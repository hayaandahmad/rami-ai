#!/usr/bin/env npx tsx
/**
 * Quick historical table health check after import.
 */
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { isDatabaseConfigured } from '../src/server/db/config';
import {
  countHistoricalTables,
  countLiveProjectTables,
  listHistoricalDocuments,
} from '../src/server/rami/historicalRepository';

async function main() {
  loadLocalEnv();
  if (!isDatabaseConfigured()) {
    console.error('FAIL: PostgreSQL not configured');
    process.exit(1);
  }
  const hist = await countHistoricalTables();
  const live = await countLiveProjectTables();
  const docs = await listHistoricalDocuments();
  console.log(
    JSON.stringify(
      {
        ok: hist.documents === 7 && hist.canonicalAnswers === 434,
        historical: hist,
        live,
        withPdf: docs.filter((d) => d.hasPdf).length,
        withoutPdf: docs.filter((d) => !d.hasPdf).length,
      },
      null,
      2,
    ),
  );
  if (hist.documents !== 7 || hist.canonicalAnswers !== 434) process.exit(1);
  await closePool();
}

main().catch(async (e) => {
  console.error(e);
  await closePool().catch(() => undefined);
  process.exit(1);
});
