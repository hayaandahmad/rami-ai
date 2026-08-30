/**
 * Many-to-many Field ↔ Section mapping for Section Readiness.
 * Authority: PROJECT_MEMORY_FIELDS.targetSections ∪ Question Bank section links.
 * fields.section_id remains a convenience primary FK and is not used for readiness.
 */

import { PROJECT_MEMORY_FIELDS, getFieldDef } from './projectMemoryFields';
import { QUESTION_SEEDS } from './questionBankSeed';
import { getFieldControlMeta } from './fieldControlMeta';
import { RFP_SECTIONS } from './rfpSchema';
import type { SectionFieldLink, SectionFieldRole } from '@/types/sectionReadiness';

function deriveRole(fieldId: string, sectionId: string, sectionCount: number): SectionFieldRole {
  const def = getFieldDef(fieldId);
  const meta = getFieldControlMeta(fieldId);
  const inDeclaredTargets = (def?.targetSections as readonly string[] | undefined)?.includes(
    sectionId,
  );
  const primary = def?.targetSections[0];
  const isPrimary = primary === sectionId || (!primary && !inDeclaredTargets && sectionCount === 1);

  if (meta.materiality === 'CRITICAL' && (inDeclaredTargets || isPrimary)) return 'must-have';
  if (
    meta.materiality === 'HIGH' &&
    (isPrimary || (inDeclaredTargets && def?.requirement === 'required'))
  ) {
    return 'must-have';
  }
  if (sectionCount > 1) return 'shared';
  return 'supporting';
}

function naValidFor(fieldId: string): boolean {
  const def = getFieldDef(fieldId);
  if (!def) return true;
  if (fieldId === 'riskNotes') return true;
  if (def.requirement === 'conditional') return true;
  return getFieldControlMeta(fieldId).materiality === 'LOW';
}

/** Stable ordered links used by readiness + PostgreSQL seed. */
export function getSectionFieldLinks(): SectionFieldLink[] {
  const pairKeys = new Map<string, { sectionId: string; fieldId: string }>();

  for (const field of PROJECT_MEMORY_FIELDS) {
    for (const sectionId of field.targetSections) {
      pairKeys.set(`${sectionId}::${field.fieldId}`, { sectionId, fieldId: field.fieldId });
    }
  }

  for (const q of QUESTION_SEEDS) {
    for (const fieldId of q.fieldIds) {
      pairKeys.set(`${q.sectionId}::${fieldId}`, { sectionId: q.sectionId, fieldId });
    }
  }

  /** Audit extras: shared facts that drafting needs but targetSections/Q-bank missed. */
  const extraPairs: Array<{ sectionId: string; fieldId: string }> = [
    { sectionId: 'administrativeProcedures', fieldId: 'tenderNumber' },
    { sectionId: 'projectManagementGovernance', fieldId: 'engagementPhases' },
    { sectionId: 'projectManagementGovernance', fieldId: 'stakeholderRoles' },
    { sectionId: 'manpowerRequirements', fieldId: 'stakeholderRoles' },
  ];
  for (const pair of extraPairs) {
    pairKeys.set(`${pair.sectionId}::${pair.fieldId}`, pair);
  }

  const sectionCounts = new Map<string, number>();
  for (const { fieldId } of pairKeys.values()) {
    sectionCounts.set(fieldId, (sectionCounts.get(fieldId) ?? 0) + 1);
  }

  const links: SectionFieldLink[] = [];
  for (const { sectionId, fieldId } of pairKeys.values()) {
    const count = sectionCounts.get(fieldId) ?? 1;
    links.push({
      sectionId,
      fieldId,
      role: deriveRole(fieldId, sectionId, count),
      tbcAllowsDraft: true,
      naValid: naValidFor(fieldId),
    });
  }

  links.sort((a, b) => {
    const so =
      (RFP_SECTIONS.find((s) => s.sectionId === a.sectionId)?.order ?? 99) -
      (RFP_SECTIONS.find((s) => s.sectionId === b.sectionId)?.order ?? 99);
    if (so !== 0) return so;
    return a.fieldId.localeCompare(b.fieldId);
  });

  return links;
}

export function getFieldIdsForSection(sectionId: string): string[] {
  return getSectionFieldLinks()
    .filter((l) => l.sectionId === sectionId)
    .map((l) => l.fieldId);
}

export function getSectionIdsForField(fieldId: string): string[] {
  return getSectionFieldLinks()
    .filter((l) => l.fieldId === fieldId)
    .map((l) => l.sectionId);
}

/** Sections that can be drafted from template/boilerplate with no project facts. */
export const BOILERPLATE_SECTION_IDS = new Set(['tableOfContents', 'abbreviations']);

/**
 * Applicable sections with no (or insufficient) field coverage.
 * Documented gaps — not new Fields in this task.
 */
export const SECTION_COVERAGE_NOTES: Record<
  string,
  { severity: 'CRITICAL' | 'IMPORTANT' | 'OPTIONAL'; note: string }
> = {
  tableOfContents: {
    severity: 'OPTIONAL',
    note: 'Generated from the applicable outline. No ProjectFacts required.',
  },
  abbreviations: {
    severity: 'OPTIONAL',
    note: 'Glossary can be derived during generation; no dedicated field.',
  },
  administrativeProcedures: {
    severity: 'IMPORTANT',
    note: 'Only proposalDeadline (and shared tenderNumber) are collected. Submission format, late-bid rules, and clarification contact are historically boilerplate (SYSTEM_DEFAULT). Propose later: clarificationContact, submissionChannel.',
  },
  projectManagementGovernance: {
    severity: 'IMPORTANT',
    note: 'No dedicated PMO fields. Shared engagementPhases / stakeholderRoles are insufficient for a full governance section. Propose later: governanceCadence.',
  },
  manpowerRequirements: {
    severity: 'CRITICAL',
    note: 'When this conditional section applies, no named-roles field exists. stakeholderRoles is shared supporting only. Propose later: namedRoles (role / experience / qualification).',
  },
  implementationRequirements: {
    severity: 'IMPORTANT',
    note: 'Only phases/duration/UAT-adjacent fields map here. Implementation stages (design, training, KT) are not first-class Fields.',
  },
};
