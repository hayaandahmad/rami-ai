#!/usr/bin/env npx tsx
/**
 * Restore the committed shared development snapshot into local rami_ai.
 *
 *   npm run db:restore-shared -- --confirm-replace-local-rami-ai
 *
 * Refuses remote/non-loopback hosts. Password comes only from .env.local.
 * Does not replace a production backup workflow (.rami-db-backups/).
 */
import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { getDatabaseUrlForName, isDatabaseConfigured } from '../src/server/db/config';
import { closePool, checkDatabase } from '../src/server/db/connection';
import { resolvePgTool } from '../src/server/db/pgTools';
import {
  assertLocalSharedDevTarget,
  getConfiguredDatabaseHost,
  getConfiguredDatabasePort,
} from '../src/server/db/localSafety';
import { ensureDatabaseExists } from '../src/server/db/databaseAdmin';
import { countStaticDefinitions } from '../src/server/repositories/StaticDefinitionRepository';
import {
  getSharedDumpPath,
  SHARED_DEV_DATABASE_NAME,
} from '../src/server/db/sharedSnapshot';

async function main() {
  loadLocalEnv();
  if (!isDatabaseConfigured()) {
    console.error('FAIL: PostgreSQL is not configured. Copy .env.example → .env.local and set RAMI_DB_*.');
    process.exit(1);
  }
  try {
    assertLocalSharedDevTarget('db:restore-shared');
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const dump = getSharedDumpPath();
  if (!existsSync(dump)) {
    console.error(`FAIL: shared snapshot not found at ${dump}`);
    process.exit(1);
  }

  if (!process.argv.includes('--confirm-replace-local-rami-ai')) {
    console.error(
      `This REPLACES local database '${SHARED_DEV_DATABASE_NAME}' on ` +
        `${getConfiguredDatabaseHost()}:${getConfiguredDatabasePort()} ` +
        `with ${dump}.\n` +
        'Pass --confirm-replace-local-rami-ai to continue.\n' +
        'Remote/production hosts are refused. Private backups remain npm run db:backup → .rami-db-backups/.',
    );
    process.exit(1);
  }

  const created = await ensureDatabaseExists(SHARED_DEV_DATABASE_NAME);
  if (created === 'created') {
    console.log(`Created empty database ${SHARED_DEV_DATABASE_NAME}.`);
  }

  const pgRestore = resolvePgTool('pg_restore');
  const result = spawnSync(
    pgRestore,
    [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges',
      '-d',
      getDatabaseUrlForName(SHARED_DEV_DATABASE_NAME),
      dump,
    ],
    { stdio: 'inherit', shell: false },
  );
  if (result.status !== 0) {
    console.error(`pg_restore failed (${pgRestore}).`);
    process.exit(result.status ?? 1);
  }

  console.log(`Restore complete into local ${SHARED_DEV_DATABASE_NAME}.`);

  const health = await checkDatabase();
  console.log(`Health: ${health.ok ? 'OK' : 'FAIL'} (${health.detail})`);
  if (!health.ok) process.exit(1);
  const counts = await countStaticDefinitions();
  console.log('Static definitions:', counts);
  await closePool();
}

main().catch(async (err) => {
  console.error(err);
  await closePool().catch(() => undefined);
  process.exit(1);
});
