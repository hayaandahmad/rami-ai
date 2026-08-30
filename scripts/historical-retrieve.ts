#!/usr/bin/env npx tsx
/**
 * CLI smoke for retrieveHistoricalReferences (not wired to chat).
 * Usage: npm run historical:retrieve -- --query "scope of work" --mode hybrid --topK 5
 */
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { retrieveHistoricalReferences } from '../src/server/rami/historicalRetrieval';
import type { RetrievalMode } from '../src/types/historicalRag';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

async function main() {
  loadLocalEnv();
  const query = arg('query', 'scope of work deliverables');
  const mode = (arg('mode', 'hybrid') || 'hybrid') as RetrievalMode;
  const topK = Number(arg('topK', '5') || 5);
  const fieldIds = arg('field') ? [arg('field')!] : undefined;
  const t0 = Date.now();
  const results = await retrieveHistoricalReferences(query!, {
    mode,
    topK,
    fieldIds,
  });
  const latencyMs = Date.now() - t0;
  console.log(
    JSON.stringify(
      {
        query,
        mode,
        topK,
        latencyMs,
        results: results.map((r) => ({
          score: Number(r.score.toFixed(4)),
          vectorScore: r.vectorScore != null ? Number(r.vectorScore.toFixed(4)) : null,
          chunkType: r.chunkType,
          historicalRfpId: r.historicalRfpId,
          fields: r.mappedFieldIds,
          sections: r.sectionIds,
          questions: r.canonicalQuestionIds,
          topicKey: r.topicKey,
          locators: r.sourceLocators,
          provenance: r.provenanceClass,
          preview: r.chunkText.slice(0, 160).replace(/\s+/g, ' '),
        })),
      },
      null,
      2,
    ),
  );
  await closePool();
}

main().catch(async (e) => {
  console.error(e);
  await closePool().catch(() => undefined);
  process.exit(1);
});
