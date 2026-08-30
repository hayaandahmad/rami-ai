#!/usr/bin/env npx tsx
/**
 * RFP Generation Core unit checks.
 * Uses a mock provider for generation persistence tests (no GPU / no Ollama required).
 * Live Ollama smoke is optional via RAMI_GEN_LIVE=1.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool, withTransaction, query } from '../src/server/db/connection';
import { isDatabaseConfigured } from '../src/server/db/config';
import { createEmptyProjectMemory } from '../src/types/projectMemory';
import { createMemoryField } from '../src/types/provenance';
import { createEmptyProjectContext } from '../src/types/projectContext';
import { withActivePacks } from '../src/server/rami/questionPackEngine';
import { applyExtractedFacts } from '../src/server/rami/memoryUpdater';
import { getSectionReadiness } from '../src/server/rami/sectionReadiness';
import {
  buildSectionGenerationContext,
  contextFactFieldIds,
} from '../src/server/rami/sectionGenerationContext';
import {
  assertGenerationAllowed,
  enforceTbcBlocks,
  generateRfpSection,
  approveRfpSection,
  assembleRfpDocument,
  getGeneratedSection,
} from '../src/server/rami/sectionGeneration';
import { GenerationError, TBC_MARKER_PREFIX } from '../src/types/generatedSection';
import type { RamiModelProvider, ChatMessage } from '../src/server/ai/RamiModelProvider';
import { clearAllSessionCache } from '../src/server/rami/sessionStore';
import {
  getOrHydrateSession,
  persistRuntimeState,
  hydrateProject,
} from '../src/server/rami/projectPersistence';
import {
  getCurrentSectionContent,
  listSectionContentHistory,
} from '../src/server/repositories/ProjectSectionContentRepository';
import { findProjectByDocumentKey } from '../src/server/repositories/ProjectRepository';
import { listProjectFacts } from '../src/server/repositories/ProjectFactsRepository';

let passed = 0;
let failed = 0;

function run(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => fn())
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

function consultingMemory() {
  const memory = createEmptyProjectMemory();
  applyExtractedFacts(
    memory,
    [
      { fieldId: 'documentType', value: 'assessment', confidence: 'high' },
      { fieldId: 'engagementType', value: 'consulting', confidence: 'high' },
      { fieldId: 'documentTitle', value: 'Assessment RFP', confidence: 'high' },
      {
        fieldId: 'beneficiaryEntity',
        value: 'Ministry of Digital Economy and Entrepreneurship (MoDEE)',
        confidence: 'high',
      },
      {
        fieldId: 'currentSituation',
        value: 'Fragmented portals and manual maturity tracking.',
        confidence: 'high',
      },
      {
        fieldId: 'businessNeedRationale',
        value: 'Need an independent maturity assessment and target operating model.',
        confidence: 'high',
      },
      {
        fieldId: 'businessObjectives',
        value: ['Assess maturity', 'Recommend TOM'],
        confidence: 'high',
      },
      { fieldId: 'painPoints', value: 'TBC', confidence: 'high' },
      {
        fieldId: 'inScope',
        value: ['Maturity assessment', 'Roadmap advice'],
        confidence: 'high',
      },
      {
        fieldId: 'outOfScope',
        value: ['Software implementation'],
        confidence: 'high',
      },
      {
        fieldId: 'users',
        value: { internal: ['MoDEE team'], external: [] },
        confidence: 'high',
      },
    ],
    'validate:rfp-generation',
  );
  return memory;
}

function mockProvider(blocks: unknown): RamiModelProvider {
  return {
    providerType: 'mock-generation',
    async complete() {
      return { text: '', durationMs: 1, modelUsed: 'mock' };
    },
    async *completeStream() {
      yield '';
    },
    async extractStructured<T>(_messages: ChatMessage[]) {
      return { data: blocks as T, durationMs: 1, modelUsed: 'mock-qwen3:8b' };
    },
    async embed() {
      return [0];
    },
    async healthCheck() {
      return {
        providerType: 'mock-generation',
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

console.log('\n=== RFP Generation Core checks ===\n');

async function main() {
  loadLocalEnv();

  await run('NOT_APPLICABLE blocks generation', () => {
    const memory = createEmptyProjectMemory();
    memory.documentType = createMemoryField(
      'documentType',
      'consulting',
      'EXTRACTED',
      'ba-message',
    );
    const ctx = withActivePacks(createEmptyProjectContext(), memory);
    assert.throws(
      () => assertGenerationAllowed(memory, 'functionalRequirements', ctx),
      (e: unknown) => e instanceof GenerationError && e.code === 'NOT_APPLICABLE',
    );
  });

  await run('NOT_READY blocks generation', () => {
    const memory = createEmptyProjectMemory();
    memory.documentType = createMemoryField(
      'documentType',
      'assessment',
      'EXTRACTED',
      'ba-message',
    );
    const ctx = withActivePacks(createEmptyProjectContext(), memory);
    assert.throws(
      () => assertGenerationAllowed(memory, 'background', ctx),
      (e: unknown) => e instanceof GenerationError && e.code === 'NOT_READY',
    );
  });

  await run('READY_TO_DRAFT / DRAFTABLE_WITH_TBC allows generation gate', () => {
    const memory = consultingMemory();
    const ctx = withActivePacks(createEmptyProjectContext(), memory);
    const r = assertGenerationAllowed(memory, 'background', ctx);
    assert.ok(r.readiness === 'DRAFTABLE_WITH_TBC' || r.readiness === 'READY_TO_DRAFT');
  });

  await run('DRAFTABLE_WITH_TBC context lists TBC fields', () => {
    const memory = consultingMemory();
    const ctx = withActivePacks(createEmptyProjectContext(), memory);
    const genCtx = buildSectionGenerationContext({
      projectId: '00000000-0000-0000-0000-000000000001',
      documentKey: 'unit-test',
      sectionId: 'background',
      memory,
      projectContext: ctx,
    });
    assert.equal(genCtx.readiness, 'DRAFTABLE_WITH_TBC');
    assert.ok(genCtx.tbcFields.some((f) => f.fieldId === 'painPoints'));
    assert.ok(genCtx.answeredFacts.some((f) => f.fieldId === 'currentSituation'));
    assert.ok(!contextFactFieldIds(genCtx).includes('painPoints'));
  });

  await run('context excludes irrelevant unresolved fields', () => {
    const memory = consultingMemory();
    // evaluationWeights is out of scope for background — should not enter context
    applyExtractedFacts(
      memory,
      [
        {
          fieldId: 'evaluationWeights',
          value: 'technical 70 / financial 30',
          confidence: 'high',
        },
      ],
      'validate:rfp-generation',
    );
    const ctx = withActivePacks(createEmptyProjectContext(), memory);
    const genCtx = buildSectionGenerationContext({
      projectId: '00000000-0000-0000-0000-000000000001',
      documentKey: 'unit-test',
      sectionId: 'background',
      memory,
      projectContext: ctx,
    });
    const ids = contextFactFieldIds(genCtx);
    assert.ok(!ids.includes('evaluationWeights'));
    assert.ok(!genCtx.tbcFields.some((f) => f.fieldId === 'evaluationWeights'));
  });

  await run('enforceTbcBlocks injects missing TBC markers', () => {
    const memory = consultingMemory();
    const ctx = withActivePacks(createEmptyProjectContext(), memory);
    const genCtx = buildSectionGenerationContext({
      projectId: '00000000-0000-0000-0000-000000000001',
      documentKey: 'unit-test',
      sectionId: 'background',
      memory,
      projectContext: ctx,
    });
    const blocks = enforceTbcBlocks(
      [{ type: 'heading', level: 1, text: 'Background and Business Need' }],
      genCtx,
    );
    assert.ok(blocks.some((b) => b.type === 'tbc' && b.fieldId === 'painPoints'));
    assert.ok(
      blocks.some(
        (b) => b.type === 'tbc' && b.label.includes(TBC_MARKER_PREFIX),
      ),
    );
  });

  if (!isDatabaseConfigured()) {
    console.log('\n(Skipping live PostgreSQL generation persistence tests — DB not configured)\n');
  } else {
    const docKey = `rami-gen-unit-${randomUUID().slice(0, 8)}`;

    await run('migration table project_section_contents exists', async () => {
      const r = await query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_name = 'project_section_contents'
         ) AS exists`,
      );
      assert.equal(r.rows[0]?.exists, true);
    });

    await run('persisted generation + reload + ProjectFacts unchanged', async () => {
      clearAllSessionCache();
      const session = await getOrHydrateSession(docKey, docKey);
      session.memory = consultingMemory();
      session.projectContext = withActivePacks(createEmptyProjectContext(), session.memory);
      session.conversation.rfpIntent = 'CREATE_RFP';
      await persistRuntimeState(session);

      const project = await findProjectByDocumentKey(docKey);
      assert.ok(project);
      const factsBefore = await listProjectFacts(project!.project_id);
      const factCountBefore = factsBefore.length;

      const mock = mockProvider({
        blocks: [
          { type: 'heading', level: 1, text: 'Background and Business Need' },
          {
            type: 'paragraph',
            text: 'MoDEE requires an independent digital-services maturity assessment.',
          },
        ],
      });

      const result = await generateRfpSection({
        documentKey: docKey,
        sectionId: 'background',
        provider: mock,
      });
      assert.equal(result.generated.approvalStatus, 'DRAFT');
      assert.ok(result.generated.blocks.some((b) => b.type === 'tbc'));

      clearAllSessionCache();
      const reloaded = await getGeneratedSection({
        documentKey: docKey,
        sectionId: 'background',
      });
      assert.ok(reloaded);
      assert.equal(reloaded!.content_json.sectionId, 'background');
      assert.ok(reloaded!.content_json.blocks.length >= 2);

      const factsAfter = await listProjectFacts(project!.project_id);
      assert.equal(factsAfter.length, factCountBefore);
    });

    await run('regeneration creates new version; approve protected', async () => {
      const mock = mockProvider({
        blocks: [
          { type: 'heading', level: 1, text: 'Background and Business Need' },
          { type: 'paragraph', text: 'Regenerated draft text.' },
        ],
      });
      const first = await generateRfpSection({
        documentKey: docKey,
        sectionId: 'background',
        provider: mock,
      });
      await approveRfpSection({ documentKey: docKey, sectionId: 'background' });

      await assert.rejects(
        () =>
          generateRfpSection({
            documentKey: docKey,
            sectionId: 'background',
            provider: mock,
          }),
        (e: unknown) =>
          e instanceof GenerationError && e.code === 'APPROVED_CONTENT_PROTECTED',
      );

      const second = await generateRfpSection({
        documentKey: docKey,
        sectionId: 'background',
        provider: mock,
        reopenApproved: true,
      });
      assert.ok(second.content.version > first.content.version);
      assert.equal(second.generated.approvalStatus, 'DRAFT');

      const project = await findProjectByDocumentKey(docKey);
      const history = await listSectionContentHistory(project!.project_id, 'background');
      assert.ok(history.length >= 2);
      assert.equal(history.filter((h) => h.is_current).length, 1);
    });

    await run('assemble RFP respects order and does not invent missing sections', async () => {
      const assembled = await assembleRfpDocument(docKey);
      assert.equal(assembled.sections.length, 20);
      for (let i = 1; i < assembled.sections.length; i++) {
        assert.ok(assembled.sections[i].order > assembled.sections[i - 1].order);
      }
      const bg = assembled.sections.find((s) => s.sectionId === 'background');
      assert.ok(bg?.generated);
      const missing = assembled.sections.filter((s) => s.applicable && s.missingGeneration);
      assert.ok(missing.length >= 1);
      assert.equal(assembled.complete, false);
    });

    await run('cache clear + rehydrate still returns generated content', async () => {
      clearAllSessionCache();
      await hydrateProject(docKey);
      const row = await getCurrentSectionContent(
        (await findProjectByDocumentKey(docKey))!.project_id,
        'background',
      );
      assert.ok(row?.content_json.blocks.length);
    });

    // cleanup unit project contents (keep DB tidy)
    await withTransaction(async (client) => {
      const p = await findProjectByDocumentKey(docKey, client);
      if (p) {
        await client.query('DELETE FROM projects WHERE project_id = $1', [p.project_id]);
      }
    });
  }

  console.log('\n──────────────────────────────────────');
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  if (failed > 0) {
    await closePool().catch(() => undefined);
    process.exit(1);
  }
  console.log('\n✅ RFP generation validation passed.\n');
  await closePool().catch(() => undefined);
}

main().catch(async (err) => {
  console.error(err);
  await closePool().catch(() => undefined);
  process.exit(1);
});
