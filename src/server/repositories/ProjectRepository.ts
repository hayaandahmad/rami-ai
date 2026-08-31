import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { query } from '@/server/db/connection';

export interface ProjectRow {
  project_id: string;
  document_key: string;
  name: string;
  budget_jod: string | null;
  duration_months: number | null;
  status: string;
  completed_by_user_id: string | null;
}

export async function findProjectByDocumentKey(
  documentKey: string,
  client?: PoolClient,
): Promise<ProjectRow | null> {
  const sql = `SELECT * FROM projects WHERE document_key = $1`;
  const r = client ? await client.query<ProjectRow>(sql, [documentKey]) : await query<ProjectRow>(sql, [documentKey]);
  return r.rows[0] ?? null;
}

export async function findProjectById(
  projectId: string,
  client?: PoolClient,
): Promise<ProjectRow | null> {
  const sql = `SELECT * FROM projects WHERE project_id = $1`;
  const r = client ? await client.query<ProjectRow>(sql, [projectId]) : await query<ProjectRow>(sql, [projectId]);
  return r.rows[0] ?? null;
}

export async function ensureProject(
  documentKey: string,
  name = 'Untitled RFP',
  client?: PoolClient,
): Promise<ProjectRow> {
  const existing = await findProjectByDocumentKey(documentKey, client);
  if (existing) return existing;
  const row: ProjectRow = {
    project_id: randomUUID(),
    document_key: documentKey,
    name,
    budget_jod: null,
    duration_months: null,
    status: 'active',
    completed_by_user_id: null,
  };
  const sql = `
    INSERT INTO projects (project_id, document_key, name, budget_jod, duration_months, status, completed_by_user_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (document_key) DO UPDATE SET name = COALESCE(NULLIF(projects.name, 'Untitled RFP'), EXCLUDED.name)
    RETURNING *
  `;
  const params = [
    row.project_id,
    row.document_key,
    row.name,
    row.budget_jod,
    row.duration_months,
    row.status,
    row.completed_by_user_id,
  ];
  const r = client
    ? await client.query<ProjectRow>(sql, params)
    : await query<ProjectRow>(sql, params);
  return r.rows[0];
}

export async function deleteProjectByDocumentKey(
  documentKey: string,
  client?: PoolClient,
): Promise<boolean> {
  const sql = `DELETE FROM projects WHERE document_key = $1 RETURNING project_id`;
  const r = client
    ? await client.query<{ project_id: string }>(sql, [documentKey])
    : await query<{ project_id: string }>(sql, [documentKey]);
  return (r.rowCount ?? 0) > 0;
}

export async function updateProjectDerived(
  projectId: string,
  patch: { name?: string; budgetJod?: number | null; durationMonths?: number | null; status?: string },
  client?: PoolClient,
): Promise<void> {
  const sql = `
    UPDATE projects SET
      name = COALESCE($2, name),
      budget_jod = COALESCE($3, budget_jod),
      duration_months = COALESCE($4, duration_months),
      status = COALESCE($5, status)
    WHERE project_id = $1
  `;
  const params = [
    projectId,
    patch.name ?? null,
    patch.budgetJod ?? null,
    patch.durationMonths ?? null,
    patch.status ?? null,
  ];
  if (client) await client.query(sql, params);
  else await query(sql, params);
}
