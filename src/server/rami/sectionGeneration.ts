/**
 * RFP section generation core.
 * Readiness gates in TypeScript. Qwen drafts language only via RamiModelProvider.
 */

import type { RamiModelProvider } from '@/server/ai/RamiModelProvider';
import { getDefaultProvider } from '@/server/ai';
import { withTransaction } from '@/server/db/connection';
import { findProjectByDocumentKey } from '@/server/repositories/ProjectRepository';
import {
  approveCurrentSectionContent,
  getCurrentSectionContent,
  insertSectionContentVersion,
  listCurrentSectionContents,
  type ProjectSectionContentRow,
} from '@/server/repositories/ProjectSectionContentRepository';
import { hydrateProject, persistRuntimeState } from '@/server/rami/projectPersistence';
import { buildSectionGenerationContext } from '@/server/rami/sectionGenerationContext';
import {
  buildGenerationMessages,
  GENERATED_SECTION_JSON_SCHEMA,
} from '@/server/rami/generationPrompt';
import { getSectionReadiness, getAllSectionReadiness } from '@/server/rami/sectionReadiness';
import { getRfpSection, RFP_SECTIONS, isSectionApplicable } from '@/schema/rfpSchema';
import { buildApplicabilityContext } from '@/server/rami/gapEngine';
import {
  advanceSectionState,
  createSectionStateRecord,
  type SectionLifecycleState,
} from '@/types/sectionState';
import type {
  AssembledRfp,
  GeneratedBlock,
  GeneratedSection,
  SectionGenerationContext,
} from '@/types/generatedSection';
import {
  GenerationError,
  TBC_MARKER_PREFIX,
} from '@/types/generatedSection';

function isBlock(raw: unknown): raw is GeneratedBlock {
  if (!raw || typeof raw !== 'object') return false;
  const b = raw as Record<string, unknown>;
  const type = b.type;
  if (typeof type !== 'string') return false;
  switch (type) {
    case 'heading':
      return (
        (b.level === 1 || b.level === 2 || b.level === 3) &&
        typeof b.text === 'string'
      );
    case 'paragraph':
      return typeof b.text === 'string';
    case 'bullet_list':
    case 'numbered_list':
      return Array.isArray(b.items) && b.items.every((x) => typeof x === 'string');
    case 'table':
      return (
        Array.isArray(b.headers) &&
        Array.isArray(b.rows) &&
        b.headers.every((x) => typeof x === 'string') &&
        b.rows.every(
          (row) => Array.isArray(row) && row.every((c) => typeof c === 'string'),
        )
      );
    case 'tbc':
      return typeof b.label === 'string';
    default:
      return false;
  }
}

function normalizeBlocks(raw: unknown): GeneratedBlock[] {
  if (!raw || typeof raw !== 'object') return [];
  const blocks = (raw as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocks)) return [];
  return blocks.filter(isBlock);
}

/** Ensure every TBC field has an explicit marker; drop empty lists. */
export function enforceTbcBlocks(
  blocks: GeneratedBlock[],
  ctx: SectionGenerationContext,
): GeneratedBlock[] {
  const present = new Set(
    blocks
      .filter((b): b is Extract<GeneratedBlock, { type: 'tbc' }> => b.type === 'tbc')
      .map((b) => b.fieldId)
      .filter(Boolean),
  );

  const out = [...blocks];
  for (const tbc of ctx.tbcFields) {
    if (present.has(tbc.fieldId)) continue;
    const alreadyLabeled = out.some((b) => {
      if (b.type !== 'tbc') return false;
      const label = b.label.toLowerCase();
      return (
        label.includes(tbc.label.toLowerCase()) ||
        label.includes(tbc.fieldId.toLowerCase())
      );
    });
    if (alreadyLabeled) {
      // Attach fieldId onto the first matching unlabeled tbc block for auditability.
      const idx = out.findIndex(
        (b) =>
          b.type === 'tbc' &&
          !b.fieldId &&
          (b.label.toLowerCase().includes(tbc.label.toLowerCase()) ||
            b.label.toLowerCase().includes(tbc.fieldId.toLowerCase())),
      );
      if (idx >= 0) {
        const block = out[idx] as Extract<GeneratedBlock, { type: 'tbc' }>;
        out[idx] = { ...block, fieldId: tbc.fieldId };
      }
      continue;
    }
    out.push({
      type: 'tbc',
      fieldId: tbc.fieldId,
      label: `${TBC_MARKER_PREFIX}: ${tbc.label}${
        tbc.deferredTo ? ` (deferred to ${tbc.deferredTo})` : ''
      }`,
    });
  }
  return out.filter((b) => {
    if (b.type === 'bullet_list' || b.type === 'numbered_list') return b.items.length > 0;
    if (b.type === 'paragraph' || b.type === 'heading') return b.text.trim().length > 0;
    return true;
  });
}

async function resolveProject(documentKey: string) {
  const project = await findProjectByDocumentKey(documentKey);
  if (!project) {
    throw new GenerationError(
      'PROJECT_NOT_FOUND',
      `Project '${documentKey}' not found.`,
    );
  }
  return project;
}

/** Walk legal transitions so a freshly generated section lands in REVIEW. */
function advanceLifecycleTowardReview(
  prior: {
    sectionId: string;
    state: SectionLifecycleState;
    enteredAt: string;
    reopenReason?: string;
    draftFieldSnapshot?: string[];
  },
  fieldSnapshot: string[],
): ReturnType<typeof createSectionStateRecord> {
  let record: ReturnType<typeof createSectionStateRecord> = {
    ...prior,
    draftFieldSnapshot: fieldSnapshot,
  };

  const sequences: Record<SectionLifecycleState, SectionLifecycleState[]> = {
    NOT_STARTED: ['COLLECTING', 'READY_TO_DRAFT', 'DRAFTING', 'REVIEW'],
    COLLECTING: ['READY_TO_DRAFT', 'DRAFTING', 'REVIEW'],
    READY_TO_DRAFT: ['DRAFTING', 'REVIEW'],
    DRAFTING: ['REVIEW'],
    REVIEW: ['REVISING', 'DRAFTING', 'REVIEW'],
    REVISING: ['DRAFTING', 'REVIEW'],
    APPROVED: ['REOPENED', 'COLLECTING', 'READY_TO_DRAFT', 'DRAFTING', 'REVIEW'],
    REOPENED: ['COLLECTING', 'READY_TO_DRAFT', 'DRAFTING', 'REVIEW'],
  };

  for (const to of sequences[record.state] ?? []) {
    if (record.state === to) continue;
    record = advanceSectionState(record, to, {
      draftFieldSnapshot: fieldSnapshot,
      reopenReason: to === 'REOPENED' ? 'manual' : record.reopenReason,
    });
  }
  return record;
}

export interface GenerateSectionResult {
  context: SectionGenerationContext;
  content: ProjectSectionContentRow;
  generated: GeneratedSection;
}

async function draftBlocks(
  ctx: SectionGenerationContext,
  provider: RamiModelProvider,
): Promise<{ blocks: GeneratedBlock[]; modelUsed: string }> {
  const messages = buildGenerationMessages(ctx);
  try {
    const result = await provider.extractStructured<{ blocks: unknown }>(
      messages,
      GENERATED_SECTION_JSON_SCHEMA,
      { temperature: 0.2, timeoutMs: 300_000 },
    );
    const blocks = enforceTbcBlocks(normalizeBlocks(result.data), ctx);
    if (blocks.length === 0) {
      throw new GenerationError(
        'INVALID_MODEL_OUTPUT',
        'Model returned no usable content blocks.',
      );
    }
    return { blocks, modelUsed: result.modelUsed };
  } catch (err) {
    if (err instanceof GenerationError) throw err;
    throw new GenerationError(
      'PROVIDER_FAILED',
      `Section generation inference failed: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }
}

/**
 * Generate one section when readiness allows. Persists to PostgreSQL as DRAFT.
 */
export async function generateRfpSection(input: {
  documentKey: string;
  sectionId: string;
  provider?: RamiModelProvider;
  /** When current content is APPROVED, require explicit reopen. */
  reopenApproved?: boolean;
}): Promise<GenerateSectionResult> {
  const project = await resolveProject(input.documentKey);
  const session = await hydrateProject(input.documentKey);

  const existing = await getCurrentSectionContent(project.project_id, input.sectionId);
  if (existing?.approval_status === 'APPROVED' && !input.reopenApproved) {
    throw new GenerationError(
      'APPROVED_CONTENT_PROTECTED',
      `Section ${input.sectionId} is APPROVED. Pass reopenApproved=true to create a new DRAFT version (history kept).`,
    );
  }

  const ctx = buildSectionGenerationContext({
    projectId: project.project_id,
    documentKey: input.documentKey,
    sectionId: input.sectionId,
    memory: session.memory,
    projectContext: session.projectContext,
  });

  const provider = input.provider ?? getDefaultProvider();
  const { blocks, modelUsed } = await draftBlocks(ctx, provider);

  const generated: GeneratedSection = {
    sectionId: ctx.sectionId,
    title: ctx.title,
    version: 0, // repository assigns
    approvalStatus: 'DRAFT',
    generatedAt: new Date().toISOString(),
    readinessAtGeneration: ctx.readiness,
    modelUsed,
    blocks,
    sourceFieldIds: [
      ...ctx.answeredFacts.map((f) => f.fieldId),
      ...ctx.sharedFacts.map((f) => f.fieldId),
    ],
    tbcFieldIds: ctx.tbcFields.map((f) => f.fieldId),
  };

  const content = await withTransaction(async (client) => {
    return insertSectionContentVersion(
      {
        projectId: project.project_id,
        sectionId: input.sectionId,
        content: generated,
      },
      client,
    );
  });

  const prior =
    session.sectionStates[input.sectionId] ?? createSectionStateRecord(input.sectionId);
  session.sectionStates[input.sectionId] = advanceLifecycleTowardReview(
    prior,
    generated.sourceFieldIds,
  );
  await persistRuntimeState(session);

  return {
    context: ctx,
    content,
    generated: content.content_json,
  };
}

/** Same pipeline as generate — explicit alias for UI clarity. */
export async function regenerateRfpSection(input: {
  documentKey: string;
  sectionId: string;
  provider?: RamiModelProvider;
  reopenApproved?: boolean;
}): Promise<GenerateSectionResult> {
  return generateRfpSection(input);
}

export async function approveRfpSection(input: {
  documentKey: string;
  sectionId: string;
}): Promise<ProjectSectionContentRow> {
  const project = await resolveProject(input.documentKey);
  const session = await hydrateProject(input.documentKey);
  const current = await getCurrentSectionContent(project.project_id, input.sectionId);
  if (!current) {
    throw new GenerationError(
      'CONTENT_NOT_FOUND',
      `No generated content for section ${input.sectionId}.`,
    );
  }

  const row = await withTransaction(async (client) => {
    return approveCurrentSectionContent(project.project_id, input.sectionId, client);
  });

  let rec =
    session.sectionStates[input.sectionId] ?? createSectionStateRecord(input.sectionId);
  if (rec.state === 'REVIEW') {
    rec = advanceSectionState(rec, 'APPROVED', {
      draftFieldSnapshot: row.source_field_ids,
    });
  } else if (rec.state !== 'APPROVED') {
    // Force to REVIEW then APPROVED when lifecycle was out of sync
    if (rec.state === 'DRAFTING' || rec.state === 'READY_TO_DRAFT' || rec.state === 'REVISING') {
      if (rec.state === 'READY_TO_DRAFT') rec = advanceSectionState(rec, 'DRAFTING');
      if (rec.state === 'DRAFTING' || rec.state === 'REVISING') {
        if (rec.state === 'REVISING') rec = advanceSectionState(rec, 'DRAFTING');
        rec = advanceSectionState(rec, 'REVIEW');
      }
      rec = advanceSectionState(rec, 'APPROVED', {
        draftFieldSnapshot: row.source_field_ids,
      });
    }
  }
  session.sectionStates[input.sectionId] = rec;
  await persistRuntimeState(session);
  return row;
}

export async function getGeneratedSection(input: {
  documentKey: string;
  sectionId: string;
}): Promise<ProjectSectionContentRow | null> {
  const project = await resolveProject(input.documentKey);
  return getCurrentSectionContent(project.project_id, input.sectionId);
}

export async function listGeneratedSections(input: {
  documentKey: string;
}): Promise<ProjectSectionContentRow[]> {
  const project = await resolveProject(input.documentKey);
  return listCurrentSectionContents(project.project_id);
}

/**
 * Assemble backend RFP from persisted generated sections in canonical order.
 * Does not invent missing sections.
 */
export async function assembleRfpDocument(documentKey: string): Promise<AssembledRfp> {
  const project = await resolveProject(documentKey);
  const session = await hydrateProject(documentKey);
  const contents = await listCurrentSectionContents(project.project_id);
  const bySection = new Map(contents.map((c) => [c.section_id, c]));
  const readinessAll = getAllSectionReadiness(session.memory, session.projectContext);
  const readinessMap = new Map(readinessAll.map((r) => [r.sectionId, r]));
  const sectionCtx = buildApplicabilityContext(session.memory, session.projectContext);

  const sections = RFP_SECTIONS.map((s) => {
    const applicable = isSectionApplicable(s, sectionCtx);
    const readiness = readinessMap.get(s.sectionId)?.readiness ?? 'NOT_APPLICABLE';
    const row = bySection.get(s.sectionId) ?? null;
    return {
      sectionId: s.sectionId,
      title: s.title,
      order: s.order,
      applicable,
      readiness,
      approvalStatus: row?.approval_status ?? null,
      generated: row?.content_json ?? null,
      missingGeneration: applicable && !row,
    };
  });

  const applicableSections = sections.filter((s) => s.applicable);
  const generatedApplicableCount = applicableSections.filter((s) => s.generated).length;
  const approvedApplicableCount = applicableSections.filter(
    (s) => s.approvalStatus === 'APPROVED',
  ).length;

  return {
    documentKey,
    projectId: project.project_id,
    assembledAt: new Date().toISOString(),
    sections,
    applicableSectionCount: applicableSections.length,
    generatedApplicableCount,
    approvedApplicableCount,
    complete:
      applicableSections.length > 0 &&
      approvedApplicableCount === applicableSections.length,
  };
}

export function peekSectionReadinessForDocument(
  documentKey: string,
  sectionId: string,
) {
  return { documentKey, sectionId, section: getRfpSection(sectionId) };
}

/** Exported for unit tests — readiness gate without persistence. */
export function assertGenerationAllowed(
  memory: Parameters<typeof getSectionReadiness>[0],
  sectionId: string,
  projectContext?: Parameters<typeof getSectionReadiness>[2],
): ReturnType<typeof getSectionReadiness> {
  const r = getSectionReadiness(memory, sectionId, projectContext);
  if (!r.applicable || r.readiness === 'NOT_APPLICABLE') {
    throw new GenerationError('NOT_APPLICABLE', 'blocked', r);
  }
  if (r.readiness === 'NOT_READY') {
    throw new GenerationError('NOT_READY', 'blocked', r);
  }
  return r;
}
