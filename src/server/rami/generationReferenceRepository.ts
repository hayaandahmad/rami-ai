/**
 * Persistence for project_generation_references.
 * Drafting guidance only — never writes project_facts.
 */

import { query } from '@/server/db/connection';
import type {
  GenerationReferenceStatus,
  GenerationReferenceUsageScope,
  ProjectGenerationReference,
} from '@/types/generationReference';

interface Row {
  generation_reference_id: string;
  project_id: string;
  section_id: string;
  historical_chunk_id: string;
  usage_scope: string;
  status: string;
  approved_by: string | null;
  approved_at: Date;
  created_at: Date;
  revoked_at: Date | null;
}

function mapRow(r: Row): ProjectGenerationReference {
  return {
    generationReferenceId: r.generation_reference_id,
    projectId: r.project_id,
    sectionId: r.section_id,
    historicalChunkId: r.historical_chunk_id,
    usageScope: r.usage_scope as GenerationReferenceUsageScope,
    status: r.status as GenerationReferenceStatus,
    approvedBy: r.approved_by,
    approvedAt: r.approved_at.toISOString(),
    createdAt: r.created_at.toISOString(),
    revokedAt: r.revoked_at ? r.revoked_at.toISOString() : null,
  };
}

export async function insertGenerationReference(input: {
  generationReferenceId: string;
  projectId: string;
  sectionId: string;
  historicalChunkId: string;
  usageScope?: GenerationReferenceUsageScope;
  approvedBy?: string | null;
}): Promise<ProjectGenerationReference> {
  const r = await query<Row>(
    `INSERT INTO project_generation_references (
       generation_reference_id, project_id, section_id, historical_chunk_id,
       usage_scope, status, approved_by, approved_at, created_at
     ) VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6,NOW(),NOW())
     RETURNING *`,
    [
      input.generationReferenceId,
      input.projectId,
      input.sectionId,
      input.historicalChunkId,
      input.usageScope ?? 'STRUCTURE_AND_LANGUAGE',
      input.approvedBy ?? null,
    ],
  );
  return mapRow(r.rows[0]);
}

export async function listGenerationReferences(opts: {
  projectId: string;
  sectionId?: string;
  status?: GenerationReferenceStatus;
}): Promise<ProjectGenerationReference[]> {
  const clauses = [`project_id = $1`];
  const params: unknown[] = [opts.projectId];
  if (opts.sectionId) {
    params.push(opts.sectionId);
    clauses.push(`section_id = $${params.length}`);
  }
  if (opts.status) {
    params.push(opts.status);
    clauses.push(`status = $${params.length}`);
  }
  const r = await query<Row>(
    `SELECT * FROM project_generation_references
     WHERE ${clauses.join(' AND ')}
     ORDER BY created_at ASC`,
    params,
  );
  return r.rows.map(mapRow);
}

export async function getGenerationReference(
  generationReferenceId: string,
): Promise<ProjectGenerationReference | null> {
  const r = await query<Row>(
    `SELECT * FROM project_generation_references WHERE generation_reference_id = $1`,
    [generationReferenceId],
  );
  return r.rows[0] ? mapRow(r.rows[0]) : null;
}

export async function findActiveGenerationReference(opts: {
  projectId: string;
  sectionId: string;
  historicalChunkId: string;
}): Promise<ProjectGenerationReference | null> {
  const r = await query<Row>(
    `SELECT * FROM project_generation_references
     WHERE project_id = $1 AND section_id = $2 AND historical_chunk_id = $3 AND status = 'ACTIVE'
     LIMIT 1`,
    [opts.projectId, opts.sectionId, opts.historicalChunkId],
  );
  return r.rows[0] ? mapRow(r.rows[0]) : null;
}

export async function findRevokedGenerationReference(opts: {
  projectId: string;
  sectionId: string;
  historicalChunkId: string;
}): Promise<ProjectGenerationReference | null> {
  const r = await query<Row>(
    `SELECT * FROM project_generation_references
     WHERE project_id = $1 AND section_id = $2 AND historical_chunk_id = $3 AND status = 'REVOKED'
     ORDER BY revoked_at DESC NULLS LAST
     LIMIT 1`,
    [opts.projectId, opts.sectionId, opts.historicalChunkId],
  );
  return r.rows[0] ? mapRow(r.rows[0]) : null;
}

export async function reactivateGenerationReference(
  generationReferenceId: string,
  approvedBy?: string | null,
): Promise<ProjectGenerationReference> {
  const r = await query<Row>(
    `UPDATE project_generation_references
     SET status = 'ACTIVE', revoked_at = NULL, approved_at = NOW(), approved_by = COALESCE($2, approved_by)
     WHERE generation_reference_id = $1
     RETURNING *`,
    [generationReferenceId, approvedBy ?? null],
  );
  return mapRow(r.rows[0]);
}

export async function revokeGenerationReferenceRow(
  generationReferenceId: string,
): Promise<ProjectGenerationReference | null> {
  const r = await query<Row>(
    `UPDATE project_generation_references
     SET status = 'REVOKED', revoked_at = NOW()
     WHERE generation_reference_id = $1 AND status = 'ACTIVE'
     RETURNING *`,
    [generationReferenceId],
  );
  return r.rows[0] ? mapRow(r.rows[0]) : null;
}

export async function countActiveGenerationReferences(
  projectId: string,
  sectionId: string,
): Promise<number> {
  const r = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM project_generation_references
     WHERE project_id = $1 AND section_id = $2 AND status = 'ACTIVE'`,
    [projectId, sectionId],
  );
  return Number(r.rows[0].n);
}
