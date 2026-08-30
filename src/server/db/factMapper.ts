/**
 * Serialize / deserialize ProjectMemory fields ↔ ProjectFacts rows.
 * Preserves provenance, history, gapStatus, deferred, contradiction.
 */

import { createEmptyProjectMemory } from '@/types/projectMemory';
import type { ProjectMemory } from '@/types/projectMemory';
import type { GapStatus } from '@/types/gapStatus';
import type { InformationEntry, InformationStatus, InformationSourceType } from '@/types/provenance';
import { CANONICAL_FIELD_IDS } from '@/schema/projectMemoryFields';
import { classifySpokenUnknown } from '@/server/rami/spokenTbc';

export type CollectionState = 'ANSWERED' | 'TBC' | 'NOT_APPLICABLE';

export interface ProjectFactRow {
  field_id: string;
  value_json: unknown;
  collection_state: CollectionState;
  provenance_status: string;
  source_type: string | null;
  source_ref: string | null;
  confirmed_by: string | null;
  updated_at: string | null;
  history_json: unknown;
  gap_status: string | null;
  deferred_to: string | null;
  contradiction_json: unknown;
}

interface MemoryFieldBag {
  fieldId: string;
  current: InformationEntry;
  history: InformationEntry[];
  gapStatus?: GapStatus;
  deferredTo?: string;
  contradiction?: unknown;
}

export function collectionStateFromField(field: MemoryFieldBag): CollectionState {
  if (field.gapStatus === 'NOT_APPLICABLE') return 'NOT_APPLICABLE';
  if (
    field.gapStatus === 'UNKNOWN' ||
    field.gapStatus === 'DEFERRED' ||
    field.current.status === 'TBC' ||
    classifySpokenUnknown(field.current.value) !== null
  ) {
    return 'TBC';
  }
  return 'ANSWERED';
}

export function memoryFieldToFactRow(field: MemoryFieldBag): ProjectFactRow {
  return {
    field_id: field.fieldId,
    value_json: field.current.value,
    collection_state: collectionStateFromField(field),
    provenance_status: field.current.status,
    source_type: field.current.sourceType ?? null,
    source_ref: field.current.sourceRef ?? null,
    confirmed_by: field.current.confirmedBy ?? null,
    updated_at: field.current.updatedAt ?? null,
    history_json: field.history ?? [],
    gap_status: field.gapStatus ?? null,
    deferred_to: field.deferredTo ?? null,
    contradiction_json: field.contradiction ?? null,
  };
}

export function projectMemoryToFactRows(memory: ProjectMemory): ProjectFactRow[] {
  const rows: ProjectFactRow[] = [];
  for (const fieldId of CANONICAL_FIELD_IDS) {
    const raw = (memory as unknown as Record<string, unknown>)[fieldId];
    if (!raw || typeof raw !== 'object') continue;
    const field = raw as MemoryFieldBag;
    if (!field.current) continue;
    rows.push(memoryFieldToFactRow({ ...field, fieldId }));
  }
  return rows;
}

export function factRowToMemoryField(row: ProjectFactRow): MemoryFieldBag {
  const spoken = classifySpokenUnknown(row.value_json);
  const storedCurrent: InformationEntry = {
    value: row.value_json,
    status: row.provenance_status as InformationStatus,
    sourceType: (row.source_type as InformationSourceType) ?? 'ba-message',
    sourceRef: row.source_ref ?? undefined,
    confirmedBy: row.confirmed_by ?? undefined,
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };

  if (spoken && row.provenance_status !== 'TBC' && row.gap_status !== 'UNKNOWN' && row.gap_status !== 'DEFERRED') {
    const history = Array.isArray(row.history_json) ? (row.history_json as InformationEntry[]) : [];
    return {
      fieldId: row.field_id,
      current: {
        value: null,
        status: 'TBC',
        sourceType: storedCurrent.sourceType,
        sourceRef: storedCurrent.sourceRef,
        updatedAt: storedCurrent.updatedAt,
      },
      history: [...history, storedCurrent],
      gapStatus: spoken === 'deferred' ? 'DEFERRED' : 'UNKNOWN',
      deferredTo: spoken === 'deferred' ? row.deferred_to ?? 'later' : row.deferred_to ?? undefined,
      contradiction: row.contradiction_json ?? undefined,
    };
  }

  return {
    fieldId: row.field_id,
    current: storedCurrent,
    history: Array.isArray(row.history_json) ? (row.history_json as InformationEntry[]) : [],
    gapStatus: (row.gap_status as GapStatus) || undefined,
    deferredTo: row.deferred_to ?? undefined,
    contradiction: row.contradiction_json ?? undefined,
  };
}

export function factRowsToProjectMemory(rows: ProjectFactRow[]): ProjectMemory {
  const memory = createEmptyProjectMemory();
  const bag = memory as unknown as Record<string, unknown>;
  for (const row of rows) {
    if (!CANONICAL_FIELD_IDS.has(row.field_id)) continue;
    bag[row.field_id] = factRowToMemoryField(row);
  }
  return memory;
}
