/**
 * Compact BA-facing project understanding — derived from PostgreSQL session + gap engine.
 * Does not invent facts. Does not expose Field IDs as primary copy.
 */

import type { ProjectMemory } from '@/types/projectMemory';
import type { ProjectContext } from '@/types/projectContext';
import type { GapAnalysis } from '@/types/conversation';
import { PROJECT_MEMORY_FIELDS, CANONICAL_FIELD_IDS } from '@/schema/projectMemoryFields';
import { describeBlocker, fieldLabel, formatValuePreview } from '@/utils/fieldDisplay';
import type { ProjectUnderstanding, UnderstandingItem } from '@/types/projectUnderstanding';

export type { ProjectUnderstanding, UnderstandingItem };

function memString(memory: ProjectMemory, fieldId: keyof ProjectMemory): string | null {
  const bag = memory[fieldId] as { current?: { value?: unknown } } | null | undefined;
  const v = bag?.current?.value;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function focusCopy(gaps: GapAnalysis): string | null {
  const action = gaps.nextAction;
  if (action.type === 'ASK_REQUIREMENTS') {
    const primary = fieldLabel(action.primaryFieldId);
    const related = action.relatedFieldIds.map(fieldLabel);
    if (related.length === 0) return `Currently clarifying: ${primary}`;
    return `Currently clarifying: ${primary} (and ${related.join(', ')})`;
  }
  if (action.type === 'CLARIFY_CONTRADICTION') {
    return `Needs review: conflicting information on ${fieldLabel(action.targetId)}`;
  }
  if (action.type === 'STOP_COLLECTION') {
    return 'Enough core information is gathered to start drafting applicable sections.';
  }
  if (action.type === 'OFFER_HISTORICAL_REFERENCE') {
    return 'Historical examples are available for review — they are not current project facts.';
  }
  return gaps.nextPriorityLabel ? `Currently clarifying: ${gaps.nextPriorityLabel}` : null;
}

export function buildProjectUnderstanding(
  memory: ProjectMemory,
  projectContext: ProjectContext,
  gaps: GapAnalysis,
  contextContradictions: Array<{ targetId: string; values: unknown[] }>,
): ProjectUnderstanding {
  const missingFromGaps = gaps.fieldGaps
    .filter(
      (g) =>
        g.gapStatus === 'MISSING' &&
        (g.materiality === 'CRITICAL' || g.materiality === 'HIGH'),
    )
    .map((g) => g.fieldId);
  const missingIds = (missingFromGaps.length > 0 ? missingFromGaps : gaps.missingRequired).slice(
    0,
    8,
  );
  const missingCritical = missingIds.map((fieldId) => ({
    fieldId,
    label: describeBlocker(fieldId, 'missing'),
  }));

  const tbcItems = gaps.tbcFields.slice(0, 8).map((fieldId) => ({
    fieldId,
    label: describeBlocker(fieldId, 'tbc'),
  }));

  const fieldConflicts = gaps.fieldGaps
    .filter((g) => g.gapStatus === 'CONTRADICTORY')
    .map((g) => ({
      fieldId: g.fieldId,
      label: describeBlocker(g.fieldId, 'contradiction'),
    }));

  const ctxConflicts = contextContradictions.map((c) => ({
    fieldId: c.targetId,
    label: describeBlocker(c.targetId, 'contradiction'),
  }));

  const seen = new Set<string>();
  const contradictions: UnderstandingItem[] = [];
  for (const item of [...ctxConflicts, ...fieldConflicts]) {
    if (seen.has(item.fieldId)) continue;
    seen.add(item.fieldId);
    contradictions.push(item);
  }

  const confirmed: Array<UnderstandingItem & { at: string }> = [];
  for (const def of PROJECT_MEMORY_FIELDS) {
    if (!CANONICAL_FIELD_IDS.has(def.fieldId)) continue;
    const bag = (memory as unknown as Record<string, { current?: { value?: unknown; status?: string; updatedAt?: string } } | null>)[
      def.fieldId
    ];
    const current = bag?.current;
    if (!current) continue;
    if (current.status !== 'CONFIRMED' && current.status !== 'EXTRACTED') continue;
    if (current.value == null || current.value === '') continue;
    confirmed.push({
      fieldId: def.fieldId,
      label: def.label,
      detail: formatValuePreview(current.value, 90),
      at: current.updatedAt ?? '',
    });
  }
  confirmed.sort((a, b) => (b.at || '').localeCompare(a.at || ''));

  const readyCountHint =
    gaps.collectionSufficient
      ? 'Core information is sufficient to draft remaining applicable sections when they are ready.'
      : null;

  return {
    documentTitle: memString(memory, 'documentTitle'),
    beneficiaryEntity: memString(memory, 'beneficiaryEntity'),
    documentType: memString(memory, 'documentType'),
    engagementType: memString(memory, 'engagementType'),
    documentStage:
      projectContext.documentStage && projectContext.documentStage !== 'UNDETERMINED'
        ? projectContext.documentStage.replace(/_/g, ' ').toLowerCase()
        : null,
    completionPercent: gaps.completionPercent,
    collectionSufficient: gaps.collectionSufficient,
    currentlyClarifying: focusCopy(gaps),
    missingCritical,
    tbcItems,
    contradictions,
    recentlyConfirmed: confirmed.slice(0, 5).map(({ fieldId, label, detail }) => ({
      fieldId,
      label,
      detail,
    })),
    readyToDraftHint: readyCountHint,
  };
}
