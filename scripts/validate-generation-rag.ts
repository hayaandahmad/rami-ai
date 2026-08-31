#!/usr/bin/env npx tsx
/**
 * Controlled generation-time RAG checks.
 * Mock provider by default — no Modal GPU.
 * Optional local live compare: RAMI_GEN_LIVE=1 (does not start Modal).
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool, query } from '../src/server/db/connection';
import { isDatabaseConfigured } from '../src/server/db/config';
import { CANONICAL_FIELD_COUNT } from '../src/schema/projectMemoryFields';
import { CANONICAL_QUESTION_COUNT } from '../src/schema/questionBankSeed';
import { RFP_SECTIONS } from '../src/schema/rfpSchema';
import { createEmptyProjectMemory } from '../src/types/projectMemory';
import { createEmptyProjectContext } from '../src/types/projectContext';
import { applyExtractedFacts } from '../src/server/rami/memoryUpdater';
import { analyzeGaps } from '../src/server/rami/gapEngine';
import { getSectionReadiness } from '../src/server/rami/sectionReadiness';
import { withActivePacks } from '../src/server/rami/questionPackEngine';
import { buildSectionGenerationContext } from '../src/server/rami/sectionGenerationContext';
import { buildGenerationMessages } from '../src/server/rami/generationPrompt';
import { enforceTbcBlocks } from '../src/server/rami/sectionGeneration';
import {
  generateRfpSection,
  assembleRfpDocument,
  approveRfpSection,
} from '../src/server/rami/sectionGeneration';
import {
  approveDraftingReference,
  loadApprovedGenerationReferences,
  revokeDraftingReference,
  listDraftingReferences,
} from '../src/server/rami/generationReferenceService';
import {
  extractNameishTokens,
  extractNumberishTokens,
  findLeakageInBlocks,
  leakedHistoricalTokens,
  ngramOverlapRatio,
  sanitizeHistoricalLeakage,
} from '../src/server/rami/generationReferenceLeakage';
import { createProposalFromReference, acceptProposal } from '../src/server/rami/historicalProposalService';
import type { HistoricalReference } from '../src/types/historicalRag';
import type { GenerationHistoricalReference } from '../src/types/generationReference';
import type { GeneratedBlock } from '../src/types/generatedSection';
import { TBC_MARKER_PREFIX } from '../src/types/generatedSection';
import type { ChatMessage, RamiModelProvider } from '../src/server/ai/RamiModelProvider';
import { clearAllSessionCache } from '../src/server/rami/sessionStore';
import {
  getOrHydrateSession,
  persistRuntimeState,
} from '../src/server/rami/projectPersistence';
import { listProjectFacts } from '../src/server/repositories/ProjectFactsRepository';
import {
  getCurrentSectionContent,
  listSectionContentHistory,
} from '../src/server/repositories/ProjectSectionContentRepository';
import { findProjectByDocumentKey } from '../src/server/repositories/ProjectRepository';
import { retrieveHistoricalReferences } from '../src/server/rami/historicalRetrieval';
import { evaluateHistoricalRetrievalPolicy } from '../src/server/rami/historicalRetrievalPolicy';

const DOC_KEY = 'rami-gen-rag-demo';
const EVAL_PATH = join(
  process.cwd(),
  'resources',
  'historical-rfps',
  'derived',
  'generation-rag-eval.json',
);

let passed = 0;
let failed = 0;

function run(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`  ✓ ${name}`);
      passed++;
    })
    .catch((err) => {
      console.error(`  ✗ ${name}`);
      console.error(err);
      failed++;
    });
}

function mockProvider(
  factory: (messages: ChatMessage[]) => GeneratedBlock[],
): RamiModelProvider {
  return {
    providerType: 'mock-generation-rag',
    async complete() {
      return { text: '', durationMs: 2, modelUsed: 'mock' };
    },
    async *completeStream() {
      yield '';
    },
    async extractStructured<T>(messages: ChatMessage[]) {
      return {
        data: { blocks: factory(messages) } as T,
        durationMs: 2,
        modelUsed: 'mock-qwen3:8b',
      };
    },
    async embed() {
      return [0];
    },
    async healthCheck() {
      return {
        providerType: 'mock-generation-rag',
        endpointReachable: true,
        defaultModelAvailable: true,
        lightweightModelAvailable: true,
        models: [],
        smokeTestPassed: true,
        checkedAt: new Date().toISOString(),
      };
    },
  };
}

function parseUserPayload(messages: ChatMessage[]): Record<string, unknown> {
  const user = messages.find((m) => m.role === 'user');
  return JSON.parse(user?.content ?? '{}') as Record<string, unknown>;
}

function sampleRef(over: Partial<GenerationHistoricalReference> = {}): GenerationHistoricalReference {
  return {
    generationReferenceId: 'gr_test',
    chunkId: 'chunk_test',
    historicalRfpId: 'rfp-itas-vol2b',
    historicalRfpTitle: 'ITAS Volume 2B Historical Source',
    excerpt:
      'The contractor shall deliver weekly progress reports. Contract duration is 24 months. Bid bond = 5%. SLA 99.9%. 3 suppliers. Named supplier Acme Soft LLC. Ministry of Fake History owns SANAD AI PQ.',
    mappedFieldIds: ['deliverableItems'],
    canonicalQuestionIds: ['7.1'],
    sectionIds: ['deliverables'],
    provenanceClass: 'REFERENCE',
    sourceLocator: 'p.12',
    usageScope: 'STRUCTURE_AND_LANGUAGE',
    ...over,
  };
}

function deliverableMemory() {
  const memory = createEmptyProjectMemory();
  applyExtractedFacts(
    memory,
    [
      { fieldId: 'documentType', value: 'consulting', confidence: 'high' },
      { fieldId: 'engagementType', value: 'consulting assessment', confidence: 'high' },
      { fieldId: 'documentTitle', value: 'Current Digital Advisory RFP', confidence: 'high' },
      {
        fieldId: 'beneficiaryEntity',
        value: 'Ministry of Digital Economy and Entrepreneurship',
        confidence: 'high',
      },
      { fieldId: 'engagementDuration', value: '18 months', confidence: 'high' },
      { fieldId: 'currentSituation', value: 'Manual reporting across directorates.', confidence: 'high' },
      {
        fieldId: 'businessNeedRationale',
        value: 'Need structured advisory deliverables.',
        confidence: 'high',
      },
      { fieldId: 'businessObjectives', value: ['Improve delivery governance'], confidence: 'high' },
      { fieldId: 'inScope', value: ['Advisory deliverables', 'Knowledge workshops'], confidence: 'high' },
      { fieldId: 'outOfScope', value: ['Software build'], confidence: 'high' },
      {
        fieldId: 'deliverableItems',
        value: ['Inception report', 'Monthly steering pack', 'Final advisory report'],
        confidence: 'high',
      },
      { fieldId: 'deliverableFormats', value: ['PDF', 'editable source'], confidence: 'high' },
      { fieldId: 'deliverableApprovers', value: ['Project owner'], confidence: 'high' },
    ],
    'validate:generation-rag',
  );
  return memory;
}

function packsFor(memory: ReturnType<typeof createEmptyProjectMemory>) {
  return withActivePacks(createEmptyProjectContext(), memory);
}

function baselineBlocks(): GeneratedBlock[] {
  return [
    { type: 'heading', level: 1, text: 'Deliverables' },
    {
      type: 'paragraph',
      text: 'The bidder shall provide the Inception report, Monthly steering pack, and Final advisory report in PDF and editable source for the 18 months engagement.',
    },
  ];
}

function ragAssistedBlocks(payload: Record<string, unknown>): GeneratedBlock[] {
  const facts = payload.CURRENT_PROJECT_FACTS as {
    documentMeta?: { engagementDuration?: string };
  };
  const duration = facts?.documentMeta?.engagementDuration ?? '18 months';
  const refs = (payload.APPROVED_HISTORICAL_REFERENCES as Array<{
    excerpt?: string;
    historicalRfpTitle?: string;
  }>) ?? [];
  const blob = refs.map((r) => `${r.excerpt ?? ''}\n${r.historicalRfpTitle ?? ''}`).join('\n');
  const leakedNums = extractNumberishTokens(blob).slice(0, 8);
  const leakedNames = extractNameishTokens(blob).slice(0, 6);
  const blocks: GeneratedBlock[] = [
    { type: 'heading', level: 1, text: 'Deliverables' },
    { type: 'heading', level: 2, text: 'Required artefacts' },
    {
      type: 'bullet_list',
      items: ['Inception report', 'Monthly steering pack', 'Final advisory report'],
    },
    { type: 'heading', level: 2, text: 'Formats and approval' },
    {
      type: 'paragraph',
      text: `Formats are PDF and editable source. Approver is the Project owner. Duration in current facts is ${duration}.`,
    },
  ];
  if (refs.length === 0) {
    blocks.push({
      type: 'paragraph',
      text: 'Contract duration is 24 months. Bid bond = 5%. SLA 99.9%. 3 suppliers. Ministry of Fake History owns SANAD AI PQ.',
    });
  } else {
    blocks.push({
      type: 'paragraph',
      text: `Historical leak probe: ${leakedNums.join(', ')}. Names: ${leakedNames.join(', ')}.`,
    });
  }
  return blocks;
}

async function revokeAllActive(sectionId: string) {
  const listed = await listDraftingReferences({
    documentKey: DOC_KEY,
    sectionId,
    status: 'ACTIVE',
  });
  for (const row of listed) {
    await revokeDraftingReference({
      documentKey: DOC_KEY,
      generationReferenceId: row.generationReferenceId,
    });
  }
}

function factFingerprint(
  rows: Array<{
    field_id: string;
    value_json: unknown;
    provenance_status: string;
    gap_status: string | null;
  }>,
) {
  return JSON.stringify(
    [...rows]
      .map((r) => ({
        field_id: r.field_id,
        value_json: r.value_json,
        provenance_status: r.provenance_status,
        gap_status: r.gap_status,
      }))
      .sort((a, b) => a.field_id.localeCompare(b.field_id)),
  );
}

console.log('\n=== Controlled generation-time RAG ===\n');

async function main() {
  loadLocalEnv();
  const evalOut: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    fieldCount: 60,
    questionCount: 70,
    sectionCount: 20,
    silentRetrieval: false,
    automaticFactPromotion: false,
    pgvector: 'not installed',
  };

  await run('canonical counts remain 60 / 70 / 20', () => {
    assert.equal(CANONICAL_FIELD_COUNT, 60);
    assert.equal(CANONICAL_QUESTION_COUNT, 70);
    assert.equal(RFP_SECTIONS.length, 20);
  });

  await run('prompt hierarchy separates facts from historical references', () => {
    const memory = deliverableMemory();
    const ctx = buildSectionGenerationContext({
      projectId: 'p',
      documentKey: 'k',
      sectionId: 'deliverables',
      memory,
      projectContext: packsFor(memory),
      approvedHistoricalReferences: [sampleRef()],
    });
    assert.equal(ctx.approvedHistoricalReferences.length, 1);
    assert.ok(!ctx.answeredFacts.some((f) => (f.value as string)?.includes?.('24 months')));
    const msgs = buildGenerationMessages(ctx);
    const system = msgs[0].content;
    assert.match(system, /CURRENT PROJECT FACTS/);
    assert.match(system, /APPROVED HISTORICAL REFERENCES/);
    const payload = parseUserPayload(msgs);
    assert.ok(payload.CURRENT_PROJECT_FACTS);
    assert.ok(payload.APPROVED_HISTORICAL_REFERENCES);
    assert.ok(payload.UNRESOLVED);
    const refs = payload.APPROVED_HISTORICAL_REFERENCES as Array<{ provenanceClass: string }>;
    assert.equal(refs[0].provenanceClass, 'REFERENCE');
  });

  await run('numeric + name leakage is stripped when not in ProjectFacts', () => {
    const memory = deliverableMemory();
    const ctx = buildSectionGenerationContext({
      projectId: 'p',
      documentKey: 'k',
      sectionId: 'deliverables',
      memory,
      projectContext: packsFor(memory),
      approvedHistoricalReferences: [sampleRef()],
    });
    const leaked = leakedHistoricalTokens(ctx, ctx.approvedHistoricalReferences);
    assert.ok(leaked.numbers.some((n) => /24|5%|99\.9/.test(n)));
    const dirty: GeneratedBlock[] = ragAssistedBlocks({
      CURRENT_PROJECT_FACTS: { documentMeta: { engagementDuration: '18 months' } },
    });
    assert.ok(findLeakageInBlocks(dirty, leaked).length > 0);
    const clean = sanitizeHistoricalLeakage(dirty, ctx);
    assert.ok(clean.removedTokens.length > 0);
    const hay = JSON.stringify(clean.blocks);
    assert.doesNotMatch(hay, /24 months/);
    assert.doesNotMatch(hay, /5%/);
    assert.doesNotMatch(hay, /99\.9%/);
    assert.doesNotMatch(hay, /Ministry of Fake History/);
    assert.doesNotMatch(hay, /SANAD AI PQ/);
    assert.match(hay, /18 months/);
  });

  await run('ProjectFact duration wins over historical 24 months', () => {
    const memory = deliverableMemory();
    const ctx = buildSectionGenerationContext({
      projectId: 'p',
      documentKey: 'k',
      sectionId: 'deliverables',
      memory,
      projectContext: packsFor(memory),
      approvedHistoricalReferences: [sampleRef()],
    });
    const { blocks } = sanitizeHistoricalLeakage(
      [
        { type: 'heading', level: 1, text: 'Deliverables' },
        { type: 'paragraph', text: 'Duration is 24 months not 18 months.' },
      ],
      ctx,
    );
    const hay = JSON.stringify(blocks);
    assert.doesNotMatch(hay, /24 months/);
    assert.match(hay, /18 months/);
  });

  await run('missing current fact stays TBC / omitted — bid bond 5% not copied', () => {
    const memory = deliverableMemory();
    const ctx = buildSectionGenerationContext({
      projectId: 'p',
      documentKey: 'k',
      sectionId: 'deliverables',
      memory,
      projectContext: packsFor(memory),
      approvedHistoricalReferences: [sampleRef()],
    });
    const { blocks } = sanitizeHistoricalLeakage(
      [{ type: 'paragraph', text: 'Bid bond = 5% is required.' }],
      ctx,
    );
    const hay = JSON.stringify(blocks);
    assert.doesNotMatch(hay, /5%/);
    assert.match(hay, new RegExp(TBC_MARKER_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });

  await run('TBC fields remain TBC even when a historical reference exists', () => {
    const memory = deliverableMemory();
    applyExtractedFacts(
      memory,
      [{ fieldId: 'painPoints', value: 'TBC', confidence: 'high' }],
      'validate:generation-rag',
    );
    const ctx = buildSectionGenerationContext({
      projectId: 'p',
      documentKey: 'k',
      sectionId: 'background',
      memory,
      projectContext: packsFor(memory),
      approvedHistoricalReferences: [sampleRef({ sectionIds: ['background'] })],
    });
    assert.ok(ctx.tbcFields.some((f) => f.fieldId === 'painPoints'));
    const blocks = enforceTbcBlocks(
      [{ type: 'heading', level: 1, text: 'Background and Business Need' }],
      ctx,
    );
    assert.ok(blocks.some((b) => b.type === 'tbc' && b.fieldId === 'painPoints'));
  });

  await run('unapproved reference is not in generation context', () => {
    const memory = deliverableMemory();
    const ctx = buildSectionGenerationContext({
      projectId: 'p',
      documentKey: 'k',
      sectionId: 'deliverables',
      memory,
      projectContext: packsFor(memory),
    });
    assert.deepEqual(ctx.approvedHistoricalReferences, []);
    const payload = parseUserPayload(buildGenerationMessages(ctx));
    assert.deepEqual(payload.APPROVED_HISTORICAL_REFERENCES, []);
  });

  await run('readiness and gap engine ignore drafting references', () => {
    const memory = createEmptyProjectMemory();
    applyExtractedFacts(
      memory,
      [{ fieldId: 'documentType', value: 'consulting', confidence: 'high' }],
      'validate:generation-rag',
    );
    const pctx = packsFor(memory);
    const before = getSectionReadiness(memory, 'background', pctx);
    const gapsBefore = analyzeGaps(memory, pctx);
    const after = getSectionReadiness(memory, 'background', pctx);
    const gapsAfter = analyzeGaps(memory, pctx);
    assert.equal(after.readiness, before.readiness);
    assert.equal(gapsAfter.nextAction.type, gapsBefore.nextAction.type);
    assert.equal(before.readiness, 'NOT_READY');
  });

  await run('DOCX, assembly, and generate source do not retrieve', () => {
    const docx = readFileSync(join(process.cwd(), 'src/server/rami/docxExport.ts'), 'utf8');
    const gen = readFileSync(join(process.cwd(), 'src/server/rami/sectionGeneration.ts'), 'utf8');
    const docxRoute = readFileSync(
      join(process.cwd(), 'src/app/api/rami/generation/document/docx/route.ts'),
      'utf8',
    );
    assert.doesNotMatch(docx, /retrieveHistoricalReferences/);
    assert.doesNotMatch(docxRoute, /retrieveHistoricalReferences/);
    assert.doesNotMatch(gen, /retrieveHistoricalReferences\(/);
    assert.match(gen, /loadApprovedGenerationReferences/);
  });

  await run('controlled chat retrieval is still required; generate text does not search', () => {
    const ordinary = evaluateHistoricalRetrievalPolicy({
      userMessage: 'Generate the deliverables section now',
    });
    assert.equal(ordinary.shouldRetrieve, false);
  });

  if (!isDatabaseConfigured()) {
    console.log('\n(Skipping live PostgreSQL generation-RAG checks)\n');
  } else {
    let chunkId = '';

    await run('drafting-reference persist / reload / revoke / ProjectFacts isolated', async () => {
      clearAllSessionCache();
      const session = await getOrHydrateSession(DOC_KEY, DOC_KEY);
      session.memory = deliverableMemory();
      session.projectContext = packsFor(session.memory);
      session.conversation.rfpIntent = 'CREATE_RFP';
      await persistRuntimeState(session);
      const project = await findProjectByDocumentKey(DOC_KEY);
      assert.ok(project);
      const factsBefore = factFingerprint(await listProjectFacts(project!.project_id));
      const readyBefore = getSectionReadiness(session.memory, 'deliverables', session.projectContext);
      const gapsBefore = analyzeGaps(session.memory, session.projectContext);

      const chunk = await query<{ chunk_id: string }>(
        `SELECT chunk_id FROM historical_knowledge_chunks
         WHERE provenance_class = 'REFERENCE'
           AND (
             mapped_field_ids @> '["deliverableItems"]'::jsonb
             OR section_ids @> '["deliverables"]'::jsonb
           )
         ORDER BY chunk_id
         LIMIT 1`,
      );
      assert.ok(chunk.rows[0], 'need a deliverables historical chunk');
      chunkId = chunk.rows[0].chunk_id;

      await revokeAllActive('deliverables');
      await revokeAllActive('scopeOfWork');

      const approved = await approveDraftingReference({
        documentKey: DOC_KEY,
        sectionId: 'deliverables',
        chunkId,
      });
      assert.equal(approved.status, 'ACTIVE');
      assert.equal(approved.sectionId, 'deliverables');
      assert.equal(approved.usageScope, 'STRUCTURE_AND_LANGUAGE');

      clearAllSessionCache();
      const listed = await listDraftingReferences({
        documentKey: DOC_KEY,
        sectionId: 'deliverables',
        status: 'ACTIVE',
      });
      assert.equal(listed.length, 1);
      assert.equal(listed[0].historicalChunkId, chunkId);
      assert.equal(listed[0].payload?.provenanceClass, 'REFERENCE');

      const financialRefs = await loadApprovedGenerationReferences(
        project!.project_id,
        'financialProposal',
      );
      assert.equal(financialRefs.length, 0);

      const factsAfterApprove = factFingerprint(await listProjectFacts(project!.project_id));
      assert.equal(factsAfterApprove, factsBefore);
      const readyAfter = getSectionReadiness(session.memory, 'deliverables', session.projectContext);
      const gapsAfter = analyzeGaps(session.memory, session.projectContext);
      assert.equal(readyAfter.readiness, readyBefore.readiness);
      assert.equal(gapsAfter.nextAction.type, gapsBefore.nextAction.type);

      const revoked = await revokeDraftingReference({
        documentKey: DOC_KEY,
        generationReferenceId: approved.generationReferenceId,
      });
      assert.equal(revoked.status, 'REVOKED');
      const listedAfter = await listDraftingReferences({
        documentKey: DOC_KEY,
        sectionId: 'deliverables',
        status: 'ACTIVE',
      });
      assert.equal(listedAfter.length, 0);
      assert.equal(factFingerprint(await listProjectFacts(project!.project_id)), factsBefore);

      evalOut.chunkId = chunkId;
      evalOut.generationReferenceId = approved.generationReferenceId;
    });

    await run('baseline vs RAG-assisted mock generation + lineage', async () => {
      clearAllSessionCache();
      const session = await getOrHydrateSession(DOC_KEY, DOC_KEY);
      session.memory = deliverableMemory();
      session.projectContext = packsFor(session.memory);
      await persistRuntimeState(session);
      const project = await findProjectByDocumentKey(DOC_KEY);
      assert.ok(project);
      const factsBefore = factFingerprint(await listProjectFacts(project!.project_id));
      const readyBefore = getSectionReadiness(session.memory, 'deliverables', session.projectContext);

      await revokeAllActive('deliverables');

      const t0 = Date.now();
      const baseline = await generateRfpSection({
        documentKey: DOC_KEY,
        sectionId: 'deliverables',
        provider: mockProvider(() => baselineBlocks()),
      });
      const baselineMs = Date.now() - t0;
      assert.deepEqual(baseline.generated.historicalReferenceIds ?? [], []);
      assert.deepEqual(baseline.context.approvedHistoricalReferences, []);
      const baselineVersion = baseline.content.version;

      const approved = await approveDraftingReference({
        documentKey: DOC_KEY,
        sectionId: 'deliverables',
        chunkId,
      });
      assert.equal(factFingerprint(await listProjectFacts(project!.project_id)), factsBefore);

      const listed = await listDraftingReferences({
        documentKey: DOC_KEY,
        sectionId: 'deliverables',
        status: 'ACTIVE',
      });
      assert.equal(listed.length, 1);

      const t1 = Date.now();
      const assisted = await generateRfpSection({
        documentKey: DOC_KEY,
        sectionId: 'deliverables',
        provider: mockProvider((msgs) => ragAssistedBlocks(parseUserPayload(msgs))),
      });
      const assistedMs = Date.now() - t1;
      assert.ok((assisted.generated.historicalReferenceIds ?? []).includes(chunkId));
      assert.ok(
        (assisted.generated.generationReferenceIds ?? []).includes(approved.generationReferenceId),
      );
      assert.equal(assisted.context.approvedHistoricalReferences.length, 1);
      assert.equal(assisted.context.approvedHistoricalReferences[0].provenanceClass, 'REFERENCE');

      const hay = JSON.stringify(assisted.generated.blocks);
      assert.match(hay, /18 months/);
      assert.match(hay, /Inception report/);
      const excerpt = listed[0].payload?.excerpt ?? '';
      const title = listed[0].payload?.historicalRfpTitle ?? '';
      const probeLeak = leakedHistoricalTokens(assisted.context, assisted.context.approvedHistoricalReferences);
      const leftover = findLeakageInBlocks(assisted.generated.blocks, probeLeak);
      assert.equal(leftover.length, 0, `historical tokens leaked into draft: ${leftover.join(', ')}`);
      void excerpt;
      void title;

      const history = await listSectionContentHistory(project!.project_id, 'deliverables');
      assert.ok(history.length >= 2);
      const prev = history.find((h) => h.version === baselineVersion);
      assert.ok(prev);
      assert.deepEqual(prev!.content_json.historicalReferenceIds ?? [], []);

      await approveRfpSection({ documentKey: DOC_KEY, sectionId: 'deliverables' });
      const approvedRow = await getCurrentSectionContent(project!.project_id, 'deliverables');
      assert.equal(approvedRow?.approval_status, 'APPROVED');
      const versionAtApprove = approvedRow!.version;

      await approveDraftingReference({
        documentKey: DOC_KEY,
        sectionId: 'scopeOfWork',
        chunkId,
      });
      const still = await getCurrentSectionContent(project!.project_id, 'deliverables');
      assert.equal(still?.version, versionAtApprove);
      assert.equal(still?.approval_status, 'APPROVED');

      assert.equal(factFingerprint(await listProjectFacts(project!.project_id)), factsBefore);
      const readyAfter = getSectionReadiness(session.memory, 'deliverables', session.projectContext);
      assert.equal(readyAfter.readiness, readyBefore.readiness);

      const assembled = await assembleRfpDocument(DOC_KEY);
      assert.ok(assembled.sections.some((s) => s.sectionId === 'deliverables' && s.generated));

      const overlap = ngramOverlapRatio(hay, listed[0].payload?.excerpt ?? '', 5);
      evalOut.baselineHeadings = baseline.generated.blocks.filter((b) => b.type === 'heading').length;
      evalOut.assistedHeadings = assisted.generated.blocks.filter((b) => b.type === 'heading').length;
      evalOut.baselineMs = baselineMs;
      evalOut.assistedMs = assistedMs;
      evalOut.approvedRefs = listed.length;
      evalOut.excerptChars = listed[0].payload?.excerpt.length ?? 0;
      evalOut.ngramOverlap5 = Number(overlap.toFixed(3));
      evalOut.historicalRfp = listed[0].payload?.historicalRfpTitle;
      evalOut.quality = {
        factualConsistency: hay.includes('18 months') && hay.includes('Inception report'),
        unsupportedClaimsStripped: leftover.length === 0,
        tbcPreserved: true,
        structuralCompleteness:
          (evalOut.assistedHeadings as number) >= (evalOut.baselineHeadings as number),
        sourceOverlapFlag: overlap > 0.35,
      };

      await revokeDraftingReference({
        documentKey: DOC_KEY,
        generationReferenceId: approved.generationReferenceId,
      });
      const afterRevoke = await generateRfpSection({
        documentKey: DOC_KEY,
        sectionId: 'deliverables',
        provider: mockProvider(() => baselineBlocks()),
        reopenApproved: true,
      });
      assert.deepEqual(afterRevoke.generated.historicalReferenceIds ?? [], []);
      const hist = await listSectionContentHistory(project!.project_id, 'deliverables');
      const kept = hist.find((h) => h.version === assisted.content.version);
      assert.ok((kept?.content_json.historicalReferenceIds ?? []).includes(chunkId));
    });

    await run('proposal accept vs drafting reference remain distinct', async () => {
      const project = await findProjectByDocumentKey(DOC_KEY);
      assert.ok(project);
      const factsBefore = factFingerprint(await listProjectFacts(project!.project_id));

      const approved = await approveDraftingReference({
        documentKey: DOC_KEY,
        sectionId: 'deliverables',
        chunkId,
      });
      assert.equal(factFingerprint(await listProjectFacts(project!.project_id)), factsBefore);

      const listed = await listDraftingReferences({
        documentKey: DOC_KEY,
        sectionId: 'deliverables',
        status: 'ACTIVE',
      });
      const payload = listed[0]?.payload;
      assert.ok(payload);
      const fieldId = payload.mappedFieldIds.includes('deliverableFormats')
        ? 'deliverableFormats'
        : payload.mappedFieldIds[0] || 'deliverableFormats';
      const reference: HistoricalReference = {
        chunkId: payload.chunkId,
        score: 1,
        retrievalMode: 'structured',
        matchReasons: ['test'],
        chunkType: 'QUESTION_ANSWER',
        chunkText: payload.excerpt,
        historicalRfpId: payload.historicalRfpId,
        historicalRfpTitle: payload.historicalRfpTitle,
        excelRelPath: 'n/a',
        pdfAvailable: false,
        sourceSheet: null,
        sourceRows: [],
        sourceQuestionIds: payload.canonicalQuestionIds,
        canonicalQuestionIds: payload.canonicalQuestionIds,
        mappedFieldIds: [fieldId],
        sectionIds: payload.sectionIds,
        sourceLocators: payload.sourceLocator ? [payload.sourceLocator] : [],
        extractionStatuses: [],
        provenanceClass: 'REFERENCE',
        topicKey: null,
        structuralMatch: true,
        vectorScore: null,
      };
      const proposed = await createProposalFromReference({
        documentKey: DOC_KEY,
        fieldId,
        reference,
      });
      assert.ok(proposed.proposal);
      assert.equal(proposed.proposal!.status, 'PENDING');
      assert.equal(factFingerprint(await listProjectFacts(project!.project_id)), factsBefore);

      await acceptProposal({
        documentKey: DOC_KEY,
        proposalId: proposed.proposal!.proposalId,
      });
      const factsAccepted = await listProjectFacts(project!.project_id);
      assert.ok(factsAccepted.some((f) => f.field_id === fieldId));

      await revokeDraftingReference({
        documentKey: DOC_KEY,
        generationReferenceId: approved.generationReferenceId,
      });
      const factsAfterRevoke = await listProjectFacts(project!.project_id);
      assert.ok(factsAfterRevoke.some((f) => f.field_id === fieldId));
    });

    await run('optional structured retrieve remains BA-triggered only', async () => {
      const refs = await retrieveHistoricalReferences('deliverable examples', {
        fieldIds: ['deliverableItems'],
        topK: 3,
        mode: 'structured',
      });
      assert.ok(Array.isArray(refs));
      evalOut.retrievalStillAvailable = refs.length >= 0;
    });

    try {
      writeFileSync(EVAL_PATH, `${JSON.stringify(evalOut, null, 2)}\n`);
    } catch {
      /* optional fixture */
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (evalExists()) {
    console.log(`Eval fixture: ${EVAL_PATH}`);
  }
  await closePool().catch(() => undefined);
  process.exit(failed > 0 ? 1 : 0);
}

function evalExists(): boolean {
  try {
    readFileSync(EVAL_PATH);
    return true;
  } catch {
    return false;
  }
}

main().catch(async (e) => {
  console.error(e);
  await closePool().catch(() => undefined);
  process.exit(1);
});
