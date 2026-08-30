import type { PoolClient } from 'pg';
import { query } from '@/server/db/connection';
import type { ConversationMessage } from '@/types/conversation';

export interface MessageRow {
  message_id: string;
  project_id: string;
  role: string;
  user_id: string | null;
  content: string;
  language: string | null;
  sort_order: number;
  extracted_field_ids: unknown;
  created_at: string;
}

function roleToDb(role: ConversationMessage['role']): string {
  if (role === 'user') return 'BA';
  if (role === 'assistant') return 'RAMI';
  return 'SYSTEM';
}

function roleFromDb(role: string): ConversationMessage['role'] {
  if (role === 'BA') return 'user';
  if (role === 'RAMI') return 'assistant';
  return 'system';
}

export async function insertMessage(
  projectId: string,
  message: ConversationMessage,
  sortOrder: number,
  userId: string | null,
  client?: PoolClient,
): Promise<void> {
  const sql = `
    INSERT INTO messages (
      message_id, project_id, role, user_id, content, language,
      sort_order, extracted_field_ids, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
    ON CONFLICT (message_id) DO UPDATE SET
      content = EXCLUDED.content,
      extracted_field_ids = EXCLUDED.extracted_field_ids
  `;
  const params = [
    message.id,
    projectId,
    roleToDb(message.role),
    userId,
    message.content,
    message.language ?? null,
    sortOrder,
    JSON.stringify(message.extractedFieldIds ?? null),
    message.createdAt,
  ];
  if (client) await client.query(sql, params);
  else await query(sql, params);
}

export async function nextSortOrder(projectId: string, client?: PoolClient): Promise<number> {
  const sql = `SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM messages WHERE project_id = $1`;
  const r = client
    ? await client.query<{ n: number }>(sql, [projectId])
    : await query<{ n: number }>(sql, [projectId]);
  return Number(r.rows[0]?.n ?? 1);
}

export async function listMessages(projectId: string): Promise<ConversationMessage[]> {
  const r = await query<MessageRow>(
    `SELECT * FROM messages WHERE project_id = $1 ORDER BY sort_order ASC`,
    [projectId],
  );
  return r.rows.map((row) => ({
    id: row.message_id,
    role: roleFromDb(row.role),
    content: row.content,
    language: (row.language as ConversationMessage['language']) ?? undefined,
    createdAt: row.created_at,
    extractedFieldIds: Array.isArray(row.extracted_field_ids)
      ? (row.extracted_field_ids as string[])
      : undefined,
  }));
}
