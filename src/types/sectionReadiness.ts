/**
 * Information readiness for one RFP section — not the document lifecycle.
 * Lifecycle (DRAFTING / REVIEW / APPROVED) lives in sectionState.ts.
 */

export type SectionInformationReadiness =
  | 'NOT_APPLICABLE'
  | 'NOT_READY'
  | 'DRAFTABLE_WITH_TBC'
  | 'READY_TO_DRAFT';

export type SectionFieldRole = 'must-have' | 'supporting' | 'shared';

export type SectionCoverageGapSeverity = 'CRITICAL' | 'IMPORTANT' | 'OPTIONAL';

export interface SectionFieldLink {
  sectionId: string;
  fieldId: string;
  role: SectionFieldRole;
  tbcAllowsDraft: boolean;
  naValid: boolean;
}

export interface SectionReadinessResult {
  sectionId: string;
  applicable: boolean;
  readiness: SectionInformationReadiness;
  answeredFields: string[];
  tbcFields: string[];
  notApplicableFields: string[];
  missingFields: string[];
  criticalBlockers: string[];
  coverageGap?: SectionCoverageGapSeverity;
  coverageNote?: string;
}

export interface ProjectSectionReadinessReport {
  documentKey?: string;
  results: SectionReadinessResult[];
}
