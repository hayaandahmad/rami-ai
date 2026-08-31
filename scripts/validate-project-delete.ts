#!/usr/bin/env npx tsx
/**
 * Phase 5 — project deletion via existing FK cascades.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool, query } from '../src/server/db/connection';
import { isDatabaseConfigured } from '../src/server/db/config';
import { createWorkspaceProject, deleteWorkspaceProject } from '../src/server/rami/workspaceService';
import { findProjectByDocumentKey } from '../src/server/repositories/ProjectRepository';
import { getSession } from '../src/server/rami/sessionStore';
import { applyExtractedFacts } from '../src/server/rami/memoryUpdater';
import { getOrHydrateSession, persistRuntimeState } from '../src/server/rami/projectPersistence';
import { createEmptyProjectMemory } from '../src/types/projectMemory';
import { insertMessage } from '../src/server/repositories/MessageRepository';

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

async function main() {
  loadLocalEnv();
  console.log('\n=== Project delete checks ===\n');

  await run('DELETE API route exists for documentKey', () => {
    const src = readFileSync(
      join(root, 'src/app/api/rami/projects/[documentKey]/route.ts'),
      'utf8',
    );
    assert.match(src, /export async function DELETE/);
    assert.match(src, /deleteWorkspaceProject/);
  });

  await run('DocumentCard has kebab menu and delete confirmation', () => {
    const src = readFileSync(join(root, 'src/components/workspace/DocumentCard.tsx'), 'utf8');
    assert.match(src, /MoreVertical/);
    assert.match(src, /Delete RFP/);
    assert.match(src, /permanently deletes this RFP/);
    assert.match(src, /REMOVE_DOCUMENT/);
  });

  await run('delete removes project and owned rows (controlled test project)', async () => {
    if (!isDatabaseConfigured()) {
      console.log('    (skipped — DB not configured)');
      return;
    }

    const { documentKey, project } = await createWorkspaceProject({
      documentType: 'assessment',
      title: `Phase5 Delete Test ${randomUUID().slice(0, 6)}`,
    });

    const session = await getOrHydrateSession(documentKey, documentKey);
    const memory = createEmptyProjectMemory();
    applyExtractedFacts(memory, [
      { fieldId: 'documentTitle', value: 'Delete test', confidence: 'high' },
    ]);
    session.memory = memory;
    await persistRuntimeState(session);

    await insertMessage(
      project.project_id,
      {
        id: randomUUID(),
        role: 'user',
        content: 'delete test message',
        createdAt: new Date().toISOString(),
      },
      1,
      null,
    );

    assert.ok(getSession(documentKey));

    const deleted = await deleteWorkspaceProject(documentKey);
    assert.equal(deleted, true);
    assert.equal(await findProjectByDocumentKey(documentKey), null);
    assert.equal(getSession(documentKey), undefined);

    const msg = await query(`SELECT 1 FROM messages WHERE project_id = $1 LIMIT 1`, [
      project.project_id,
    ]);
    assert.equal(msg.rowCount, 0);

    const facts = await query(`SELECT 1 FROM project_facts WHERE project_id = $1 LIMIT 1`, [
      project.project_id,
    ]);
    assert.equal(facts.rowCount, 0);
  });

  await run('delete unknown project returns false / 404 contract', async () => {
    if (!isDatabaseConfigured()) return;
    const missing = `rfp-missing-${randomUUID()}`;
    const deleted = await deleteWorkspaceProject(missing);
    assert.equal(deleted, false);
  });

  if (isDatabaseConfigured()) {
    await closePool();
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
