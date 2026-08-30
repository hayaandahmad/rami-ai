/**
 * Repository for generated ProjectSection content versions.
 * ProjectFacts are never written here.
 */

import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { query } from '@/server/db/connection';
import type {
  GeneratedSection,
  SectionApprovalStatus,
} from '@/types/generatedSection';

export interface ProjectSectionContentRow {
  content_id: string;
  project_id: string;
  section_id: string;
  version: number;
  approval_status: SectionApprovalStatus;
  content_json: GeneratedSection;
  readiness_at_generation: 'READY_TO_DRAFT' | 'DRAFTABLE_WITH_TBC';
  model_used: string | null;
  source_field_ids: string[];
  tbc_field_ids: string[];
  is_current: boolean;
  created_at: string;
  superseded_at: string | null;
}

function normalizeRow(row: Record<string, unknown>): ProjectSectionContentRow {
  const content = row.content_json as GeneratedSection;
  return {
    content_id: String(row.content_id),
    project_id: String(row.project_id),
    section_id: String(row.section_id),
    version: Number(row.version),
    approval_status: row.approval_status as SectionApprovalStatus,
    content_json: content,
    readiness_at_generation: row.readiness_at_generation as
      | 'READY_TO_DRAFT'
      | 'DRAFTABLE_WITH_TBC',
    model_used: (row.model_used as string | null) ?? null,
    source_field_ids: Array.isArray(row.source_field_ids)
      ? (row.source_field_ids as string[])
      : [],
    tbc_field_ids: Array.isArray(row.tbc_field_ids) ? (row.tbc_field_ids as string[]) : [],
    is_current: Boolean(row.is_current),
    created_at: String(row.created_at),
    superseded_at: row.superseded_at ? String(row.superseded_at) : null,
  };
}

export async function getCurrentSectionContent(
  projectId: string,
  sectionId: string,
): Promise<ProjectSectionContentRow | null> {
  const r = await query(
    `SELECT * FROM project_section_contents
     WHERE project_id = $1 AND section_id = $2 AND is_current = TRUE
     LIMIT 1`,
    [projectId, sectionId],
  );
  const row = r.rows[0];
  return row ? normalizeRow(row) : null;
}

export async function listCurrentSectionContents(
  projectId: string,
): Promise<ProjectSectionContentRow[]> {
  const r = await query(
    `SELECT * FROM project_section_contents
     WHERE project_id = $1 AND is_current = TRUE
     ORDER BY section_id`,
    [projectId],
  );
  return r.rows.map((row) => normalizeRow(row));
}

export async function listSectionContentHistory(
  projectId: string,
  sectionId: string,
): Promise<ProjectSectionContentRow[]> {
  const r = await query(
    `SELECT * FROM project_section_contents
     WHERE project_id = $1 AND section_id = $2
     ORDER BY version DESC`,
    [projectId, sectionId],
  );
  return r.rows.map((row) => normalizeRow(row));
}

export async function nextSectionContentVersion(
  projectId: string,
  sectionId: string,
  client: PoolClient,
): Promise<number> {
  const r = await client.query<{ max: number | null }>(
    `SELECT MAX(version) AS max FROM project_section_contents
     WHERE project_id = $1 AND section_id = $2`,
    [projectId, sectionId],
  );
  return (r.rows[0]?.max ?? 0) + 1;
}

/**
 * Insert a new current version. Previous current row is superseded (history kept).
 */
export async function insertSectionContentVersion(
  input: {
    projectId: string;
    sectionId: string;
    content: GeneratedSection;
  },
  client: PoolClient,
): Promise<ProjectSectionContentRow> {
  const now = new Date().toISOString();
  await client.query(
    `UPDATE project_section_contents
     SET is_current = FALSE, superseded_at = $3
     WHERE project_id = $1 AND section_id = $2 AND is_current = TRUE`,
    [input.projectId, input.sectionId, now],
  );

  const version = await nextSectionContentVersion(
    input.projectId,
    input.sectionId,
    client,
  );
  const contentId = randomUUID();
  const content: GeneratedSection = {
    ...input.content,
    version,
    generatedAt: input.content.generatedAt || now,
  };

  const r = await client.query(
    `INSERT INTO project_section_contents (
       content_id, project_id, section_id, version, approval_status,
       content_json, readiness_at_generation, model_used,
       source_field_ids, tbc_field_ids, is_current, created_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb,$10::jsonb,TRUE,$11
     )
     RETURNING *`,
    [
      contentId,
      input.projectId,
      input.sectionId,
      version,
      content.approvalStatus,
      JSON.stringify(content),
      content.readinessAtGeneration,
      content.modelUsed,
      JSON.stringify(content.sourceFieldIds),
      JSON.stringify(content.tbcFieldIds),
      now,
    ],
  );
  return normalizeRow(r.rows[0]);
}

export async function approveCurrentSectionContent(
  projectId: string,
  sectionId: string,
  client: PoolClient,
): Promise<ProjectSectionContentRow> {
  const r = await client.query(
    `UPDATE project_section_contents
     SET approval_status = 'APPROVED',
         content_json = jsonb_set(content_json, '{approvalStatus}', '"APPROVED"')
     WHERE project_id = $1 AND section_id = $2 AND is_current = TRUE
     RETURNING *`,
    [projectId, sectionId],
  );
  const row = r.rows[0];
  if (!row) {
    throw new Error(`No current content for ${sectionId}`);
  }
  return normalizeRow(row);
}
