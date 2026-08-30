#!/usr/bin/env npx tsx
import { spawnSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { getBackupDir, getDatabaseUrl, isDatabaseConfigured } from '../src/server/db/config';

async function main() {
  loadLocalEnv();
  if (!isDatabaseConfigured()) {
    console.error('FAIL: PostgreSQL is not configured.');
    process.exit(1);
  }
  const dir = join(process.cwd(), getBackupDir());
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `rami-${stamp}.dump`);
  const result = spawnSync('pg_dump', ['-Fc', '-f', file, getDatabaseUrl()], {
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    console.error('pg_dump failed. Is PostgreSQL client tools on PATH?');
    process.exit(result.status ?? 1);
  }
  console.log(`Backup written: ${file}`);
  console.log('Store dumps on a separate drive or approved network location — not the live PG data directory.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
