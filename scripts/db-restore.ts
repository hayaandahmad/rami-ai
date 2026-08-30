#!/usr/bin/env npx tsx
import { spawnSync } from 'child_process';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { getDatabaseUrl, isDatabaseConfigured } from '../src/server/db/config';

async function main() {
  loadLocalEnv();
  if (!isDatabaseConfigured()) {
    console.error('FAIL: PostgreSQL is not configured.');
    process.exit(1);
  }
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: npm run db:restore -- path/to/rami.dump');
    process.exit(1);
  }
  const result = spawnSync(
    'pg_restore',
    ['--clean', '--if-exists', '-d', getDatabaseUrl(), file],
    { stdio: 'inherit', shell: true },
  );
  if (result.status !== 0) {
    console.error('pg_restore failed.');
    process.exit(result.status ?? 1);
  }
  console.log('Restore complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
