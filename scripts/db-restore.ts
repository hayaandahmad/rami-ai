#!/usr/bin/env npx tsx
import { spawnSync } from 'child_process';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import {
  getDatabaseName,
  getDatabaseUrlForName,
  isDatabaseConfigured,
} from '../src/server/db/config';
import { resolvePgTool } from '../src/server/db/pgTools';

async function main() {
  loadLocalEnv();
  if (!isDatabaseConfigured()) {
    console.error('FAIL: PostgreSQL is not configured.');
    process.exit(1);
  }
  const file = process.argv[2];
  const targetDb = process.argv[3];
  const overwriteLive = process.argv.includes('--overwrite-live');
  if (!file || !targetDb) {
    console.error(
      'Usage: npm run db:restore -- path/to/rami.dump <targetDatabase>\n' +
        'Restore into a separate database (e.g. rami_ai_restore_test). ' +
        'To overwrite the live database, pass --overwrite-live.',
    );
    process.exit(1);
  }
  const liveName = getDatabaseName();
  if (targetDb === liveName && !overwriteLive) {
    console.error(
      `Refusing to restore onto live database '${liveName}'. Use a separate target (e.g. rami_ai_restore_test) or pass --overwrite-live.`,
    );
    process.exit(1);
  }
  const pgRestore = resolvePgTool('pg_restore');
  const result = spawnSync(
    pgRestore,
    ['--clean', '--if-exists', '-d', getDatabaseUrlForName(targetDb), file],
    { stdio: 'inherit', shell: false },
  );
  if (result.status !== 0) {
    console.error(`pg_restore failed (${pgRestore}).`);
    process.exit(result.status ?? 1);
  }
  console.log(`Restore complete into ${targetDb}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
