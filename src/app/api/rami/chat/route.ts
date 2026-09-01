/**
 * POST /api/rami/chat
 *
 * Phase 2.2 pipeline:
 *   validate → extract → apply facts (correction/conflict) → classify → packs →
 *   gap analysis (NextAction) → stream phrased response
 */

import type { NextRequest } from 'next/server';
import { getDefaultProvider, getConfiguredProviderKind, ModalNotReadyError } from '@/server/ai';
import {
  buildSystemPrompt,
  buildContextBlock,
  resolveConversationLanguage,
} from '@/server/ai/ramiSystemPrompt';
import { EXTRACTION_JSON_SCHEMA, buildExtractionSystemPrompt, isValidFieldId } from '@/server/ai/extractionSchema';
import type { ExtractionSignals } from '@/server/ai/extractionSchema';
import { saveSession } from '@/server/rami/sessionStore';
import {
  getOrHydrateSession,
  persistAssistantMessage,
  persistRuntimeState,
  persistUserMessage,
  PersistenceError,
} from '@/server/rami/projectPersistence';
import { analyzeGaps, buildApplicabilityContext } from '@/server/rami/gapEngine';
import { applyExtractedFacts, markFieldDeferred, markFieldUnknown, type ExtractedFactWithKind } from '@/server/rami/memoryUpdater';
import { normalizeExtractedFacts } from '@/server/rami/extractedFactNormalize';
import { detectIntent } from '@/server/rami/intentDetector';
import { classifyProject } from '@/server/rami/projectClassifier';
import { withActivePacks } from '@/server/rami/questionPackEngine';
import { evaluateHistoricalRetrievalPolicy } from '@/server/rami/historicalRetrievalPolicy';
import { retrieveHistoricalReferences } from '@/server/rami/historicalRetrieval';
import { toSurfacedReference } from '@/types/historicalProposal';
import { PROJECT_MEMORY_FIELDS } from '@/schema/projectMemoryFields';
import { RFP_SECTIONS, isSectionApplicable } from '@/schema/rfpSchema';
import type { ExtractionResult, StreamEvent } from '@/types/conversation';
import type { NextAction } from '@/types/nextAction';
import { getEngineState, isModalReadyForChat } from '@/server/ai/modalEngineControl';
import { classifyStatusMessage } from '@/server/rami/projectStatusQuestion';
import { answerProjectStatusQuestion } from '@/server/rami/projectStatusSnapshot';
import { findProjectByDocumentKey } from '@/server/repositories/ProjectRepository';
import { listCurrentSectionContents } from '@/server/repositories/ProjectSectionContentRepository';
import type { RamiServerSession } from '@/server/rami/sessionStore';
import type { ConversationLanguage, ExtractedFact, RfpIntent } from '@/types/conversation';

function sseEvent(data: StreamEvent): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

interface ExtendedExtraction extends ExtractionResult, ExtractionSignals {
  extractedFacts: ExtractedFactWithKind[];
}

async function emitDeterministicStatusReply(input: {
  encode: (event: StreamEvent) => void;
  session: RamiServerSession;
  sessionId: string;
  conversationLanguage: ConversationLanguage;
  extractedFacts: ExtractedFact[];
  updatedFieldIds: string[];
  rfpIntent: RfpIntent;
  retrievalReason: string;
}): Promise<boolean> {
  const { encode, session, sessionId, conversationLanguage } = input;
  session.projectContext = withActivePacks(session.projectContext, session.memory);
  const gaps = analyzeGaps(session.memory, session.projectContext, {
    contextContradictions: session.contextContradictions,
  });
  session.projectContext = {
    ...session.projectContext,
    collectionSufficient: gaps.collectionSufficient,
  };

  let generatedSections: Array<{
    sectionId: string;
    approvalStatus: 'DRAFT' | 'APPROVED';
  }> = [];
  try {
    const project = await findProjectByDocumentKey(
      session.conversation.documentId || session.sessionId,
    );
    if (project) {
      const rows = await listCurrentSectionContents(project.project_id);
      generatedSections = rows.map((row) => ({
        sectionId: row.section_id,
        approvalStatus: row.approval_status,
      }));
    }
  } catch (genErr) {
    console.error('[Rami chat] Status generated-section lookup failed (non-fatal):', genErr);
  }

  const { snapshot, reply } = answerProjectStatusQuestion({
    memory: session.memory,
    projectContext: session.projectContext,
    contextContradictions: session.contextContradictions,
    sectionStates: session.sectionStates,
    generatedSections,
    language: conversationLanguage,
  });

  const ctx = buildApplicabilityContext(session.memory, session.projectContext);
  const applicableSectionCount = RFP_SECTIONS.filter((s) => isSectionApplicable(s, ctx)).length;
  const docType = (session.memory.documentType?.current?.value as string | undefined) ?? '';
  const engType = (session.memory.engagementType?.current?.value as string | undefined) ?? '';

  encode({
    type: 'facts',
    facts: input.extractedFacts,
    updatedFieldIds: input.updatedFieldIds,
    rfpIntent: input.rfpIntent,
    documentType: docType || undefined,
    engagementType: engType || undefined,
    applicableSectionCount,
    completionPercent: gaps.completionPercent,
    collectionSufficient: snapshot.collectionSufficient,
    nextActionType: snapshot.nextAction.type,
  });

  encode({ type: 'text', chunk: reply });

  const assistantMessage = {
    id: `msg-${Date.now()}-a`,
    role: 'assistant' as const,
    content: reply,
    language: conversationLanguage,
    createdAt: new Date().toISOString(),
    extractedFieldIds: input.updatedFieldIds,
  };
  session.conversation.messages.push(assistantMessage);

  try {
    await persistAssistantMessage(session, assistantMessage);
    await persistRuntimeState(session);
  } catch (persistErr) {
    const msg =
      persistErr instanceof PersistenceError
        ? persistErr.message
        : 'Rami replied but the response could not be saved to PostgreSQL.';
    encode({ type: 'error', message: msg });
    return false;
  }

  saveSession(session);
  encode({
    type: 'done',
    sessionId,
    rfpIntent: input.rfpIntent,
    updatedFieldIds: input.updatedFieldIds,
    language: conversationLanguage,
    documentType: docType || undefined,
    engagementType: engType || undefined,
    applicableSectionCount,
    completionPercent: gaps.completionPercent,
    collectionSufficient: snapshot.collectionSufficient,
    nextActionType: snapshot.nextAction.type,
    retrievalDebug: {
      triggered: false,
      trigger: 'none',
      reason: input.retrievalReason,
    },
  });
  return true;
}

export async function POST(req: NextRequest) {
  let sessionId: string;
  let message: string;
  let documentId: string | undefined;

  try {
    const body = (await req.json()) as {
      sessionId?: string;
      documentId?: string;
      message?: string;
    };
    sessionId = body.sessionId?.trim() || 'default';
    message = (body.message ?? '').trim();
    documentId = body.documentId;
  } catch {
    return new Response(sseEvent({ type: 'error', message: 'Invalid request body.' }), {
      status: 400,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  if (!message) {
    return new Response(sseEvent({ type: 'error', message: 'Message is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  // Modal cost control: never auto-start GPU on chat.
  // Pure status / gap questions are answered from Gap Engine — no model required.
  // Mixed status + fact messages still need extraction (model) then a status reply.
  const statusKind = classifyStatusMessage(message);
  if (statusKind !== 'pure_status' && getConfiguredProviderKind() === 'modal') {
    const state = getEngineState();
    if (state === 'STARTING' || state === 'LOADING' || state === 'WARMING_UP') {
      return new Response(
        sseEvent({
          type: 'error',
          message: 'Rami is starting... Please wait until READY, then send your message.',
        }),
        { status: 409, headers: { 'Content-Type': 'text/event-stream' } },
      );
    }
    if (!isModalReadyForChat()) {
      return new Response(
        sseEvent({
          type: 'error',
          message: 'Start Rami to begin chatting. Use the floating Rami AI control → Start Rami.',
        }),
        { status: 409, headers: { 'Content-Type': 'text/event-stream' } },
      );
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encode = (event: StreamEvent) =>
        controller.enqueue(new TextEncoder().encode(sseEvent(event)));

      try {
        encode({ type: 'thinking' });

        let session;
        try {
          session = await getOrHydrateSession(sessionId, documentId);
        } catch (persistErr) {
          const msg =
            persistErr instanceof PersistenceError
              ? persistErr.message
              : 'Could not load this project from PostgreSQL.';
          encode({ type: 'error', message: msg });
          return;
        }

        const conversationLanguage = resolveConversationLanguage(
          message,
          session.conversation.language ?? 'en',
        );
        session.conversation.language = conversationLanguage;

        const userMsgId = `msg-${Date.now()}-u`;
        const userMessage = {
          id: userMsgId,
          role: 'user' as const,
          content: message,
          language: conversationLanguage,
          createdAt: new Date().toISOString(),
        };
        session.conversation.messages.push(userMessage);
        try {
          await persistUserMessage(session, userMessage);
        } catch (persistErr) {
          const msg =
            persistErr instanceof PersistenceError
              ? persistErr.message
              : 'Could not save your message. The project was not updated.';
          encode({ type: 'error', message: msg });
          return;
        }

        if (statusKind === 'pure_status') {
          await emitDeterministicStatusReply({
            encode,
            session,
            sessionId,
            conversationLanguage,
            extractedFacts: [],
            updatedFieldIds: [],
            rfpIntent: session.conversation.rfpIntent,
            retrievalReason: 'pure project-status question — Gap Engine only; no model and no retrieval',
          });
          return;
        }

        let extractionResult: ExtendedExtraction = {
          extractedFacts: [],
          rfpIntentSignal: 'NONE',
        };

        const provider = getDefaultProvider();

        try {
          const extractMessages = [
            { role: 'system' as const, content: buildExtractionSystemPrompt() },
            { role: 'user' as const, content: message },
          ];

          const extraction = await provider.extractStructured<ExtendedExtraction>(
            extractMessages,
            EXTRACTION_JSON_SCHEMA as unknown as Record<string, unknown>,
            { temperature: 0, timeoutMs: 90_000 },
          );
          extractionResult = extraction.data;
        } catch (extractErr) {
          if (extractErr instanceof ModalNotReadyError) {
            encode({ type: 'error', message: extractErr.message });
            return;
          }
          console.error('[Rami chat] Extraction error:', extractErr);
        }

        const rawFacts = (extractionResult.extractedFacts ?? []).filter((f) =>
          PROJECT_MEMORY_FIELDS.some((def) => def.fieldId === f.fieldId),
        );

        // conflictCandidates from extraction → mark as conflict updateKind
        for (const c of extractionResult.conflictCandidates ?? []) {
          if (!c.fieldId || !Array.isArray(c.values) || c.values.length < 2) continue;
          rawFacts.push({
            fieldId: c.fieldId,
            value: c.values[1],
            confidence: 'high',
            updateKind: 'conflict',
          });
        }

        const validFacts = normalizeExtractedFacts(rawFacts, message);

        const memoryUpdate = applyExtractedFacts(
          session.memory,
          validFacts,
          `user-message:${userMsgId}`,
          message,
        );

        // Deferred statements from BA
        for (const d of extractionResult.deferredStatements ?? []) {
          const topic = (d.topic || '').toLowerCase();
          const match = PROJECT_MEMORY_FIELDS.find(
            (f) =>
              f.fieldId.toLowerCase().includes(topic.replace(/\s+/g, '')) ||
              f.label.toLowerCase().includes(topic),
          );
          if (match) markFieldDeferred(session.memory, match.fieldId, d.deferredTo || 'later');
        }

        for (const fieldId of extractionResult.unknownFields ?? []) {
          if (isValidFieldId(fieldId)) {
            markFieldUnknown(session.memory, fieldId, `user-message:${userMsgId}`);
          }
        }

        const newIntent = detectIntent(
          session.conversation.rfpIntent,
          extractionResult.rfpIntentSignal,
          session.memory,
        );
        session.conversation.rfpIntent = newIntent;

        // Classify → packs (ProjectContext only — never duplicate into ProjectMemory)
        let projectContext = classifyProject({
          memory: session.memory,
          previous: session.projectContext,
          signals: {
            documentStageSignal: extractionResult.documentStageSignal,
            granularitySignal: extractionResult.granularitySignal,
            domainSignals: extractionResult.domainSignals,
            deferredStatements: extractionResult.deferredStatements,
            conflictCandidates: extractionResult.conflictCandidates,
          },
          latestMessage: message,
        });
        projectContext = withActivePacks(projectContext, session.memory);
        session.projectContext = projectContext;

        const gaps = analyzeGaps(session.memory, projectContext, {
          contextContradictions: session.contextContradictions,
        });
        session.projectContext = {
          ...projectContext,
          collectionSufficient: gaps.collectionSufficient,
        };

        if (statusKind === 'mixed_status_and_facts') {
          try {
            await persistRuntimeState(session);
          } catch (persistErr) {
            const msg =
              persistErr instanceof PersistenceError
                ? persistErr.message
                : 'Could not save extracted project facts. The reply was not generated.';
            encode({ type: 'error', message: msg });
            return;
          }
          await emitDeterministicStatusReply({
            encode,
            session,
            sessionId,
            conversationLanguage,
            extractedFacts: extractionResult.extractedFacts ?? [],
            updatedFieldIds: memoryUpdate.applied,
            rfpIntent: newIntent,
            retrievalReason:
              'mixed status + facts — extracted then Gap Engine status; no phrasing model and no retrieval',
          });
          return;
        }

        // Controlled historical retrieval — never on ordinary turns; never writes ProjectFacts
        const focusFieldIds =
          gaps.nextAction.type === 'ASK_REQUIREMENTS'
            ? [gaps.nextAction.primaryFieldId, ...gaps.nextAction.relatedFieldIds]
            : [];
        const retrievalPolicy = evaluateHistoricalRetrievalPolicy({
          userMessage: message,
          gaps,
          focusFieldIds,
        });
        let phrasingAction: NextAction = gaps.nextAction;
        let surfacedRefs: ReturnType<typeof toSurfacedReference>[] = [];
        const retrievalDebug: NonNullable<StreamEvent['retrievalDebug']> = {
          triggered: false,
          trigger: retrievalPolicy.trigger,
          reason: retrievalPolicy.reason,
        };

        if (retrievalPolicy.shouldRetrieve && retrievalPolicy.mode !== 'none') {
          try {
            const refs = await retrieveHistoricalReferences(retrievalPolicy.query, {
              mode: retrievalPolicy.mode,
              topK: retrievalPolicy.topK,
              fieldIds:
                retrievalPolicy.mode === 'structured' && retrievalPolicy.fieldIds.length
                  ? retrievalPolicy.fieldIds
                  : undefined,
              sectionIds:
                retrievalPolicy.mode === 'structured' && retrievalPolicy.sectionIds.length
                  ? retrievalPolicy.sectionIds
                  : undefined,
              questionIds: retrievalPolicy.questionIds.length
                ? retrievalPolicy.questionIds
                : undefined,
            });
            surfacedRefs = refs.map(toSurfacedReference);
            retrievalDebug.triggered = true;
            retrievalDebug.mode = retrievalPolicy.mode;
            retrievalDebug.query = retrievalPolicy.query;
            retrievalDebug.fieldIds = retrievalPolicy.fieldIds;
            retrievalDebug.sectionIds = retrievalPolicy.sectionIds;
            retrievalDebug.topK = retrievalPolicy.topK;
            phrasingAction = {
              type: 'OFFER_HISTORICAL_REFERENCE',
              fieldIds: retrievalPolicy.fieldIds,
              referenceCount: surfacedRefs.length,
              retrievalMode: retrievalPolicy.mode,
            };
            if (surfacedRefs.length > 0) {
              encode({
                type: 'historical_references',
                historicalReferences: surfacedRefs,
                retrievalDebug,
                nextActionType: phrasingAction.type,
              });
            }
          } catch (ragErr) {
            console.error('[Rami chat] Historical retrieval error (non-fatal):', ragErr);
            retrievalDebug.reason = `retrieval_failed: ${ragErr instanceof Error ? ragErr.message : 'unknown'}`;
          }
        }

        const ctx = buildApplicabilityContext(session.memory, session.projectContext);
        const applicableSectionCount = RFP_SECTIONS.filter((s) =>
          isSectionApplicable(s, ctx),
        ).length;

        const docType =
          (session.memory.documentType?.current?.value as string | undefined) ?? '';
        const engType =
          (session.memory.engagementType?.current?.value as string | undefined) ?? '';

        encode({
          type: 'facts',
          facts: extractionResult.extractedFacts,
          updatedFieldIds: memoryUpdate.applied,
          rfpIntent: newIntent,
          documentType: docType || undefined,
          engagementType: engType || undefined,
          applicableSectionCount,
          completionPercent: gaps.completionPercent,
          collectionSufficient: gaps.collectionSufficient,
          nextActionType: phrasingAction.type,
        });

        const docTitle = session.memory.documentTitle?.current?.value as string | undefined;
        const beneficiary = session.memory.beneficiaryEntity?.current?.value as
          | string
          | undefined;

        const contextBlock = buildContextBlock({
          documentType: docType || undefined,
          documentTitle: docTitle,
          beneficiaryEntity: beneficiary,
          activeSection: session.conversation.activeSection,
          filledCount: gaps.filledCount,
          totalRequired: gaps.totalRequired,
          nextFieldLabel: gaps.nextPriorityLabel,
          language: conversationLanguage,
          nextAction: phrasingAction,
          documentStage: session.projectContext.documentStage,
          primaryDomain: session.projectContext.primaryDomain,
          collectionSufficient: gaps.collectionSufficient,
        });

        // History for phrasing only — extraction already used BA message alone.
        // Strip any prior HISTORICAL REFERENCE blocks so model does not restate as facts.
        const recentHistory = session.conversation.messages
          .slice(-8)
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content:
              m.role === 'assistant'
                ? m.content.replace(
                    /\[HISTORICAL REFERENCE[\s\S]*?\[\/HISTORICAL REFERENCE\]/gi,
                    '[historical reference omitted]',
                  )
                : m.content,
          }));

        const systemPrompt = buildSystemPrompt(conversationLanguage);
        const chatMessages = [
          { role: 'system' as const, content: `${systemPrompt}\n\n${contextBlock}` },
          ...recentHistory,
        ];

        try {
          await persistRuntimeState(session);
        } catch (persistErr) {
          const msg =
            persistErr instanceof PersistenceError
              ? persistErr.message
              : 'Could not save extracted project facts. The reply was not generated.';
          encode({ type: 'error', message: msg });
          return;
        }

        let assistantContent = '';
        try {
          for await (const chunk of provider.completeStream(chatMessages, {
            temperature: 0.65,
            timeoutMs: 120_000,
          })) {
            if (chunk) {
              assistantContent += chunk;
              encode({ type: 'text', chunk });
            }
          }
        } catch (streamErr) {
          if (streamErr instanceof ModalNotReadyError) {
            encode({ type: 'error', message: streamErr.message });
            return;
          }
          console.error('[Rami chat] Streaming error:', streamErr);
          const fallback =
            gaps.nextAction.type === 'STOP_COLLECTION'
              ? conversationLanguage === 'ar'
                ? 'لدينا معلومات كافية للمضي قدمًا في هذه المرحلة. أخبرني إذا رغبت بتعديل أي نقطة.'
                : 'We have enough information to proceed for now. Tell me if you want to adjust anything.'
              : gaps.nextPriorityLabel
                ? conversationLanguage === 'ar'
                  ? `حسناً. هل يمكنك إخباري عن: ${gaps.nextPriorityLabel}؟`
                  : `I understand. Could you tell me more about: ${gaps.nextPriorityLabel}?`
                : conversationLanguage === 'ar'
                  ? 'شكراً. ما المزيد الذي يمكنك مشاركته عن هذا المشروع؟'
                  : 'Thank you for that information. What else can you tell me about this project?';
          assistantContent = fallback;
          encode({ type: 'text', chunk: fallback });
        }

        const assistantMsgId = `msg-${Date.now()}-a`;
        const assistantMessage = {
          id: assistantMsgId,
          role: 'assistant' as const,
          content: assistantContent,
          language: conversationLanguage,
          createdAt: new Date().toISOString(),
          extractedFieldIds: memoryUpdate.applied,
        };
        session.conversation.messages.push(assistantMessage);

        try {
          await persistAssistantMessage(session, assistantMessage);
          await persistRuntimeState(session);
        } catch (persistErr) {
          const msg =
            persistErr instanceof PersistenceError
              ? persistErr.message
              : 'Rami replied but the response could not be saved to PostgreSQL.';
          encode({ type: 'error', message: msg });
          return;
        }

        saveSession(session);

        encode({
          type: 'done',
          sessionId,
          rfpIntent: newIntent,
          updatedFieldIds: memoryUpdate.applied,
          language: conversationLanguage,
          documentType: docType || undefined,
          engagementType: engType || undefined,
          applicableSectionCount,
          completionPercent: gaps.completionPercent,
          collectionSufficient: gaps.collectionSufficient,
          nextActionType: phrasingAction.type,
          historicalReferences: surfacedRefs.length ? surfacedRefs : undefined,
          retrievalDebug,
        });
      } catch (err) {
        console.error('[Rami chat] Unhandled error:', err);
        const errMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
        encode({ type: 'error', message: errMsg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
