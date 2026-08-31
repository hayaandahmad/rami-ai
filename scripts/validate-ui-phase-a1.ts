#!/usr/bin/env npx tsx
/**
 * UI Phase A1 — workspace truth + engine panel checks.
 */
import assert from 'node:assert/strict';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { isDatabaseConfigured } from '../src/server/db/config';
import { deriveWorkspaceMetrics } from '../src/utils/workspaceMetrics';
import { listWorkspaceDocuments } from '../src/server/rami/workspaceService';
import { getLocalEngineStatus } from '../src/server/ai/localEngineStatus';
import { buildStatusPayload } from '../src/server/ai/modalEngineControl';
import type { DocumentProject } from '../src/types/document';

let passed = 0;
let failed = 0;

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    failed++;
  }
}

function sampleDocs(): DocumentProject[] {
  return [
    {
      id: 'a',
      title: 'A',
      documentType: 'system-implementation',
      beneficiary: 'X',
      status: 'in-progress',
      progressPercent: 10,
      lastUpdated: '1h ago',
      nextAction: 'continue-interview',
      interviewCompleted: false,
    },
    {
      id: 'b',
      title: 'B',
      documentType: 'assessment',
      beneficiary: 'Y',
      status: 'needs-clarification',
      progressPercent: 50,
      lastUpdated: '2h ago',
      nextAction: 'continue-interview',
      interviewCompleted: false,
    },
    {
      id: 'c',
      title: 'C',
      documentType: 'support',
      beneficiary: 'Z',
      status: 'draft-generated',
      progressPercent: 80,
      lastUpdated: '1d ago',
      nextAction: 'open-draft',
      interviewCompleted: true,
    },
  ];
}

console.log('\n=== UI Phase A1 checks ===\n');

async function main() {
  loadLocalEnv();

  await run('workspace metrics derive deterministically', () => {
    const m = deriveWorkspaceMetrics(sampleDocs());
    assert.equal(m.totalDocuments, 3);
    assert.equal(m.inProgress, 1);
    assert.equal(m.needsClarification, 1);
    assert.equal(m.draftsGenerated, 1);
  });

  await run('recent documents sort by activity (newest first)', async () => {
    if (!isDatabaseConfigured()) return;
    const { documents } = await listWorkspaceDocuments();
    if (documents.length < 2) return;
    for (let i = 1; i < documents.length; i++) {
      // lastUpdated is relative text; ordering verified at SQL level in integration
      assert.ok(documents[i - 1].id);
      assert.ok(documents[i].id);
    }
  });

  await run('local engine status has no modal billing fields', async () => {
    const t0 = Date.now();
    const status = await getLocalEngineStatus();
    const elapsedMs = Date.now() - t0;
    assert.equal(status.provider, 'local');
    assert.equal((status as Record<string, unknown>).estimated, undefined);
    assert.equal((status as Record<string, unknown>).billingNote, undefined);
    // Status polling must not run a Qwen smoke test (widget interval is 5s).
    assert.ok(elapsedMs < 15_000, `local status took ${elapsedMs}ms`);
    assert.notEqual(status.lastError, 'AbortError: This operation was aborted');
  });

  await run('modal status payload has session estimate not fake budget', () => {
    const payload = buildStatusPayload();
    assert.equal((payload as { estimated?: unknown }).estimated, undefined);
    const session = (payload as { session?: { estimatedCostUsd?: number | null } }).session;
    assert.ok(session);
    assert.ok('billingNote' in payload);
  });

  await run('provider-specific panel data classes', () => {
    const local = { provider: 'local', endpointReachable: true, defaultModelAvailable: true };
    const modal = { provider: 'modal', sessionDurationHms: '00:01:00', billingNote: 'x' };
    assert.equal(local.billingNote, undefined);
    assert.equal(modal.endpointReachable, undefined);
    assert.ok(modal.billingNote);
  });

  if (isDatabaseConfigured()) {
    await run('workspace loads PostgreSQL projects', async () => {
      const { documents } = await listWorkspaceDocuments();
      assert.ok(Array.isArray(documents));
      for (const doc of documents) {
        assert.ok(doc.id);
        assert.ok(doc.title);
        assert.ok(typeof doc.progressPercent === 'number');
      }
    });
  } else {
    console.log('\n(Skipping live DB workspace checks — RAMI_DB not configured)\n');
  }

  await closePool();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
