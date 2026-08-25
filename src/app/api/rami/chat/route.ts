/**
 * POST /api/rami/chat
 *
 * Conversational Rami endpoint. Processes a BA message through the full pipeline:
 *   validate → extract facts → update memory → gap analysis → stream response
 *
 * Uses SSE (text/event-stream) format for streaming.
 * All Ollama calls happen server-side only.
 */

import type { NextRequest } from 'next/server';
import { LocalModelProvider } from '@/server/ai/LocalModelProvider';
import { getModelManifest } from '@/server/ai/modelManifest';
import {
  buildSystemPrompt,
  buildContextBlock,
  resolveConversationLanguage,
} from '@/server/ai/ramiSystemPrompt';
import { EXTRACTION_JSON_SCHEMA, buildExtractionSystemPrompt } from '@/server/ai/extractionSchema';
import { getOrCreateSession, saveSession } from '@/server/rami/sessionStore';
import { analyzeGaps, buildApplicabilityContext } from '@/server/rami/gapEngine';
import { applyExtractedFacts } from '@/server/rami/memoryUpdater';
import { detectIntent } from '@/server/rami/intentDetector';
import { PROJECT_MEMORY_FIELDS } from '@/schema/projectMemoryFields';
import { RFP_SECTIONS, isSectionApplicable } from '@/schema/rfpSchema';
import type { ExtractionResult, StreamEvent } from '@/types/conversation';

/** Encode a single SSE event. */
function sseEvent(data: StreamEvent): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  let sessionId: string;
  let message: string;
  let documentId: string | undefined;

  try {
    const body = await req.json() as {
      sessionId?: string;
      documentId?: string;
      message?: string;
    };
    sessionId = body.sessionId?.trim() || 'default';
    message = (body.message ?? '').trim();
    documentId = body.documentId;
  } catch {
    return new Response(
      sseEvent({ type: 'error', message: 'Invalid request body.' }),
      { status: 400, headers: { 'Content-Type': 'text/event-stream' } },
    );
  }

  if (!message) {
    return new Response(
      sseEvent({ type: 'error', message: 'Message is required.' }),
      { status: 400, headers: { 'Content-Type': 'text/event-stream' } },
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encode = (event: StreamEvent) =>
        controller.enqueue(new TextEncoder().encode(sseEvent(event)));

      try {
        // 1. Immediately signal thinking state
        encode({ type: 'thinking' });

        // 2. Load or create session
        const session = getOrCreateSession(sessionId, documentId);

        // 3. Detect conversation language
        const conversationLanguage = resolveConversationLanguage(
          message,
          session.conversation.language ?? 'en',
        );
        session.conversation.language = conversationLanguage;

        // 4. Add user message to conversation
        const userMsgId = `msg-${Date.now()}-u`;
        session.conversation.messages.push({
          id: userMsgId,
          role: 'user',
          content: message,
          language: conversationLanguage,
          createdAt: new Date().toISOString(),
        });

        // 5. Structured extraction
        let extractionResult: ExtractionResult = {
          extractedFacts: [],
          rfpIntentSignal: 'NONE',
        };

        try {
          const manifest = getModelManifest();
          const provider = new LocalModelProvider(manifest);

          const extractMessages = [
            { role: 'system' as const, content: buildExtractionSystemPrompt() },
            { role: 'user' as const, content: message },
          ];

          const extraction = await provider.extractStructured<ExtractionResult>(
            extractMessages,
            EXTRACTION_JSON_SCHEMA as Record<string, unknown>,
            { temperature: 0, timeoutMs: 90_000 },
          );
          extractionResult = extraction.data;
        } catch (extractErr) {
          console.error('[Rami chat] Extraction error:', extractErr);
          // Continue without extraction — still generate a response
        }

        // 6. Validate and apply extracted facts to memory
        const validFacts = extractionResult.extractedFacts.filter((f) =>
          PROJECT_MEMORY_FIELDS.some((def) => def.fieldId === f.fieldId),
        );
        const memoryUpdate = applyExtractedFacts(
          session.memory,
          validFacts,
          `user-message:${userMsgId}`,
        );

        // 7. Update RFP intent
        const newIntent = detectIntent(
          session.conversation.rfpIntent,
          extractionResult.rfpIntentSignal,
          session.memory,
        );
        session.conversation.rfpIntent = newIntent;

        // 8. Gap analysis
        const gaps = analyzeGaps(session.memory);

        // 9. Compute applicable sections for client applicability display
        const ctx = buildApplicabilityContext(session.memory);
        const applicableSectionCount = RFP_SECTIONS.filter((s) => isSectionApplicable(s, ctx)).length;

        const docType = (session.memory.documentType?.current?.value as string | undefined) ?? '';
        const engType = (session.memory.engagementType?.current?.value as string | undefined) ?? '';

        // 10. Emit facts event (lets client update memory display)
        encode({
          type: 'facts',
          facts: extractionResult.extractedFacts,
          updatedFieldIds: memoryUpdate.applied,
          rfpIntent: newIntent,
          documentType: docType || undefined,
          engagementType: engType || undefined,
          applicableSectionCount,
        });

        // 11. Build conversation context for response generation
        const docTitle = (session.memory.documentTitle?.current?.value as string | undefined);
        const beneficiary = (session.memory.beneficiaryEntity?.current?.value as string | undefined);

        // Infer working title if documentTitle is missing but beneficiary or context is known
        const workingTitle = docTitle ?? undefined;

        const contextBlock = buildContextBlock({
          documentType: docType || undefined,
          documentTitle: workingTitle,
          beneficiaryEntity: beneficiary,
          activeSection: session.conversation.activeSection,
          filledCount: gaps.filledCount,
          totalRequired: gaps.totalRequired,
          nextFieldLabel: gaps.nextPriorityLabel,
          language: conversationLanguage,
        });

        // 12. Build message history (last 8 turns to stay within context)
        const recentHistory = session.conversation.messages
          .slice(-8)
          .filter((m) => m.role !== 'system')
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

        const systemPrompt = buildSystemPrompt(conversationLanguage);
        const chatMessages = [
          { role: 'system' as const, content: `${systemPrompt}\n\n${contextBlock}` },
          ...recentHistory,
        ];

        // 13. Stream the conversational response
        let assistantContent = '';
        try {
          const manifest = getModelManifest();
          const provider = new LocalModelProvider(manifest);

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
          console.error('[Rami chat] Streaming error:', streamErr);
          const fallback = gaps.nextPriorityLabel
            ? (conversationLanguage === 'ar'
              ? `حسناً. هل يمكنك إخباري عن: ${gaps.nextPriorityLabel}؟`
              : `I understand. Could you tell me more about: ${gaps.nextPriorityLabel}?`)
            : (conversationLanguage === 'ar'
              ? 'شكراً. ما المزيد الذي يمكنك مشاركته عن هذا المشروع؟'
              : 'Thank you for that information. What else can you tell me about this project?');
          assistantContent = fallback;
          encode({ type: 'text', chunk: fallback });
        }

        // 14. Save assistant response to conversation
        const assistantMsgId = `msg-${Date.now()}-a`;
        session.conversation.messages.push({
          id: assistantMsgId,
          role: 'assistant',
          content: assistantContent,
          language: conversationLanguage,
          createdAt: new Date().toISOString(),
          extractedFieldIds: memoryUpdate.applied,
        });

        // 15. Persist session
        saveSession(session);

        // 16. Done event — include applicability context for client-side section display
        encode({
          type: 'done',
          sessionId,
          rfpIntent: newIntent,
          updatedFieldIds: memoryUpdate.applied,
          language: conversationLanguage,
          documentType: docType || undefined,
          engagementType: engType || undefined,
          applicableSectionCount,
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
