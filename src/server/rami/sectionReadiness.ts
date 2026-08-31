/**
 * Section Readiness Engine.
 * Gap Engine asks what to collect next. This engine asks whether a section
 * can be drafted responsibly from persisted ProjectFacts.
 * Qwen does not decide readiness.
 */

import type { ProjectMemory } from '@/types/projectMemory';
import type { ProjectContext } from '@/types/projectContext';
import type { GapStatus } from '@/types/gapStatus';
import type {
  SectionInformationReadiness,
  SectionReadinessResult,
} from '@/types/sectionReadiness';
import { RFP_SECTIONS, isSectionApplicable, getRfpSection } from '@/schema/rfpSchema';
import { getFieldControlMeta } from '@/schema/fieldControlMeta';
import {
  BOILERPLATE_SECTION_IDS,
  SECTION_COVERAGE_NOTES,
  getSectionFieldLinks,
} from '@/schema/sectionFieldMap';
import { classifySpokenUnknown } from '@/server/rami/spokenTbc';
import { buildApplicabilityContext } from '@/server/rami/gapEngine';
import { createEmptyProjectContext } from '@/types/projectContext';

type Completeness = 'answered' | 'tbc' | 'not_applicable' | 'missing' | 'contradictory';

interface MemoryBag {
  current?: { value?: unknown; status?: string };
  gapStatus?: GapStatus;
  deferredTo?: string;
  contradiction?: unknown;
}

function getBag(memory: ProjectMemory, fieldId: string): MemoryBag | null {
  const raw = (memory as unknown as Record<string, unknown>)[fieldId];
  if (!raw || typeof raw !== 'object') return null;
  return raw as MemoryBag;
}

function classifyFieldCompleteness(memory: ProjectMemory, fieldId: string): Completeness {
  const bag = getBag(memory, fieldId);
  if (!bag || !bag.current) return 'missing';
  if (bag.gapStatus === 'CONTRADICTORY' || bag.contradiction) return 'contradictory';
  if (bag.gapStatus === 'NOT_APPLICABLE') return 'not_applicable';
  if (bag.gapStatus === 'DEFERRED' || bag.gapStatus === 'UNKNOWN') return 'tbc';
  if (bag.current.status === 'TBC') return 'tbc';
  // Historical suggestions must never satisfy readiness as answered
  if (bag.current.status === 'PROPOSED' || bag.current.status === 'REFERENCE') {
    return 'tbc';
  }
  if (classifySpokenUnknown(bag.current.value) !== null) return 'tbc';

  const value = bag.current.value;
  if (value === null || value === undefined) return 'missing';
  if (typeof value === 'string' && value.trim() === '') return 'missing';
  if (Array.isArray(value) && value.length === 0) return 'missing';
  return 'answered';
}

/** Foundational Introduction clusters — RAMI drafts from these; BA does not supply intro prose. */
export const INTRODUCTION_WHO_FIELDS = ['beneficiaryEntity'] as const;
export const INTRODUCTION_WHAT_FIELDS = ['documentTitle', 'documentType', 'engagementType'] as const;
export const INTRODUCTION_WHY_FIELDS = [
  'currentSituation',
  'businessNeedRationale',
  'businessObjectives',
  'inScope',
] as const;

function clusterStatus(
  memory: ProjectMemory,
  fieldIds: readonly string[],
): Completeness {
  const states = fieldIds.map((id) => classifyFieldCompleteness(memory, id));
  if (states.some((s) => s === 'contradictory')) return 'contradictory';
  if (states.some((s) => s === 'answered')) return 'answered';
  if (states.some((s) => s === 'tbc')) return 'tbc';
  return 'missing';
}

function resolveIntroductionReadiness(input: {
  memory: ProjectMemory;
  criticalBlockers: string[];
}): SectionInformationReadiness {
  const who = clusterStatus(input.memory, INTRODUCTION_WHO_FIELDS);
  const what = clusterStatus(input.memory, INTRODUCTION_WHAT_FIELDS);
  const why = clusterStatus(input.memory, INTRODUCTION_WHY_FIELDS);

  if (who === 'missing' || who === 'contradictory') {
    if (!input.criticalBlockers.includes('beneficiaryEntity')) {
      input.criticalBlockers.push('beneficiaryEntity');
    }
  }
  if (what === 'missing' || what === 'contradictory') {
    if (!input.criticalBlockers.includes('documentType')) {
      input.criticalBlockers.push('documentType');
    }
  }
  if (why === 'missing' || why === 'contradictory') {
    if (!input.criticalBlockers.includes('businessNeedRationale')) {
      input.criticalBlockers.push('businessNeedRationale');
    }
  }

  if (
    who === 'missing' ||
    what === 'missing' ||
    why === 'missing' ||
    who === 'contradictory' ||
    what === 'contradictory' ||
    why === 'contradictory'
  ) {
    return 'NOT_READY';
  }
  if (who === 'tbc' || what === 'tbc' || why === 'tbc') return 'DRAFTABLE_WITH_TBC';
  return 'READY_TO_DRAFT';
}

function isPackAskable(fieldId: string, ctx: ProjectContext): boolean {
  const meta = getFieldControlMeta(fieldId);
  return meta.packs.some((p) => ctx.activePacks.includes(p));
}

export function getSectionReadiness(
  memory: ProjectMemory,
  sectionId: string,
  projectContext?: ProjectContext,
): SectionReadinessResult {
  const section = getRfpSection(sectionId);
  const ctx = projectContext ?? createEmptyProjectContext();
  const sectionCtx = buildApplicabilityContext(memory, ctx);
  const empty: SectionReadinessResult = {
    sectionId,
    applicable: false,
    readiness: 'NOT_APPLICABLE',
    answeredFields: [],
    tbcFields: [],
    notApplicableFields: [],
    missingFields: [],
    criticalBlockers: [],
  };

  if (!section) return { ...empty, coverageNote: 'Unknown sectionId' };

  const applicable = isSectionApplicable(section, sectionCtx);
  if (!applicable) return empty;

  const links = getSectionFieldLinks().filter((l) => l.sectionId === sectionId);
  const answeredFields: string[] = [];
  const tbcFields: string[] = [];
  const notApplicableFields: string[] = [];
  const missingFields: string[] = [];
  const criticalBlockers: string[] = [];

  for (const link of links) {
    const packOn = isPackAskable(link.fieldId, ctx);
    const completeness = classifyFieldCompleteness(memory, link.fieldId);

    if (!packOn && completeness === 'missing') {
      notApplicableFields.push(link.fieldId);
      continue;
    }

    if (completeness === 'not_applicable') {
      if (link.naValid) notApplicableFields.push(link.fieldId);
      else {
        missingFields.push(link.fieldId);
        if (link.role === 'must-have') criticalBlockers.push(link.fieldId);
      }
      continue;
    }

    if (completeness === 'contradictory') {
      criticalBlockers.push(link.fieldId);
      continue;
    }

    if (completeness === 'answered') {
      answeredFields.push(link.fieldId);
      continue;
    }

    if (completeness === 'tbc') {
      tbcFields.push(link.fieldId);
      continue;
    }

    missingFields.push(link.fieldId);
    if (link.role === 'must-have') criticalBlockers.push(link.fieldId);
  }

  const coverage = SECTION_COVERAGE_NOTES[sectionId];
  const boilerplate = BOILERPLATE_SECTION_IDS.has(sectionId);

  let readiness: SectionInformationReadiness;
  if (sectionId === 'coverPage') {
    readiness =
      tbcFields.length > 0 || missingFields.length > 0 || criticalBlockers.length > 0
        ? 'DRAFTABLE_WITH_TBC'
        : 'READY_TO_DRAFT';
  } else if (sectionId === 'annexes') {
    const annexTbc = tbcFields.filter((id) => id !== 'requiredAnnexes');
    readiness = annexTbc.length > 0 ? 'DRAFTABLE_WITH_TBC' : 'READY_TO_DRAFT';
  } else if (sectionId === 'introduction') {
    readiness = resolveIntroductionReadiness({
      memory,
      criticalBlockers,
    });
  } else if (criticalBlockers.length > 0) {
    readiness = 'NOT_READY';
  } else if (boilerplate && links.length === 0) {
    readiness = 'READY_TO_DRAFT';
  } else if (tbcFields.length > 0) {
    readiness = 'DRAFTABLE_WITH_TBC';
  } else {
    readiness = 'READY_TO_DRAFT';
  }

  if (coverage?.severity === 'CRITICAL' && applicable && sectionId !== 'coverPage') {
    if (answeredFields.length === 0 && tbcFields.length === 0) {
      readiness = 'NOT_READY';
      if (!criticalBlockers.includes('__coverage_gap__')) criticalBlockers.push('__coverage_gap__');
    } else if (readiness === 'READY_TO_DRAFT') {
      readiness = 'DRAFTABLE_WITH_TBC';
    }
  }

  return {
    sectionId,
    applicable: true,
    readiness,
    answeredFields,
    tbcFields,
    notApplicableFields,
    missingFields,
    criticalBlockers,
    coverageGap: coverage?.severity,
    coverageNote: coverage?.note,
  };
}

export function getAllSectionReadiness(
  memory: ProjectMemory,
  projectContext?: ProjectContext,
): SectionReadinessResult[] {
  return RFP_SECTIONS.map((s) => getSectionReadiness(memory, s.sectionId, projectContext));
}
