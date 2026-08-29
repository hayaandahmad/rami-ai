/**
 * Deterministic next-action control plane (Phase 2.2).
 * TypeScript chooses the action; the LLM only phrases it.
 */

export type ClarifyTargetKind = 'memory_field' | 'project_context';

/**
 * ASK_REQUIREMENTS: one natural question covering a tightly related cluster.
 * Hard cap: 1 primary + ≤2 related = max 3 field IDs.
 */
export type NextAction =
  | {
      type: 'ASK_REQUIREMENTS';
      primaryFieldId: string;
      relatedFieldIds: string[];
    }
  | {
      type: 'CLARIFY_CONTRADICTION';
      targetKind: ClarifyTargetKind;
      /** Canonical fieldId or ProjectContext key (e.g. documentStage). */
      targetId: string;
    }
  | {
      type: 'STOP_COLLECTION';
      reason: string;
    }
  | { type: 'OPEN_ENDED' }
  /** Phase 3 placeholders — do not implement in 2.2. */
  | { type: 'SEARCH_HISTORICAL_RFPS'; fieldId: string }
  | { type: 'PROPOSE_VALUE'; fieldId: string; proposedValue: unknown }
  /** Phase 4 placeholder. */
  | { type: 'READY_TO_DRAFT'; sectionId: string };

/** Enforce ASK_REQUIREMENTS cluster size (max 3 field IDs). */
export function normalizeAskRequirements(
  primaryFieldId: string,
  relatedFieldIds: string[] = [],
): Extract<NextAction, { type: 'ASK_REQUIREMENTS' }> {
  const related = [...new Set(relatedFieldIds.filter((id) => id && id !== primaryFieldId))].slice(
    0,
    2,
  );
  return { type: 'ASK_REQUIREMENTS', primaryFieldId, relatedFieldIds: related };
}
