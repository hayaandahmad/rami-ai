/**
 * Persistence for historical_knowledge_chunks + embeddings.
 */

import { query, withTransaction } from '@/server/db/connection';
import type { HistoricalKnowledgeChunk } from '@/types/historicalRag';
import type { PoolClient } from 'pg';

interface ChunkRow {
  chunk_id: string;
  historical_rfp_id: string;
  chunk_type: string;
  chunk_text: string;
  content_hash: string;
  source_sheet: string | null;
  source_rows: number[] | null;
  source_answer_ids: string[] | null;
  source_question_ids: string[] | null;
  canonical_question_ids: string[] | null;
  mapped_field_ids: unknown;
  section_ids: unknown;
  extraction_statuses: unknown;
  source_locators: unknown;
  excel_rel_path: string;
  excel_sha256: string;
  pdf_available: boolean;
  provenance_class: string;
  topic_key: string | null;
  metadata: unknown;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(String);
}

function asNumberArray(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.map(Number);
}

export function mapChunkRow(r: ChunkRow): HistoricalKnowledgeChunk {
  return {
    chunkId: r.chunk_id,
    historicalRfpId: r.historical_rfp_id,
    chunkType: r.chunk_type as HistoricalKnowledgeChunk['chunkType'],
    chunkText: r.chunk_text,
    contentHash: r.content_hash,
    sourceSheet: r.source_sheet,
    sourceRows: asNumberArray(r.source_rows),
    sourceAnswerIds: asStringArray(r.source_answer_ids),
    sourceQuestionIds: asStringArray(r.source_question_ids),
    canonicalQuestionIds: asStringArray(r.canonical_question_ids),
    mappedFieldIds: asStringArray(r.mapped_field_ids),
    sectionIds: asStringArray(r.section_ids),
    extractionStatuses: asStringArray(r.extraction_statuses),
    sourceLocators: asStringArray(r.source_locators),
    excelRelPath: r.excel_rel_path,
    excelSha256: r.excel_sha256,
    pdfAvailable: r.pdf_available,
    provenanceClass: 'REFERENCE',
    topicKey: r.topic_key,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
  };
}

async function upsertChunk(client: PoolClient, c: HistoricalKnowledgeChunk) {
  await client.query(
    `INSERT INTO historical_knowledge_chunks (
      chunk_id, historical_rfp_id, chunk_type, chunk_text, content_hash,
      source_sheet, source_rows, source_answer_ids, source_question_ids,
      canonical_question_ids, mapped_field_ids, section_ids, extraction_statuses,
      source_locators, excel_rel_path, excel_sha256, pdf_available,
      provenance_class, topic_key, metadata, created_at, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,
      $15,$16,$17,'REFERENCE',$18,$19::jsonb,NOW(),NOW()
    )
    ON CONFLICT (chunk_id) DO UPDATE SET
      historical_rfp_id = EXCLUDED.historical_rfp_id,
      chunk_type = EXCLUDED.chunk_type,
      chunk_text = EXCLUDED.chunk_text,
      content_hash = EXCLUDED.content_hash,
      source_sheet = EXCLUDED.source_sheet,
      source_rows = EXCLUDED.source_rows,
      source_answer_ids = EXCLUDED.source_answer_ids,
      source_question_ids = EXCLUDED.source_question_ids,
      canonical_question_ids = EXCLUDED.canonical_question_ids,
      mapped_field_ids = EXCLUDED.mapped_field_ids,
      section_ids = EXCLUDED.section_ids,
      extraction_statuses = EXCLUDED.extraction_statuses,
      source_locators = EXCLUDED.source_locators,
      excel_rel_path = EXCLUDED.excel_rel_path,
      excel_sha256 = EXCLUDED.excel_sha256,
      pdf_available = EXCLUDED.pdf_available,
      topic_key = EXCLUDED.topic_key,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()`,
    [
      c.chunkId,
      c.historicalRfpId,
      c.chunkType,
      c.chunkText,
      c.contentHash,
      c.sourceSheet,
      c.sourceRows,
      c.sourceAnswerIds,
      c.sourceQuestionIds,
      c.canonicalQuestionIds,
      JSON.stringify(c.mappedFieldIds),
      JSON.stringify(c.sectionIds),
      JSON.stringify(c.extractionStatuses),
      JSON.stringify(c.sourceLocators),
      c.excelRelPath,
      c.excelSha256,
      c.pdfAvailable,
      c.topicKey,
      JSON.stringify(c.metadata),
    ],
  );
}

export async function replaceAllChunks(
  chunks: HistoricalKnowledgeChunk[],
): Promise<number> {
  return withTransaction(async (client) => {
    // Deterministic rebuild: delete embeddings+chunks then insert
    await client.query(`DELETE FROM historical_chunk_embeddings`);
    await client.query(`DELETE FROM historical_knowledge_chunks`);
    for (const c of chunks) {
      await upsertChunk(client, c);
    }
    return chunks.length;
  });
}

export async function listChunks(opts?: {
  historicalRfpId?: string;
  chunkTypes?: string[];
  excludeHistoricalRfpIds?: string[];
}): Promise<HistoricalKnowledgeChunk[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts?.historicalRfpId) {
    params.push(opts.historicalRfpId);
    clauses.push(`historical_rfp_id = $${params.length}`);
  }
  if (opts?.excludeHistoricalRfpIds?.length) {
    params.push(opts.excludeHistoricalRfpIds);
    clauses.push(`NOT (historical_rfp_id = ANY($${params.length}::text[]))`);
  }
  if (opts?.chunkTypes?.length) {
    params.push(opts.chunkTypes);
    clauses.push(`chunk_type = ANY($${params.length}::text[])`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const r = await query<ChunkRow>(
    `SELECT * FROM historical_knowledge_chunks ${where} ORDER BY chunk_id`,
    params,
  );
  return r.rows.map(mapChunkRow);
}

/**
 * Merge answer mapped_field_ids onto existing chunks without touching chunk_text
 * or embeddings (no re-embed).
 */
export async function syncChunkMappedFieldsFromAnswers(): Promise<number> {
  const chunks = await listChunks();
  let updated = 0;
  for (const c of chunks) {
    if (!c.sourceAnswerIds.length) continue;
    const r = await query<{ mapped_field_ids: unknown }>(
      `SELECT mapped_field_ids FROM historical_question_answers
       WHERE answer_id = ANY($1::text[])`,
      [c.sourceAnswerIds],
    );
    const merged = new Set(c.mappedFieldIds);
    for (const row of r.rows) {
      for (const f of asStringArray(row.mapped_field_ids)) merged.add(f);
    }
    const next = [...merged];
    if (next.length === c.mappedFieldIds.length && next.every((f) => c.mappedFieldIds.includes(f))) {
      continue;
    }
    await query(
      `UPDATE historical_knowledge_chunks
       SET mapped_field_ids = $1::jsonb, updated_at = NOW()
       WHERE chunk_id = $2`,
      [JSON.stringify(next), c.chunkId],
    );
    updated += 1;
  }
  return updated;
}

export async function getChunkById(
  chunkId: string,
): Promise<HistoricalKnowledgeChunk | null> {
  const r = await query<ChunkRow>(
    `SELECT * FROM historical_knowledge_chunks WHERE chunk_id = $1`,
    [chunkId],
  );
  return r.rows[0] ? mapChunkRow(r.rows[0]) : null;
}

export async function countChunks(): Promise<{
  chunks: number;
  embeddings: number;
  byType: Record<string, number>;
}> {
  const c = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM historical_knowledge_chunks`,
  );
  const e = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM historical_chunk_embeddings`,
  );
  const t = await query<{ chunk_type: string; n: string }>(
    `SELECT chunk_type, COUNT(*)::text AS n FROM historical_knowledge_chunks GROUP BY chunk_type`,
  );
  const byType: Record<string, number> = {};
  for (const row of t.rows) byType[row.chunk_type] = Number(row.n);
  return {
    chunks: Number(c.rows[0].n),
    embeddings: Number(e.rows[0].n),
    byType,
  };
}

export async function upsertEmbedding(input: {
  chunkId: string;
  embeddingModel: string;
  embeddingDims: number;
  embeddingVersion: string;
  contentHash: string;
  embedding: number[];
}): Promise<void> {
  await query(
    `INSERT INTO historical_chunk_embeddings (
      chunk_id, embedding_model, embedding_dims, embedding_version,
      content_hash, embedding, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,NOW())
    ON CONFLICT (chunk_id, embedding_model, embedding_version) DO UPDATE SET
      embedding_dims = EXCLUDED.embedding_dims,
      content_hash = EXCLUDED.content_hash,
      embedding = EXCLUDED.embedding,
      created_at = NOW()`,
    [
      input.chunkId,
      input.embeddingModel,
      input.embeddingDims,
      input.embeddingVersion,
      input.contentHash,
      input.embedding,
    ],
  );
}

export async function listEmbeddings(opts: {
  embeddingModel: string;
  embeddingVersion: string;
}): Promise<
  Array<{
    chunkId: string;
    contentHash: string;
    embedding: number[];
    dims: number;
  }>
> {
  const r = await query<{
    chunk_id: string;
    content_hash: string;
    embedding: number[];
    embedding_dims: number;
  }>(
    `SELECT chunk_id, content_hash, embedding, embedding_dims
     FROM historical_chunk_embeddings
     WHERE embedding_model = $1 AND embedding_version = $2`,
    [opts.embeddingModel, opts.embeddingVersion],
  );
  return r.rows.map((row) => ({
    chunkId: row.chunk_id,
    contentHash: row.content_hash,
    embedding: row.embedding,
    dims: row.embedding_dims,
  }));
}

export async function estimateEmbeddingStorageBytes(): Promise<number> {
  const r = await query<{ bytes: string }>(
    `SELECT COALESCE(SUM(pg_column_size(embedding)),0)::text AS bytes
     FROM historical_chunk_embeddings`,
  );
  return Number(r.rows[0].bytes);
}
