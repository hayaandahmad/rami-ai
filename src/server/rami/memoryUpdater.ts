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
import type { ProjectMemory } from '@/types/projectMemory';
import type { ExtractedFact } from '@/types/conversation';

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

    const memoryRecord = memory as unknown as Record<string, unknown>;
    const existingField = memoryRecord[fieldId];

    try {
      if (!existingField) {
        // Field never set — create it
        memoryRecord[fieldId] = createMemoryField(
          fieldId,
          value,
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
          if (JSON.stringify(existing.current.value) !== JSON.stringify(value)) {
            // User is correcting a previously CONFIRMED value — treat as new EXTRACTED
            // (requires explicit BA re-confirmation to become CONFIRMED again)
            memoryRecord[fieldId] = updateMemoryField(
              existing as Parameters<typeof updateMemoryField>[0],
              value,
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
          const newNote = Array.isArray(value) ? value : [String(value)];
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
        if (JSON.stringify(existing.current.value) !== JSON.stringify(value)) {
          memoryRecord[fieldId] = updateMemoryField(
            existing as Parameters<typeof updateMemoryField>[0],
            value,
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
