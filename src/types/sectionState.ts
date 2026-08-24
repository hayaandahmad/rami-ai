/**
 * Section state machine for RFP section lifecycle.
 * Authority: .private-context/architecture/rfp-generation-architecture.md §1
 *
 * Valid state transitions (enforced by assertSectionTransition / isSectionTransitionAllowed):
 *   NOT_STARTED   → COLLECTING
 *   COLLECTING    → READY_TO_DRAFT
 *   READY_TO_DRAFT→ DRAFTING
 *   DRAFTING      → REVIEW
 *   REVIEW        → REVISING
 *   REVIEW        → APPROVED        (requires explicit BA approval — never automatic)
 *   REVISING      → DRAFTING        (re-draft after revisions)
 *   APPROVED      → REOPENED        (upstream fact changed, or explicit BA reopen)
 *   REOPENED      → COLLECTING      (not directly back to DRAFTING — must re-gate)
 */

export type SectionLifecycleState =
  | 'NOT_STARTED'
  | 'COLLECTING'
  | 'READY_TO_DRAFT'
  | 'DRAFTING'
  | 'REVIEW'
  | 'REVISING'
  | 'APPROVED'
  | 'REOPENED';

/** Allowed transitions as an adjacency map. */
export const ALLOWED_SECTION_TRANSITIONS: ReadonlyMap<
  SectionLifecycleState,
  ReadonlySet<SectionLifecycleState>
> = new Map([
  ['NOT_STARTED',    new Set<SectionLifecycleState>(['COLLECTING'])],
  ['COLLECTING',     new Set<SectionLifecycleState>(['READY_TO_DRAFT'])],
  ['READY_TO_DRAFT', new Set<SectionLifecycleState>(['DRAFTING'])],
  ['DRAFTING',       new Set<SectionLifecycleState>(['REVIEW'])],
  ['REVIEW',         new Set<SectionLifecycleState>(['REVISING', 'APPROVED'])],
  ['REVISING',       new Set<SectionLifecycleState>(['DRAFTING'])],
  ['APPROVED',       new Set<SectionLifecycleState>(['REOPENED'])],
  ['REOPENED',       new Set<SectionLifecycleState>(['COLLECTING'])],
]);

export function isSectionTransitionAllowed(
  from: SectionLifecycleState,
  to: SectionLifecycleState,
): boolean {
  return ALLOWED_SECTION_TRANSITIONS.get(from)?.has(to) ?? false;
}

/**
 * Asserts the transition is valid; throws a descriptive error if not.
 * Use in state-machine update paths to prevent illegal state changes.
 */
export function assertSectionTransition(
  sectionId: string,
  from: SectionLifecycleState,
  to: SectionLifecycleState,
): void {
  if (!isSectionTransitionAllowed(from, to)) {
    throw new Error(
      `Illegal section state transition: ${sectionId} — ` +
      `${from} → ${to}. ` +
      `See rfp-generation-architecture.md §1 for valid transitions.`,
    );
  }
}

/** A record of one section's lifecycle state with audit metadata. */
export interface SectionStateRecord {
  sectionId: string;
  state: SectionLifecycleState;
  /** ISO-8601 timestamps for auditability */
  enteredAt: string;
  /**
   * For REOPENED: which field(s) changed and triggered the reopen,
   * or 'manual' if the BA explicitly reopened.
   */
  reopenReason?: string;
  /**
   * The set of canonical field IDs this section's last draft was built from.
   * Used to detect upstream changes that should trigger REOPENED.
   */
  draftFieldSnapshot?: string[];
}

/** Creates a new section state record in NOT_STARTED. */
export function createSectionStateRecord(sectionId: string): SectionStateRecord {
  return {
    sectionId,
    state: 'NOT_STARTED',
    enteredAt: new Date().toISOString(),
  };
}

/** Advances the state, asserting the transition is valid. Returns a new record. */
export function advanceSectionState(
  record: SectionStateRecord,
  to: SectionLifecycleState,
  options?: { reopenReason?: string; draftFieldSnapshot?: string[] },
): SectionStateRecord {
  assertSectionTransition(record.sectionId, record.state, to);
  return {
    ...record,
    state: to,
    enteredAt: new Date().toISOString(),
    reopenReason: options?.reopenReason ?? record.reopenReason,
    draftFieldSnapshot: options?.draftFieldSnapshot ?? record.draftFieldSnapshot,
  };
}
