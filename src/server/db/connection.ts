import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { getDatabaseUrl, getSslEnabled, isDatabaseConfigured } from './config';
import { PersistenceError } from './errors';

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!isDatabaseConfigured()) {
    throw new PersistenceError(
      'NOT_CONFIGURED',
      'PostgreSQL is not configured. Set RAMI_DB_URL or RAMI_DB_HOST/NAME/USER in .env.local.',
    );
  }
  if (!_pool) {
    _pool = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: getSslEnabled() ? { rejectUnauthorized: false } : false,
      max: 8,
    });
  }
  return _pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  try {
    return await getPool().query<T>(text, params);
  } catch (err) {
    if (err instanceof PersistenceError) throw err;
    throw new PersistenceError('UNAVAILABLE', `PostgreSQL query failed: ${String(err)}`, err);
  }
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    if (err instanceof PersistenceError) throw err;
    throw new PersistenceError('WRITE_FAILED', `PostgreSQL transaction failed: ${String(err)}`, err);
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

export async function checkDatabase(): Promise<{ ok: boolean; detail: string }> {
  if (!isDatabaseConfigured()) {
    return { ok: false, detail: 'not_configured' };
  }
  try {
    const r = await query<{ n: number }>('SELECT 1 AS n');
    return { ok: r.rows[0]?.n === 1, detail: 'connected' };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
