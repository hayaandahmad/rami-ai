#!/usr/bin/env npx tsx
/**
 * Embed historical knowledge chunks via local Ollama nomic-embed-text.
 * Explicit command — not run during install/build/start.
 */
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { isDatabaseConfigured } from '../src/server/db/config';
import { getDefaultEmbeddingProvider } from '../src/server/ai/RamiEmbeddingProvider';
import {
  countChunks,
  estimateEmbeddingStorageBytes,
  listChunks,
  listEmbeddings,
  upsertEmbedding,
} from '../src/server/rami/historicalChunkRepository';
import { countLiveProjectTables } from '../src/server/rami/historicalRepository';
import { NOMIC_EMBED_INFO } from '../src/types/historicalRag';

async function main() {
  loadLocalEnv();
  if (!isDatabaseConfigured()) {
    console.error('FAIL: PostgreSQL not configured');
    process.exit(1);
  }
  const before = await countLiveProjectTables();
  const provider = getDefaultEmbeddingProvider();
  const chunks = await listChunks();
  if (!chunks.length) {
    console.error('No chunks — run npm run historical:chunks first');
    process.exit(1);
  }

  const t0 = Date.now();
  let embedded = 0;
  let skipped = 0;
  const existing = await listEmbeddings({
    embeddingModel: provider.info.model,
    embeddingVersion: provider.info.version,
  });
  const existingMap = new Map(existing.map((e) => [e.chunkId, e]));

  for (const c of chunks) {
    const prev = existingMap.get(c.chunkId);
    if (prev && prev.contentHash === c.contentHash && prev.embedding.length > 0) {
      skipped++;
      continue;
    }
    const vec = await provider.embed(c.chunkText, 'document');
    await upsertEmbedding({
      chunkId: c.chunkId,
      embeddingModel: provider.info.model,
      embeddingDims: vec.length,
      embeddingVersion: provider.info.version,
      contentHash: c.contentHash,
      embedding: vec,
    });
    embedded++;
    if (embedded % 25 === 0) {
      console.log(`embedded ${embedded}/${chunks.length}…`);
    }
  }

  const elapsedMs = Date.now() - t0;
  const after = await countLiveProjectTables();
  const counts = await countChunks();
  const storageBytes = await estimateEmbeddingStorageBytes();

  console.log(
    JSON.stringify(
      {
        ok: true,
        model: provider.info,
        embedded,
        skipped,
        elapsedMs,
        counts,
        storageBytes,
        approxBytesPerVector: counts.embeddings
          ? Math.round(storageBytes / counts.embeddings)
          : 0,
        liveUnchanged: JSON.stringify(before) === JSON.stringify(after),
        pgvectorInstalled: false,
        vectorStorage: 'real_array_app_side_cosine',
      },
      null,
      2,
    ),
  );

  if (JSON.stringify(before) !== JSON.stringify(after)) process.exit(1);
  if (counts.embeddings < chunks.length) {
    console.error('Not all chunks embedded');
    process.exit(1);
  }
  // smoke dims
  const sample = await listEmbeddings({
    embeddingModel: NOMIC_EMBED_INFO.model,
    embeddingVersion: NOMIC_EMBED_INFO.version,
  });
  if (sample[0] && sample[0].dims !== 768 && sample[0].embedding.length !== 768) {
    console.warn('Unexpected embedding dims', sample[0].dims, sample[0].embedding.length);
  }
  await closePool();
}

main().catch(async (e) => {
  console.error(e);
  await closePool().catch(() => undefined);
  process.exit(1);
});
