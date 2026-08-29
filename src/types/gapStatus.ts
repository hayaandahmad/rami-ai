/**
 * Gap / completeness status — separate from ProvenanceStatus.
 * Authority: Phase 2.2 Adaptive Control Plane.
 *
 * Provenance answers: where did this value come from / how was it accepted?
 * GapStatus answers: do we have a usable current-project value for this requirement?
 */

export type GapStatus =
  | 'KNOWN'            // usable current value exists (EXTRACTED or CONFIRMED)
  | 'MISSING'          // applicable and not yet obtained
  | 'DEFERRED'         // intentionally later stage / SOW / Stage-2
  | 'NOT_APPLICABLE'   // does not belong on this project
  | 'CONTRADICTORY'    // competing values without clear supersession
  | 'UNKNOWN';         // BA explicitly does not know / TBC (completeness, not provenance)

export type Materiality = 'CRITICAL' | 'HIGH' | 'STANDARD' | 'LOW';

export type ExplorationDepth = 'SHORT' | 'STANDARD' | 'DETAILED';

/** Contradiction payload attached when GapStatus is CONTRADICTORY. */
export interface ContradictionState {
  values: unknown[];
  sources: string[];
  /** Blocking clarifications pause stop/generation; warnings do not. */
  severity: 'BLOCKING' | 'WARNING';
}

/** Per-field runtime completeness metadata (sibling to ProjectMemoryField provenance). */
export interface FieldGapState {
  gapStatus: GapStatus;
  materiality: Materiality;
  deferredTo?: string;
  contradiction?: ContradictionState;
}
