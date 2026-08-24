/**
 * Provenance and structured project-memory types.
 * Authority: .private-context/architecture/rfp-knowledge-architecture.md §1–2
 *
 * Hard rule: REFERENCE must never automatically become a current project fact.
 * A REFERENCE value must transition to PROPOSED before a BA can accept it as
 * CONFIRMED. There is no code path from REFERENCE directly to CONFIRMED.
 */

export type InformationStatus =
  | 'CONFIRMED'   // BA explicitly stated or approved this value
  | 'EXTRACTED'   // LLM extracted from a BA message; not yet explicitly confirmed
  | 'REFERENCE'   // Sourced from historical-RFP retrieval; describes a different past engagement
  | 'PROPOSED'    // A REFERENCE or template-default offered to the BA as a starting point
  | 'TBC';        // Explicitly deferred; drafting may proceed with this gap flagged

/** Valid transitions from one status to another. Enforced by isSectionTransitionAllowed(). */
export const ALLOWED_PROVENANCE_TRANSITIONS: ReadonlyMap<
  InformationStatus,
  ReadonlySet<InformationStatus>
> = new Map([
  ['EXTRACTED',  new Set<InformationStatus>(['CONFIRMED', 'TBC'])],
  ['PROPOSED',   new Set<InformationStatus>(['CONFIRMED', 'TBC'])],
  ['TBC',        new Set<InformationStatus>(['EXTRACTED', 'PROPOSED', 'CONFIRMED'])],
  ['CONFIRMED',  new Set<InformationStatus>(['EXTRACTED'])], // only via reopening — upstream field changed
  ['REFERENCE',  new Set<InformationStatus>(['PROPOSED'])],  // the ONLY legal exit from REFERENCE
]);

/** Returns true if transitioning from `from` to `to` is a legal provenance move. */
export function isProvenanceTransitionAllowed(
  from: InformationStatus,
  to: InformationStatus,
): boolean {
  return ALLOWED_PROVENANCE_TRANSITIONS.get(from)?.has(to) ?? false;
}

/** Source of the information item's current value. */
export type InformationSourceType =
  | 'ba-message'           // BA said it directly in conversation
  | 'historical-retrieval' // came from local RAG over approved historical sources
  | 'template-default'     // came from GeneralTemplate.docx or known-good boilerplate
  | 'system';              // set by Rami deterministic logic (e.g. SYSTEM_DEFAULT fields)

/** A single version snapshot of a project-memory field's value. */
export interface InformationEntry<T = unknown> {
  value: T;
  status: InformationStatus;
  sourceType: InformationSourceType;
  /** e.g. chat message id, or "OFA-Internet-Services-...pdf#SLA-table" */
  sourceRef?: string;
  /** BA identity / session id once promoted to CONFIRMED */
  confirmedBy?: string;
  updatedAt: string; // ISO-8601
}

/**
 * A full project-memory field with its current value and complete history.
 * The `history` array is append-only; values are never silently overwritten.
 */
export interface ProjectMemoryField<T = unknown> {
  fieldId: string;
  current: InformationEntry<T>;
  /** Prior versions — retained for auditability and reopening detection. */
  history: InformationEntry<T>[];
}

/** Convenience: create a new ProjectMemoryField with no prior history. */
export function createMemoryField<T>(
  fieldId: string,
  value: T,
  status: InformationStatus,
  sourceType: InformationSourceType,
  sourceRef?: string,
): ProjectMemoryField<T> {
  const entry: InformationEntry<T> = {
    value,
    status,
    sourceType,
    sourceRef,
    updatedAt: new Date().toISOString(),
  };
  return { fieldId, current: entry, history: [] };
}

/**
 * Update a ProjectMemoryField, moving the old current value into history.
 * Enforces the provenance transition rule; throws if the transition is illegal.
 */
export function updateMemoryField<T>(
  field: ProjectMemoryField<T>,
  newValue: T,
  newStatus: InformationStatus,
  sourceType: InformationSourceType,
  sourceRef?: string,
  confirmedBy?: string,
): ProjectMemoryField<T> {
  if (!isProvenanceTransitionAllowed(field.current.status, newStatus)) {
    throw new Error(
      `Illegal provenance transition: ${field.fieldId} — ` +
      `${field.current.status} → ${newStatus}. ` +
      `REFERENCE values must go through PROPOSED first.`,
    );
  }
  const newEntry: InformationEntry<T> = {
    value: newValue,
    status: newStatus,
    sourceType,
    sourceRef,
    confirmedBy,
    updatedAt: new Date().toISOString(),
  };
  return {
    fieldId: field.fieldId,
    current: newEntry,
    history: [...field.history, field.current],
  };
}
