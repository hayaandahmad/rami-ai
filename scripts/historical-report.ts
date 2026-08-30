#!/usr/bin/env npx tsx
/**
 * Report historical import coverage + information-model gap frequency.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import {
  countHistoricalTables,
  listHistoricalAnswers,
  listHistoricalDocuments,
} from '../src/server/rami/historicalRepository';
import {
  evaluateFieldCoverage,
  evaluateQuestionCoverage,
  listGoldenRfpCases,
} from '../src/server/rami/goldenEvaluation';
import { getHistoricalCoverage } from '../src/server/rami/historicalQuery';

const GAP_THEMES: Array<{
  id: string;
  severity: 'CRITICAL' | 'IMPORTANT' | 'OPTIONAL';
  patterns: RegExp[];
  partialFields: string[];
  sections: string[];
}> = [
  {
    id: 'procurementStage',
    severity: 'CRITICAL',
    patterns: [/pre-?qualification/i, /procurement stage/i, /\bPQ\b/, /stage\s*1/i],
    partialFields: [],
    sections: ['coverPage', 'administrativeProcedures'],
  },
  {
    id: 'awardModelAndSupplierCount',
    severity: 'CRITICAL',
    patterns: [/award/i, /top\s*\d/i, /number of (bidders|suppliers|winners)/i],
    partialFields: [],
    sections: ['administrativeProcedures', 'evaluationCriteria'],
  },
  {
    id: 'callOffOrSowProcess',
    severity: 'CRITICAL',
    patterns: [/call-?off/i, /\bSOW\b/, /work order/i, /assignment/i],
    partialFields: ['engagementType', 'engagementPhases'],
    sections: ['engagementDefinition', 'administrativeProcedures'],
  },
  {
    id: 'namedKeyPersonnelRequirements',
    severity: 'CRITICAL',
    patterns: [/key personnel/i, /project manager/i, /\bPMP\b/, /staff roles/i, /\bCV\b/],
    partialFields: ['stakeholderRoles'],
    sections: ['manpower', 'introduction'],
  },
  {
    id: 'clarificationContact',
    severity: 'IMPORTANT',
    patterns: [/clarification/i, /enquir/i, /contact person/i],
    partialFields: [],
    sections: ['administrativeProcedures'],
  },
  {
    id: 'submissionChannel',
    severity: 'IMPORTANT',
    patterns: [/JONEPS/i, /e-?procurement/i, /submission portal/i, /submit proposal/i],
    partialFields: [],
    sections: ['administrativeProcedures'],
  },
  {
    id: 'governanceCadence',
    severity: 'IMPORTANT',
    patterns: [/steering committee/i, /governance/i, /progress report/i, /\bPMO\b/],
    partialFields: [],
    sections: ['scopeOfWork', 'implementationRequirements'],
  },
  {
    id: 'knowledgeTransferRequirements',
    severity: 'IMPORTANT',
    patterns: [/knowledge transfer/i, /training of trainers/i, /handover/i],
    partialFields: ['deliverableItems'],
    sections: ['deliverables', 'supportMaintenance'],
  },
];

async function main() {
  loadLocalEnv();
  const counts = await countHistoricalTables();
  const docs = await listHistoricalDocuments();
  const coverage = await getHistoricalCoverage();
  const cases = await listGoldenRfpCases();

  const perRfp = [];
  for (const d of docs) {
    const qc = await evaluateQuestionCoverage(d.historicalRfpId);
    const fc = await evaluateFieldCoverage(d.historicalRfpId);
    perRfp.push({
      id: d.historicalRfpId,
      hasPdf: d.hasPdf,
      eligibility: d.evaluationEligibility,
      questionCoverage: qc,
      fieldSupported: fc.supportedFieldIds.length,
      fieldUnsupported: fc.unsupportedFieldIds.length,
    });
  }

  const allAnswers = await listHistoricalAnswers();
  const gaps = GAP_THEMES.map((g) => {
    const hits: Array<{ historicalRfpId: string; sourceQuestionId: string; sheet: string }> =
      [];
    for (const a of allAnswers) {
      const blob = `${a.exactQuestionText}\n${a.answerText}`;
      if (g.patterns.some((p) => p.test(blob))) {
        hits.push({
          historicalRfpId: a.historicalRfpId,
          sourceQuestionId: a.sourceQuestionId,
          sheet: a.sourceSheet,
        });
      }
    }
    const datasets = [...new Set(hits.map((h) => h.historicalRfpId))];
    return {
      candidateFieldOrTopic: g.id,
      severity: g.severity,
      datasetCount: datasets.length,
      datasets,
      hitCount: hits.length,
      sampleSourceQuestions: hits.slice(0, 8),
      partialExistingFields: g.partialFields,
      relevantSections: g.sections,
      promotionRecommendation: g.severity,
      note: 'Do not add to ProjectMemory until explicitly decided.',
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    counts,
    documentsWithPdf: docs.filter((d) => d.hasPdf).map((d) => d.historicalRfpId),
    documentsWithoutPdf: docs.filter((d) => !d.hasPdf).map((d) => d.historicalRfpId),
    coverage: coverage.perDocument,
    goldenCaseCount: cases.length,
    perRfp,
    informationModelGaps: gaps,
    ragStatus: 'NOT_IMPLEMENTED',
    embeddingsStatus: 'NOT_IMPLEMENTED',
  };

  const outJson = join(
    process.cwd(),
    'resources',
    'historical-rfps',
    'derived',
    'historical-coverage-report.json',
  );
  writeFileSync(outJson, JSON.stringify(report, null, 2), 'utf8');

  const mdLines = [
    '# Historical coverage & gap report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Documents: **${counts.documents}** · Canonical QA: **${counts.canonicalAnswers}** · Noncanonical: **${counts.noncanonicalAnswers}**`,
    '',
    `PDF-backed: ${report.documentsWithPdf.join(', ') || '(none)'}`,
    '',
    `PDF unavailable: ${report.documentsWithoutPdf.join(', ') || '(none)'}`,
    '',
    '## Information-model gaps (from imported historical text)',
    '',
    '| Candidate | Severity | Datasets | Hits | Partial overlap |',
    '|---|---|---:|---:|---|',
    ...gaps.map(
      (g) =>
        `| ${g.candidateFieldOrTopic} | ${g.severity} | ${g.datasetCount} | ${g.hitCount} | ${g.partialExistingFields.join(', ') || '—'} |`,
    ),
    '',
    'Do **not** expand the 52-field model from this report automatically.',
    '',
    'RAG / embeddings: **not implemented**.',
    '',
  ];
  const outMd = join(
    process.cwd(),
    'resources',
    'historical-rfps',
    'derived',
    'GAP_REPORT.md',
  );
  writeFileSync(outMd, mdLines.join('\n'), 'utf8');

  console.log(JSON.stringify({ ok: true, counts, outJson, outMd, gaps: gaps.length }, null, 2));
  await closePool();
}

main().catch(async (e) => {
  console.error(e);
  await closePool().catch(() => undefined);
  process.exit(1);
});
