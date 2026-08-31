#!/usr/bin/env npx tsx
/**
 * Phase 4 — Edit with Rami safety invariants (mock provider + PostgreSQL when configured).
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { isDatabaseConfigured } from '../src/server/db/config';
import { createEmptyProjectMemory } from '../src/types/projectMemory';
import { createMemoryField } from '../src/types/provenance';
import { createEmptyProjectContext } from '../src/types/projectContext';
import { withActivePacks } from '../src/server/rami/questionPackEngine';
import { applyExtractedFacts } from '../src/server/rami/memoryUpdater';
import {
  aiEditRfpSection,
  approveRfpSection,
  generateRfpSection,
} from '../src/server/rami/sectionGeneration';
import { buildSectionEditContext } from '../src/server/rami/sectionGenerationContext';
import { buildEditMessages } from '../src/server/rami/generationPrompt';
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
import { getSectionReadiness } from '../src/server/rami/sectionReadiness';

const root = join(import.meta.dirname ?? __dirname, '..');

let passed = 0;
let failed = 0;

function run(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      passed++;
      console.log(`  ✓ ${name}`);
    })
    .catch((err) => {
      failed++;
      console.error(`  ✗ ${name}`);
      console.error(err);
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
    'validate:edit-with-rami',
  );
  return memory;
}

function mockProvider(blocks: unknown, fail = false): RamiModelProvider {
  return {
    providerType: 'mock-ai-edit',
    async complete() {
      return { text: '', durationMs: 1, modelUsed: 'mock' };
    },
    async *completeStream() {
      yield '';
    },
    async extractStructured<T>(_messages: ChatMessage[]) {
      if (fail) throw new Error('mock provider failure');
      return { data: blocks as T, durationMs: 1, modelUsed: 'mock-qwen3:8b' };
    },
    async embed() {
      return [0];
    },
    async healthCheck() {
      return {
        providerType: 'mock-ai-edit',
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

console.log('\n=== Edit with Rami checks ===\n');

async function main() {
  loadLocalEnv();

  await run('edit context includes current blocks and instruction', () => {
    const memory = consultingMemory();
    const ctx = withActivePacks(createEmptyProjectContext(), memory);
    const blocks = [
      { type: 'heading', level: 1, text: 'Background and Business Need' },
      { type: 'paragraph', text: 'Long paragraph that should be shortened.' },
    ];
    const editCtx = buildSectionEditContext({
      projectId: '00000000-0000-0000-0000-000000000001',
      documentKey: 'unit-test',
      sectionId: 'background',
      memory,
      projectContext: ctx,
      currentSection: blocks as never,
      currentVersion: 2,
      readinessAtGeneration: 'DRAFTABLE_WITH_TBC',
      editInstruction: 'Make this section shorter.',
    });
    assert.equal(editCtx.currentVersion, 2);
    assert.equal(editCtx.editInstruction, 'Make this section shorter.');
    assert.ok(editCtx.currentBlocks.length === 2);
    const messages = buildEditMessages(editCtx);
    assert.ok(messages.some((m) => m.content.includes('CURRENT_SECTION_BLOCKS')));
    assert.ok(messages.some((m) => m.content.includes('Make this section shorter')));
    assert.ok(messages.some((m) => m.content.includes('not fact extraction')));
  });

  await run('edit messages preserve TBC hierarchy', () => {
    const memory = consultingMemory();
    const ctx = withActivePacks(createEmptyProjectContext(), memory);
    const editCtx = buildSectionEditContext({
      projectId: '00000000-0000-0000-0000-000000000001',
      documentKey: 'unit-test',
      sectionId: 'background',
      memory,
      projectContext: ctx,
      currentSection: [{ type: 'heading', level: 1, text: 'Background' }],
      currentVersion: 1,
      readinessAtGeneration: 'DRAFTABLE_WITH_TBC',
      editInstruction: 'Improve tone only.',
    });
    assert.ok(editCtx.tbcFields.some((f) => f.fieldId === 'painPoints'));
    const userMsg = buildEditMessages(editCtx).find((m) => m.role === 'user')!;
    assert.ok(userMsg.content.includes('painPoints'));
  });

  await run('API route file exists and uses aiEditRfpSection', () => {
    const src = readFileSync(
      join(root, 'src/app/api/rami/generation/ai-edit/route.ts'),
      'utf8',
    );
    assert.match(src, /aiEditRfpSection/);
    assert.match(src, /editInstruction/);
    assert.doesNotMatch(src, /\/api\/rami\/chat/);
  });

  await run('UI exposes Edit with Rami without routing to chat', () => {
    const panel = readFileSync(join(root, 'src/components/rfp/RfpDocumentPanel.tsx'), 'utf8');
    const hook = readFileSync(join(root, 'src/hooks/useRfpDocument.ts'), 'utf8');
    assert.match(panel, /Edit with Rami/);
    assert.match(panel, /doc\.aiEdit/);
    assert.match(hook, /\/api\/rami\/generation\/ai-edit/);
    assert.doesNotMatch(panel, /\/api\/rami\/chat/);
    assert.doesNotMatch(hook, /\/api\/rami\/chat/);
  });

  await run('SectionProgress is compact strip without duplicate section list', () => {
    const src = readFileSync(join(root, 'src/components/rfp/SectionProgress.tsx'), 'utf8');
    assert.doesNotMatch(src, /isExpanded/);
    assert.doesNotMatch(src, /applicableSections\.map/);
    assert.match(src, /approved/);
  });

  if (!isDatabaseConfigured()) {
    console.log('\n(Skipping PostgreSQL AI-edit persistence tests — DB not configured)\n');
  } else {
    const docKey = `rami-ai-edit-${randomUUID().slice(0, 8)}`;

    await run('AI edit creates new version; previous retained', async () => {
      clearAllSessionCache();
      const session = await getOrHydrateSession(docKey, docKey);
      session.memory = consultingMemory();
      session.projectContext = withActivePacks(createEmptyProjectContext(), session.memory);
      await persistRuntimeState(session);

      const genMock = mockProvider({
        blocks: [
          { type: 'heading', level: 1, text: 'Background and Business Need' },
          { type: 'paragraph', text: 'Original long draft content for testing.' },
        ],
      });
      await generateRfpSection({
        documentKey: docKey,
        sectionId: 'background',
        provider: genMock,
      });

      const before = await getCurrentSectionContent(
        (await findProjectByDocumentKey(docKey))!.project_id,
        'background',
      );
      assert.equal(before!.version, 1);

      const editMock = mockProvider({
        blocks: [
          { type: 'heading', level: 1, text: 'Background and Business Need' },
          { type: 'paragraph', text: 'Shorter revised draft.' },
        ],
      });
      const result = await aiEditRfpSection({
        documentKey: docKey,
        sectionId: 'background',
        editInstruction: 'Make this section shorter.',
        provider: editMock,
      });
      assert.equal(result.content.version, 2);
      assert.match(result.generated.modelUsed, /ai-edit/);

      const project = await findProjectByDocumentKey(docKey)!;
      const history = await listSectionContentHistory(project.project_id, 'background');
      assert.equal(history.length, 2);
      assert.ok(history.some((h) => h.version === 1));
      assert.ok(history.some((h) => h.version === 2 && h.is_current));
    });

    await run('ProjectFacts unchanged after AI edit', async () => {
      const project = await findProjectByDocumentKey(docKey)!;
      const facts = await listProjectFacts(project.project_id);
      const session = await hydrateProject(docKey);
      const readinessBefore = getSectionReadiness(
        session.memory,
        'background',
        session.projectContext,
      );
      assert.ok(facts.length > 0);
      assert.ok(readinessBefore.tbcFields.includes('painPoints'));
    });

    await run('approved protection blocks AI edit without reopen', async () => {
      await approveRfpSection({ documentKey: docKey, sectionId: 'background' });
      await assert.rejects(
        () =>
          aiEditRfpSection({
            documentKey: docKey,
            sectionId: 'background',
            editInstruction: 'Try silent edit.',
            provider: mockProvider({
              blocks: [{ type: 'heading', level: 1, text: 'X' }],
            }),
          }),
        (e: unknown) =>
          e instanceof GenerationError && e.code === 'APPROVED_CONTENT_PROTECTED',
      );
    });

    await run('AI edit with reopenApproved creates new draft from approved', async () => {
      const editMock = mockProvider({
        blocks: [
          { type: 'heading', level: 1, text: 'Background and Business Need' },
          { type: 'paragraph', text: 'Reopened AI-edited draft.' },
        ],
      });
      const result = await aiEditRfpSection({
        documentKey: docKey,
        sectionId: 'background',
        editInstruction: 'Shorten after reopen.',
        reopenApproved: true,
        provider: editMock,
      });
      assert.equal(result.generated.approvalStatus, 'DRAFT');
      assert.ok(result.content.version >= 3);
    });

    await run('failed AI edit does not create partial version', async () => {
      const project = await findProjectByDocumentKey(docKey)!;
      const beforeVersion = (await getCurrentSectionContent(project.project_id, 'background'))!
        .version;
      await assert.rejects(
        () =>
          aiEditRfpSection({
            documentKey: docKey,
            sectionId: 'background',
            editInstruction: 'This should fail.',
            provider: mockProvider(null, true),
          }),
        () => true,
      );
      const afterVersion = (await getCurrentSectionContent(project.project_id, 'background'))!
        .version;
      assert.equal(afterVersion, beforeVersion);
    });
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await closePool();
  process.exit(failed > 0 ? 1 : 0);
}

void main();
