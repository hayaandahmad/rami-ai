#!/usr/bin/env npx tsx
/**
 * Validate historical structured import + golden evaluation foundation.
 */
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { isDatabaseConfigured } from '../src/server/db/config';
import { QUESTION_SEEDS } from '../src/schema/questionBankSeed';
import {
  countHistoricalTables,
  countLiveProjectTables,
  listHistoricalAnswers,
  listHistoricalDocuments,
  upsertHistoricalImport,
} from '../src/server/rami/historicalRepository';
import {
  buildExtractionContractForRfp,
  buildGoldenRfpCase,
  evaluateFieldCoverage,
  evaluateQuestionCoverage,
  listGoldenRfpCases,
  scoreFieldDetection,
} from '../src/server/rami/goldenEvaluation';
import {
  getHistoricalAnswersForQuestion,
  getHistoricalCoverage,
  getHistoricalExamplesForField,
  getHistoricalRfp,
} from '../src/server/rami/historicalQuery';
import { spawnSync } from 'child_process';

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

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

console.log('\n=== Historical structured data + golden eval ===\n');

async function main() {
  loadLocalEnv();
  const root = join(process.cwd(), 'resources', 'historical-rfps');
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));

  await run('manifest lists 7 resources with excel paths', () => {
    assert.equal(manifest.totals.datasetCount, 7);
    assert.equal(manifest.resources.length, 7);
    for (const r of manifest.resources) {
      assert.ok(existsSync(join(root, r.excel.path)), r.excel.path);
      assert.equal(sha256File(join(root, r.excel.path)), r.excel.sha256);
      if (r.pdf) {
        assert.ok(existsSync(join(root, r.pdf.path)), r.pdf.path);
        assert.equal(sha256File(join(root, r.pdf.path)), r.pdf.sha256);
      }
    }
  });

  await run('workbook extract produces 7×62 canonical (+ suggested)', () => {
    const py = process.env.RAMI_PYTHON || 'python';
    const r = spawnSync(
      py,
      [join(process.cwd(), 'scripts', 'extract-historical-workbooks.py'), root],
      { encoding: 'utf8', windowsHide: true },
    );
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const payload = JSON.parse(
      readFileSync(join(root, 'derived', 'import-payload.json'), 'utf8'),
    );
    assert.equal(payload.ok, true, JSON.stringify(payload.errors));
    assert.equal(payload.counts.documents, 7);
    assert.equal(payload.counts.canonicalAnswers, 7 * 62);
    assert.ok(payload.counts.noncanonicalAnswers > 0);
    const ids = new Set(payload.answers.map((a: { answerId: string }) => a.answerId));
    assert.equal(ids.size, payload.answers.length, 'answerId collisions');
    // collision-safe: same 13.1 across RFPs must differ
    const sug = payload.answers.filter(
      (a: { sourceQuestionId: string; isCanonical: boolean }) =>
        !a.isCanonical && a.sourceQuestionId === '13.1',
    );
    assert.ok(sug.length >= 2);
    assert.equal(new Set(sug.map((a: { answerId: string }) => a.answerId)).size, sug.length);
  });

  if (!isDatabaseConfigured()) {
    console.log('\n(Skipping live DB historical checks)\n');
  } else {
    const liveBefore = await countLiveProjectTables();

    await run('tables exist and import is idempotent', async () => {
      const py = process.env.RAMI_PYTHON || 'python';
      spawnSync(
        py,
        [join(process.cwd(), 'scripts', 'extract-historical-workbooks.py'), root],
        { encoding: 'utf8', windowsHide: true },
      );
      const payload = JSON.parse(
        readFileSync(join(root, 'derived', 'import-payload.json'), 'utf8'),
      );
      await upsertHistoricalImport({
        documents: payload.documents,
        answers: payload.answers,
      });
      const first = await countHistoricalTables();
      await upsertHistoricalImport({
        documents: payload.documents,
        answers: payload.answers,
      });
      const second = await countHistoricalTables();
      assert.deepEqual(second, first);
      assert.equal(first.documents, 7);
      assert.equal(first.canonicalAnswers, 434);
      assert.ok(first.noncanonicalAnswers > 50);
    });

    await run('ProjectFacts / live project tables unchanged by import', async () => {
      const liveAfter = await countLiveProjectTables();
      assert.deepEqual(liveAfter, liveBefore);
    });

    await run('provenance: PDF-backed vs PDF-unavailable', async () => {
      const docs = await listHistoricalDocuments();
      const withPdf = docs.filter((d) => d.hasPdf);
      const without = docs.filter((d) => !d.hasPdf);
      assert.equal(withPdf.length, 4);
      assert.equal(without.length, 3);
      for (const d of without) {
        assert.ok(d.notes.some((n) => /pdf unavailable/i.test(n)));
        assert.equal(d.evaluationEligibility.pageLevelProvenance, false);
      }
      const qa = await listHistoricalAnswers({
        historicalRfpId: withPdf[0].historicalRfpId,
        canonicalOnly: true,
      });
      assert.ok(qa.every((a) => a.provenanceClass === 'REFERENCE'));
      assert.ok(qa.every((a) => a.pdfAvailable === true));
      assert.ok(qa.every((a) => a.sourceLocator && a.sourceLocator.length > 0));
    });

    await run('Field mapping from Question↔Field only', async () => {
      const a = await listHistoricalAnswers({
        questionId: '3.4',
        canonicalOnly: true,
      });
      assert.ok(a.length >= 1);
      assert.deepEqual(a[0].mappedFieldIds.slice().sort(), ['approvers', 'uatOwners']);
    });

    await run('query helpers (non-RAG)', async () => {
      const doc = await getHistoricalRfp('rfp-itas-vol2b');
      assert.ok(doc);
      const byQ = await getHistoricalAnswersForQuestion('4.1');
      assert.ok(byQ.length >= 1);
      const byF = await getHistoricalExamplesForField('inScope');
      assert.ok(byF.length >= 1);
      const cov = await getHistoricalCoverage();
      assert.equal(cov.documents.length, 7);
    });

    await run('golden cases + question/field coverage', async () => {
      const cases = await listGoldenRfpCases();
      assert.equal(cases.length, 7);
      for (const c of cases) {
        const qc = await evaluateQuestionCoverage(c.historicalRfpId);
        assert.equal(qc.expectedCanonical, QUESTION_SEEDS.length);
        assert.equal(qc.matchedCanonical, 62);
        assert.equal(qc.missingQuestionIds.length, 0);
        const fc = await evaluateFieldCoverage(c.historicalRfpId);
        assert.ok(fc.supportedFieldIds.length > 20);
        const golden = await buildGoldenRfpCase(c.historicalRfpId);
        assert.ok(golden);
      }
      const contract = await buildExtractionContractForRfp('rfp-itas-vol2b');
      assert.ok(contract);
      assert.equal(contract.version, 1);
      assert.ok(contract.metricsPlanned.includes('field_detection_precision'));
      const score = scoreFieldDetection(
        ['inScope', 'bogus'],
        contract.golden.supportedFieldIds,
      );
      assert.ok(score.tp >= 1);
      assert.equal(score.fp, 1);
    });

    await run('unmapped canonical questions remain valid (empty field lists)', async () => {
      const a = await listHistoricalAnswers({ questionId: '0.6', canonicalOnly: true });
      assert.ok(a.length >= 1);
      assert.deepEqual(a[0].mappedFieldIds, []);
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
