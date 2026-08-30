#!/usr/bin/env npx tsx
/**
 * Evaluate structured / vector / hybrid retrieval on golden cases.
 * Writes resources/historical-rfps/derived/retrieval-eval-report.json
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { retrieveHistoricalReferences } from '../src/server/rami/historicalRetrieval';
import {
  RETRIEVAL_EVAL_CASES,
  aggregateMetrics,
  scoreRetrievalCase,
} from '../src/server/rami/retrievalEvaluation';
import { countChunks } from '../src/server/rami/historicalChunkRepository';
import { countLiveProjectTables } from '../src/server/rami/historicalRepository';
import type { RetrievalMode } from '../src/types/historicalRag';

async function runMode(mode: RetrievalMode) {
  const metrics = [];
  const latencies: number[] = [];
  for (const c of RETRIEVAL_EVAL_CASES) {
    const t0 = Date.now();
    const results = await retrieveHistoricalReferences(c.query, {
      mode,
      topK: 8,
      fieldIds: c.task === 'FIELD' ? c.expectedFieldIds : undefined,
      sectionIds: c.task === 'SECTION' ? c.expectedSectionIds : undefined,
      questionIds: c.task === 'QUESTION' ? c.expectedQuestionIds : undefined,
      excludeHistoricalRfpIds: c.excludeHistoricalRfpId
        ? [c.excludeHistoricalRfpId]
        : undefined,
    });
    latencies.push(Date.now() - t0);
    metrics.push(scoreRetrievalCase(c, results, mode));
  }
  return {
    mode,
    aggregate: aggregateMetrics(metrics),
    meanLatencyMs: Math.round(latencies.reduce((s, n) => s + n, 0) / latencies.length),
    maxLatencyMs: Math.max(...latencies),
    metrics,
  };
}

async function main() {
  loadLocalEnv();
  const before = await countLiveProjectTables();
  const counts = await countChunks();
  if (counts.embeddings < counts.chunks) {
    console.error('Embeddings incomplete — run npm run historical:embed');
    process.exit(1);
  }

  const structured = await runMode('structured');
  const vector = await runMode('vector');
  const hybrid = await runMode('hybrid');

  // Gap evidence: hybrid hits on procurement cases
  const gapCases = hybrid.metrics.filter((m) => m.caseId.startsWith('gap-'));
  const gapEvidence = gapCases.map((m) => ({
    caseId: m.caseId,
    hitAtK: m.hitAtK,
    mrr: m.mrr,
    topicMatchRate: m.topicMatchRate,
  }));

  const after = await countLiveProjectTables();
  const report = {
    generatedAt: new Date().toISOString(),
    chunkCounts: counts,
    pgvectorInstalled: false,
    vectorStorage: 'real_array_app_side_cosine',
    embeddingModel: 'nomic-embed-text',
    embeddingDims: 768,
    liveUnchanged: JSON.stringify(before) === JSON.stringify(after),
    modes: {
      structured: { aggregate: structured.aggregate, meanLatencyMs: structured.meanLatencyMs, maxLatencyMs: structured.maxLatencyMs },
      vector: { aggregate: vector.aggregate, meanLatencyMs: vector.meanLatencyMs, maxLatencyMs: vector.maxLatencyMs },
      hybrid: { aggregate: hybrid.aggregate, meanLatencyMs: hybrid.meanLatencyMs, maxLatencyMs: hybrid.maxLatencyMs },
    },
    leaveOneOutCases: RETRIEVAL_EVAL_CASES.filter((c) => c.excludeHistoricalRfpId).map((c) => c.id),
    detailed: { structured, vector, hybrid },
    gapEvidence,
    recommendation:
      'Default to hybrid (metadata filters + vector). Structured-only wins MRR when Field/Section/Question IDs are known; vector-only is weakest ranking. Keep structural filters primary.',
  };

  const out = join(
    process.cwd(),
    'resources',
    'historical-rfps',
    'derived',
    'retrieval-eval-report.json',
  );
  writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
  console.log(
    JSON.stringify(
      {
        ok: true,
        out,
        modes: report.modes,
        recommendation: report.recommendation,
        liveUnchanged: report.liveUnchanged,
      },
      null,
      2,
    ),
  );
  if (!report.liveUnchanged) process.exit(1);
  await closePool();
}

main().catch(async (e) => {
  console.error(e);
  await closePool().catch(() => undefined);
  process.exit(1);
});
