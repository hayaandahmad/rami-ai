#!/usr/bin/env npx tsx
/**
 * Import historical RFP Excel answers into PostgreSQL (idempotent upsert).
 * Does not write ProjectFacts / messages / section contents.
 */
import { spawnSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { isDatabaseConfigured } from '../src/server/db/config';
import {
  countLiveProjectTables,
  countHistoricalTables,
  upsertHistoricalImport,
  type HistoricalImportPayloadAnswer,
  type HistoricalImportPayloadDoc,
} from '../src/server/rami/historicalRepository';

function extractPayload(root: string): string {
  const script = join(process.cwd(), 'scripts', 'extract-historical-workbooks.py');
  const py = process.env.RAMI_PYTHON || 'python';
  const r = spawnSync(py, [script, root], {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
  });
  if (r.status !== 0) {
    throw new Error(
      `extract-historical-workbooks failed: ${r.stderr || r.stdout || r.error}`,
    );
  }
  const outPath = join(root, 'derived', 'import-payload.json');
  if (!existsSync(outPath)) {
    throw new Error(`Missing payload at ${outPath}. stdout=${r.stdout}`);
  }
  console.log(r.stdout.trim());
  return outPath;
}

async function main() {
  loadLocalEnv();
  if (!isDatabaseConfigured()) {
    console.error('FAIL: PostgreSQL not configured');
    process.exit(1);
  }

  const root = join(process.cwd(), 'resources', 'historical-rfps');
  const beforeLive = await countLiveProjectTables();
  console.log('live tables before', beforeLive);

  const payloadPath = extractPayload(root);
  const payload = JSON.parse(readFileSync(payloadPath, 'utf8')) as {
    ok: boolean;
    errors: string[];
    documents: HistoricalImportPayloadDoc[];
    answers: HistoricalImportPayloadAnswer[];
  };
  if (!payload.ok) {
    console.error('Extract errors:', payload.errors);
    process.exit(1);
  }

  const result = await upsertHistoricalImport({
    documents: payload.documents,
    answers: payload.answers,
  });
  const hist = await countHistoricalTables();
  const afterLive = await countLiveProjectTables();

  console.log('upserted', result);
  console.log('historical counts', hist);
  console.log('live tables after', afterLive);

  for (const k of Object.keys(beforeLive)) {
    if (beforeLive[k] !== afterLive[k]) {
      console.error(`BOUNDARY VIOLATION: ${k} changed ${beforeLive[k]} → ${afterLive[k]}`);
      process.exit(1);
    }
  }
  console.log('ProjectFacts / live project tables unchanged ✓');
  await closePool();
}

main().catch(async (e) => {
  console.error(e);
  await closePool().catch(() => undefined);
  process.exit(1);
});
