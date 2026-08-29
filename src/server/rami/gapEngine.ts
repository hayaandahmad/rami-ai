/**
 * Deterministic gap detection engine v2 (Phase 2.2 Adaptive Control Plane).
 *
 * Owns: applicability vs materiality vs depth, GapStatus, NextAction, stop.
 * LLM decides NOTHING about gap detection or next action.
 */

import type { ProjectMemory } from '@/types/projectMemory';
import type { ProjectContext, PackId } from '@/types/projectContext';
import { isClassificationUnresolved } from '@/types/projectContext';
import type { GapStatus, Materiality } from '@/types/gapStatus';
import type { GapAnalysis, FieldGapSnapshot } from '@/types/conversation';
import type { NextAction } from '@/types/nextAction';
import { normalizeAskRequirements } from '@/types/nextAction';
import { PROJECT_MEMORY_FIELDS } from '@/schema/projectMemoryFields';
import { getFieldControlMeta } from '@/schema/fieldControlMeta';
import {
  RFP_SECTIONS,
  isSectionApplicable,
  type SectionApplicabilityContext,
} from '@/schema/rfpSchema';
import { createEmptyProjectContext } from '@/types/projectContext';

const MATERIALITY_RANK: Record<Materiality, number> = {
  CRITICAL: 0,
  HIGH: 1,
  STANDARD: 2,
  LOW: 3,
};

/** Build section applicability context from memory + ProjectContext. */
export function buildApplicabilityContext(
  memory: ProjectMemory,
  projectContext?: ProjectContext,
): SectionApplicabilityContext {
  const docType = (memory.documentType?.current?.value as string | undefined) ?? '';
  const engType = (memory.engagementType?.current?.value as string | undefined) ?? '';
  const ctx = projectContext ?? createEmptyProjectContext();
  const domain = ctx.primaryDomain;

  const isSystem =
    domain === 'SYSTEM_IMPLEMENTATION' || docType.toLowerCase().includes('system');
  const isConnectivity =
    domain === 'CONNECTIVITY' || docType.toLowerCase().includes('connect');
  const isSupport =
    domain === 'SLA_SUPPORT' || docType.toLowerCase().includes('support');

  return {
    documentType: docType,
    engagementType: engType,
    documentStage: ctx.documentStage,
    primaryDomain: domain,
    contractingGranularity: ctx.contractingGranularity,
    activePacks: ctx.activePacks,
    hasDeliveryMilestone: isSystem,
    hasSupportPeriod: isSystem || isSupport || isConnectivity,
    hasNamedRoles: false,
    isLargeEngagement: isSystem || ctx.complexity.process === 'HIGH',
  };
}

function getMemoryEntry(memory: ProjectMemory, fieldId: string) {
  const field = (memory as unknown as Record<string, unknown>)[fieldId];
  if (!field || typeof field !== 'object') return null;
  return (field as { current?: { value?: unknown; status?: string } }).current ?? null;
}

function isFieldFilled(memory: ProjectMemory, fieldId: string): boolean {
  const entry = getMemoryEntry(memory, fieldId);
  if (!entry) return false;
  if (entry.status === 'TBC') return false;
  if (entry.value === null || entry.value === undefined) return false;
  if (Array.isArray(entry.value) && entry.value.length === 0) return false;
  if (typeof entry.value === 'string' && entry.value.trim() === '') return false;
  return true;
}

function isFieldTbcProvenance(memory: ProjectMemory, fieldId: string): boolean {
  return getMemoryEntry(memory, fieldId)?.status === 'TBC';
}

function isContradictoryField(memory: ProjectMemory, fieldId: string): boolean {
  const field = (memory as unknown as Record<string, unknown>)[fieldId] as
    | { gapStatus?: GapStatus; contradiction?: unknown }
    | undefined;
  return field?.gapStatus === 'CONTRADICTORY' || !!field?.contradiction;
}

function isDeferredField(memory: ProjectMemory, fieldId: string): { deferred: boolean; to?: string } {
  const field = (memory as unknown as Record<string, unknown>)[fieldId] as
    | { gapStatus?: GapStatus; deferredTo?: string }
    | undefined;
  if (field?.gapStatus === 'DEFERRED') return { deferred: true, to: field.deferredTo };
  return { deferred: false };
}

function packActive(active: PackId[], packs: PackId[]): boolean {
  return packs.some((p) => active.includes(p));
}

/**
 * Field applicability for asking — pack-gated.
 * Section visibility in preview is separate and must not imply missing.
 */
function isFieldAskApplicable(
  fieldId: string,
  ctx: ProjectContext,
  sectionCtx: SectionApplicabilityContext,
): boolean {
  const meta = getFieldControlMeta(fieldId);
  const def = PROJECT_MEMORY_FIELDS.find((f) => f.fieldId === fieldId);
  if (!def) return false;

  // Pack gate
  if (!packActive(ctx.activePacks, meta.packs)) return false;

  // While unresolved: only CORE packs
  if (isClassificationUnresolved(ctx) && !meta.packs.includes('CORE')) {
    return false;
  }

  // Section gate for conditional fields (when packs allow)
  if (def.targetSections.length === 0) return true;
  const applicableSectionIds = new Set(
    RFP_SECTIONS.filter((s) => isSectionApplicable(s, sectionCtx)).map((s) => s.sectionId),
  );
  return def.targetSections.some((sid) => applicableSectionIds.has(sid));
}

function computeGapStatus(
  memory: ProjectMemory,
  fieldId: string,
  askApplicable: boolean,
): { status: GapStatus; deferredTo?: string } {
  if (!askApplicable) return { status: 'NOT_APPLICABLE' };

  if (isContradictoryField(memory, fieldId)) return { status: 'CONTRADICTORY' };

  const deferred = isDeferredField(memory, fieldId);
  if (deferred.deferred) return { status: 'DEFERRED', deferredTo: deferred.to };

  if (isFieldTbcProvenance(memory, fieldId)) return { status: 'UNKNOWN' };

  const field = (memory as unknown as Record<string, unknown>)[fieldId] as
    | { gapStatus?: GapStatus }
    | undefined;
  if (field?.gapStatus === 'UNKNOWN') return { status: 'UNKNOWN' };

  if (isFieldFilled(memory, fieldId)) return { status: 'KNOWN' };

  return { status: 'MISSING' };
}

/**
 * Safe UNKNOWN: non-blocking only when materiality is STANDARD/LOW,
 * does not block a CRITICAL/HIGH dependency, and is not necessary for
 * scope, acceptance, legal/commercial structure, or another blocking requirement.
 */
export function isSafeUnknown(fieldId: string, materiality: Materiality): boolean {
  if (materiality === 'CRITICAL' || materiality === 'HIGH') return false;
  const blockingIds = new Set([
    'documentType',
    'engagementType',
    'beneficiaryEntity',
    'currentSituation',
    'businessNeedRationale',
    'inScope',
    'outOfScope',
    'acceptanceCriteria',
    'evaluationWeights',
    'pricingModelAndCostBreakdown',
    'legalTerms',
    'requiredAnnexes',
  ]);
  if (blockingIds.has(fieldId)) return false;
  return materiality === 'STANDARD' || materiality === 'LOW';
}

function contextContradiction(ctx: ProjectContext): NextAction | null {
  // Reserved for future multi-value context storage; classification conflicts
  // are signaled via session.contextContradictions when set by updater/route.
  void ctx;
  return null;
}

export interface AnalyzeGapsOptions {
  /** Active context contradictions e.g. documentStage */
  contextContradictions?: Array<{ targetId: string }>;
}

/**
 * Perform Phase 2.2 gap analysis.
 */
export function analyzeGaps(
  memory: ProjectMemory,
  projectContext?: ProjectContext,
  options?: AnalyzeGapsOptions,
): GapAnalysis {
  const ctx = projectContext
    ? { ...projectContext }
    : createEmptyProjectContext();
  const sectionCtx = buildApplicabilityContext(memory, ctx);

  const applicableSections = RFP_SECTIONS.filter((s) => isSectionApplicable(s, sectionCtx));
  const applicableSectionCount = applicableSections.length;

  const fieldGaps: FieldGapSnapshot[] = [];
  const missingRequired: string[] = [];
  const missingConditional: string[] = [];
  const tbcFields: string[] = [];
  let filledCount = 0;
  let totalRequired = 0;

  for (const field of PROJECT_MEMORY_FIELDS) {
    const { fieldId, requirement } = field;
    const meta = getFieldControlMeta(fieldId);
    const askApplicable = isFieldAskApplicable(fieldId, ctx, sectionCtx);
    const { status, deferredTo } = computeGapStatus(memory, fieldId, askApplicable);

    fieldGaps.push({
      fieldId,
      gapStatus: status,
      materiality: meta.materiality,
      packs: meta.packs,
      deferredTo,
    });

    if (status === 'UNKNOWN' || isFieldTbcProvenance(memory, fieldId)) {
      tbcFields.push(fieldId);
    }

    if (!askApplicable || status === 'NOT_APPLICABLE') continue;

    // Count "required" for display % only among CORE critical/high when classified,
    // else among CORE critical while UNDETERMINED.
    const countsTowardRequired =
      meta.packs.includes('CORE') &&
      (meta.materiality === 'CRITICAL' || meta.materiality === 'HIGH');

    if (countsTowardRequired) totalRequired++;

    if (status === 'KNOWN') {
      if (countsTowardRequired) filledCount++;
      continue;
    }

    if (status === 'MISSING') {
      if (requirement === 'required' || meta.materiality === 'CRITICAL' || meta.materiality === 'HIGH') {
        missingRequired.push(fieldId);
      } else {
        missingConditional.push(fieldId);
      }
    }
  }

  // Context-level contradiction takes priority
  let nextAction: NextAction;
  const ctxConflict = options?.contextContradictions?.[0];
  if (ctxConflict) {
    nextAction = {
      type: 'CLARIFY_CONTRADICTION',
      targetKind: 'project_context',
      targetId: ctxConflict.targetId,
    };
  } else {
    const fieldConflict = fieldGaps.find((g) => g.gapStatus === 'CONTRADICTORY');
    if (fieldConflict) {
      nextAction = {
        type: 'CLARIFY_CONTRADICTION',
        targetKind: 'memory_field',
        targetId: fieldConflict.fieldId,
      };
    } else {
      nextAction = chooseAskOrStop(ctx, fieldGaps, memory);
    }
  }

  const collectionSufficient = nextAction.type === 'STOP_COLLECTION';
  ctx.collectionSufficient = collectionSufficient;

  const nextPriorityFieldId =
    nextAction.type === 'ASK_REQUIREMENTS' ? nextAction.primaryFieldId : null;
  const nextPriorityLabel = nextPriorityFieldId
    ? (PROJECT_MEMORY_FIELDS.find((f) => f.fieldId === nextPriorityFieldId)?.label ?? null)
    : null;

  const completionPercent =
    totalRequired > 0 ? Math.round((filledCount / totalRequired) * 100) : 0;

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
    fieldGaps,
    nextAction,
    collectionSufficient,
  };
}

function chooseAskOrStop(
  ctx: ProjectContext,
  fieldGaps: FieldGapSnapshot[],
  memory: ProjectMemory,
): NextAction {
  // While unresolved: keep asking CORE classification / discovery — never stop as "complete RFP"
  const unresolved = isClassificationUnresolved(ctx);

  const actionableMissing = fieldGaps.filter((g) => g.gapStatus === 'MISSING');
  const blockingUnknown = fieldGaps.filter(
    (g) => g.gapStatus === 'UNKNOWN' && !isSafeUnknown(g.fieldId, g.materiality),
  );

  const criticalCoreMissing = actionableMissing.filter(
    (g) =>
      g.packs.includes('CORE') &&
      g.materiality === 'CRITICAL',
  );
  const highActiveMissing = actionableMissing.filter((g) => g.materiality === 'HIGH');

  const needsAsk = [...criticalCoreMissing, ...highActiveMissing, ...blockingUnknown];

  // Also ask STANDARD CORE discovery while UNDETERMINED (documentType etc. already CRITICAL)
  if (unresolved) {
    const coreMissing = actionableMissing
      .filter((g) => g.packs.includes('CORE'))
      .sort((a, b) => MATERIALITY_RANK[a.materiality] - MATERIALITY_RANK[b.materiality]);
    if (coreMissing.length > 0) {
      return buildAskCluster(coreMissing[0].fieldId, coreMissing, memory);
    }
    // Still unresolved but no missing CORE? ask open-ended classification
    if (!memory.documentType?.current?.value) {
      return normalizeAskRequirements('documentType', ['engagementType', 'beneficiaryEntity']);
    }
    return { type: 'OPEN_ENDED' };
  }

  if (needsAsk.length === 0) {
    // Check remaining MISSING are only LOW / deferred handled already
    const leftoverBlocking = actionableMissing.filter(
      (g) => g.materiality === 'CRITICAL' || g.materiality === 'HIGH',
    );
    if (leftoverBlocking.length === 0) {
      return {
        type: 'STOP_COLLECTION',
        reason:
          'No critical/high material gaps remain in active packs; remaining items are deferred, N/A, low-materiality, or safe UNKNOWN.',
      };
    }
  }

  // Pick highest materiality missing (or blocking unknown)
  const pool = needsAsk.length > 0 ? needsAsk : actionableMissing;
  if (pool.length === 0) {
    return {
      type: 'STOP_COLLECTION',
      reason: 'No applicable material gaps remain.',
    };
  }

  pool.sort((a, b) => MATERIALITY_RANK[a.materiality] - MATERIALITY_RANK[b.materiality]);
  return buildAskCluster(pool[0].fieldId, pool, memory);
}

function buildAskCluster(
  primaryFieldId: string,
  pool: FieldGapSnapshot[],
  memory: ProjectMemory,
): NextAction {
  const meta = getFieldControlMeta(primaryFieldId);
  const peers = (meta.relatedAskPeers ?? []).filter((id) => {
    if (id === primaryFieldId) return false;
    if (isFieldFilled(memory, id)) return false;
    const peerGap = pool.find((g) => g.fieldId === id);
    return !peerGap || peerGap.gapStatus === 'MISSING' || peerGap.gapStatus === 'UNKNOWN';
  });
  return normalizeAskRequirements(primaryFieldId, peers.slice(0, 2));
}

/**
 * Returns the current active section (earliest COLLECTING / NOT_STARTED applicable).
 */
export function getActiveSection(
  memory: ProjectMemory,
  sectionStates: Record<string, { state: string }>,
  projectContext?: ProjectContext,
): string | null {
  const sectionCtx = buildApplicabilityContext(memory, projectContext);
  for (const section of RFP_SECTIONS) {
    if (!isSectionApplicable(section, sectionCtx)) continue;
    const state = sectionStates[section.sectionId]?.state ?? 'NOT_STARTED';
    if (state === 'COLLECTING' || state === 'NOT_STARTED') {
      return section.sectionId;
    }
  }
  return null;
}

// silence unused helper until context multi-value storage lands
void contextContradiction;
