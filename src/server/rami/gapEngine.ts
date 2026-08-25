/**
 * Deterministic gap detection engine.
 * Authority: .private-context/architecture/rami-agent-architecture.md §2
 *
 * This module contains ONLY TypeScript logic — no LLM calls.
 * The LLM decides NOTHING about gap detection; that is the hard rule.
 */

import type { ProjectMemory } from '@/types/projectMemory';
import { PROJECT_MEMORY_FIELDS } from '@/schema/projectMemoryFields';
import { RFP_SECTIONS, isSectionApplicable, type SectionApplicabilityContext } from '@/schema/rfpSchema';
import type { GapAnalysis } from '@/types/conversation';

/**
 * Business-conversation priority for fields (lower = ask sooner).
 * Administrative / presentation fields (title, tender number, deadline) have
 * low priority so they don't interrupt meaningful BA discovery.
 * Required by Phase 2.1 — Priority fix.
 */
const FIELD_BUSINESS_PRIORITY: Partial<Record<string, number>> = {
  // Critical — project definition (ask first)
  documentType:          1,
  beneficiaryEntity:     1,
  currentSituation:      1,
  businessNeedRationale: 1,

  // High — scope and stakeholders
  businessObjectives:    2,
  engagementType:        2,
  inScope:               2,
  users:                 2,
  painPoints:            2,
  stakeholderRoles:      3,

  // Medium — requirements, delivery, technical
  outOfScope:            3,
  functionalModules:     3,
  integrations:          3,
  engagementDuration:    3,
  keyWorkflows:          4,
  hostingModel:          4,
  deliverableItems:      4,
  evaluationWeights:     4,
  supportPeriodAndHours: 4,
  slaTiers:              4,

  // Lower — details that don't block discovery
  engagementPhases:      5,
  uatRounds:             5,
  acceptanceCriteria:    5,
  performanceAvailabilityTargets: 5,
  securityRequirements:  5,

  // Low — administrative, presentation (ask last)
  documentTitle:         8,
  tenderNumber:          9,
  proposalDeadline:      9,
  referenceTemplateId:   9,
};

/**
 * Build an applicability context from the current memory state.
 * Used to determine which conditional sections and fields are relevant.
 */
export function buildApplicabilityContext(memory: ProjectMemory): SectionApplicabilityContext {
  const docType = (memory.documentType?.current?.value as string | undefined) ?? '';
  const engType = (memory.engagementType?.current?.value as string | undefined) ?? '';

  return {
    documentType: docType,
    engagementType: engType,
    hasDeliveryMilestone: ['system-implementation'].includes(docType),
    hasSupportPeriod: ['system-implementation', 'support'].includes(docType),
    hasNamedRoles: false, // determined by free-text analysis in Phase 3+
    isLargeEngagement: ['system-implementation'].includes(docType),
  };
}

/** Returns true if a field in ProjectMemory has a meaningful value (not null, not TBC). */
function isFieldFilled(memory: ProjectMemory, fieldId: string): boolean {
  const field = (memory as unknown as Record<string, unknown>)[fieldId];
  if (!field || typeof field !== 'object') return false;
  const entry = (field as { current?: { value?: unknown; status?: string } }).current;
  if (!entry) return false;
  if (entry.status === 'TBC') return false;
  if (entry.value === null || entry.value === undefined) return false;
  if (Array.isArray(entry.value) && entry.value.length === 0) return false;
  if (typeof entry.value === 'string' && entry.value.trim() === '') return false;
  return true;
}

/** Returns true if a field is present but explicitly TBC. */
function isFieldTbc(memory: ProjectMemory, fieldId: string): boolean {
  const field = (memory as unknown as Record<string, unknown>)[fieldId];
  if (!field || typeof field !== 'object') return false;
  const entry = (field as { current?: { status?: string } }).current;
  return entry?.status === 'TBC';
}

/**
 * Compute the composite priority score for a field (lower = ask sooner).
 * Combines business priority with section order so fields in earlier sections
 * are asked before later ones within the same business priority tier.
 */
function computeFieldScore(fieldId: string): number {
  const def = PROJECT_MEMORY_FIELDS.find((f) => f.fieldId === fieldId);
  if (!def) return 999;

  const businessPriority = FIELD_BUSINESS_PRIORITY[fieldId] ?? 5; // default medium

  // Find earliest applicable section order
  let earliestSectionOrder = 999;
  for (const sid of def.targetSections) {
    const section = RFP_SECTIONS.find((s) => s.sectionId === sid);
    if (section && section.order < earliestSectionOrder) {
      earliestSectionOrder = section.order;
    }
  }

  // explicitAskIfMissing = small bonus to ask it sooner within a priority tier
  const askBonus = def.explicitAskIfMissing ? 0 : 0.3;

  // Score: business priority dominates, then section order, then ask bonus
  return businessPriority * 100 + earliestSectionOrder + askBonus;
}

/**
 * Perform deterministic gap analysis on the current project memory.
 * Returns structured gap information used by the next-question engine.
 */
export function analyzeGaps(memory: ProjectMemory): GapAnalysis {
  const ctx = buildApplicabilityContext(memory);

  const applicableSections = RFP_SECTIONS.filter((s) => isSectionApplicable(s, ctx));
  const applicableSectionIds = new Set(applicableSections.map((s) => s.sectionId));
  const applicableSectionCount = applicableSections.length;

  const missingRequired: string[] = [];
  const missingConditional: string[] = [];
  const tbcFields: string[] = [];
  let filledCount = 0;
  let totalRequired = 0;

  for (const field of PROJECT_MEMORY_FIELDS) {
    const { fieldId, requirement, targetSections } = field;

    const isApplicable =
      targetSections.length === 0 ||
      targetSections.some((sid) => applicableSectionIds.has(sid));

    if (!isApplicable) continue;

    if (requirement === 'required') totalRequired++;

    if (isFieldTbc(memory, fieldId)) {
      tbcFields.push(fieldId);
      continue;
    }

    if (isFieldFilled(memory, fieldId)) {
      if (requirement === 'required') filledCount++;
      continue;
    }

    if (requirement === 'required') {
      missingRequired.push(fieldId);
    } else if (requirement === 'conditional' && isApplicable) {
      missingConditional.push(fieldId);
    }
  }

  // Sort missing fields: required before conditional, then by composite priority score
  const allMissing = [...missingRequired, ...missingConditional];
  allMissing.sort((a, b) => {
    const aIsRequired = missingRequired.includes(a);
    const bIsRequired = missingRequired.includes(b);
    if (aIsRequired && !bIsRequired) return -1;
    if (!aIsRequired && bIsRequired) return 1;
    return computeFieldScore(a) - computeFieldScore(b);
  });

  const nextPriorityFieldId = allMissing[0] ?? null;
  const nextPriorityLabel = nextPriorityFieldId
    ? (PROJECT_MEMORY_FIELDS.find((f) => f.fieldId === nextPriorityFieldId)?.label ?? null)
    : null;

  const completionPercent = totalRequired > 0
    ? Math.round((filledCount / totalRequired) * 100)
    : 0;

  return {
    missingRequired,
    missingConditional,
    tbcFields,
    filledCount,
    totalRequired,
    completionPercent,
    applicableSectionCount,
    nextPriorityFieldId,
    nextPriorityLabel,
  };
}

/**
 * Returns the current active section (the earliest section in COLLECTING state
 * or the first section with missing required fields).
 */
export function getActiveSection(
  memory: ProjectMemory,
  sectionStates: Record<string, { state: string }>,
): string | null {
  const ctx = buildApplicabilityContext(memory);

  for (const section of RFP_SECTIONS) {
    if (!isSectionApplicable(section, ctx)) continue;
    const state = sectionStates[section.sectionId]?.state ?? 'NOT_STARTED';
    if (state === 'COLLECTING' || state === 'NOT_STARTED') {
      return section.sectionId;
    }
  }
  return null;
}
