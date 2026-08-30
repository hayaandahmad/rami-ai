/**
 * Golden evaluation foundation over historical_question_answers.
 * Deterministic coverage reports + extraction-eval contract (no model runs).
 */

import {
  HISTORICAL_WORKBOOK_QUESTION_COUNT,
  QUESTION_SEEDS,
} from '@/schema/questionBankSeed';
import {
  LEGACY_CANONICAL_FIELD_COUNT,
  PROJECT_MEMORY_FIELDS,
  PROMOTED_FIELD_IDS,
} from '@/schema/projectMemoryFields';
import {
  getHistoricalDocument,
  listHistoricalAnswers,
  listHistoricalDocuments,
} from '@/server/rami/historicalRepository';
import type {
  ExtractionEvaluationContract,
  FieldCoverageReport,
  GoldenRfpCase,
  QuestionCoverageReport,
} from '@/types/historicalRfp';
import { EXTRACTION_EVAL_METRICS_PLANNED } from '@/types/historicalRfp';

const CANONICAL_QIDS = QUESTION_SEEDS.map((q) => q.questionId);
const CANONICAL_FIELD_IDS = PROJECT_MEMORY_FIELDS.map((f) => f.fieldId);

function statusBucket(status: string): string {
  return status.trim();
}

export async function buildGoldenRfpCase(
  historicalRfpId: string,
): Promise<GoldenRfpCase | null> {
  const doc = await getHistoricalDocument(historicalRfpId);
  if (!doc) return null;
  const answers = await listHistoricalAnswers({
    historicalRfpId,
    canonicalOnly: true,
  });
  const noncanonical = await listHistoricalAnswers({ historicalRfpId });
  const statusDistribution: Record<string, number> = {};
  const supported = new Set<string>();
  for (const a of answers) {
    statusDistribution[statusBucket(a.extractionStatus)] =
      (statusDistribution[statusBucket(a.extractionStatus)] ?? 0) + 1;
    for (const f of a.mappedFieldIds) supported.add(f);
  }
  for (const a of noncanonical.filter((x) => !x.isCanonical)) {
    for (const f of a.mappedFieldIds) supported.add(f);
  }
  const supportedFieldIds = [...supported].sort();
  const unsupportedFieldIds = CANONICAL_FIELD_IDS.filter((f) => !supported.has(f));
  return {
    historicalRfpId: doc.historicalRfpId,
    title: doc.title,
    hasPdf: doc.hasPdf,
    excelRelPath: doc.excelRelPath,
    pdfRelPath: doc.pdfRelPath,
    evaluationEligibility: doc.evaluationEligibility,
    expectedCanonicalQuestionCount: HISTORICAL_WORKBOOK_QUESTION_COUNT,
    expectedCanonicalQuestionIds: [...CANONICAL_QIDS],
    statusDistribution,
    supportedFieldIds,
    unsupportedFieldIds,
    noncanonicalAnswerCount: noncanonical.filter((a) => !a.isCanonical).length,
  };
}

export async function listGoldenRfpCases(): Promise<GoldenRfpCase[]> {
  const docs = await listHistoricalDocuments();
  const cases: GoldenRfpCase[] = [];
  for (const d of docs) {
    const c = await buildGoldenRfpCase(d.historicalRfpId);
    if (c) cases.push(c);
  }
  return cases;
}

export async function evaluateQuestionCoverage(
  historicalRfpId: string,
): Promise<QuestionCoverageReport> {
  const answers = await listHistoricalAnswers({
    historicalRfpId,
    canonicalOnly: true,
  });
  const found = new Set(answers.map((a) => a.canonicalQuestionId!).filter(Boolean));
  const workbookIds = CANONICAL_QIDS.filter((id) => !id.startsWith('18.'));
  const missingQuestionIds = workbookIds.filter((id) => !found.has(id));
  const unexpectedCanonicalIds = [...found].filter((id) => !CANONICAL_QIDS.includes(id));
  const statusDistribution: Record<string, number> = {};
  let tbcCount = 0;
  let notApplicableCount = 0;
  let partiallyStatedCount = 0;
  let answeredCount = 0;
  for (const a of answers) {
    const s = statusBucket(a.extractionStatus);
    statusDistribution[s] = (statusDistribution[s] ?? 0) + 1;
    const lower = s.toLowerCase();
    if (lower === 'tbc' || lower.includes('to be confirmed')) tbcCount++;
    else if (lower === 'not applicable') notApplicableCount++;
    else if (lower.includes('partial')) partiallyStatedCount++;
    else if (lower === 'answered') answeredCount++;
  }
  return {
    historicalRfpId,
    expectedCanonical: HISTORICAL_WORKBOOK_QUESTION_COUNT,
    matchedCanonical: found.size,
    missingQuestionIds,
    unexpectedCanonicalIds,
    statusDistribution,
    tbcCount,
    notApplicableCount,
    partiallyStatedCount,
    answeredCount,
  };
}

export async function evaluateFieldCoverage(
  historicalRfpId: string,
): Promise<FieldCoverageReport> {
  const answers = await listHistoricalAnswers({
    historicalRfpId,
  });
  const fieldToQuestionIds: Record<string, string[]> = {};
  const multiFieldQuestions: Array<{ questionId: string; fieldIds: string[] }> = [];
  for (const a of answers) {
    const qid = a.canonicalQuestionId || a.sourceQuestionId;
    if (a.mappedFieldIds.length > 1) {
      multiFieldQuestions.push({ questionId: qid, fieldIds: a.mappedFieldIds });
    }
    for (const f of a.mappedFieldIds) {
      if (!fieldToQuestionIds[f]) fieldToQuestionIds[f] = [];
      if (!fieldToQuestionIds[f].includes(qid)) fieldToQuestionIds[f].push(qid);
    }
  }
  const supportedFieldIds = Object.keys(fieldToQuestionIds).sort();
  const unsupportedFieldIds = CANONICAL_FIELD_IDS.filter(
    (f) => !supportedFieldIds.includes(f),
  );
  return {
    historicalRfpId,
    supportedFieldIds,
    unsupportedFieldIds,
    fieldToQuestionIds,
    multiFieldQuestions,
  };
}

/**
 * Build the comparison contract for a future extraction run.
 * Does not invoke Qwen. Callers supply `predicted` later.
 */
export function buildExtractionEvaluationContract(input: {
  historicalRfpId: string;
  goldenAnswers: Array<{
    questionId: string;
    extractionStatus: string;
    mappedFieldIds: string[];
  }>;
  supportedFieldIds: string[];
  predicted?: ExtractionEvaluationContract['predicted'];
}): ExtractionEvaluationContract {
  return {
    version: 1,
    description:
      'Compare RAMI extraction predictions against historical golden answers/Fields. Free-text values should use structured/semantic comparison later — not only exact string equality.',
    predicted: input.predicted ?? {
      fieldIds: [],
      fields: [],
      questions: [],
    },
    golden: {
      historicalRfpId: input.historicalRfpId,
      supportedFieldIds: input.supportedFieldIds,
      canonicalAnswers: input.goldenAnswers,
    },
    metricsPlanned: [...EXTRACTION_EVAL_METRICS_PLANNED],
    comparisonNotes: [
      'Field detection: set precision/recall on predicted.fieldIds vs golden.supportedFieldIds (optionally exclude Fields only linked to Not applicable questions).',
      'TBC/N/A classification: compare predicted gapStatus/collectionState against golden extractionStatus buckets.',
      'Value similarity: for Answered Fields, prefer normalized structured compare + optional embedding similarity later; do not fail solely on whitespace/punctuation.',
      'Provenance: when PDF exists, prefer predictions that retain source locators; datasets without PDF skip page-level checks.',
      'Never promote golden historical answers into ProjectFacts during evaluation.',
    ],
  };
}

export async function buildExtractionContractForRfp(
  historicalRfpId: string,
): Promise<ExtractionEvaluationContract | null> {
  const fieldCov = await evaluateFieldCoverage(historicalRfpId);
  const answers = await listHistoricalAnswers({
    historicalRfpId,
    canonicalOnly: true,
  });
  return buildExtractionEvaluationContract({
    historicalRfpId,
    supportedFieldIds: fieldCov.supportedFieldIds,
    goldenAnswers: answers.map((a) => ({
      questionId: a.canonicalQuestionId!,
      extractionStatus: a.extractionStatus,
      mappedFieldIds: a.mappedFieldIds,
    })),
  });
}

/** Historical support for Fields promoted after the 52-field workbook era. */
export async function reportPromotedFieldHistoricalSupport(): Promise<
  Array<{
    fieldId: string;
    answerCount: number;
    rfpIds: string[];
    legacyFieldCount: number;
    currentFieldCount: number;
  }>
> {
  const out: Array<{
    fieldId: string;
    answerCount: number;
    rfpIds: string[];
    legacyFieldCount: number;
    currentFieldCount: number;
  }> = [];
  for (const fieldId of PROMOTED_FIELD_IDS) {
    const answers = await listHistoricalAnswers({ fieldId });
    const rfpIds = [...new Set(answers.map((a) => a.historicalRfpId))].sort();
    out.push({
      fieldId,
      answerCount: answers.length,
      rfpIds,
      legacyFieldCount: LEGACY_CANONICAL_FIELD_COUNT,
      currentFieldCount: PROJECT_MEMORY_FIELDS.length,
    });
  }
  return out;
}

/** Deterministic field-detection metrics helper for future predicted sets. */
export function scoreFieldDetection(
  predictedFieldIds: string[],
  goldenSupportedFieldIds: string[],
): { precision: number; recall: number; f1: number; tp: number; fp: number; fn: number } {
  const pred = new Set(predictedFieldIds);
  const gold = new Set(goldenSupportedFieldIds);
  let tp = 0;
  for (const f of pred) if (gold.has(f)) tp++;
  const fp = pred.size - tp;
  const fn = gold.size - tp;
  const precision = pred.size === 0 ? 0 : tp / pred.size;
  const recall = gold.size === 0 ? 0 : tp / gold.size;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1, tp, fp, fn };
}
