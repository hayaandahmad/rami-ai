/**
 * Deterministic historical query helpers (NOT RAG — no embeddings / similarity).
 * Do not wire into live section generation prompts automatically.
 */

import {
  getHistoricalDocument,
  listHistoricalAnswers,
  listHistoricalDocuments,
} from '@/server/rami/historicalRepository';
import type { HistoricalQuestionAnswer, HistoricalRfpDocument } from '@/types/historicalRfp';

export async function getHistoricalRfp(
  resourceId: string,
): Promise<HistoricalRfpDocument | null> {
  return getHistoricalDocument(resourceId);
}

export async function getHistoricalAnswersForQuestion(
  questionId: string,
): Promise<HistoricalQuestionAnswer[]> {
  return listHistoricalAnswers({ questionId, canonicalOnly: true });
}

export async function getHistoricalExamplesForField(
  fieldId: string,
): Promise<HistoricalQuestionAnswer[]> {
  return listHistoricalAnswers({ fieldId, canonicalOnly: true });
}

export async function getHistoricalCoverage(): Promise<{
  documents: HistoricalRfpDocument[];
  perDocument: Array<{
    historicalRfpId: string;
    canonicalAnswers: number;
    noncanonicalAnswers: number;
    hasPdf: boolean;
    statusDistribution: Record<string, number>;
    supportedFieldCount: number;
  }>;
}> {
  const documents = await listHistoricalDocuments();
  const perDocument = [];
  for (const d of documents) {
    const answers = await listHistoricalAnswers({ historicalRfpId: d.historicalRfpId });
    const canonical = answers.filter((a) => a.isCanonical);
    const noncanonical = answers.filter((a) => !a.isCanonical);
    const statusDistribution: Record<string, number> = {};
    const fields = new Set<string>();
    for (const a of canonical) {
      statusDistribution[a.extractionStatus] =
        (statusDistribution[a.extractionStatus] ?? 0) + 1;
      for (const f of a.mappedFieldIds) fields.add(f);
    }
    perDocument.push({
      historicalRfpId: d.historicalRfpId,
      canonicalAnswers: canonical.length,
      noncanonicalAnswers: noncanonical.length,
      hasPdf: d.hasPdf,
      statusDistribution,
      supportedFieldCount: fields.size,
    });
  }
  return { documents, perDocument };
}
