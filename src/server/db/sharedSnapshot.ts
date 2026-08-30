/**
 * Shared development-database snapshot path and identity.
 * Git stores a portable pg_dump; each machine still runs its own PostgreSQL server.
 */

import { join } from 'path';

export const SHARED_DEV_DATABASE_NAME = 'rami_ai';
export const SHARED_DUMP_RELATIVE_PATH = 'dev/database/rami_ai_shared.dump';
export const SHARED_RESTORE_TEST_DATABASE_NAME = 'rami_ai_shared_restore_test';

/** Tables that must exist in the committed custom-format dump. */
export const SHARED_DUMP_REQUIRED_TABLES = [
  'schema_migrations',
  'users',
  'sections',
  'questions',
  'fields',
  'question_fields',
  'section_fields',
  'projects',
  'project_facts',
  'messages',
  'project_runtime',
  'project_section_states',
] as const;

export function getSharedDumpPath(cwd = process.cwd()): string {
  return join(cwd, SHARED_DUMP_RELATIVE_PATH);
}
