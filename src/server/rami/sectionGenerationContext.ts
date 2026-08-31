/**
 * Controlled SectionGenerationContext builder.
 * Scoped facts only — never full DB / chat / historical RFPs.
 */

import type { ProjectMemory } from '@/types/projectMemory';
import type { ProjectContext } from '@/types/projectContext';
import type {
  GeneratedBlock,
  GenerationFactSnapshot,
  GenerationTbcSnapshot,
  SectionEditContext,
  SectionGenerationContext,
} from '@/types/generatedSection';
import type { GenerationHistoricalReference } from '@/types/generationReference';
import { ANTI_HALLUCINATION_RULES, GenerationError } from '@/types/generatedSection';
import { getRfpSection } from '@/schema/rfpSchema';
import { getFieldDef } from '@/schema/projectMemoryFields';
import { getSectionFieldLinks } from '@/schema/sectionFieldMap';
import { getSectionReadiness } from '@/server/rami/sectionReadiness';

interface MemoryBag {
  current?: { value?: unknown; status?: string };
  gapStatus?: string;
  deferredTo?: string;
}

function getBag(memory: ProjectMemory, fieldId: string): MemoryBag | null {
  const raw = (memory as unknown as Record<string, unknown>)[fieldId];
  if (!raw || typeof raw !== 'object') return null;
  return raw as MemoryBag;
}

function fieldLabel(fieldId: string): string {
  return getFieldDef(fieldId)?.label ?? fieldId;
}

function stringish(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value) && value.length > 0) return JSON.stringify(value);
  if (value && typeof value === 'object') return JSON.stringify(value);
  return undefined;
}

/**
 * Build an auditable generation context for one section.
 * Throws GenerationError when readiness forbids generation.
 */
export function buildSectionGenerationContext(input: {
  projectId: string;
  documentKey: string;
  sectionId: string;
  memory: ProjectMemory;
  projectContext?: ProjectContext;
  /** Pre-loaded BA-approved refs only. Generation must not retrieve. */
  approvedHistoricalReferences?: GenerationHistoricalReference[];
}): SectionGenerationContext {
  const section = getRfpSection(input.sectionId);
  if (!section) {
    throw new GenerationError('SECTION_UNKNOWN', `Unknown sectionId: ${input.sectionId}`);
  }

  const readiness = getSectionReadiness(
    input.memory,
    input.sectionId,
    input.projectContext,
  );

  if (!readiness.applicable || readiness.readiness === 'NOT_APPLICABLE') {
    throw new GenerationError(
      'NOT_APPLICABLE',
      `Section ${input.sectionId} is not applicable; generation blocked.`,
      readiness,
    );
  }

  if (readiness.readiness === 'NOT_READY') {
    throw new GenerationError(
      'NOT_READY',
      `Section ${input.sectionId} is NOT_READY; generation blocked.`,
      {
        missingFields: readiness.missingFields,
        criticalBlockers: readiness.criticalBlockers,
        readiness,
      },
    );
  }

  if (
    readiness.readiness !== 'READY_TO_DRAFT' &&
    readiness.readiness !== 'DRAFTABLE_WITH_TBC'
  ) {
    throw new GenerationError(
      'NOT_READY',
      `Section ${input.sectionId} cannot be generated from readiness ${readiness.readiness}.`,
      readiness,
    );
  }

  const facts = assembleSectionFacts(input, readiness);

  return {
    projectId: input.projectId,
    documentKey: input.documentKey,
    sectionId: section.sectionId,
    title: section.title,
    subsections: section.representativeSubsections.map((s) => ({
      id: s.id,
      title: s.title,
    })),
    applicable: true,
    readiness: facts.readiness,
    answeredFacts: facts.answeredFacts,
    sharedFacts: facts.sharedFacts,
    tbcFields: facts.tbcFields,
    notApplicableFields: facts.notApplicableFields,
    approvedHistoricalReferences: [...(input.approvedHistoricalReferences ?? [])],
    documentMeta: facts.documentMeta,
    antiHallucinationRules: [...ANTI_HALLUCINATION_RULES],
  };
}

/** Field IDs that entered answered/shared context (for tests / audit). */
export function contextFactFieldIds(ctx: SectionGenerationContext): string[] {
  return [
    ...ctx.answeredFacts.map((f) => f.fieldId),
    ...ctx.sharedFacts.map((f) => f.fieldId),
  ];
}

function assembleSectionFacts(
  input: {
    sectionId: string;
    memory: ProjectMemory;
    projectContext?: ProjectContext;
    approvedHistoricalReferences?: GenerationHistoricalReference[];
  },
  readiness: ReturnType<typeof getSectionReadiness>,
): Pick<
  SectionGenerationContext,
  | 'answeredFacts'
  | 'sharedFacts'
  | 'tbcFields'
  | 'notApplicableFields'
  | 'documentMeta'
  | 'readiness'
> {
  const links = getSectionFieldLinks().filter((l) => l.sectionId === input.sectionId);
  const answeredFacts: GenerationFactSnapshot[] = [];
  const sharedFacts: GenerationFactSnapshot[] = [];
  const tbcFields: GenerationTbcSnapshot[] = [];

  for (const link of links) {
    if (readiness.notApplicableFields.includes(link.fieldId)) continue;

    if (readiness.tbcFields.includes(link.fieldId)) {
      const bag = getBag(input.memory, link.fieldId);
      tbcFields.push({
        fieldId: link.fieldId,
        label: fieldLabel(link.fieldId),
        deferredTo: bag?.deferredTo,
      });
      continue;
    }

    if (!readiness.answeredFields.includes(link.fieldId)) continue;

    const bag = getBag(input.memory, link.fieldId);
    if (!bag?.current) continue;
    const snap: GenerationFactSnapshot = {
      fieldId: link.fieldId,
      label: fieldLabel(link.fieldId),
      value: bag.current.value,
      provenance: bag.current.status ?? 'EXTRACTED',
      role: link.role,
    };
    if (link.role === 'shared') sharedFacts.push(snap);
    else answeredFacts.push(snap);
  }

  const metaFields = [
    'documentTitle',
    'beneficiaryEntity',
    'documentType',
    'engagementType',
    'engagementDuration',
  ] as const;
  const documentMeta: SectionGenerationContext['documentMeta'] = {};
  for (const id of metaFields) {
    const bag = getBag(input.memory, id);
    const v = stringish(bag?.current?.value);
    if (v && bag?.current?.status !== 'TBC' && bag?.gapStatus !== 'UNKNOWN') {
      documentMeta[id] = v;
    }
  }

  const readinessAtGen =
    readiness.readiness === 'READY_TO_DRAFT' || readiness.readiness === 'DRAFTABLE_WITH_TBC'
      ? readiness.readiness
      : 'DRAFTABLE_WITH_TBC';

  return {
    readiness: readinessAtGen,
    answeredFacts,
    sharedFacts,
    tbcFields,
    notApplicableFields: [...readiness.notApplicableFields],
    documentMeta,
  };
}

/**
 * Build edit context for an existing generated section.
 * Does not require NOT_READY gate — content already exists.
 * Does not retrieve historical references; uses pre-approved refs only.
 */
export function buildSectionEditContext(input: {
  projectId: string;
  documentKey: string;
  sectionId: string;
  memory: ProjectMemory;
  projectContext?: ProjectContext;
  approvedHistoricalReferences?: GenerationHistoricalReference[];
  currentSection: GeneratedBlock[];
  currentVersion: number;
  readinessAtGeneration: 'READY_TO_DRAFT' | 'DRAFTABLE_WITH_TBC';
  editInstruction: string;
}): SectionEditContext {
  const section = getRfpSection(input.sectionId);
  if (!section) {
    throw new GenerationError('SECTION_UNKNOWN', `Unknown sectionId: ${input.sectionId}`);
  }

  const readiness = getSectionReadiness(
    input.memory,
    input.sectionId,
    input.projectContext,
  );

  if (!readiness.applicable || readiness.readiness === 'NOT_APPLICABLE') {
    throw new GenerationError(
      'NOT_APPLICABLE',
      `Section ${input.sectionId} is not applicable; AI edit blocked.`,
      readiness,
    );
  }

  const instruction = input.editInstruction.trim();
  if (!instruction) {
    throw new GenerationError('INVALID_MODEL_OUTPUT', 'Edit instruction is required.');
  }

  const facts = assembleSectionFacts(input, readiness);

  return {
    projectId: input.projectId,
    documentKey: input.documentKey,
    sectionId: section.sectionId,
    title: section.title,
    subsections: section.representativeSubsections.map((s) => ({
      id: s.id,
      title: s.title,
    })),
    applicable: true,
    readiness: input.readinessAtGeneration,
    answeredFacts: facts.answeredFacts,
    sharedFacts: facts.sharedFacts,
    tbcFields: facts.tbcFields,
    notApplicableFields: facts.notApplicableFields,
    approvedHistoricalReferences: [...(input.approvedHistoricalReferences ?? [])],
    documentMeta: facts.documentMeta,
    antiHallucinationRules: [...ANTI_HALLUCINATION_RULES],
    currentBlocks: input.currentSection,
    currentVersion: input.currentVersion,
    editInstruction: instruction,
  };
}
