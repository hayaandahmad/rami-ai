#!/usr/bin/env npx tsx
/**
 * Canonical information-model expansion checks.
 * No Modal GPU. Live PostgreSQL used only when configured.
 */
import assert from 'node:assert/strict';
import {
  CANONICAL_FIELD_COUNT,
  LEGACY_CANONICAL_FIELD_COUNT,
  POST_EXPANSION_FIELD_IDS,
  PROJECT_MEMORY_FIELDS,
  PROMOTED_FIELD_IDS,
} from '../src/schema/projectMemoryFields';
import {
  CANONICAL_QUESTION_COUNT,
  HISTORICAL_WORKBOOK_QUESTION_COUNT,
  PROMOTED_QUESTION_IDS,
  QUESTION_SEEDS,
} from '../src/schema/questionBankSeed';
import { getSectionFieldLinks } from '../src/schema/sectionFieldMap';
import { RFP_SECTIONS } from '../src/schema/rfpSchema';
import { assertAllFieldsHaveControlMeta } from '../src/schema/fieldControlMeta';
import { promotedFieldsForHistoricalQuestion } from '../src/schema/historicalPromotedFieldMap';
import { createEmptyProjectMemory } from '../src/types/projectMemory';
import { createEmptyProjectContext } from '../src/types/projectContext';
import { createMemoryField } from '../src/types/provenance';
import {
  applyExtractedFacts,
  markFieldNotApplicable,
} from '../src/server/rami/memoryUpdater';
import { classifySpokenUnknown, classifySpokenNotApplicable } from '../src/server/rami/spokenTbc';
import { analyzeGaps } from '../src/server/rami/gapEngine';
import { classifyProject } from '../src/server/rami/projectClassifier';
import { withActivePacks } from '../src/server/rami/questionPackEngine';
import { getSectionReadiness } from '../src/server/rami/sectionReadiness';
import {
  buildSectionGenerationContext,
  contextFactFieldIds,
} from '../src/server/rami/sectionGenerationContext';
import { evaluateHistoricalRetrievalPolicy } from '../src/server/rami/historicalRetrievalPolicy';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool, query } from '../src/server/db/connection';
import { isDatabaseConfigured } from '../src/server/db/config';
import { clearAllSessionCache } from '../src/server/rami/sessionStore';
import {
  getOrHydrateSession,
  hydrateProject,
  persistRuntimeState,
} from '../src/server/rami/projectPersistence';
import { countLiveProjectTables } from '../src/server/rami/historicalRepository';
import { backfillPromotedHistoricalFieldMappings } from '../src/server/rami/historicalRepository';
import { countChunks, syncChunkMappedFieldsFromAnswers } from '../src/server/rami/historicalChunkRepository';
import {
  evaluateFieldCoverage,
  evaluateQuestionCoverage,
  reportPromotedFieldHistoricalSupport,
} from '../src/server/rami/goldenEvaluation';

const EXPANSION_DOC_KEY = 'rami-model-expansion-demo';
const LEGACY_DOC_KEY = 'rami-gen-core-demo';

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

function gapOf(
  memory: ReturnType<typeof createEmptyProjectMemory>,
  latestMessage: string,
  previous = createEmptyProjectContext(),
) {
  const ctx = withActivePacks(
    classifyProject({ memory, previous, latestMessage }),
    memory,
  );
  return { ctx, gaps: analyzeGaps(memory, ctx) };
}

function statusMap(gaps: ReturnType<typeof analyzeGaps>): Record<string, string> {
  return Object.fromEntries(gaps.fieldGaps.map((g) => [g.fieldId, g.gapStatus]));
}

function setKnown(
  memory: ReturnType<typeof createEmptyProjectMemory>,
  fieldId: keyof ReturnType<typeof createEmptyProjectMemory>,
  value: unknown,
) {
  (memory as unknown as Record<string, unknown>)[fieldId as string] = {
    ...createMemoryField(fieldId as string, value, 'EXTRACTED', 'ba-message'),
    gapStatus: 'KNOWN',
  };
}

console.log('\n=== Canonical information-model expansion ===\n');

async function main() {
  loadLocalEnv();

  await run('counts: 52 + 7 promoted + issuerEntity; 62 + 7 + issuer question', () => {
    assert.equal(LEGACY_CANONICAL_FIELD_COUNT, 52);
    assert.equal(PROMOTED_FIELD_IDS.length, 7);
    assert.equal(POST_EXPANSION_FIELD_IDS.length, 1);
    assert.equal(CANONICAL_FIELD_COUNT, 60);
    assert.equal(PROJECT_MEMORY_FIELDS.length, 60);
    assert.ok(PROJECT_MEMORY_FIELDS.some((f) => f.fieldId === 'issuerEntity'));
    assert.equal(HISTORICAL_WORKBOOK_QUESTION_COUNT, 62);
    assert.equal(PROMOTED_QUESTION_IDS.length, 7);
    assert.equal(CANONICAL_QUESTION_COUNT, 70);
    assert.equal(QUESTION_SEEDS.length, 70);
    assert.equal(RFP_SECTIONS.length, 20);
  });

  await run('no field or question ID collisions', () => {
    const fieldIds = PROJECT_MEMORY_FIELDS.map((f) => f.fieldId);
    assert.equal(new Set(fieldIds).size, fieldIds.length);
    const qids = QUESTION_SEEDS.map((q) => q.questionId);
    assert.equal(new Set(qids).size, qids.length);
    for (const id of PROMOTED_QUESTION_IDS) {
      assert.ok(id.startsWith('18.'), id);
      assert.ok(!QUESTION_SEEDS.some((q) => q.questionId !== id && q.questionId === id));
    }
    const colliding = qids.filter((id) => /^(13|14|15|16|17)\./.test(id));
    assert.equal(colliding.length, 0);
    const missingMeta = assertAllFieldsHaveControlMeta();
    assert.deepEqual(missingMeta, []);
  });

  await run('Question→Field and Field→Section mappings', () => {
    const qMap: Record<string, string[]> = {
      '18.1': ['awardModel'],
      '18.2': ['callOffOrSowProcess'],
      '18.3': ['namedKeyPersonnel'],
      '18.4': ['clarificationContact'],
      '18.5': ['submissionChannel'],
      '18.6': ['governanceCadence'],
      '18.7': ['knowledgeTransferRequirements'],
    };
    for (const [qid, fields] of Object.entries(qMap)) {
      const q = QUESTION_SEEDS.find((x) => x.questionId === qid);
      assert.ok(q, qid);
      assert.deepEqual(q!.fieldIds, fields);
    }
    const links = getSectionFieldLinks();
    const pair = (sid: string, fid: string) =>
      links.some((l) => l.sectionId === sid && l.fieldId === fid);
    assert.ok(pair('evaluationCriteria', 'awardModel'));
    assert.ok(pair('engagementDefinition', 'callOffOrSowProcess'));
    assert.ok(pair('manpowerRequirements', 'namedKeyPersonnel'));
    assert.ok(pair('administrativeProcedures', 'clarificationContact'));
    assert.ok(pair('administrativeProcedures', 'submissionChannel'));
    assert.ok(pair('projectManagementGovernance', 'governanceCadence'));
    assert.ok(pair('implementationRequirements', 'knowledgeTransferRequirements'));
    const nk = links.find((l) => l.fieldId === 'namedKeyPersonnel' && l.sectionId === 'manpowerRequirements');
    assert.equal(nk?.role, 'must-have');
    assert.equal(nk?.naValid, true);
    const admin = links.find(
      (l) => l.fieldId === 'clarificationContact' && l.sectionId === 'administrativeProcedures',
    );
    assert.ok(admin);
    assert.notEqual(admin!.role, 'must-have');
  });

  await run('deterministic historical question mapping (no LLM)', () => {
    assert.deepEqual(
      promotedFieldsForHistoricalQuestion('How many suppliers will be awarded under this framework?'),
      ['awardModel'],
    );
    assert.deepEqual(
      promotedFieldsForHistoricalQuestion('How are call-offs and work orders initiated?'),
      ['callOffOrSowProcess'],
    );
    assert.deepEqual(
      promotedFieldsForHistoricalQuestion('Which mandatory staff roles and key personnel require CVs?'),
      ['namedKeyPersonnel'],
    );
    assert.deepEqual(promotedFieldsForHistoricalQuestion('Who approves? Who does UAT?'), []);
  });

  await run('multi-fact extraction + TBC + N/A + correction', () => {
    const memory = createEmptyProjectMemory();
    const ba =
      'This is a framework agreement for digital services. We expect to award three suppliers. Individual assignments will be issued through SOWs. The bidder must nominate a project manager and technical lead with CVs. Clarifications go to procurement@example.gov and proposals are submitted through the tender portal.';
    const result = applyExtractedFacts(
      memory,
      [
        { fieldId: 'documentType', value: 'framework-agreement', confidence: 'high' },
        { fieldId: 'engagementType', value: 'framework agreement', confidence: 'high' },
        { fieldId: 'awardModel', value: 'three suppliers', confidence: 'high' },
        {
          fieldId: 'callOffOrSowProcess',
          value: 'Individual assignments issued through SOWs',
          confidence: 'high',
        },
        {
          fieldId: 'namedKeyPersonnel',
          value: 'project manager and technical lead with CVs',
          confidence: 'high',
        },
        { fieldId: 'clarificationContact', value: 'procurement@example.gov', confidence: 'high' },
        { fieldId: 'submissionChannel', value: 'tender portal', confidence: 'high' },
      ],
      'user-message:expansion',
      ba,
    );
    assert.ok(result.applied.includes('awardModel'));
    assert.ok(result.applied.includes('callOffOrSowProcess'));
    assert.ok(result.applied.includes('namedKeyPersonnel'));
    assert.equal(memory.awardModel?.current.status, 'EXTRACTED');
    assert.equal((memory.awardModel?.current.value as { model?: string }).model, 'multi-supplier');
    assert.equal((memory.awardModel?.current.value as { supplierCount?: number }).supplierCount, 3);
    assert.ok(Array.isArray(memory.namedKeyPersonnel?.current.value));
    assert.ok(
      (memory.namedKeyPersonnel?.current.value as Array<{ role: string }>).some((p) =>
        /project manager/i.test(p.role),
      ),
    );

    const tbcMem = createEmptyProjectMemory();
    applyExtractedFacts(tbcMem, [
      { fieldId: 'awardModel', value: 'Supplier count is not confirmed yet', confidence: 'high' },
    ]);
    assert.equal(tbcMem.awardModel?.current.status, 'TBC');
    assert.equal((tbcMem.awardModel as { gapStatus?: string }).gapStatus, 'UNKNOWN');

    const naMem = createEmptyProjectMemory();
    applyExtractedFacts(naMem, [
      { fieldId: 'namedKeyPersonnel', value: 'Named personnel are not required', confidence: 'high' },
    ]);
    assert.equal((naMem.namedKeyPersonnel as { gapStatus?: string }).gapStatus, 'NOT_APPLICABLE');

    applyExtractedFacts(
      memory,
      [{ fieldId: 'awardModel', value: 'two suppliers', confidence: 'high' }],
      'user-message:correction',
      'Actually, it will be two suppliers',
    );
    assert.equal((memory.awardModel?.current.value as { supplierCount?: number }).supplierCount, 2);
    assert.ok((memory.awardModel?.history?.length ?? 0) >= 1);

    const conflict = applyExtractedFacts(
      memory,
      [{ fieldId: 'awardModel', value: { model: 'single-supplier', supplierCount: 1 }, confidence: 'high' }],
      'user-message:conflict',
      'The cover says one winner but the annex says three suppliers',
    );
    assert.ok(conflict.contradicted.includes('awardModel'));
    assert.ok(classifySpokenUnknown('Supplier count is not confirmed yet'));
    assert.ok(classifySpokenNotApplicable('Named personnel are not required'));
  });

  await run('gap engine: one-off vs framework vs assessment vs PQ', () => {
    const oneOff = createEmptyProjectMemory();
    setKnown(oneOff, 'documentType', 'consulting');
    setKnown(oneOff, 'engagementType', 'one-time consulting project');
    const a = gapOf(oneOff, 'This is a one-off consulting RFP', {
      ...createEmptyProjectContext(),
      documentStage: 'FULL_RFP',
      contractingGranularity: 'SINGLE_PROJECT',
      primaryDomain: 'CONSULTING',
    });
    const aMap = statusMap(a.gaps);
    assert.equal(aMap.callOffOrSowProcess, 'NOT_APPLICABLE');
    assert.equal(aMap.namedKeyPersonnel, 'NOT_APPLICABLE');
    assert.equal(aMap.knowledgeTransferRequirements, 'NOT_APPLICABLE');
    assert.equal(aMap.governanceCadence, 'NOT_APPLICABLE');
    assert.ok(aMap.awardModel === 'MISSING' || aMap.awardModel === 'KNOWN');
    if (a.gaps.nextAction.type === 'ASK_REQUIREMENTS') {
      assert.notEqual(a.gaps.nextAction.primaryFieldId, 'callOffOrSowProcess');
    }

    const fw = createEmptyProjectMemory();
    setKnown(fw, 'documentType', 'framework-agreement');
    setKnown(fw, 'engagementType', 'framework agreement');
    const b = gapOf(fw, 'This is a framework agreement. Call-offs will be issued through SOWs.', {
      ...createEmptyProjectContext(),
      documentStage: 'FRAMEWORK_QUALIFICATION',
      contractingGranularity: 'FRAMEWORK',
      primaryDomain: 'GENERAL',
    });
    const bMap = statusMap(b.gaps);
    assert.equal(bMap.callOffOrSowProcess, 'MISSING');
    assert.equal(bMap.namedKeyPersonnel, 'MISSING');
    assert.ok(b.ctx.activePacks.includes('FRAMEWORK'));

    const assess = createEmptyProjectMemory();
    setKnown(assess, 'documentType', 'assessment');
    setKnown(assess, 'engagementType', 'assessment');
    const c = gapOf(assess, 'This is a short assessment with no named staff.', {
      ...createEmptyProjectContext(),
      documentStage: 'FULL_RFP',
      contractingGranularity: 'SINGLE_PROJECT',
      primaryDomain: 'ASSESSMENT',
    });
    const cMap = statusMap(c.gaps);
    assert.equal(cMap.namedKeyPersonnel, 'NOT_APPLICABLE');
    assert.equal(cMap.callOffOrSowProcess, 'NOT_APPLICABLE');

    const pq = createEmptyProjectMemory();
    setKnown(pq, 'documentType', 'consulting');
    const d = gapOf(pq, 'This is a pre-qualification / PQ shortlist.', {
      ...createEmptyProjectContext(),
      documentStage: 'PRE_QUALIFICATION',
      contractingGranularity: 'SINGLE_PROJECT',
      primaryDomain: 'CONSULTING',
    });
    const dMap = statusMap(d.gaps);
    assert.equal(dMap.callOffOrSowProcess, 'NOT_APPLICABLE');
    assert.equal(dMap.supportPeriodAndHours, 'NOT_APPLICABLE');
    assert.ok(d.ctx.activePacks.includes('PRE_QUALIFICATION'));
    if (d.gaps.nextAction.type === 'ASK_REQUIREMENTS') {
      assert.notEqual(d.gaps.nextAction.primaryFieldId, 'callOffOrSowProcess');
    }
  });

  await run('readiness: conditional missing does not block unrelated sections', () => {
    const memory = createEmptyProjectMemory();
    setKnown(memory, 'documentType', 'consulting');
    setKnown(memory, 'documentTitle', 'Advisory support');
    setKnown(memory, 'beneficiaryEntity', 'MODEE');
    const ctx = withActivePacks(
      classifyProject({
        memory,
        previous: {
          ...createEmptyProjectContext(),
          documentStage: 'FULL_RFP',
          contractingGranularity: 'SINGLE_PROJECT',
          primaryDomain: 'CONSULTING',
        },
      }),
      memory,
    );
    const cover = getSectionReadiness(memory, 'coverPage', ctx);
    assert.equal(cover.applicable, true);
    assert.ok(!cover.criticalBlockers.includes('callOffOrSowProcess'));
    assert.ok(!cover.criticalBlockers.includes('namedKeyPersonnel'));
    const manpower = getSectionReadiness(memory, 'manpowerRequirements', ctx);
    assert.equal(manpower.applicable, false);
    assert.equal(manpower.readiness, 'NOT_APPLICABLE');

    setKnown(memory, 'awardModel', { model: 'single-supplier', supplierCount: 1 });
    const evalR = getSectionReadiness(memory, 'evaluationCriteria', ctx);
    assert.ok(!evalR.criticalBlockers.includes('awardModel'));
  });

  await run('generation context includes promoted facts', () => {
    const memory = createEmptyProjectMemory();
    setKnown(memory, 'documentType', 'framework-agreement');
    setKnown(memory, 'documentTitle', 'Digital services framework');
    setKnown(memory, 'beneficiaryEntity', 'MODEE');
    setKnown(memory, 'engagementType', 'framework');
    setKnown(memory, 'awardModel', { model: 'multi-supplier', supplierCount: 3 });
    setKnown(memory, 'evaluationWeights', '70/30');
    setKnown(memory, 'evaluationRules', 'minimum 70 technical');
    const ctx = withActivePacks(
      classifyProject({
        memory,
        previous: {
          ...createEmptyProjectContext(),
          documentStage: 'FULL_RFP',
          contractingGranularity: 'FRAMEWORK',
          primaryDomain: 'GENERAL',
        },
        latestMessage: 'framework agreement with three suppliers',
      }),
      memory,
    );
    const gen = buildSectionGenerationContext({
      projectId: 'test',
      documentKey: 'test',
      sectionId: 'evaluationCriteria',
      memory,
      projectContext: ctx,
    });
    assert.ok(contextFactFieldIds(gen).includes('awardModel'));
  });

  await run('controlled RAG policy still isolation-safe', () => {
    const ordinary = evaluateHistoricalRetrievalPolicy({
      userMessage: 'This is a framework agreement for digital services with three suppliers.',
    });
    assert.equal(ordinary.shouldRetrieve, false);
    const explicit = evaluateHistoricalRetrievalPolicy({
      userMessage: 'Show me examples of award model from previous RFPs',
    });
    assert.equal(explicit.shouldRetrieve, true);
    assert.ok(explicit.fieldIds.includes('awardModel'));
  });

  if (!isDatabaseConfigured()) {
    console.log('\n(Skipping live PostgreSQL expansion checks)\n');
  } else {
    const liveBefore = await countLiveProjectTables();
    const chunksBefore = await countChunks();

    await run('seeded definitions are 60 fields / 70 questions', async () => {
      const f = await query<{ n: string }>('SELECT COUNT(*)::text AS n FROM fields');
      const q = await query<{ n: string }>('SELECT COUNT(*)::text AS n FROM questions');
      assert.equal(Number(f.rows[0].n), 60);
      assert.equal(Number(q.rows[0].n), 70);
    });

    await run('historical mapping backfill + chunk metadata sync (no re-embed)', async () => {
      const backfill = await backfillPromotedHistoricalFieldMappings();
      const chunkUpdates = await syncChunkMappedFieldsFromAnswers();
      const support = await reportPromotedFieldHistoricalSupport();
      console.log('    historical support:', JSON.stringify(support.map((s) => ({
        fieldId: s.fieldId,
        answers: s.answerCount,
        rfps: s.rfpIds.length,
      }))));
      assert.ok(backfill.answersScanned >= 434);
      const chunksAfter = await countChunks();
      assert.equal(chunksAfter.chunks, chunksBefore.chunks);
      assert.equal(chunksAfter.embeddings, chunksBefore.embeddings);
      void chunkUpdates;
      for (const s of support) {
        if (s.fieldId === 'awardModel' || s.fieldId === 'namedKeyPersonnel' || s.fieldId === 'clarificationContact') {
          assert.ok(s.answerCount >= 1, `${s.fieldId} should have historical mappings`);
        }
      }
    });

    await run('golden coverage: workbook 62 questions; new fields may be sparse', async () => {
      const qc = await evaluateQuestionCoverage('rfp-itas-vol2b');
      assert.equal(qc.expectedCanonical, 62);
      assert.equal(qc.matchedCanonical, 62);
      const fc = await evaluateFieldCoverage('rfp-itas-vol2b');
      const oldIds = PROJECT_MEMORY_FIELDS.map((f) => f.fieldId).filter(
        (id) => !(PROMOTED_FIELD_IDS as readonly string[]).includes(id),
      );
      const oldCovered = oldIds.filter((id) => fc.supportedFieldIds.includes(id));
      assert.ok(oldCovered.length > 20);
    });

    await run('multi-fact conversational persist + hydrate (no SQL fact insert)', async () => {
      clearAllSessionCache();
      const session = await getOrHydrateSession(EXPANSION_DOC_KEY);
      for (const id of PROMOTED_FIELD_IDS) {
        (session.memory as unknown as Record<string, unknown>)[id] = null;
      }
      session.memory.documentType = null;
      session.memory.engagementType = null;
      const ba =
        'This is a framework agreement for digital services. We expect to award three suppliers. Individual assignments will be issued through SOWs. The bidder must nominate a project manager and technical lead with CVs. Clarifications go to procurement@example.gov and proposals are submitted through the tender portal.';
      applyExtractedFacts(
        session.memory,
        [
          { fieldId: 'documentType', value: 'framework-agreement', confidence: 'high' },
          { fieldId: 'documentTitle', value: 'Digital services framework', confidence: 'high' },
          { fieldId: 'beneficiaryEntity', value: 'MODEE', confidence: 'high' },
          { fieldId: 'engagementType', value: 'framework agreement', confidence: 'high' },
          { fieldId: 'awardModel', value: 'three suppliers', confidence: 'high' },
          { fieldId: 'callOffOrSowProcess', value: 'SOWs / call-offs per assignment', confidence: 'high' },
          { fieldId: 'namedKeyPersonnel', value: 'project manager and technical lead with CVs', confidence: 'high' },
          { fieldId: 'clarificationContact', value: 'procurement@example.gov', confidence: 'high' },
          { fieldId: 'submissionChannel', value: 'tender portal', confidence: 'high' },
        ],
        'user-message:expansion-live',
        ba,
      );
      session.projectContext = withActivePacks(
        classifyProject({
          memory: session.memory,
          previous: session.projectContext,
          latestMessage: ba,
        }),
        session.memory,
      );
      await persistRuntimeState(session);
      clearAllSessionCache();
      const hydrated = await hydrateProject(EXPANSION_DOC_KEY);
      assert.equal(hydrated.memory.awardModel?.current.status, 'EXTRACTED');
      assert.equal(
        (hydrated.memory.awardModel?.current.value as { supplierCount?: number }).supplierCount,
        3,
      );
      assert.equal(hydrated.memory.callOffOrSowProcess?.current.status, 'EXTRACTED');
      assert.ok(hydrated.memory.namedKeyPersonnel?.current.value);
      assert.equal(hydrated.memory.clarificationContact?.current.value, 'procurement@example.gov');
      assert.equal(hydrated.projectContext.contractingGranularity, 'FRAMEWORK');
      const gaps = analyzeGaps(hydrated.memory, hydrated.projectContext);
      const asked = gaps.nextAction.type === 'ASK_REQUIREMENTS' ? gaps.nextAction.primaryFieldId : null;
      assert.notEqual(asked, 'callOffOrSowProcess');
      assert.notEqual(asked, 'awardModel');
    });

    await run('legacy demo hydrates; missing new fields stay unresolved', async () => {
      clearAllSessionCache();
      const existing = await query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM projects WHERE document_key = $1`,
        [LEGACY_DOC_KEY],
      );
      if (Number(existing.rows[0].n) === 0) {
        console.log('    (legacy demo project not present — skipped)');
        return;
      }
      const session = await hydrateProject(LEGACY_DOC_KEY);
      for (const id of PROMOTED_FIELD_IDS) {
        const bag = (session.memory as unknown as Record<string, { current?: unknown } | null>)[id];
        assert.ok(bag === null || bag?.current == null || bag.current === undefined);
      }
      const sections = await query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM project_section_contents p
         JOIN projects pr ON pr.project_id = p.project_id
         WHERE pr.document_key = $1`,
        [LEGACY_DOC_KEY],
      );
      assert.ok(Number(sections.rows[0].n) >= 1);
    });

    await run('live project / historical / proposal tables remain intact', async () => {
      const liveAfter = await countLiveProjectTables();
      assert.ok(liveAfter.projects >= liveBefore.projects);
      assert.ok(liveAfter.project_facts >= 1);
      const hist = await query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM historical_rfp_documents`,
      );
      assert.equal(Number(hist.rows[0].n), 7);
      const proposals = await query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM historical_field_proposals`,
      );
      assert.ok(Number(proposals.rows[0].n) >= 0);
      const chunks = await countChunks();
      assert.equal(chunks.chunks, chunksBefore.chunks);
      assert.equal(chunks.embeddings, chunksBefore.embeddings);
    });

    await run('TBC then correction persist on expansion project', async () => {
      clearAllSessionCache();
      const session = await hydrateProject(EXPANSION_DOC_KEY);
      applyExtractedFacts(session.memory, [
        { fieldId: 'governanceCadence', value: 'Supplier count is not confirmed yet', confidence: 'high' },
      ]);
      assert.equal(session.memory.governanceCadence?.current.status, 'TBC');
      applyExtractedFacts(
        session.memory,
        [{ fieldId: 'governanceCadence', value: 'Monthly steering committee', confidence: 'high' }],
        'user-message:gov-fix',
        'Actually, monthly steering committee',
      );
      assert.equal(session.memory.governanceCadence?.current.value, 'Monthly steering committee');
      markFieldNotApplicable(session.memory, 'knowledgeTransferRequirements', 'user-message:kt-na');
      assert.equal(
        (session.memory.knowledgeTransferRequirements as { gapStatus?: string }).gapStatus,
        'NOT_APPLICABLE',
      );
      await persistRuntimeState(session);
    });
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  await closePool().catch(() => undefined);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await closePool().catch(() => undefined);
  process.exit(1);
});
