/**
 * ProjectMemory update logic — applies extracted facts to the session memory.
 * Authority: .private-context/architecture/rfp-knowledge-architecture.md §1-2
 *
 * Rules:
 * - Extracted values from LLM get status EXTRACTED (not CONFIRMED)
 * - CONFIRMED values are not silently overwritten
 * - Provenance history is preserved via updateMemoryField
 * - Unknown fieldIds are rejected
 * - riskNotes are accumulated, not replaced
 */

import { createMemoryField, updateMemoryField } from '@/types/provenance';
import { isValidFieldId } from '@/server/ai/extractionSchema';
import type { ProjectMemory, UsersValue } from '@/types/projectMemory';
import type { ExtractedFact } from '@/types/conversation';

/**
 * Normalize an LLM-extracted users value into the canonical UsersValue shape.
 * The LLM may return a plain string ("150 employees"), an array, or an object.
 * This function always returns a valid UsersValue or null if value is unusable.
 */
function normalizeUsersValue(raw: unknown): UsersValue | null {
  if (raw === null || raw === undefined) return null;

  // Already correctly shaped
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const internal = Array.isArray(obj['internal'])
      ? (obj['internal'] as unknown[]).map(String)
      : obj['internal'] ? [String(obj['internal'])] : [];
    const external = Array.isArray(obj['external'])
      ? (obj['external'] as unknown[]).map(String)
      : obj['external'] ? [String(obj['external'])] : [];
    if (internal.length > 0 || external.length > 0) return { internal, external };
    return null;
  }

  // Array of strings — classify each item
  if (Array.isArray(raw)) {
    const internal: string[] = [];
    const external: string[] = [];
    for (const item of raw as unknown[]) {
      const s = String(item).trim();
      if (!s) continue;
      if (/citizen|external|public|customer|beneficiar/i.test(s)) {
        external.push(s);
      } else {
        internal.push(s);
      }
    }
    if (internal.length > 0 || external.length > 0) return { internal, external };
    return null;
  }

  // Plain string — treat as internal users description
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    // Detect external-user hints
    if (/citizen|external|public|customer/i.test(trimmed)) {
      return { internal: [], external: [trimmed] };
    }
    return { internal: [trimmed], external: [] };
  }

  return null;
}

export interface MemoryUpdateResult {
  applied: string[];   // fieldIds successfully applied
  rejected: string[];  // fieldIds rejected (unknown, type mismatch, etc.)
  protected: string[]; // fieldIds skipped because CONFIRMED
}

/**
 * Apply a list of extracted facts to the project memory.
 * Returns which fields were applied, rejected, or protected.
 */
export function applyExtractedFacts(
  memory: ProjectMemory,
  facts: ExtractedFact[],
  sourceRef?: string,
): MemoryUpdateResult {
  const applied: string[] = [];
  const rejected: string[] = [];
  const protected_: string[] = [];

  for (const fact of facts) {
    const { fieldId, value, confidence } = fact;

    // Reject unknown field IDs
    if (!isValidFieldId(fieldId)) {
      rejected.push(fieldId);
      continue;
    }

    // Reject null/undefined/empty values
    if (value === null || value === undefined) {
      rejected.push(fieldId);
      continue;
    }
    if (typeof value === 'string' && value.trim() === '') {
      rejected.push(fieldId);
      continue;
    }
    if (Array.isArray(value) && value.length === 0) {
      rejected.push(fieldId);
      continue;
    }

    // Normalize users field to canonical UsersValue shape
    let normalizedValue: unknown = value;
    if (fieldId === 'users') {
      const users = normalizeUsersValue(value);
      if (!users) {
        rejected.push(fieldId);
        continue;
      }
      normalizedValue = users;
    }

    const memoryRecord = memory as unknown as Record<string, unknown>;
    const existingField = memoryRecord[fieldId];

    try {
      if (!existingField) {
        // Field never set — create it
        memoryRecord[fieldId] = createMemoryField(
          fieldId,
          normalizedValue,
          'EXTRACTED',
          'ba-message',
          sourceRef,
        );
        applied.push(fieldId);
      } else {
        // Field exists — check if CONFIRMED (don't silently overwrite)
        const existing = existingField as {
          current: { status: string; value: unknown };
        };

        if (existing.current.status === 'CONFIRMED') {
          // Only update if value actually changed
          if (JSON.stringify(existing.current.value) !== JSON.stringify(normalizedValue)) {
            // User is correcting a previously CONFIRMED value — treat as new EXTRACTED
            // (requires explicit BA re-confirmation to become CONFIRMED again)
            memoryRecord[fieldId] = updateMemoryField(
              existing as Parameters<typeof updateMemoryField>[0],
              normalizedValue,
              'EXTRACTED',
              'ba-message',
              sourceRef,
            );
            applied.push(fieldId);
          } else {
            protected_.push(fieldId); // same value, no change needed
          }
          continue;
        }

        // riskNotes: accumulate as array
        if (fieldId === 'riskNotes') {
          const currentNotes = Array.isArray(existing.current.value)
            ? existing.current.value as string[]
            : [];
          const newNote = Array.isArray(normalizedValue) ? normalizedValue as string[] : [String(normalizedValue)];
          const merged = [...currentNotes, ...newNote];
          memoryRecord[fieldId] = updateMemoryField(
            existing as Parameters<typeof updateMemoryField>[0],
            merged,
            'EXTRACTED',
            'ba-message',
            sourceRef,
          );
          applied.push(fieldId);
          continue;
        }

        // Standard update
        if (JSON.stringify(existing.current.value) !== JSON.stringify(normalizedValue)) {
          memoryRecord[fieldId] = updateMemoryField(
            existing as Parameters<typeof updateMemoryField>[0],
            normalizedValue,
            'EXTRACTED',
            'ba-message',
            sourceRef,
          );
          applied.push(fieldId);
        }
        // else: same value, skip silently
      }
    } catch {
      rejected.push(fieldId);
    }

    // Suppress unused variable warning for confidence — it can be used for Phase 3 trust scoring
    void confidence;
  }

  return { applied, rejected, protected: protected_ };
}
