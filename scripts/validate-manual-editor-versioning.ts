#!/usr/bin/env npx tsx
/**
 * Phase 5 — manual editor versioning + ProjectFacts safety.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { isDatabaseConfigured } from '../src/server/db/config';
import { createEmptyProjectMemory } from '../src/types/projectMemory';
import { createEmptyProjectContext } from '../src/types/projectContext';
import { applyExtractedFacts } from '../src/server/rami/memoryUpdater';
import { withActivePacks } from '../src/server/rami/questionPackEngine';
import {
  editRfpSection,
  generateRfpSection,
  approveRfpSection,
} from '../src/server/rami/sectionGeneration';
import { GenerationError } from '../src/types/generatedSection';
import type { RamiModelProvider, ChatMessage } from '../src/server/ai/RamiModelProvider';
import { clearAllSessionCache } from '../src/server/rami/sessionStore';
import {
  getOrHydrateSession,
  persistRuntimeState,
} from '../src/server/rami/projectPersistence';
import {
  getCurrentSectionContent,
  listSectionContentHistory,
} from '../src/server/repositories/ProjectSectionContentRepository';
import { findProjectByDocumentKey } from '../src/server/repositories/ProjectRepository';
import { listProjectFacts } from '../src/server/repositories/ProjectFactsRepository';
import { getSectionReadiness } from '../src/server/rami/sectionReadiness';
import { validateGeneratedBlocks } from '../src/components/rfp/ManualBlockEditor';

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

class MockProvider implements RamiModelProvider {
  readonly providerType = 'mock-provider';
  async complete() {
    return { text: '', durationMs: 1, modelUsed: 'mock-provider' };
  }
  async *completeStream() {
    yield '';
  }
  async extractStructured<T>() {
    return {
      data: {
        blocks: [
          { type: 'heading', level: 2, text: 'Introduction' },
          { type: 'paragraph', text: 'Generated paragraph.' },
          { type: 'tbc', label: '[To be confirmed] Pain points', fieldId: 'painPoints' },
        ],
      } as T,
      durationMs: 1,
      modelUsed: 'mock-provider',
    };
  }
  async embed() {
    return [0];
  }
  async healthCheck() {
    return {
      providerType: 'mock-provider',
      endpointReachable: true,
      defaultModelAvailable: true,
      lightweightModelAvailable: true,
      models: [],
      smokeTestPassed: true,
      checkedAt: new Date().toISOString(),
    };
  }}

function consultingMemory() {
  const memory = createEmptyProjectMemory();
  applyExtractedFacts(memory, [
    { fieldId: 'documentType', value: 'assessment', confidence: 'high' },
    { fieldId: 'engagementType', value: 'consulting', confidence: 'high' },
    { fieldId: 'documentTitle', value: 'Manual Edit Test RFP', confidence: 'high' },
    { fieldId: 'beneficiaryEntity', value: 'Test Ministry', confidence: 'high' },
    { fieldId: 'currentSituation', value: 'Fragmented portals.', confidence: 'high' },
    { fieldId: 'businessNeedRationale', value: 'Need assessment.', confidence: 'high' },
    { fieldId: 'businessObjectives', value: ['Assess maturity'], confidence: 'high' },
    { fieldId: 'painPoints', value: 'TBC', confidence: 'high' },
    { fieldId: 'inScope', value: ['Assessment'], confidence: 'high' },
    { fieldId: 'outOfScope', value: ['Implementation'], confidence: 'high' },
  ]);
  return memory;
}

async function seedTestProject(documentKey: string) {
  const memory = consultingMemory();
  const session = await getOrHydrateSession(documentKey, documentKey);
  session.memory = memory;
  session.projectContext = withActivePacks(createEmptyProjectContext(), memory);
  await persistRuntimeState(session);
  await generateRfpSection({
    documentKey,
    sectionId: 'introduction',
    provider: new MockProvider(),
  });
}

async function main() {
  loadLocalEnv();
  console.log('\n=== Manual editor versioning checks ===\n');

  await run('ManualBlockEditor component exposes structured editor + Advanced JSON', () => {
    const src = readFileSync(join(root, 'src/components/rfp/ManualBlockEditor.tsx'), 'utf8');
    assert.match(src, /Advanced JSON/);
    assert.match(src, /TBC — protected/);
    assert.match(src, /validateGeneratedBlocks/);
  });

  await run('RfpDocumentPanel uses ManualBlockEditor instead of raw JSON primary editor', () => {
    const src = readFileSync(join(root, 'src/components/rfp/RfpDocumentPanel.tsx'), 'utf8');
    assert.match(src, /ManualBlockEditor/);
    assert.match(src, /SectionVersionHistory/);
  });

  await run('validateGeneratedBlocks rejects invalid structures', () => {
    assert.throws(() => validateGeneratedBlocks([{ type: 'paragraph' }]));
    const blocks = validateGeneratedBlocks([
      { type: 'paragraph', text: 'Hello' },
      { type: 'tbc', label: 'TBC item', fieldId: 'painPoints' },
    ]);
    assert.equal(blocks.length, 2);
  });

  await run('manual save creates new version without changing ProjectFacts (DB)', async () => {
    if (!isDatabaseConfigured()) {
      console.log('    (skipped — DB not configured)');
      return;
    }
    clearAllSessionCache();
    const documentKey = `rfp-phase5-manual-${randomUUID().slice(0, 8)}`;
    await seedTestProject(documentKey);
    const project = await findProjectByDocumentKey(documentKey);
    assert.ok(project);
    const factsBefore = await listProjectFacts(project.project_id);
    const readinessBefore = await getSectionReadiness(documentKey);

    const current = await getCurrentSectionContent(project.project_id, 'introduction');
    assert.ok(current);
    const blocks = current.content_json.blocks.map((b) =>
      b.type === 'paragraph' ? { ...b, text: 'BA edited paragraph.' } : b,
    );

    await editRfpSection({ documentKey, sectionId: 'introduction', blocks });

    const history = await listSectionContentHistory(project.project_id, 'introduction');
    assert.equal(history.length, 2);
    assert.equal(history[0].version, 2);
    assert.match(history[0].model_used ?? '', /\+manual-edit/);

    const factsAfter = await listProjectFacts(project.project_id);
    assert.equal(JSON.stringify(factsAfter), JSON.stringify(factsBefore));

    const readinessAfter = await getSectionReadiness(documentKey);
    assert.equal(JSON.stringify(readinessAfter), JSON.stringify(readinessBefore));

    const tbcBlock = history[0].content_json.blocks.find((b) => b.type === 'tbc');
    assert.ok(tbcBlock && tbcBlock.type === 'tbc');
  });

  await run('approved section manual edit requires reopenApproved', async () => {
    if (!isDatabaseConfigured()) return;
    const documentKey = `rfp-phase5-approve-${randomUUID().slice(0, 8)}`;
    await seedTestProject(documentKey);
    await approveRfpSection({ documentKey, sectionId: 'introduction' });

    await assert.rejects(
      () =>
        editRfpSection({
          documentKey,
          sectionId: 'introduction',
          blocks: [{ type: 'paragraph', text: 'Nope' }],
        }),
      (err: unknown) =>
        err instanceof GenerationError && err.code === 'APPROVED_CONTENT_PROTECTED',
    );

    await editRfpSection({
      documentKey,
      sectionId: 'introduction',
      blocks: [
        { type: 'paragraph', text: 'Reopened edit' },
        { type: 'tbc', label: 'TBC', fieldId: 'painPoints' },
      ],
      reopenApproved: true,
    });
    const project = await findProjectByDocumentKey(documentKey);
    const current = await getCurrentSectionContent(project!.project_id, 'introduction');
    assert.equal(current?.approval_status, 'DRAFT');
  });

  await run('restore creates new version with restored-from label', async () => {
    if (!isDatabaseConfigured()) return;
    const documentKey = `rfp-phase5-restore-${randomUUID().slice(0, 8)}`;
    await seedTestProject(documentKey);
    const project = await findProjectByDocumentKey(documentKey);
    const v1 = await getCurrentSectionContent(project!.project_id, 'introduction');
    await editRfpSection({
      documentKey,
      sectionId: 'introduction',
      blocks: v1!.content_json.blocks.map((b) =>
        b.type === 'paragraph' ? { ...b, text: 'Version 2 text' } : b,
      ),
    });
    await editRfpSection({
      documentKey,
      sectionId: 'introduction',
      blocks: v1!.content_json.blocks,
      versionLabel: 'restored-from-v1',
    });
    const history = await listSectionContentHistory(project!.project_id, 'introduction');
    assert.equal(history[0].version, 3);
    assert.match(history[0].model_used ?? '', /restored-from-v1/);
    assert.equal(history[1].version, 2);
    assert.equal(history[2].version, 1);
  });

  if (isDatabaseConfigured()) {
    await closePool();
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
