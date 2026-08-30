#!/usr/bin/env npx tsx
/**
 * Prove the committed shared dump restores, without touching live rami_ai.
 *
 * Restores into rami_ai_shared_restore_test, checks counts, then drops that DB.
 */
import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { Client } from 'pg';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { getDatabaseUrlForName, getSslEnabled, isDatabaseConfigured } from '../src/server/db/config';
import { closePool, query } from '../src/server/db/connection';
import { resolvePgTool } from '../src/server/db/pgTools';
import { assertLocalSharedDevTarget } from '../src/server/db/localSafety';
import { dropDatabaseIfExists, ensureDatabaseExists } from '../src/server/db/databaseAdmin';
import {
  getSharedDumpPath,
  SHARED_DUMP_REQUIRED_TABLES,
  SHARED_RESTORE_TEST_DATABASE_NAME,
} from '../src/server/db/sharedSnapshot';

type Counts = Record<string, number>;

async function readTableCounts(
  run: (sql: string) => Promise<{ rows: Array<{ n: string }> }>,
): Promise<Counts> {
  const out: Counts = {};
  for (const table of SHARED_DUMP_REQUIRED_TABLES) {
    const r = await run(`SELECT COUNT(*)::text AS n FROM ${table}`);
    out[table] = Number(r.rows[0]?.n ?? 0);
  }
  return out;
}

async function liveTableCounts(): Promise<Counts> {
  return readTableCounts((sql) => query<{ n: string }>(sql));
}

async function liveProjectKeys(): Promise<string[]> {
  const r = await query<{ document_key: string }>(
    'SELECT document_key FROM projects ORDER BY document_key',
  );
  return r.rows.map((row) => row.document_key);
}

async function restoredSnapshot(databaseName: string): Promise<{
  counts: Counts;
  projectKeys: string[];
  userEmails: string[];
  migrations: string[];
}> {
  const client = new Client({
    connectionString: getDatabaseUrlForName(databaseName),
    ssl: getSslEnabled() ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  try {
    const counts = await readTableCounts((sql) => client.query<{ n: string }>(sql));
    const projects = await client.query<{ document_key: string }>(
      'SELECT document_key FROM projects ORDER BY document_key',
    );
    const users = await client.query<{ email: string }>('SELECT email FROM users ORDER BY email');
    const migrations = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY version',
    );
    return {
      counts,
      projectKeys: projects.rows.map((row) => row.document_key),
      userEmails: users.rows.map((row) => row.email),
      migrations: migrations.rows.map((row) => row.version),
    };
  } finally {
    await client.end();
  }
}

function countDiffs(a: Counts, b: Counts): string[] {
  const diffs: string[] = [];
  for (const t of SHARED_DUMP_REQUIRED_TABLES) {
    if (a[t] !== b[t]) diffs.push(`${t}: live=${a[t]} restored=${b[t]}`);
  }
  return diffs;
}

async function main() {
  loadLocalEnv();
  if (!isDatabaseConfigured()) {
    console.error('FAIL: PostgreSQL is not configured.');
    process.exit(1);
  }
  try {
    assertLocalSharedDevTarget('db:verify-shared-restore');
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const dump = getSharedDumpPath();
  if (!existsSync(dump)) {
    console.error(`FAIL: dump missing at ${dump}`);
    process.exit(1);
  }

  const liveBefore = await liveTableCounts();
  const liveKeysBefore = await liveProjectKeys();

  await dropDatabaseIfExists(SHARED_RESTORE_TEST_DATABASE_NAME);
  await ensureDatabaseExists(SHARED_RESTORE_TEST_DATABASE_NAME);

  const pgRestore = resolvePgTool('pg_restore');
  const result = spawnSync(
    pgRestore,
    [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges',
      '-d',
      getDatabaseUrlForName(SHARED_RESTORE_TEST_DATABASE_NAME),
      dump,
    ],
    { stdio: 'inherit', shell: false },
  );
  if (result.status !== 0) {
    console.error(`pg_restore into ${SHARED_RESTORE_TEST_DATABASE_NAME} failed.`);
    await dropDatabaseIfExists(SHARED_RESTORE_TEST_DATABASE_NAME).catch(() => undefined);
    process.exit(result.status ?? 1);
  }

  const restored = await restoredSnapshot(SHARED_RESTORE_TEST_DATABASE_NAME);
  const diffs = countDiffs(liveBefore, restored.counts);

  const liveAfter = await liveTableCounts();
  const liveKeysAfter = await liveProjectKeys();
  const liveUntouched =
    countDiffs(liveBefore, liveAfter).length === 0 &&
    liveKeysBefore.join(',') === liveKeysAfter.join(',');

  await dropDatabaseIfExists(SHARED_RESTORE_TEST_DATABASE_NAME);
  await closePool();

  console.log('Live counts (untouched rami_ai):', liveBefore);
  console.log('Restored counts (test DB):', restored.counts);
  console.log('Project keys restored:', restored.projectKeys.join(', ') || '(none)');
  console.log('Users restored:', restored.userEmails.join(', ') || '(none)');
  console.log('Migrations restored:', restored.migrations.join(', ') || '(none)');

  if (diffs.length) {
    console.error('FAIL: restored counts differ from live:', diffs.join('; '));
    process.exit(1);
  }
  if (restored.projectKeys.join(',') !== liveKeysBefore.join(',')) {
    console.error(
      `FAIL: project keys differ. live=${liveKeysBefore.join(',')} restored=${restored.projectKeys.join(',')}`,
    );
    process.exit(1);
  }
  if (!liveUntouched) {
    console.error('FAIL: live rami_ai counts changed during the restore test.');
    process.exit(1);
  }
  if (!restored.projectKeys.includes('rami-persist-accept-20260830')) {
    console.error('FAIL: expected acceptance project missing from snapshot.');
    process.exit(1);
  }
  if (!restored.userEmails.includes('rami@local')) {
    console.error('FAIL: expected system user missing from snapshot.');
    process.exit(1);
  }

  console.log('Live rami_ai unchanged: yes');
  console.log('Temporary test DB dropped: yes');
  console.log('✅ Shared snapshot restore verification passed.');
}

main().catch(async (err) => {
  console.error(err);
  try {
    await dropDatabaseIfExists(SHARED_RESTORE_TEST_DATABASE_NAME);
  } catch {
    /* ignore */
  }
  await closePool().catch(() => undefined);
  process.exit(1);
});
