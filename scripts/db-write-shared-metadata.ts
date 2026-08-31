#!/usr/bin/env npx tsx
/**
 * Write/update machine-readable metadata for the shared development dump.
 * Does not include passwords or connection secrets.
 */
import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool, query } from '../src/server/db/connection';
import { getDatabaseName, isDatabaseConfigured } from '../src/server/db/config';
import { getSharedDumpPath, SHARED_DUMP_RELATIVE_PATH } from '../src/server/db/sharedSnapshot';

async function count(table: string): Promise<number> {
  const r = await query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${table}`);
  return Number(r.rows[0].n);
}

async function main() {
  loadLocalEnv();
  if (!isDatabaseConfigured()) {
    console.error('FAIL: PostgreSQL is not configured.');
    process.exit(1);
  }
  const dumpPath = getSharedDumpPath();
  if (!existsSync(dumpPath)) {
    console.error(`FAIL: missing dump at ${dumpPath}`);
    process.exit(1);
  }

  const ver = await query<{ v: string }>('SELECT version() AS v');
  const migrations = (
    await query<{ version: string }>('SELECT version FROM schema_migrations ORDER BY version')
  ).rows.map((r) => r.version);

  const bytes = statSync(dumpPath).size;
  const sha256 = createHash('sha256').update(readFileSync(dumpPath)).digest('hex');

  const emb = await query<{ model: string; version: string; dims: number; n: string }>(
    `SELECT embedding_model AS model, embedding_version AS version, embedding_dims AS dims, COUNT(*)::text AS n
     FROM historical_chunk_embeddings
     GROUP BY embedding_model, embedding_version, embedding_dims`,
  );

  const genRef = await query<{ status: string; n: string }>(
    `SELECT status, COUNT(*)::text AS n FROM project_generation_references GROUP BY status`,
  );
  const proposals = await query<{ status: string; n: string }>(
    `SELECT status, COUNT(*)::text AS n FROM historical_field_proposals GROUP BY status`,
  );

  const metadata = {
    sourceDatabaseName: getDatabaseName(),
    postgresqlVersion: ver.rows[0].v.split(',')[0],
    snapshotFormat: 'pg_dump -Fc --no-owner --no-privileges',
    createdAt: new Date().toISOString(),
    sourceCommitBeforeSnapshot: process.env.RAMI_SNAPSHOT_SOURCE_COMMIT ?? null,
    migrations,
    latestMigration: migrations[migrations.length - 1] ?? null,
    canonical: {
      sections: await count('sections'),
      fields: await count('fields'),
      questions: await count('questions'),
      questionFields: await count('question_fields'),
      sectionFields: await count('section_fields'),
    },
    safeCounts: {
      projects: await count('projects'),
      project_facts: await count('project_facts'),
      messages: await count('messages'),
      project_runtime: await count('project_runtime'),
      project_section_states: await count('project_section_states'),
      project_section_contents: await count('project_section_contents'),
      historical_rfp_documents: await count('historical_rfp_documents'),
      historical_question_answers: await count('historical_question_answers'),
      historical_knowledge_chunks: await count('historical_knowledge_chunks'),
      historical_chunk_embeddings: await count('historical_chunk_embeddings'),
      historical_rag_runtime: await count('historical_rag_runtime'),
      historical_field_proposals: await count('historical_field_proposals'),
      project_generation_references: await count('project_generation_references'),
      users: await count('users'),
      schema_migrations: await count('schema_migrations'),
    },
    embedding: emb.rows[0]
      ? {
          model: emb.rows[0].model,
          version: emb.rows[0].version,
          dims: emb.rows[0].dims,
          count: Number(emb.rows[0].n),
          storage: 'REAL[] (pgvector not installed)',
        }
      : null,
    generationReferences: Object.fromEntries(
      genRef.rows.map((r) => [r.status, Number(r.n)]),
    ),
    historicalProposals: Object.fromEntries(
      proposals.rows.map((r) => [r.status, Number(r.n)]),
    ),
    snapshotRelativePath: SHARED_DUMP_RELATIVE_PATH,
    snapshotBytes: bytes,
    snapshotSha256: sha256,
    notes: [
      'Development handoff artifact only — not a production backup.',
      'Git does not contain a live PostgreSQL server; each machine restores locally.',
      'No passwords, API keys, or .env.local contents are included.',
    ],
  };

  const out = join(process.cwd(), 'dev', 'database', 'rami_ai_shared.metadata.json');
  writeFileSync(out, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(`Wrote ${out}`);
  console.log(`sha256=${sha256} bytes=${bytes}`);
  await closePool();
}

main().catch(async (e) => {
  console.error(e);
  await closePool().catch(() => undefined);
  process.exit(1);
});
