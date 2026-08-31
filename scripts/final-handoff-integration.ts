#!/usr/bin/env npx tsx
/**
 * Final handoff â€” live PostgreSQL integration checks (manual edit, restore, facts safety).
 * Uses disposable temp projects only; cleans up before exit.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
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
} from '../src/server/rami/sectionGeneration';
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
import { deleteWorkspaceProject } from '../src/server/rami/workspaceService';

class MockProvider implements RamiModelProvider {
  readonly providerType = 'mock-handoff';
  async complete() {
    return { text: '', durationMs: 1, modelUsed: 'mock-handoff' };
  }
  async *completeStream() {
    yield '';
  }
  async extractStructured<T>() {
    return {
      data: {
        blocks: [
          { type: 'heading', level: 2, text: 'Introduction' },
          { type: 'paragraph', text: 'Original generated paragraph for handoff test.' },
          { type: 'tbc', label: '[To be confirmed] Pain points', fieldId: 'painPoints' },
        ],
      } as T,
      durationMs: 1,
      modelUsed: 'mock-handoff',
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
    { fieldId: 'documentTitle', value: 'Handoff integration test', confidence: 'high' },
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

async function seed(documentKey: string) {
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
  if (!isDatabaseConfigured()) {
    console.error('FAIL: PostgreSQL not configured');
    process.exit(1);
  }

  clearAllSessionCache();
  const documentKey = `rfp-final-handoff-${randomUUID().slice(0, 8)}`;
  console.log(`\n=== Final handoff DB integration (${documentKey}) ===\n`);

  try {
    await seed(documentKey);
    const project = await findProjectByDocumentKey(documentKey);
    assert.ok(project);

    const factsBefore = await listProjectFacts(project.project_id);
    const readinessBefore = await getSectionReadiness(documentKey);
    const v1 = await getCurrentSectionContent(project.project_id, 'introduction');
    assert.ok(v1);
    const versionBefore = v1.version;

    const editedBlocks = v1.content_json.blocks.map((b) =>
      b.type === 'paragraph' ? { ...b, text: 'BA manual edit during final handoff.' } : b,
    );
    await editRfpSection({ documentKey, sectionId: 'introduction', blocks: editedBlocks });

    const v2row = await getCurrentSectionContent(project.project_id, 'introduction');
    assert.ok(v2row);
    assert.equal(v2row.version, versionBefore + 1);

    const history = await listSectionContentHistory(project.project_id, 'introduction');
    assert.equal(history.length, 2);
    assert.equal(history.find((h) => h.version === versionBefore)?.is_current, false);

    const factsAfterEdit = await listProjectFacts(project.project_id);
    assert.equal(JSON.stringify(factsAfterEdit), JSON.stringify(factsBefore));
    const readinessAfterEdit = await getSectionReadiness(documentKey);
    assert.equal(JSON.stringify(readinessAfterEdit), JSON.stringify(readinessBefore));

    const tbc = v2row.content_json.blocks.find((b) => b.type === 'tbc');
    assert.ok(tbc && tbc.type === 'tbc' && tbc.fieldId === 'painPoints');

    const v1blocks = history.find((h) => h.version === versionBefore)!.content_json.blocks;
    await editRfpSection({
      documentKey,
      sectionId: 'introduction',
      blocks: v1blocks,
      versionLabel: `restored-from-v${versionBefore}`,
    });
    const v3 = await getCurrentSectionContent(project.project_id, 'introduction');
    assert.ok(v3);
    assert.equal(v3.version, versionBefore + 2);
    assert.match(v3.model_used ?? '', /restored-from-v/);

    console.log('  ✓ manual edit creates new version');
    console.log('  ✓ facts unchanged');
    console.log('  ✓ readiness unchanged');
    console.log('  ✓ TBC preserved');
    console.log('  ✓ restore creates new version');
    console.log('\nFINAL_HANDOFF_DB: PASS\n');
  } finally {
    await deleteWorkspaceProject(documentKey);
    await closePool();
  }
}

main().catch(async (err) => {
  console.error(err);
  await closePool().catch(() => undefined);
  process.exit(1);
});
