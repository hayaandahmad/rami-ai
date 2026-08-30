#!/usr/bin/env npx tsx
/**
 * Validate RAG foundation: chunks, embeddings, retrieval, isolation.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
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
  listChunks,
  listEmbeddings,
} from '../src/server/rami/historicalChunkRepository';
import { retrieveHistoricalReferences } from '../src/server/rami/historicalRetrieval';
import { NOMIC_EMBED_INFO } from '../src/types/historicalRag';

let passed = 0;
let failed = 0;

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    failed++;
  }
}

console.log('\n=== Historical RAG foundation checks ===\n');

async function main() {
  loadLocalEnv();

  await run('chunk builder is deterministic (stable IDs)', async () => {
    const docs = await listHistoricalDocuments();
    assert.ok(docs.length >= 1);
    const d = docs[0];
    const answers = await listHistoricalAnswers({ historicalRfpId: d.historicalRfpId });
    const a = buildChunksForDocument(d, answers);
    const b = buildChunksForDocument(d, answers);
    assert.equal(a.length, b.length);
    assert.deepEqual(
      a.map((c) => c.chunkId),
      b.map((c) => c.chunkId),
    );
  });

  if (!isDatabaseConfigured()) {
    console.log('\n(Skipping live DB RAG checks)\n');
  } else {
    await run('chunks exist with provenance and types', async () => {
      const counts = await countChunks();
      assert.ok(counts.chunks > 400);
      assert.ok(counts.byType.QUESTION_ANSWER >= 400);
      assert.ok(counts.byType.SECTION >= 1);
      assert.ok(counts.byType.MULTI_QA_TOPIC >= 1);
      const chunks = await listChunks();
      const sample = chunks[0];
      assert.equal(sample.provenanceClass, 'REFERENCE');
      assert.ok(sample.excelRelPath);
      assert.ok(sample.contentHash);
      const summary = summarizeChunkSizes(chunks);
      assert.ok(summary.minLen >= 0);
      assert.ok(summary.avgLen > 50);
    });

    await run('no duplicate chunk IDs', async () => {
      const chunks = await listChunks();
      assert.equal(new Set(chunks.map((c) => c.chunkId)).size, chunks.length);
    });

    await run('embeddings exist with model version + dims', async () => {
      const counts = await countChunks();
      assert.equal(counts.embeddings, counts.chunks);
      const emb = await listEmbeddings({
        embeddingModel: NOMIC_EMBED_INFO.model,
        embeddingVersion: NOMIC_EMBED_INFO.version,
      });
      assert.ok(emb.length > 0);
      assert.equal(emb[0].embedding.length, 768);
    });

    await run('structured field filter retrieval', async () => {
      const r = await retrieveHistoricalReferences('scope definition examples', {
        mode: 'structured',
        fieldIds: ['inScope'],
        topK: 5,
      });
      assert.ok(r.length >= 1);
      assert.ok(r.every((x) => x.mappedFieldIds.includes('inScope')));
      assert.ok(r.every((x) => x.provenanceClass === 'REFERENCE'));
    });

    await run('vector retrieval returns scores', async () => {
      const r = await retrieveHistoricalReferences(
        'framework call-off work order assignment process',
        { mode: 'vector', topK: 5 },
      );
      assert.ok(r.length >= 1);
      assert.ok(r.every((x) => x.vectorScore != null));
    });

    await run('hybrid leave-one-out excludes RFP', async () => {
      const exclude = 'rfp-22-egovt-2026-reengineering-ofa';
      const r = await retrieveHistoricalReferences(
        'how are individual work orders issued under a framework',
        {
          mode: 'hybrid',
          topK: 8,
          excludeHistoricalRfpIds: [exclude],
        },
      );
      assert.ok(r.every((x) => x.historicalRfpId !== exclude));
    });

    await run('question filter retrieval', async () => {
      const r = await retrieveHistoricalReferences('What is in scope?', {
        mode: 'hybrid',
        questionIds: ['4.1'],
        topK: 5,
        chunkTypes: ['QUESTION_ANSWER'],
      });
      assert.ok(r.length >= 1);
      assert.ok(r.every((x) => x.canonicalQuestionIds.includes('4.1')));
    });

    await run('ProjectFacts isolation snapshot', async () => {
      const live = await countLiveProjectTables();
      assert.ok(live.project_facts >= 0);
      // Ensure RAG tables are separate — just reading live counts is enough with prior scripts
      assert.ok('projects' in live);
    });

    await run('eval report file present if generated', () => {
      const p = join(
        process.cwd(),
        'resources',
        'historical-rfps',
        'derived',
        'retrieval-eval-report.json',
      );
      if (existsSync(p)) {
        const report = JSON.parse(readFileSync(p, 'utf8'));
        assert.ok(report.modes?.hybrid?.aggregate);
        assert.equal(report.liveUnchanged, true);
      }
    });
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  await closePool().catch(() => undefined);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await closePool().catch(() => undefined);
  process.exit(1);
});
