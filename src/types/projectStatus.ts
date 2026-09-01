/**
 * Deterministic project-status snapshot for gap / "what is missing?" questions.
 * TypeScript owns the facts. The LLM must not invent this state.
 */

import type { NextAction } from './nextAction';
import type { GapStatus, Materiality } from './gapStatus';
import type { SectionInformationReadiness } from './sectionReadiness';

export type SectionProgressKind =
  | 'not_applicable'
  | 'needs_information'
  | 'ready_to_draft'
  | 'automatically_prepared'
  | 'generated_draft'
  | 'approved';

export type ProjectSpecificAnnexStatus = 'none' | 'known' | 'details_missing';

export interface SectionStatusEntry {
  sectionId: string;
  title: string;
  applicable: boolean;
  readiness: SectionInformationReadiness;
  progressKind: SectionProgressKind;
  generated: boolean;
  approved: boolean;
  automaticallyPrepared: boolean;
  missingFieldIds: string[];
  missingFieldLabels: string[];
  tbcFieldIds: string[];
  tbcFieldLabels: string[];
  contradictionFieldIds: string[];
  contradictionFieldLabels: string[];
}

export interface StatusNextInformationNeed {
  type: NextAction['type'];
  fieldId?: string;
  fieldLabel?: string;
  contradictionValues?: unknown[];
  reason?: string;
}

export interface ProjectStatusSnapshot {
  applicableSectionTitles: string[];
  sections: SectionStatusEntry[];
  automaticallyPreparedTitles: string[];
  needsInformation: SectionStatusEntry[];
  readyToDraft: SectionStatusEntry[];
  generatedDrafts: SectionStatusEntry[];
  approved: SectionStatusEntry[];
  notApplicableTitles: string[];
  /** Real information gaps (MISSING / UNKNOWN / CONTRADICTORY), labels only for phrasing. */
  missingInformationLabels: string[];
  contradictionLabels: string[];
  contradictionValuesByFieldId: Record<string, unknown[]>;
  projectSpecificAnnexStatus: ProjectSpecificAnnexStatus;
  standardAnnexesAutomaticallyPrepared: boolean;
  nextInformationNeed: StatusNextInformationNeed;
  collectionSufficient: boolean;
  nextAction: NextAction;
  fieldGapStatuses: Array<{
    fieldId: string;
    label: string;
    gapStatus: GapStatus;
    materiality: Materiality;
  }>;
}

/** Invented names that must never appear in a status reply. */
export const FORBIDDEN_STATUS_SECTION_PHRASES = [
  'Executive Summary',
  'Appendices',
  'Appendix',
  'Terms and Conditions',
] as const;
