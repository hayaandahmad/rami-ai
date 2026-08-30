/**
 * Golden retrieval evaluation cases + metrics over HistoricalReference results.
 */

import type { HistoricalReference, RetrievalEvalCase } from '@/types/historicalRag';

export const RETRIEVAL_EVAL_CASES: RetrievalEvalCase[] = [
  {
    id: 'field-scope',
    task: 'FIELD',
    query: 'examples for scope of work in scope definition',
    expectedFieldIds: ['inScope', 'outOfScope'],
    expectedSectionIds: ['scopeOfWork'],
    notes: 'Field retrieval for scope',
  },
  {
    id: 'field-deliverables',
    task: 'FIELD',
    query: 'required deliverables and report formats',
    expectedFieldIds: ['deliverableItems', 'deliverableFormats'],
    expectedSectionIds: ['deliverables'],
  },
  {
    id: 'field-evaluation',
    task: 'FIELD',
    query: 'technical versus financial evaluation weights',
    expectedFieldIds: ['evaluationWeights', 'evaluationRules'],
    expectedSectionIds: ['evaluationCriteria'],
  },
  {
    id: 'question-4.1',
    task: 'QUESTION',
    query: 'What is in scope?',
    expectedQuestionIds: ['4.1'],
    expectedFieldIds: ['inScope'],
  },
  {
    id: 'question-10.1',
    task: 'QUESTION',
    query: 'Technical vs financial weights?',
    expectedQuestionIds: ['10.1'],
    expectedFieldIds: ['evaluationWeights'],
  },
  {
    id: 'section-legal',
    task: 'SECTION',
    query: 'legal contractual terms confidentiality IP subcontracting',
    expectedSectionIds: ['legalContractualTerms'],
    expectedFieldIds: ['legalTerms', 'jvSubcontractingRules'],
  },
  {
    id: 'section-support',
    task: 'SECTION',
    query: 'support maintenance SLA response times',
    expectedSectionIds: ['supportMaintenance'],
    expectedFieldIds: ['supportPeriodAndHours', 'slaTiers'],
  },
  {
    id: 'semantic-framework-calloff',
    task: 'SEMANTIC',
    query: 'how are individual work orders issued under a multi-year framework agreement',
    expectedTopicKeys: ['gap:callOffOrSowProcess', 'suggested_pack:13'],
    expectedFieldIds: ['engagementType', 'engagementPhases'],
    excludeHistoricalRfpId: 'rfp-22-egovt-2026-reengineering-ofa',
    notes: 'Leave-one-out: exclude reengineering OFA',
  },
  {
    id: 'gap-award-model',
    task: 'PROCUREMENT_GAP',
    query: 'how many suppliers are awarded and what is the award model',
    expectedTopicKeys: ['gap:awardModelAndSupplierCount'],
  },
  {
    id: 'gap-named-personnel',
    task: 'PROCUREMENT_GAP',
    query: 'mandatory key personnel project manager certifications and CVs',
    expectedTopicKeys: ['gap:namedKeyPersonnelRequirements'],
  },
  {
    id: 'gap-submission',
    task: 'PROCUREMENT_GAP',
    query: 'proposal submission channel JONEPS e-procurement portal',
    expectedTopicKeys: ['gap:submissionChannel'],
  },
  {
    id: 'gap-clarification',
    task: 'PROCUREMENT_GAP',
    query: 'clarification questions contact person for the tender',
    expectedTopicKeys: ['gap:clarificationContact'],
  },
  {
    id: 'gap-governance',
    task: 'PROCUREMENT_GAP',
    query: 'steering committee governance cadence progress reporting PMO',
    expectedTopicKeys: ['gap:governanceCadence'],
  },
  {
    id: 'gap-kt',
    task: 'PROCUREMENT_GAP',
    query: 'knowledge transfer training of trainers handover requirements',
    expectedTopicKeys: ['gap:knowledgeTransferRequirements'],
  },
  {
    id: 'gap-pq-stage',
    task: 'PROCUREMENT_GAP',
    query: 'pre-qualification stage versus full RFP deferred commercial detail',
    expectedTopicKeys: ['gap:procurementStage'],
    excludeHistoricalRfpId: 'pq-15-egovt-2026-sanad-ai',
  },
];

export interface CaseMetric {
  caseId: string;
  mode: string;
  hitAtK: boolean;
  recallAtK: number;
  mrr: number;
  fieldMatchRate: number;
  questionMatchRate: number;
  sectionMatchRate: number;
  topicMatchRate: number;
  provenanceComplete: boolean;
  topChunkIds: string[];
}

function rankOfFirstRelevant(
  results: HistoricalReference[],
  isRelevant: (r: HistoricalReference) => boolean,
): number | null {
  for (let i = 0; i < results.length; i++) {
    if (isRelevant(results[i])) return i + 1;
  }
  return null;
}

export function scoreRetrievalCase(
  c: RetrievalEvalCase,
  results: HistoricalReference[],
  mode: string,
): CaseMetric {
  const isRelevant = (r: HistoricalReference): boolean => {
    if (c.expectedFieldIds?.length) {
      if (c.expectedFieldIds.some((f) => r.mappedFieldIds.includes(f))) return true;
    }
    if (c.expectedQuestionIds?.length) {
      if (
        c.expectedQuestionIds.some(
          (q) =>
            r.canonicalQuestionIds.includes(q) || r.sourceQuestionIds.includes(q),
        )
      )
        return true;
    }
    if (c.expectedSectionIds?.length) {
      if (c.expectedSectionIds.some((s) => r.sectionIds.includes(s))) return true;
    }
    if (c.expectedTopicKeys?.length) {
      if (c.expectedTopicKeys.some((t) => r.topicKey === t || r.topicKey?.includes(t.replace(/^gap:/, ''))))
        return true;
      // also accept gap: prefix variants
      if (
        c.expectedTopicKeys.some(
          (t) => r.topicKey === t || (r.topicKey && t.startsWith('gap:') && r.topicKey === t),
        )
      )
        return true;
    }
    return false;
  };

  const k = results.length || 1;
  const relevantCount = results.filter(isRelevant).length;
  const rank = rankOfFirstRelevant(results, isRelevant);
  const hitAtK = rank != null;
  const recallAtK = hitAtK ? 1 : 0; // binary recall for labeled cases
  const mrr = rank ? 1 / rank : 0;

  const fieldMatchRate = c.expectedFieldIds?.length
    ? results.filter((r) => c.expectedFieldIds!.some((f) => r.mappedFieldIds.includes(f)))
        .length / k
    : relevantCount / k;
  const questionMatchRate = c.expectedQuestionIds?.length
    ? results.filter((r) =>
        c.expectedQuestionIds!.some(
          (q) =>
            r.canonicalQuestionIds.includes(q) || r.sourceQuestionIds.includes(q),
        ),
      ).length / k
    : 0;
  const sectionMatchRate = c.expectedSectionIds?.length
    ? results.filter((r) => c.expectedSectionIds!.some((s) => r.sectionIds.includes(s)))
        .length / k
    : 0;
  const topicMatchRate = c.expectedTopicKeys?.length
    ? results.filter((r) => c.expectedTopicKeys!.some((t) => r.topicKey === t)).length / k
    : 0;

  const provenanceComplete = results.every(
    (r) =>
      r.provenanceClass === 'REFERENCE' &&
      Boolean(r.historicalRfpId) &&
      Boolean(r.excelRelPath) &&
      (!r.pdfAvailable || r.sourceLocators.length >= 0),
  );

  return {
    caseId: c.id,
    mode,
    hitAtK,
    recallAtK,
    mrr,
    fieldMatchRate,
    questionMatchRate,
    sectionMatchRate,
    topicMatchRate,
    provenanceComplete,
    topChunkIds: results.slice(0, 5).map((r) => r.chunkId),
  };
}

export function aggregateMetrics(metrics: CaseMetric[]): {
  cases: number;
  hitRate: number;
  meanMrr: number;
  meanFieldMatchRate: number;
  provenanceOkRate: number;
} {
  if (!metrics.length) {
    return { cases: 0, hitRate: 0, meanMrr: 0, meanFieldMatchRate: 0, provenanceOkRate: 0 };
  }
  const n = metrics.length;
  return {
    cases: n,
    hitRate: metrics.filter((m) => m.hitAtK).length / n,
    meanMrr: metrics.reduce((s, m) => s + m.mrr, 0) / n,
    meanFieldMatchRate: metrics.reduce((s, m) => s + m.fieldMatchRate, 0) / n,
    provenanceOkRate: metrics.filter((m) => m.provenanceComplete).length / n,
  };
}
