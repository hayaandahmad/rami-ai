import type { PoolClient } from 'pg';
import { query } from '@/server/db/connection';

export const SYSTEM_USER_ID = '00000000-0000-4000-8000-000000000001';

export async function upsertSystemUser(client?: PoolClient): Promise<void> {
  const sql = `
    INSERT INTO users (user_id, name, email, role, is_active)
    VALUES ($1, 'Rami System', 'rami@local', 'system', TRUE)
    ON CONFLICT (user_id) DO NOTHING
  `;
  if (client) await client.query(sql, [SYSTEM_USER_ID]);
  else await query(sql, [SYSTEM_USER_ID]);
}
