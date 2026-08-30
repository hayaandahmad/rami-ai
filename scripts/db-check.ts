#!/usr/bin/env npx tsx
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { checkDatabase, closePool } from '../src/server/db/connection';
import { isDatabaseConfigured } from '../src/server/db/config';
import { countStaticDefinitions } from '../src/server/repositories/StaticDefinitionRepository';

async function main() {
  loadLocalEnv();
  console.log(`Configured: ${isDatabaseConfigured()}`);
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
