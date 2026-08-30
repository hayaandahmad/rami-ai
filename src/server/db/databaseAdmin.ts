/**
 * Maintenance-database helpers for CREATE/DROP DATABASE.
 * Never used for application queries. Never drops rami_ai.
 */

import { Client } from 'pg';
import { getDatabaseUrlForName, getSslEnabled } from './config';
import { assertSafeDatabaseName } from './localSafety';
import { SHARED_DEV_DATABASE_NAME } from './sharedSnapshot';

const PROTECTED_DATABASES = new Set([
  SHARED_DEV_DATABASE_NAME,
  'postgres',
  'template0',
  'template1',
]);

function maintenanceClient(): Client {
  return new Client({
    connectionString: getDatabaseUrlForName('postgres'),
    ssl: getSslEnabled() ? { rejectUnauthorized: false } : false,
  });
}

export async function withMaintenanceClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = maintenanceClient();
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function ensureDatabaseExists(name: string): Promise<'created' | 'existed'> {
  assertSafeDatabaseName(name);
  return withMaintenanceClient(async (client) => {
    const r = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if ((r.rowCount ?? 0) > 0) return 'existed';
    await client.query(`CREATE DATABASE ${name} WITH ENCODING 'UTF8'`);
    return 'created';
  });
}

export async function dropDatabaseIfExists(name: string): Promise<void> {
  assertSafeDatabaseName(name);
  if (PROTECTED_DATABASES.has(name)) {
    throw new Error(`Refusing to drop protected database '${name}'.`);
  }
  await withMaintenanceClient(async (client) => {
    await client.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [name],
    );
    await client.query(`DROP DATABASE IF EXISTS ${name}`);
  });
}
