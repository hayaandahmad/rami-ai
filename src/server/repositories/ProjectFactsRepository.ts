import type { PoolClient } from 'pg';
import { query } from '@/server/db/connection';
import type { ProjectFactRow } from '@/server/db/factMapper';

export async function replaceProjectFacts(
  projectId: string,
  rows: ProjectFactRow[],
  client: PoolClient,
): Promise<void> {
  await client.query('DELETE FROM project_facts WHERE project_id = $1', [projectId]);
  for (const row of rows) {
    await client.query(
      `INSERT INTO project_facts (
         project_id, field_id, value_json, collection_state, provenance_status,
         source_type, source_ref, confirmed_by, updated_at, history_json,
         gap_status, deferred_to, contradiction_json
       ) VALUES (
         $1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13::jsonb
       )`,
      [
        projectId,
        row.field_id,
        JSON.stringify(row.value_json ?? null),
        row.collection_state,
        row.provenance_status,
        row.source_type,
        row.source_ref,
        row.confirmed_by,
        row.updated_at,
        JSON.stringify(row.history_json ?? []),
        row.gap_status,
        row.deferred_to,
        row.contradiction_json == null ? null : JSON.stringify(row.contradiction_json),
      ],
    );
  }
}

export async function listProjectFacts(projectId: string): Promise<ProjectFactRow[]> {
  const r = await query<ProjectFactRow>(
    `SELECT field_id, value_json, collection_state, provenance_status,
            source_type, source_ref, confirmed_by, updated_at, history_json,
            gap_status, deferred_to, contradiction_json
     FROM project_facts WHERE project_id = $1`,
    [projectId],
  );
  return r.rows;
}
