#!/usr/bin/env npx tsx
/**
 * Consolidation inventory: safe counts + secret-category scan (no secret values printed).
 */
import { createHash } from 'crypto';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool, query } from '../src/server/db/connection';
import { getDatabaseName, isDatabaseConfigured } from '../src/server/db/config';

loadLocalEnv();

if (!isDatabaseConfigured()) {
  console.error('DB not configured');
  process.exit(1);
}

const SECRETISH =
  /\b(password|passwd|api[_-]?key|secret|token|bearer|authorization|private[_-]?key|aws_|modal_token|session[_-]?id)\b/i;

async function main() {
  const ver = await query<{ v: string }>('SELECT version() AS v');
  const host = (process.env.RAMI_DB_HOST || '').trim() || '(from RAMI_DB_URL)';
  const port = (process.env.RAMI_DB_PORT || '').trim() || '(from RAMI_DB_URL)';
  const name = getDatabaseName();

  const migrations = await query<{ version: string }>(
    'SELECT version FROM schema_migrations ORDER BY version',
  );
  const tables = await query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );

  const countTables = [
    'sections',
    'fields',
    'questions',
    'question_fields',
    'section_fields',
    'projects',
    'project_facts',
    'messages',
    'project_runtime',
    'project_section_states',
    'project_section_contents',
    'historical_rfp_documents',
    'historical_question_answers',
    'historical_knowledge_chunks',
    'historical_chunk_embeddings',
    'historical_rag_runtime',
    'historical_field_proposals',
    'project_generation_references',
    'users',
    'schema_migrations',
  ];

  const counts: Record<string, number> = {};
  for (const t of countTables) {
    const exists = tables.rows.some((r) => r.tablename === t);
    if (!exists) {
      counts[t] = -1;
      continue;
    }
    const r = await query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${t}`);
    counts[t] = Number(r.rows[0].n);
  }

  const projects = await query<{ document_key: string }>(
    'SELECT document_key FROM projects ORDER BY document_key',
  );
  const embMeta = await query<{ model: string; version: string; dims: number; n: string }>(
    `SELECT embedding_model AS model, embedding_version AS version, embedding_dims AS dims, COUNT(*)::text AS n
     FROM historical_chunk_embeddings
     GROUP BY embedding_model, embedding_version, embedding_dims
     ORDER BY embedding_model, embedding_version`,
  ).catch(() => ({ rows: [] as Array<{ model: string; version: string; dims: number; n: string }> }));

  const genRefStatus = await query<{ status: string; n: string }>(
    `SELECT status, COUNT(*)::text AS n FROM project_generation_references GROUP BY status ORDER BY status`,
  ).catch(() => ({ rows: [] as Array<{ status: string; n: string }> }));

  const proposalStatus = await query<{ status: string; n: string }>(
    `SELECT status, COUNT(*)::text AS n FROM historical_field_proposals GROUP BY status ORDER BY status`,
  ).catch(() => ({ rows: [] as Array<{ status: string; n: string }> }));

  // Secret category scan — report categories only, never values
  const findings: string[] = [];
  const factScan = await query<{ field_id: string; hit: boolean }>(
    `SELECT field_id,
            (value_json::text ~* $1 OR COALESCE(source_ref,'') ~* $1 OR COALESCE(history_json::text,'') ~* $1) AS hit
     FROM project_facts`,
    [SECRETISH.source],
  );
  for (const row of factScan.rows) {
    if (row.hit) findings.push(`project_facts.field_id=${row.field_id} (secretish pattern)`);
  }

  const msgScan = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM messages WHERE content ~* $1`,
    [SECRETISH.source],
  );
  if (Number(msgScan.rows[0].n) > 0) {
    findings.push(`messages: ${msgScan.rows[0].n} rows matched secretish pattern`);
  }

  const userScan = await query<{ email: string }>(`SELECT email FROM users ORDER BY email`);
  const runtimeScan = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM project_runtime
     WHERE COALESCE(context_contradictions::text,'') ~* $1
        OR COALESCE(complexity::text,'') ~* $1
        OR COALESCE(secondary_domains::text,'') ~* $1`,
    [SECRETISH.source],
  );
  if (Number(runtimeScan.rows[0].n) > 0) {
    findings.push(`project_runtime: ${runtimeScan.rows[0].n} rows matched secretish pattern`);
  }

  const sectionContentScan = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM project_section_contents WHERE content_json::text ~* $1`,
    [SECRETISH.source],
  );
  if (Number(sectionContentScan.rows[0].n) > 0) {
    findings.push(
      `project_section_contents: ${sectionContentScan.rows[0].n} rows matched secretish pattern`,
    );
  }

  console.log(
    JSON.stringify(
      {
        postgresVersion: ver.rows[0].v.split(',')[0],
        host,
        port,
        database: name,
        migrations: migrations.rows.map((r) => r.version),
        tables: tables.rows.map((r) => r.tablename),
        counts,
        projectKeys: projects.rows.map((r) => r.document_key),
        embeddingModels: embMeta.rows,
        generationReferenceStatuses: genRefStatus.rows,
        proposalStatuses: proposalStatus.rows,
        users: userScan.rows.map((r) => r.email),
        securityFindings: findings,
        securityOk: findings.length === 0,
      },
      null,
      2,
    ),
  );

  await closePool();
  process.exit(findings.length > 0 ? 2 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await closePool().catch(() => undefined);
  process.exit(1);
});
