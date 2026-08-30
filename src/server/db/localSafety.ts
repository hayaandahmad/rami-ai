/**
 * Guardrails so dump/restore scripts never target a remote or production database.
 */

import { getDatabaseName } from './config';
import { SHARED_DEV_DATABASE_NAME } from './sharedSnapshot';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

function env(name: string, fallback = ''): string {
  return (process.env[name] ?? fallback).trim();
}

export function getConfiguredDatabaseHost(): string {
  const url = env('RAMI_DB_URL');
  if (url) {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }
  return env('RAMI_DB_HOST');
}

export function getConfiguredDatabasePort(): string {
  const url = env('RAMI_DB_URL');
  if (url) {
    try {
      return new URL(url).port || '5432';
    } catch {
      return '5432';
    }
  }
  return env('RAMI_DB_PORT', '5432');
}

export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host.trim().toLowerCase());
}

/** Database names we interpolate into CREATE/DROP DATABASE (never user-controlled SQL beyond this check). */
export function assertSafeDatabaseName(name: string): void {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe database name '${name}'. Use lowercase letters, digits, and underscore only.`);
  }
}

export function assertLocalSharedDevTarget(purpose: string): void {
  const host = getConfiguredDatabaseHost();
  if (!isLoopbackHost(host)) {
    throw new Error(
      `${purpose} refused: host '${host || '(empty)'}' is not loopback. ` +
        'Shared snapshot dump/restore is local-development only (127.0.0.1 / localhost / ::1).',
    );
  }
  const name = getDatabaseName();
  if (name !== SHARED_DEV_DATABASE_NAME) {
    throw new Error(
      `${purpose} refused: configured database is '${name}', expected '${SHARED_DEV_DATABASE_NAME}'. ` +
        `Set RAMI_DB_NAME=${SHARED_DEV_DATABASE_NAME} in .env.local.`,
    );
  }
}
