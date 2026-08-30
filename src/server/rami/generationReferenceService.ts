/**
 * BA-approved drafting references. Distinct from historical_field_proposals.
 * Approving a drafting reference NEVER writes ProjectFacts.
 */

import { randomUUID } from 'crypto';
import { findProjectByDocumentKey } from '@/server/repositories/ProjectRepository';
import { getChunkById } from '@/server/rami/historicalChunkRepository';
import { getHistoricalDocument } from '@/server/rami/historicalRepository';
import { getRfpSection } from '@/schema/rfpSchema';
import {
  countActiveGenerationReferences,
  findActiveGenerationReference,
  findRevokedGenerationReference,
  getGenerationReference,
  insertGenerationReference,
  listGenerationReferences,
  reactivateGenerationReference,
  revokeGenerationReferenceRow,
} from '@/server/rami/generationReferenceRepository';
import type {
  GenerationHistoricalReference,
  GenerationReferenceLineage,
  ProjectGenerationReference,
} from '@/types/generationReference';
import {
  HIGH_RISK_GENERATION_SECTIONS,
  MAX_GENERATION_REFERENCES_PER_SECTION,
} from '@/types/generationReference';

export class GenerationReferenceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'GenerationReferenceError';
  }
}

async function resolveProject(documentKey: string) {
  const project = await findProjectByDocumentKey(documentKey);
  if (!project) {
    throw new GenerationReferenceError('PROJECT_NOT_FOUND', `Project '${documentKey}' not found.`);
  }
  return project;
}

export function excerptForSection(sectionId: string, chunkText: string): string {
  const max = HIGH_RISK_GENERATION_SECTIONS.has(sectionId) ? 400 : 900;
  const text = chunkText.trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export async function toGenerationHistoricalReference(
  row: ProjectGenerationReference,
): Promise<GenerationHistoricalReference | null> {
  const chunk = await getChunkById(row.historicalChunkId);
  if (!chunk || chunk.provenanceClass !== 'REFERENCE') return null;
  const doc = await getHistoricalDocument(chunk.historicalRfpId);
  return {
    generationReferenceId: row.generationReferenceId,
    chunkId: chunk.chunkId,
    historicalRfpId: chunk.historicalRfpId,
    historicalRfpTitle: doc?.title ?? chunk.historicalRfpId,
    excerpt: excerptForSection(row.sectionId, chunk.chunkText),
    mappedFieldIds: chunk.mappedFieldIds,
    canonicalQuestionIds: chunk.canonicalQuestionIds,
    sectionIds: chunk.sectionIds,
    provenanceClass: 'REFERENCE',
    sourceLocator: chunk.sourceLocators[0],
    usageScope: row.usageScope,
  };
}

export async function loadApprovedGenerationReferences(
  projectId: string,
  sectionId: string,
): Promise<GenerationHistoricalReference[]> {
  const rows = await listGenerationReferences({
    projectId,
    sectionId,
    status: 'ACTIVE',
  });
  const out: GenerationHistoricalReference[] = [];
  for (const row of rows.slice(0, MAX_GENERATION_REFERENCES_PER_SECTION)) {
    const payload = await toGenerationHistoricalReference(row);
    if (payload) out.push(payload);
  }
  return out;
}

export function toLineage(
  refs: GenerationHistoricalReference[],
): GenerationReferenceLineage[] {
  return refs.map((r) => ({
    generationReferenceId: r.generationReferenceId,
    chunkId: r.chunkId,
    historicalRfpId: r.historicalRfpId,
    historicalRfpTitle: r.historicalRfpTitle,
    sourceLocator: r.sourceLocator,
    usageScope: r.usageScope,
  }));
}

export function assertApprovedReferencesForSection(
  refs: GenerationHistoricalReference[],
  sectionId: string,
): void {
  for (const r of refs) {
    if (r.provenanceClass !== 'REFERENCE') {
      throw new GenerationReferenceError(
        'INVALID_PROVENANCE',
        `Reference ${r.chunkId} is not REFERENCE.`,
      );
    }
    if (r.usageScope !== 'STRUCTURE_AND_LANGUAGE') {
      throw new GenerationReferenceError('INVALID_SCOPE', `Unsupported usage scope.`);
    }
  }
  void sectionId;
}

export async function approveDraftingReference(input: {
  documentKey: string;
  sectionId: string;
  chunkId: string;
  approvedBy?: string;
}): Promise<ProjectGenerationReference> {
  if (!getRfpSection(input.sectionId)) {
    throw new GenerationReferenceError('SECTION_UNKNOWN', `Unknown section ${input.sectionId}`);
  }
  const project = await resolveProject(input.documentKey);
  const chunk = await getChunkById(input.chunkId);
  if (!chunk) {
    throw new GenerationReferenceError('CHUNK_NOT_FOUND', `Historical chunk ${input.chunkId} not found.`);
  }
  if (chunk.provenanceClass !== 'REFERENCE') {
    throw new GenerationReferenceError('INVALID_PROVENANCE', 'Chunk is not REFERENCE.');
  }

  const existing = await findActiveGenerationReference({
    projectId: project.project_id,
    sectionId: input.sectionId,
    historicalChunkId: input.chunkId,
  });
  if (existing) return existing;

  const revoked = await findRevokedGenerationReference({
    projectId: project.project_id,
    sectionId: input.sectionId,
    historicalChunkId: input.chunkId,
  });
  if (revoked) {
    return reactivateGenerationReference(revoked.generationReferenceId, input.approvedBy ?? null);
  }

  const active = await countActiveGenerationReferences(project.project_id, input.sectionId);
  if (active >= MAX_GENERATION_REFERENCES_PER_SECTION) {
    throw new GenerationReferenceError(
      'LIMIT_EXCEEDED',
      `At most ${MAX_GENERATION_REFERENCES_PER_SECTION} drafting references per section.`,
    );
  }

  return insertGenerationReference({
    generationReferenceId: `gr_${randomUUID()}`,
    projectId: project.project_id,
    sectionId: input.sectionId,
    historicalChunkId: input.chunkId,
    approvedBy: input.approvedBy ?? 'ba',
  });
}

export async function revokeDraftingReference(input: {
  documentKey: string;
  generationReferenceId: string;
}): Promise<ProjectGenerationReference> {
  const project = await resolveProject(input.documentKey);
  const row = await getGenerationReference(input.generationReferenceId);
  if (!row || row.projectId !== project.project_id) {
    throw new GenerationReferenceError('NOT_FOUND', 'Drafting reference not found for this project.');
  }
  if (row.status === 'REVOKED') return row;
  const revoked = await revokeGenerationReferenceRow(input.generationReferenceId);
  return revoked ?? row;
}

export async function listDraftingReferences(input: {
  documentKey: string;
  sectionId?: string;
  status?: 'ACTIVE' | 'REVOKED';
}): Promise<
  Array<ProjectGenerationReference & { payload: GenerationHistoricalReference | null }>
> {
  const project = await resolveProject(input.documentKey);
  const rows = await listGenerationReferences({
    projectId: project.project_id,
    sectionId: input.sectionId,
    status: input.status,
  });
  const out = [];
  for (const row of rows) {
    out.push({
      ...row,
      payload: row.status === 'ACTIVE' ? await toGenerationHistoricalReference(row) : null,
    });
  }
  return out;
}
