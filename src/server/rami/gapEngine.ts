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
  if (entry.status === 'TBC') return false; // TBC = explicitly deferred, not filled
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
 * Perform deterministic gap analysis on the current project memory.
 * Returns structured gap information used by the next-question engine.
 */
export function analyzeGaps(memory: ProjectMemory): GapAnalysis {
  const ctx = buildApplicabilityContext(memory);

  // Determine which sections are applicable
  const applicableSectionIds = new Set(
    RFP_SECTIONS
      .filter((s) => isSectionApplicable(s, ctx))
      .map((s) => s.sectionId),
  );

  const missingRequired: string[] = [];
  const missingConditional: string[] = [];
  const tbcFields: string[] = [];
  let filledCount = 0;
  let totalRequired = 0;

  for (const field of PROJECT_MEMORY_FIELDS) {
    const { fieldId, requirement, targetSections } = field;

    // Skip fields that target no applicable section (unless cross-cutting like riskNotes)
    const isApplicable =
      targetSections.length === 0 || // cross-cutting (riskNotes)
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

    // Field is missing
    if (requirement === 'required') {
      missingRequired.push(fieldId);
    } else if (requirement === 'conditional' && isApplicable) {
      missingConditional.push(fieldId);
    }
  }

  // Determine next priority field using priority rules:
  // 1. Required fields first, in canonical field order
  // 2. Fields for earlier sections first
  // 3. Fields with explicitAskIfMissing=true first
  function fieldPriority(fieldId: string): number {
    const def = PROJECT_MEMORY_FIELDS.find((f) => f.fieldId === fieldId);
    if (!def) return 999;

    // Find earliest applicable section this field targets
    let earliestOrder = 999;
    for (const sid of def.targetSections) {
      const section = RFP_SECTIONS.find((s) => s.sectionId === sid);
      if (section && section.order < earliestOrder) earliestOrder = section.order;
    }

    // Priority: fields with explicit ask first within same section
    const askBonus = def.explicitAskIfMissing ? 0 : 0.5;
    return earliestOrder + askBonus;
  }

  const allMissing = [...missingRequired, ...missingConditional];
  allMissing.sort((a, b) => {
    // Required before conditional
    const aIsRequired = missingRequired.includes(a);
    const bIsRequired = missingRequired.includes(b);
    if (aIsRequired && !bIsRequired) return -1;
    if (!aIsRequired && bIsRequired) return 1;
    return fieldPriority(a) - fieldPriority(b);
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
