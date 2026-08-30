#!/usr/bin/env npx tsx
/**
 * Write the committed shared development snapshot (custom-format pg_dump).
 * Local rami_ai only. Not a production backup.
 *
 *   npm run db:dump-shared -- --write-repo-snapshot
 */
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { spawnSync } from 'child_process';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { getDatabaseUrl, isDatabaseConfigured } from '../src/server/db/config';
import { resolvePgTool } from '../src/server/db/pgTools';
import { assertLocalSharedDevTarget } from '../src/server/db/localSafety';
import { getSharedDumpPath, SHARED_DEV_DATABASE_NAME } from '../src/server/db/sharedSnapshot';

async function main() {
  loadLocalEnv();
  if (!isDatabaseConfigured()) {
    console.error('FAIL: PostgreSQL is not configured.');
    process.exit(1);
  }
  if (!process.argv.includes('--write-repo-snapshot')) {
    console.error(
      `This overwrites ${getSharedDumpPath()} with a dump of local ${SHARED_DEV_DATABASE_NAME}.\n` +
        'Pass --write-repo-snapshot to continue.\n' +
        'Do not use this as a production backup; private dumps stay in .rami-db-backups/ (gitignored).',
    );
    process.exit(1);
  }
  try {
    assertLocalSharedDevTarget('db:dump-shared');
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const file = getSharedDumpPath();
  mkdirSync(dirname(file), { recursive: true });
  const pgDump = resolvePgTool('pg_dump');
  const result = spawnSync(
    pgDump,
    ['-Fc', '--no-owner', '--no-privileges', '-f', file, getDatabaseUrl()],
    { stdio: 'inherit', shell: false },
  );
  if (result.status !== 0) {
    console.error(`pg_dump failed (${pgDump}). Set RAMI_PG_BIN or add PostgreSQL bin to PATH.`);
    process.exit(result.status ?? 1);
  }
  console.log(`Shared development snapshot written: ${file}`);
  console.log('This is a development handoff dump only — not the production backup strategy.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
