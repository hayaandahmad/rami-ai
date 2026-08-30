#!/usr/bin/env npx tsx
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { getPool, closePool, query } from '../src/server/db/connection';
import { isDatabaseConfigured } from '../src/server/db/config';

async function main() {
  loadLocalEnv();
  if (!isDatabaseConfigured()) {
    console.error('FAIL: PostgreSQL is not configured (.env.local RAMI_DB_URL or RAMI_DB_HOST).');
    process.exit(1);
  }

  const dir = join(process.cwd(), 'src', 'server', 'db', 'migrations');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const applied = new Set(
    (await query<{ version: string }>('SELECT version FROM schema_migrations')).rows.map(
      (r) => r.version,
    ),
  );

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  skip ${file}`);
      continue;
    }
    const sql = readFileSync(join(dir, file), 'utf8');
    console.log(`  apply ${file}`);
    await getPool().query(sql);
    await query('INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING', [
      file,
    ]);
  }

  console.log('Migrations complete.');
  await closePool();
}

main().catch(async (err) => {
  console.error(err);
  await closePool().catch(() => undefined);
  process.exit(1);
});
