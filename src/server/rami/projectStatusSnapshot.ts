/**
 * Build and render authoritative project-status answers.
 * Gap Engine + section readiness + structural assembly decide the facts.
 * Qwen does not choose this content.
 */

import type { ConversationLanguage } from '@/types/conversation';
import type { NextAction } from '@/types/nextAction';
import type { ProjectMemory } from '@/types/projectMemory';
import type { ProjectContext } from '@/types/projectContext';
import type { SectionStateRecord } from '@/types/sectionState';
import type { SectionApprovalStatus } from '@/types/generatedSection';
import type {
  ProjectSpecificAnnexStatus,
  ProjectStatusSnapshot,
  SectionProgressKind,
  SectionStatusEntry,
  StatusNextInformationNeed,
} from '@/types/projectStatus';
import { FORBIDDEN_STATUS_SECTION_PHRASES } from '@/types/projectStatus';
import { PROJECT_MEMORY_FIELDS } from '@/schema/projectMemoryFields';
import {
  RFP_SECTIONS,
  isSectionApplicable,
  isStructuralSectionId,
} from '@/schema/rfpSchema';
import { listProjectSpecificAnnexTitles } from '@/schema/standardAnnexPack';
import { analyzeGaps, buildApplicabilityContext } from '@/server/rami/gapEngine';
import { getAllSectionReadiness } from '@/server/rami/sectionReadiness';
import { classifySpokenNotApplicable } from '@/server/rami/spokenTbc';
import { normalizeAskRequirements } from '@/types/nextAction';
import type { FieldGapSnapshot, GapAnalysis } from '@/types/conversation';

function fieldLabel(fieldId: string): string {
  return PROJECT_MEMORY_FIELDS.find((f) => f.fieldId === fieldId)?.label ?? fieldId;
}

function fieldBag(memory: ProjectMemory, fieldId: string) {
  const raw = (memory as unknown as Record<string, unknown>)[fieldId];
  if (!raw || typeof raw !== 'object') return null;
  return raw as {
    gapStatus?: string;
    current?: { value?: unknown; status?: string };
    contradiction?: { values?: unknown[] };
  };
}

export function projectSpecificAnnexStatus(
  memory: ProjectMemory,
  fieldGaps: FieldGapSnapshot[],
): ProjectSpecificAnnexStatus {
  const gap = fieldGaps.find((g) => g.fieldId === 'requiredAnnexes');
  const bag = fieldBag(memory, 'requiredAnnexes');
  const value = bag?.current?.value;
  if (
    gap?.gapStatus === 'NOT_APPLICABLE' ||
    classifySpokenNotApplicable(value) ||
    bag?.gapStatus === 'NOT_APPLICABLE'
  ) {
    return 'none';
  }
  if (
    gap?.gapStatus === 'CONTRADICTORY' ||
    gap?.gapStatus === 'UNKNOWN' ||
    gap?.gapStatus === 'DEFERRED'
  ) {
    return 'details_missing';
  }
  const titles = listProjectSpecificAnnexTitles(value);
  if (titles.length > 0) return 'known';
  if (gap?.gapStatus === 'MISSING') return 'none';
  if (value != null && String(value).trim()) return 'details_missing';
  return 'none';
}

function isRealInformationGap(
  fieldId: string,
  fieldGaps: FieldGapSnapshot[],
  annexStatus: ProjectSpecificAnnexStatus,
): boolean {
  if (fieldId === '__coverage_gap__') return false;
  if (fieldId === 'requiredAnnexes' && annexStatus !== 'details_missing') return false;
  const gap = fieldGaps.find((g) => g.fieldId === fieldId);
  if (!gap) return false;
  return (
    gap.gapStatus === 'MISSING' ||
    gap.gapStatus === 'UNKNOWN' ||
    gap.gapStatus === 'DEFERRED' ||
    gap.gapStatus === 'CONTRADICTORY'
  );
}

function contradictionValues(memory: ProjectMemory, fieldId: string): unknown[] {
  const bag = fieldBag(memory, fieldId);
  return Array.isArray(bag?.contradiction?.values) ? bag!.contradiction!.values! : [];
}

function statusNextAction(
  gaps: GapAnalysis,
  annexStatus: ProjectSpecificAnnexStatus,
): NextAction {
  const action = gaps.nextAction;
  if (action.type !== 'ASK_REQUIREMENTS' || action.primaryFieldId !== 'requiredAnnexes') {
    return action;
  }
  if (annexStatus === 'details_missing') return action;

  const pool = gaps.fieldGaps.filter(
    (g) =>
      g.fieldId !== 'requiredAnnexes' &&
      (g.gapStatus === 'MISSING' || g.gapStatus === 'UNKNOWN') &&
      (g.materiality === 'CRITICAL' || g.materiality === 'HIGH'),
  );
  if (pool.length === 0) {
    return {
      type: 'STOP_COLLECTION',
      reason:
        'Standard Annexes are automatically prepared; no remaining critical/high information gaps.',
    };
  }
  const primary = pool[0].fieldId;
  const metaPeers = pool.filter((g) => g.fieldId !== primary).map((g) => g.fieldId);
  return normalizeAskRequirements(primary, metaPeers);
}

function toNeed(action: NextAction, memory: ProjectMemory): StatusNextInformationNeed {
  if (action.type === 'ASK_REQUIREMENTS') {
    return {
      type: action.type,
      fieldId: action.primaryFieldId,
      fieldLabel: fieldLabel(action.primaryFieldId),
    };
  }
  if (action.type === 'CLARIFY_CONTRADICTION') {
    return {
      type: action.type,
      fieldId: action.targetId,
      fieldLabel: fieldLabel(action.targetId),
      contradictionValues: contradictionValues(memory, action.targetId),
    };
  }
  if (action.type === 'STOP_COLLECTION') {
    return { type: action.type, reason: action.reason };
  }
  if (action.type === 'READY_TO_DRAFT') {
    return { type: action.type, fieldId: action.sectionId, fieldLabel: action.sectionId };
  }
  return { type: action.type };
}

export interface BuildProjectStatusInput {
  memory: ProjectMemory;
  projectContext: ProjectContext;
  contextContradictions?: Array<{ targetId: string }>;
  sectionStates?: Record<string, SectionStateRecord>;
  generatedSections?: Array<{ sectionId: string; approvalStatus: SectionApprovalStatus }>;
}

export function buildProjectStatusSnapshot(input: BuildProjectStatusInput): ProjectStatusSnapshot {
  const gaps = analyzeGaps(input.memory, input.projectContext, {
    contextContradictions: input.contextContradictions,
  });
  const sectionCtx = buildApplicabilityContext(input.memory, input.projectContext);
  const readinessAll = getAllSectionReadiness(input.memory, input.projectContext);
  const annexStatus = projectSpecificAnnexStatus(input.memory, gaps.fieldGaps);
  const standardAnnexesAutomaticallyPrepared =
    Boolean(sectionCtx.hasStandardAnnexPack) &&
    isSectionApplicable(RFP_SECTIONS.find((s) => s.sectionId === 'annexes')!, sectionCtx);
  const generatedById = new Map(
    (input.generatedSections ?? []).map((g) => [g.sectionId, g.approvalStatus]),
  );

  const nextAction = statusNextAction(gaps, annexStatus);

  const sections: SectionStatusEntry[] = RFP_SECTIONS.map((section) => {
    const readiness = readinessAll.find((r) => r.sectionId === section.sectionId)!;
    const applicable = isSectionApplicable(section, sectionCtx);
    const generatedStatus = generatedById.get(section.sectionId);
    const generated = Boolean(generatedStatus);
    const life = input.sectionStates?.[section.sectionId]?.state;
    const approved = generatedStatus === 'APPROVED' || life === 'APPROVED';
    const automaticallyPrepared =
      applicable &&
      isStructuralSectionId(section.sectionId) &&
      (section.sectionId !== 'annexes' || standardAnnexesAutomaticallyPrepared) &&
      (section.sectionId !== 'abbreviations' || Boolean(sectionCtx.hasGlossaryTerms));

    const contradictionFieldIds = gaps.fieldGaps
      .filter(
        (g) =>
          g.gapStatus === 'CONTRADICTORY' &&
          (readiness.criticalBlockers.includes(g.fieldId) ||
            readiness.missingFields.includes(g.fieldId) ||
            readiness.answeredFields.includes(g.fieldId) ||
            readiness.tbcFields.includes(g.fieldId)),
      )
      .map((g) => g.fieldId);

    const missingFieldIds = applicable
      ? [...new Set([...readiness.missingFields, ...readiness.criticalBlockers])].filter((id) =>
          isRealInformationGap(id, gaps.fieldGaps, annexStatus),
        )
      : [];
    const tbcFieldIds = applicable
      ? readiness.tbcFields.filter((id) => isRealInformationGap(id, gaps.fieldGaps, annexStatus))
      : [];

    let progressKind: SectionProgressKind = 'not_applicable';
    if (!applicable || readiness.readiness === 'NOT_APPLICABLE') {
      progressKind = 'not_applicable';
    } else if (approved) {
      progressKind = 'approved';
    } else if (automaticallyPrepared) {
      progressKind = 'automatically_prepared';
    } else if (generated) {
      progressKind = 'generated_draft';
    } else if (
      contradictionFieldIds.length > 0 ||
      (readiness.readiness === 'NOT_READY' && missingFieldIds.length > 0)
    ) {
      progressKind = 'needs_information';
    } else {
      progressKind = 'ready_to_draft';
    }

    return {
      sectionId: section.sectionId,
      title: section.title,
      applicable,
      readiness: applicable ? readiness.readiness : 'NOT_APPLICABLE',
      progressKind,
      generated,
      approved,
      automaticallyPrepared,
      missingFieldIds,
      missingFieldLabels: missingFieldIds.map(fieldLabel),
      tbcFieldIds,
      tbcFieldLabels: tbcFieldIds.map(fieldLabel),
      contradictionFieldIds,
      contradictionFieldLabels: contradictionFieldIds.map(fieldLabel),
    };
  });

  const applicable = sections.filter((s) => s.applicable);
  const contradictionLabels = [
    ...new Set(sections.flatMap((s) => s.contradictionFieldLabels)),
  ];
  const contradictionValuesByFieldId: Record<string, unknown[]> = {};
  for (const s of sections) {
    for (const id of s.contradictionFieldIds) {
      contradictionValuesByFieldId[id] = contradictionValues(input.memory, id);
    }
  }

  const missingInformationLabels = [
    ...new Set(
      sections
        .filter((s) => s.progressKind === 'needs_information')
        .flatMap((s) => [...s.contradictionFieldLabels, ...s.missingFieldLabels, ...s.tbcFieldLabels]),
    ),
  ];

  return {
    applicableSectionTitles: applicable.map((s) => s.title),
    sections,
    automaticallyPreparedTitles: sections
      .filter((s) => s.progressKind === 'automatically_prepared')
      .map((s) => s.title),
    needsInformation: sections.filter((s) => s.progressKind === 'needs_information'),
    readyToDraft: sections.filter((s) => s.progressKind === 'ready_to_draft'),
    generatedDrafts: sections.filter((s) => s.progressKind === 'generated_draft'),
    approved: sections.filter((s) => s.progressKind === 'approved'),
    notApplicableTitles: sections.filter((s) => s.progressKind === 'not_applicable').map((s) => s.title),
    missingInformationLabels,
    contradictionLabels,
    contradictionValuesByFieldId,
    projectSpecificAnnexStatus: annexStatus,
    standardAnnexesAutomaticallyPrepared,
    nextInformationNeed: toNeed(nextAction, input.memory),
    collectionSufficient: nextAction.type === 'STOP_COLLECTION',
    nextAction,
    fieldGapStatuses: gaps.fieldGaps.map((g) => ({
      fieldId: g.fieldId,
      label: fieldLabel(g.fieldId),
      gapStatus: g.gapStatus,
      materiality: g.materiality,
    })),
  };
}

function formatValue(value: unknown): string {
  if (value == null) return '(empty)';
  if (typeof value === 'string') return value.trim() || '(empty)';
  if (Array.isArray(value)) return value.map(formatValue).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function joinTitles(titles: string[]): string {
  return titles.join('; ');
}

function listSectionGaps(entry: SectionStatusEntry): string {
  const bits = [
    ...entry.contradictionFieldLabels.map((l) => `clarify ${l}`),
    ...entry.missingFieldLabels,
    ...entry.tbcFieldLabels.map((l) => `${l} (TBC)`),
  ];
  const unique = [...new Set(bits)];
  return unique.length ? `${entry.title} — ${unique.join(', ')}` : entry.title;
}

export function renderProjectStatusReply(
  snapshot: ProjectStatusSnapshot,
  language: ConversationLanguage = 'en',
): string {
  const lines: string[] = [];
  if (language === 'ar') {
    lines.push('هذا هو الوضع الحالي من حقائق المشروع الجاهزة في RAMI (وليس تخمينًا):');
  } else {
    lines.push('Here is the current status from RAMI’s project facts — not a guess:');
  }

  if (snapshot.automaticallyPreparedTitles.length) {
    const annexNote =
      snapshot.standardAnnexesAutomaticallyPrepared &&
      snapshot.automaticallyPreparedTitles.includes('Annexes')
        ? language === 'ar'
          ? ' الملحقات القياسية مُعدّة تلقائيًا.'
          : ' The standard Annexes are already prepared automatically.'
        : '';
    lines.push(
      language === 'ar'
        ? `مُعد تلقائيًا: ${joinTitles(snapshot.automaticallyPreparedTitles)}.${annexNote}`
        : `Automatically prepared: ${joinTitles(snapshot.automaticallyPreparedTitles)}.${annexNote}`,
    );
  }

  if (snapshot.projectSpecificAnnexStatus === 'details_missing') {
    lines.push(
      language === 'ar'
        ? 'ما زال هناك متطلب ملحق خاص بالمشروع غير مكتمل التفاصيل.'
        : 'A project-specific annex requirement is recorded, but its details are still missing.',
    );
  }

  if (snapshot.contradictionLabels.length) {
    const details = snapshot.contradictionLabels.map((label) => {
      const field = PROJECT_MEMORY_FIELDS.find((f) => f.label === label);
      const values = field ? snapshot.contradictionValuesByFieldId[field.fieldId] : undefined;
      if (values && values.length >= 2) {
        return `${label} (${values.map(formatValue).join(' vs ')})`;
      }
      return label;
    });
    lines.push(
      language === 'ar'
        ? `يوجد تعارض يجب توضيحه: ${details.join('; ')}.`
        : `There is a contradiction to clarify: ${details.join('; ')}.`,
    );
  }

  if (snapshot.needsInformation.length) {
    lines.push(
      language === 'ar' ? 'يحتاج معلومات منك:' : 'Needs information from you:',
    );
    for (const entry of snapshot.needsInformation) {
      lines.push(`- ${listSectionGaps(entry)}`);
    }
  } else {
    lines.push(
      language === 'ar'
        ? 'لا توجد معلومات مشروع إضافية مطلوبة حاليًا للأقسام الجاهزة للصياغة.'
        : 'No additional project information is currently required for those sections; they are ready to draft.',
    );
  }

  if (snapshot.readyToDraft.length) {
    lines.push(
      language === 'ar'
        ? `جاهز للصياغة (المعلومات كافية، ولم يُنشأ النص بعد): ${joinTitles(snapshot.readyToDraft.map((s) => s.title))}.`
        : `Ready to draft (enough information; not yet generated): ${joinTitles(snapshot.readyToDraft.map((s) => s.title))}.`,
    );
  }

  if (snapshot.generatedDrafts.length) {
    lines.push(
      language === 'ar'
        ? `مسودة مولَّدة موجودة: ${joinTitles(snapshot.generatedDrafts.map((s) => s.title))}.`
        : `Generated draft exists: ${joinTitles(snapshot.generatedDrafts.map((s) => s.title))}.`,
    );
  }
  if (snapshot.approved.length) {
    lines.push(
      language === 'ar'
        ? `معتمد: ${joinTitles(snapshot.approved.map((s) => s.title))}.`
        : `Approved: ${joinTitles(snapshot.approved.map((s) => s.title))}.`,
    );
  }

  const need = snapshot.nextInformationNeed;
  if (need.type === 'CLARIFY_CONTRADICTION' && need.fieldLabel) {
    lines.push(
      language === 'ar'
        ? `الخطوة التالية: توضيح أي قيمة يجب اعتمادها لـ «${need.fieldLabel}».`
        : `The next information I need is to clarify which value should govern for ${need.fieldLabel}.`,
    );
  } else if (need.type === 'ASK_REQUIREMENTS' && need.fieldLabel) {
    lines.push(
      language === 'ar'
        ? `المعلومة التالية التي أحتاجها هي: ${need.fieldLabel}.`
        : `The next information I need is the ${need.fieldLabel.toLowerCase()}.`,
    );
  } else if (need.type === 'STOP_COLLECTION' || need.type === 'READY_TO_DRAFT') {
    lines.push(
      language === 'ar'
        ? 'يمكن صياغة الأقسام الجاهزة عند رغبتك — لا أحتاج معلومات إضافية الآن.'
        : 'Those ready sections can be drafted when you want — I do not need more project information first.',
    );
  } else if (need.type === 'OPEN_ENDED') {
    lines.push(
      language === 'ar'
        ? 'أخبرني بالمزيد عن نوع المشروع أو الحاجة أو النطاق.'
        : 'Please share more about the project type, business need, or scope.',
    );
  }

  const reply = lines.join('\n');
  for (const phrase of FORBIDDEN_STATUS_SECTION_PHRASES) {
    if (reply.includes(phrase)) {
      throw new Error(`Status reply invented a non-canonical section phrase: ${phrase}`);
    }
  }
  return reply;
}

export function answerProjectStatusQuestion(
  input: BuildProjectStatusInput & { language?: ConversationLanguage },
): { snapshot: ProjectStatusSnapshot; reply: string } {
  const snapshot = buildProjectStatusSnapshot(input);
  return {
    snapshot,
    reply: renderProjectStatusReply(snapshot, input.language ?? 'en'),
  };
}

export function assertStatusReplyGrounded(reply: string, snapshot: ProjectStatusSnapshot): void {
  for (const phrase of FORBIDDEN_STATUS_SECTION_PHRASES) {
    if (reply.includes(phrase)) {
      throw new Error(`Reply contains forbidden section phrase: ${phrase}`);
    }
  }
  if (snapshot.nextInformationNeed.type === 'ASK_REQUIREMENTS' && snapshot.nextInformationNeed.fieldLabel) {
    const label = snapshot.nextInformationNeed.fieldLabel;
    if (!reply.toLowerCase().includes(label.toLowerCase())) {
      throw new Error(`Reply omitted next Gap Engine field: ${label}`);
    }
  }
  if (snapshot.nextInformationNeed.type === 'CLARIFY_CONTRADICTION' && snapshot.nextInformationNeed.fieldLabel) {
    if (!reply.includes(snapshot.nextInformationNeed.fieldLabel)) {
      throw new Error('Reply omitted contradiction clarification');
    }
  }
  if (
    snapshot.standardAnnexesAutomaticallyPrepared &&
    snapshot.projectSpecificAnnexStatus !== 'details_missing'
  ) {
    if (/\b(annexes?|appendices) are missing\b/i.test(reply)) {
      throw new Error('Reply treated standard Annexes as missing');
    }
  }
}
