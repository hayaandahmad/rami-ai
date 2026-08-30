/**
 * Historical RFP structured knowledge — REFERENCE only.
 * Never treat as current ProjectFacts. No RAG / embeddings here.
 */

export type HistoricalProvenanceClass = 'REFERENCE';

export type HistoricalSheetKind = 'qa' | 'suggested_additions';

export interface HistoricalEvaluationEligibility {
  questionCoverage: boolean;
  fieldCoverage: boolean;
  extractionGolden: boolean;
  stageTbc: boolean;
  fullDocumentPdf: boolean;
  pageLevelProvenance: boolean;
}

export interface HistoricalRfpDocument {
  historicalRfpId: string;
  title: string;
  sourceType: string;
  documentKinds: string[];
  intendedUse: string[];
  excelRelPath: string;
  excelSha256: string;
  pdfRelPath: string | null;
  pdfSha256: string | null;
  hasPdf: boolean;
  evaluationEligibility: HistoricalEvaluationEligibility;
  manifestJson: Record<string, unknown>;
  notes: string[];
  importedAt: string;
  updatedAt: string;
}

export interface HistoricalQuestionAnswer {
  answerId: string;
  historicalRfpId: string;
  sourceSheet: string;
  sourceSheetKind: HistoricalSheetKind;
  sourceRow: number | null;
  sourceQuestionId: string;
  canonicalQuestionId: string | null;
  isCanonical: boolean;
  questionSectionLabel: string | null;
  exactQuestionText: string;
  answerText: string;
  extractionStatus: string;
  sourceLocator: string | null;
  provenanceClass: HistoricalProvenanceClass;
  mappedFieldIds: string[];
  excelRelPath: string;
  pdfAvailable: boolean;
  importedAt: string;
  updatedAt: string;
}

/** Golden evaluation case — references historical DB, does not duplicate full text. */
export interface GoldenRfpCase {
  historicalRfpId: string;
  title: string;
  hasPdf: boolean;
  excelRelPath: string;
  pdfRelPath: string | null;
  evaluationEligibility: HistoricalEvaluationEligibility;
  expectedCanonicalQuestionCount: number;
  expectedCanonicalQuestionIds: string[];
  statusDistribution: Record<string, number>;
  supportedFieldIds: string[];
  unsupportedFieldIds: string[];
  noncanonicalAnswerCount: number;
}

/** Contract for future extraction evaluation (no model runs in this task). */
export interface ExtractionEvaluationContract {
  version: 1;
  description: string;
  predicted: {
    /** Field IDs RAMI extraction claimed to fill */
    fieldIds: string[];
    /** Optional per-field predicted values / statuses */
    fields: Array<{
      fieldId: string;
      value?: unknown;
      collectionState?: string;
      gapStatus?: string;
    }>;
    /** Optional question-level detections */
    questions?: Array<{
      questionId: string;
      detected: boolean;
      classifiedAs?: 'answered' | 'tbc' | 'not_applicable' | 'missing';
    }>;
  };
  golden: {
    historicalRfpId: string;
    supportedFieldIds: string[];
    canonicalAnswers: Array<{
      questionId: string;
      extractionStatus: string;
      mappedFieldIds: string[];
    }>;
  };
  metricsPlanned: string[];
  comparisonNotes: string[];
}

export interface QuestionCoverageReport {
  historicalRfpId: string;
  expectedCanonical: number;
  matchedCanonical: number;
  missingQuestionIds: string[];
  unexpectedCanonicalIds: string[];
  statusDistribution: Record<string, number>;
  tbcCount: number;
  notApplicableCount: number;
  partiallyStatedCount: number;
  answeredCount: number;
}

export interface FieldCoverageReport {
  historicalRfpId: string;
  supportedFieldIds: string[];
  unsupportedFieldIds: string[];
  fieldToQuestionIds: Record<string, string[]>;
  multiFieldQuestions: Array<{ questionId: string; fieldIds: string[] }>;
}

export const EXTRACTION_EVAL_METRICS_PLANNED = [
  'field_detection_precision',
  'field_detection_recall',
  'question_coverage_recall',
  'tbc_na_classification_accuracy',
  'source_provenance_present_rate',
  'semantic_value_similarity_later',
] as const;
