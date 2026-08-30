#!/usr/bin/env npx tsx
/**
 * Build deterministic historical knowledge chunks from historical_question_answers.
 */
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { isDatabaseConfigured } from '../src/server/db/config';
import {
  countLiveProjectTables,
  listHistoricalAnswers,
  listHistoricalDocuments,
} from '../src/server/rami/historicalRepository';
import {
  buildChunksForDocument,
  summarizeChunkSizes,
} from '../src/server/rami/historicalChunkBuilder';
import {
  countChunks,
  replaceAllChunks,
} from '../src/server/rami/historicalChunkRepository';

async function main() {
  loadLocalEnv();
  if (!isDatabaseConfigured()) {
    console.error('FAIL: PostgreSQL not configured');
    process.exit(1);
  }
  const before = await countLiveProjectTables();
  const docs = await listHistoricalDocuments();
  const all = [];
  for (const d of docs) {
    const answers = await listHistoricalAnswers({ historicalRfpId: d.historicalRfpId });
    all.push(...buildChunksForDocument(d, answers));
  }
  const summary = summarizeChunkSizes(all);
  const n = await replaceAllChunks(all);
  const after = await countLiveProjectTables();
  const counts = await countChunks();
  console.log(
    JSON.stringify(
      {
        ok: true,
        upserted: n,
        summary,
        counts,
        liveUnchanged: JSON.stringify(before) === JSON.stringify(after),
        before,
        after,
      },
      null,
      2,
    ),
  );
  if (JSON.stringify(before) !== JSON.stringify(after)) process.exit(1);
  await closePool();
}

main().catch(async (e) => {
  console.error(e);
  await closePool().catch(() => undefined);
  process.exit(1);
});
