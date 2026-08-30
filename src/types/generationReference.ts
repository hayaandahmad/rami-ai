/**
 * BA-approved historical drafting references.
 * These are NOT ProjectFacts and must never satisfy readiness or gap status.
 */

export const GENERATION_REFERENCE_STATUSES = ['ACTIVE', 'REVOKED'] as const;
export type GenerationReferenceStatus = (typeof GENERATION_REFERENCE_STATUSES)[number];

export const GENERATION_REFERENCE_SCOPES = ['STRUCTURE_AND_LANGUAGE'] as const;
export type GenerationReferenceUsageScope = (typeof GENERATION_REFERENCE_SCOPES)[number];

export const MAX_GENERATION_REFERENCES_PER_SECTION = 3;

export const HIGH_RISK_GENERATION_SECTIONS = new Set([
  'financialProposal',
  'legalContractualTerms',
  'evaluationCriteria',
  'supportMaintenance',
]);

export interface ProjectGenerationReference {
  generationReferenceId: string;
  projectId: string;
  sectionId: string;
  historicalChunkId: string;
  usageScope: GenerationReferenceUsageScope;
  status: GenerationReferenceStatus;
  approvedBy: string | null;
  approvedAt: string;
  createdAt: string;
  revokedAt: string | null;
}

/** Compact lineage stored on GeneratedSection versions (no full historical text). */
export interface GenerationReferenceLineage {
  generationReferenceId: string;
  chunkId: string;
  historicalRfpId: string;
  historicalRfpTitle?: string;
  sourceLocator?: string;
  usageScope: GenerationReferenceUsageScope;
}

/** Controlled payload injected into SectionGenerationContext — separate from facts. */
export interface GenerationHistoricalReference {
  generationReferenceId: string;
  chunkId: string;
  historicalRfpId: string;
  historicalRfpTitle: string;
  excerpt: string;
  mappedFieldIds: string[];
  canonicalQuestionIds: string[];
  sectionIds: string[];
  provenanceClass: 'REFERENCE';
  sourceLocator?: string;
  usageScope: GenerationReferenceUsageScope;
}
