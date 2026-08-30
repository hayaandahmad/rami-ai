#!/usr/bin/env npx tsx
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool, withTransaction } from '../src/server/db/connection';
import { isDatabaseConfigured } from '../src/server/db/config';
import { upsertSystemUser } from '../src/server/repositories/UserRepository';
import {
  countStaticDefinitions,
  seedStaticDefinitions,
} from '../src/server/repositories/StaticDefinitionRepository';

async function main() {
  loadLocalEnv();
  if (!isDatabaseConfigured()) {
    console.error('FAIL: PostgreSQL is not configured.');
    process.exit(1);
  }
  const first = await withTransaction(async (client) => {
    await upsertSystemUser(client);
    return seedStaticDefinitions(client);
  });
  const second = await withTransaction(async (client) => seedStaticDefinitions(client));
  const counts = await countStaticDefinitions();
  console.log('Seed complete (idempotent).');
  console.log(first);
  console.log('Second run (should match, no growth):', second);
  console.log('Table counts:', counts);
  await closePool();
}

main().catch(async (err) => {
  console.error(err);
  await closePool().catch(() => undefined);
  process.exit(1);
});
