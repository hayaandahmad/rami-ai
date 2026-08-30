/**
 * Reusable generated RFP section representation.
 * One model for PostgreSQL persistence, A4 preview, and later DOCX.
 * Authority: rfp-section-readiness.md §5, DECISIONS #30–#31.
 */

import type { SectionInformationReadiness } from './sectionReadiness';

/** Document workflow for generated prose — not SectionInformationReadiness. */
export type SectionApprovalStatus = 'DRAFT' | 'APPROVED';

export type GeneratedBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet_list'; items: string[] }
  | { type: 'numbered_list'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'tbc'; label: string; fieldId?: string };

export interface GeneratedSection {
  sectionId: string;
  title: string;
  /** Monotonic per project+section; starts at 1. */
  version: number;
  approvalStatus: SectionApprovalStatus;
  generatedAt: string;
  readinessAtGeneration: 'READY_TO_DRAFT' | 'DRAFTABLE_WITH_TBC';
  modelUsed: string;
  blocks: GeneratedBlock[];
  /** Field IDs whose answered values were in generation context. */
  sourceFieldIds: string[];
  /** Field IDs that must appear as explicit TBC markers. */
  tbcFieldIds: string[];
}

export interface GenerationFactSnapshot {
  fieldId: string;
  label: string;
  value: unknown;
  provenance: string;
  role: 'must-have' | 'supporting' | 'shared';
}

export interface GenerationTbcSnapshot {
  fieldId: string;
  label: string;
  deferredTo?: string;
}

/**
 * Controlled, auditable context for one section generation call.
 * Never includes full DB, full chat history, or historical RFP prose as facts.
 */
export interface SectionGenerationContext {
  projectId: string;
  documentKey: string;
  sectionId: string;
  title: string;
  subsections: Array<{ id: string; title: string }>;
  applicable: true;
  readiness: 'READY_TO_DRAFT' | 'DRAFTABLE_WITH_TBC';
  answeredFacts: GenerationFactSnapshot[];
  /** Shared/cross-section answered facts intentionally included for consistency. */
  sharedFacts: GenerationFactSnapshot[];
  tbcFields: GenerationTbcSnapshot[];
  notApplicableFields: string[];
  documentMeta: {
    documentTitle?: string;
    beneficiaryEntity?: string;
    documentType?: string;
    engagementType?: string;
    engagementDuration?: string;
  };
  antiHallucinationRules: string[];
}

export interface AssembledRfpSectionSlot {
  sectionId: string;
  title: string;
  order: number;
  applicable: boolean;
  readiness: SectionInformationReadiness;
  approvalStatus: SectionApprovalStatus | null;
  generated: GeneratedSection | null;
  missingGeneration: boolean;
}

export interface AssembledRfp {
  documentKey: string;
  projectId: string;
  assembledAt: string;
  sections: AssembledRfpSectionSlot[];
  applicableSectionCount: number;
  generatedApplicableCount: number;
  approvedApplicableCount: number;
  complete: boolean;
}

export type GenerationErrorCode =
  | 'NOT_APPLICABLE'
  | 'NOT_READY'
  | 'SECTION_UNKNOWN'
  | 'APPROVED_CONTENT_PROTECTED'
  | 'PROVIDER_FAILED'
  | 'INVALID_MODEL_OUTPUT'
  | 'PROJECT_NOT_FOUND'
  | 'CONTENT_NOT_FOUND';

export class GenerationError extends Error {
  readonly code: GenerationErrorCode;
  readonly details?: unknown;

  constructor(code: GenerationErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'GenerationError';
    this.code = code;
    this.details = details;
  }
}

export const ANTI_HALLUCINATION_RULES: readonly string[] = [
  'Use only facts listed in answeredFacts / sharedFacts / documentMeta.',
  'Never invent dates, budgets, SLA values, technologies, integrations, people/users, quantities, percentages, evaluation weightings, delivery deadlines, support periods, certifications, procurement conditions, legal clauses, penalties, or staffing counts.',
  'When a field is listed in tbcFields, render an explicit professional TBC marker (block type "tbc"); do not invent a value.',
  'When a field is in notApplicableFields, omit it; do not invent placeholder prose.',
  'Historical or reference RFP content is not current ProjectFacts — do not assert it.',
  'RFP document language is English regardless of conversation language.',
  'Prefer short professional paragraphs and lists; do not invent tables of numbers.',
];

export const TBC_MARKER_PREFIX = '[To be confirmed]';
