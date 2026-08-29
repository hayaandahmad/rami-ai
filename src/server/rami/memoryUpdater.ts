/**
 * ProjectMemory update logic — applies extracted facts to the session memory.
 * Authority: rfp-knowledge-architecture.md + Phase 2.2 correction/contradiction rules.
 *
 * Correction vs contradiction:
 * - updateKind=correction OR explicit superseding language → history + replace (NOT CONTRADICTORY)
 * - updateKind=conflict OR competing-source language OR two simultaneous values without supersession
 *   → CONTRADICTORY + do not silent-overwrite
 * - Ambiguous material conflict without clear supersession → prefer contradiction (clarify)
 *
 * Do NOT use: same field + ba-message + ba-message = correction (too broad).
 */

import { createMemoryField, updateMemoryField } from '@/types/provenance';
import { isValidFieldId } from '@/server/ai/extractionSchema';
import type { ProjectMemory, UsersValue } from '@/types/projectMemory';
import type { ExtractedFact } from '@/types/conversation';
import type { GapStatus } from '@/types/gapStatus';
import { getFieldControlMeta } from '@/schema/fieldControlMeta';

export type FactUpdateKind = 'assert' | 'correction' | 'conflict';

export interface ExtractedFactWithKind extends ExtractedFact {
  updateKind?: FactUpdateKind;
}

function normalizeUsersValue(raw: unknown): UsersValue | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const internal = Array.isArray(obj['internal'])
      ? (obj['internal'] as unknown[]).map(String)
      : obj['internal']
        ? [String(obj['internal'])]
        : [];
    const external = Array.isArray(obj['external'])
      ? (obj['external'] as unknown[]).map(String)
      : obj['external']
        ? [String(obj['external'])]
        : [];
    if (internal.length > 0 || external.length > 0) return { internal, external };
    return null;
  }

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

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (/citizen|external|public|customer/i.test(trimmed)) {
      return { internal: [], external: [trimmed] };
    }
    return { internal: [trimmed], external: [] };
  }

  return null;
}

/** Detect explicit superseding language in the BA message. */
export function hasSupersedingLanguage(message: string): boolean {
  return /\b(actually|instead|correct that|change that|make that|not\s+\d|rather than|replace|updated? to|should be|correction)\b/i.test(
    message,
  );
}

/** Detect competing-source language. */
export function hasCompetingSourceLanguage(message: string): boolean {
  return /\b(but the|whereas|however the|annex says|document says|main (document|rfp)|conflicts? with|one source|another source|two different|vs\.?|versus)\b/i.test(
    message,
  );
}

export interface MemoryUpdateResult {
  applied: string[];
  rejected: string[];
  protected: string[];
  /** Fields marked CONTRADICTORY this turn. */
  contradicted: string[];
  corrected: string[];
}

type MemoryFieldBag = {
  fieldId: string;
  current: { status: string; value: unknown; sourceType?: string };
  history: unknown[];
  gapStatus?: GapStatus;
  deferredTo?: string;
  contradiction?: { values: unknown[]; sources: string[]; severity: 'BLOCKING' | 'WARNING' };
};

function markContradiction(
  existing: MemoryFieldBag,
  newValue: unknown,
  sourceRef: string | undefined,
  memoryRecord: Record<string, unknown>,
  fieldId: string,
): void {
  const meta = getFieldControlMeta(fieldId);
  const severity =
    meta.materiality === 'CRITICAL' || meta.materiality === 'HIGH' ? 'BLOCKING' : 'WARNING';
  const updated: MemoryFieldBag = {
    ...existing,
    gapStatus: 'CONTRADICTORY',
    contradiction: {
      values: [existing.current.value, newValue],
      sources: [
        String(existing.current.sourceType ?? 'existing'),
        sourceRef ?? 'ba-message',
      ],
      severity,
    },
  };
  memoryRecord[fieldId] = updated;
}

function resolveUpdateKind(
  fact: ExtractedFactWithKind,
  latestMessage: string | undefined,
): FactUpdateKind {
  if (fact.updateKind === 'correction' || fact.updateKind === 'conflict') {
    return fact.updateKind;
  }
  if (latestMessage && hasCompetingSourceLanguage(latestMessage)) return 'conflict';
  if (latestMessage && hasSupersedingLanguage(latestMessage)) return 'correction';
  return 'assert';
}

/**
 * Apply extracted facts with correction / contradiction awareness.
 */
export function applyExtractedFacts(
  memory: ProjectMemory,
  facts: ExtractedFactWithKind[],
  sourceRef?: string,
  latestMessage?: string,
): MemoryUpdateResult {
  const applied: string[] = [];
  const rejected: string[] = [];
  const protected_: string[] = [];
  const contradicted: string[] = [];
  const corrected: string[] = [];

  const memoryRecord = memory as unknown as Record<string, unknown>;

  for (const fact of facts) {
    const { fieldId, value } = fact;
    const updateKind = resolveUpdateKind(fact, latestMessage);

    if (!isValidFieldId(fieldId)) {
      rejected.push(fieldId);
      continue;
    }

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

    let normalizedValue: unknown = value;
    if (fieldId === 'users') {
      const users = normalizeUsersValue(value);
      if (!users) {
        rejected.push(fieldId);
        continue;
      }
      normalizedValue = users;
    }

    const existingField = memoryRecord[fieldId] as MemoryFieldBag | undefined;

    try {
      if (!existingField) {
        memoryRecord[fieldId] = {
          ...createMemoryField(fieldId, normalizedValue, 'EXTRACTED', 'ba-message', sourceRef),
          gapStatus: 'KNOWN' as GapStatus,
        };
        applied.push(fieldId);
        continue;
      }

      const existing = existingField;
      const sameValue =
        JSON.stringify(existing.current.value) === JSON.stringify(normalizedValue);

      if (sameValue) {
        protected_.push(fieldId);
        continue;
      }

      // Conflict: competing evidence — do not overwrite
      if (updateKind === 'conflict') {
        markContradiction(existing, normalizedValue, sourceRef, memoryRecord, fieldId);
        contradicted.push(fieldId);
        continue;
      }

      // Correction: explicit supersession — preserve history; keep EXTRACTED (or re-open CONFIRMED)
      if (updateKind === 'correction') {
        const newEntry = {
          value: normalizedValue,
          status: 'EXTRACTED' as const,
          sourceType: 'ba-message' as const,
          sourceRef,
          updatedAt: new Date().toISOString(),
        };
        // EXTRACTED→EXTRACTED is not a provenance transition — value replace with history
        memoryRecord[fieldId] = {
          fieldId,
          current: newEntry,
          history: [...(existing.history ?? []), existing.current],
          gapStatus: 'KNOWN' as GapStatus,
          contradiction: undefined,
        };
        applied.push(fieldId);
        corrected.push(fieldId);
        continue;
      }

      // assert with existing different value and no supersession signal:
      // if material CRITICAL/HIGH → clarify (contradiction); else treat as soft correction
      if (existing.current.value !== undefined && existing.current.value !== null) {
        const meta = getFieldControlMeta(fieldId);
        const material = meta.materiality === 'CRITICAL' || meta.materiality === 'HIGH';
        if (material && !hasSupersedingLanguage(latestMessage ?? '')) {
          markContradiction(existing, normalizedValue, sourceRef, memoryRecord, fieldId);
          contradicted.push(fieldId);
          continue;
        }
      }

      if (existing.current.status === 'CONFIRMED') {
        memoryRecord[fieldId] = {
          ...updateMemoryField(
            existing as Parameters<typeof updateMemoryField>[0],
            normalizedValue,
            'EXTRACTED',
            'ba-message',
            sourceRef,
          ),
          gapStatus: 'KNOWN' as GapStatus,
        };
        applied.push(fieldId);
        continue;
      }

      if (fieldId === 'riskNotes') {
        const currentNotes = Array.isArray(existing.current.value)
          ? (existing.current.value as string[])
          : [];
        const newNote = Array.isArray(normalizedValue)
          ? (normalizedValue as string[])
          : [String(normalizedValue)];
        memoryRecord[fieldId] = {
          ...updateMemoryField(
            existing as Parameters<typeof updateMemoryField>[0],
            [...currentNotes, ...newNote],
            'EXTRACTED',
            'ba-message',
            sourceRef,
          ),
          gapStatus: 'KNOWN' as GapStatus,
        };
        applied.push(fieldId);
        continue;
      }

      memoryRecord[fieldId] = {
        ...updateMemoryField(
          existing as Parameters<typeof updateMemoryField>[0],
          normalizedValue,
          'EXTRACTED',
          'ba-message',
          sourceRef,
        ),
        gapStatus: 'KNOWN' as GapStatus,
        contradiction: undefined,
      };
      applied.push(fieldId);
    } catch {
      rejected.push(fieldId);
    }
  }

  return { applied, rejected, protected: protected_, contradicted, corrected };
}

/** Mark a field as intentionally deferred (GapStatus DEFERRED). */
export function markFieldDeferred(
  memory: ProjectMemory,
  fieldId: string,
  deferredTo: string,
): void {
  if (!isValidFieldId(fieldId)) return;
  const memoryRecord = memory as unknown as Record<string, unknown>;
  const existing = memoryRecord[fieldId] as MemoryFieldBag | undefined;
  if (!existing) {
    memoryRecord[fieldId] = {
      fieldId,
      current: {
        value: null,
        status: 'TBC',
        sourceType: 'ba-message',
        updatedAt: new Date().toISOString(),
      },
      history: [],
      gapStatus: 'DEFERRED' as GapStatus,
      deferredTo,
    };
    return;
  }
  memoryRecord[fieldId] = {
    ...existing,
    gapStatus: 'DEFERRED' as GapStatus,
    deferredTo,
    contradiction: undefined,
  };
}
