/**
 * Repository for historical_rfp_* tables.
 * Isolated from project_facts / generation. Upserts only.
 */

import { query, withTransaction } from '@/server/db/connection';
import type {
  HistoricalQuestionAnswer,
  HistoricalRfpDocument,
} from '@/types/historicalRfp';
import type { PoolClient } from 'pg';
import { mergeHistoricalMappedFields } from '@/schema/historicalPromotedFieldMap';

interface DocRow {
  historical_rfp_id: string;
  title: string;
  source_type: string;
  document_kinds: unknown;
  intended_use: unknown;
  excel_rel_path: string;
  excel_sha256: string;
  pdf_rel_path: string | null;
  pdf_sha256: string | null;
  has_pdf: boolean;
  evaluation_eligibility: unknown;
  manifest_json: unknown;
  notes: unknown;
  imported_at: Date;
  updated_at: Date;
}

interface AnswerRow {
  answer_id: string;
  historical_rfp_id: string;
  source_sheet: string;
  source_sheet_kind: string;
  source_row: number | null;
  source_question_id: string;
  canonical_question_id: string | null;
  is_canonical: boolean;
  question_section_label: string | null;
  exact_question_text: string;
  answer_text: string;
  extraction_status: string;
  source_locator: string | null;
  provenance_class: string;
  mapped_field_ids: unknown;
  excel_rel_path: string;
  pdf_available: boolean;
  imported_at: Date;
  updated_at: Date;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(String);
}

function mapDoc(r: DocRow): HistoricalRfpDocument {
  return {
    historicalRfpId: r.historical_rfp_id,
    title: r.title,
    sourceType: r.source_type,
    documentKinds: asStringArray(r.document_kinds),
    intendedUse: asStringArray(r.intended_use),
    excelRelPath: r.excel_rel_path,
    excelSha256: r.excel_sha256,
    pdfRelPath: r.pdf_rel_path,
    pdfSha256: r.pdf_sha256,
    hasPdf: r.has_pdf,
    evaluationEligibility: (r.evaluation_eligibility ?? {}) as HistoricalRfpDocument['evaluationEligibility'],
    manifestJson: (r.manifest_json ?? {}) as Record<string, unknown>,
    notes: asStringArray(r.notes),
    importedAt: r.imported_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

function mapAnswer(r: AnswerRow): HistoricalQuestionAnswer {
  return {
    answerId: r.answer_id,
    historicalRfpId: r.historical_rfp_id,
    sourceSheet: r.source_sheet,
    sourceSheetKind: r.source_sheet_kind as HistoricalQuestionAnswer['sourceSheetKind'],
    sourceRow: r.source_row,
    sourceQuestionId: r.source_question_id,
    canonicalQuestionId: r.canonical_question_id,
    isCanonical: r.is_canonical,
    questionSectionLabel: r.question_section_label,
    exactQuestionText: r.exact_question_text,
    answerText: r.answer_text,
    extractionStatus: r.extraction_status,
    sourceLocator: r.source_locator,
    provenanceClass: 'REFERENCE',
    mappedFieldIds: asStringArray(r.mapped_field_ids),
    excelRelPath: r.excel_rel_path,
    pdfAvailable: r.pdf_available,
    importedAt: r.imported_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export interface HistoricalImportPayloadDoc {
  historicalRfpId: string;
  title: string;
  sourceType: string;
  documentKinds: string[];
  intendedUse: string[];
  excelRelPath: string;
  excelSha256: string;
  pdfRelPath: string | null;
  pdfSha256: string | null;
  hasPdf: boolean;
  evaluationEligibility: Record<string, unknown>;
  manifestJson: Record<string, unknown>;
  notes: string[];
}

export interface HistoricalImportPayloadAnswer {
  answerId: string;
  historicalRfpId: string;
  sourceSheet: string;
  sourceSheetKind: string;
  sourceRow: number | null;
  sourceQuestionId: string;
  canonicalQuestionId: string | null;
  isCanonical: boolean;
  questionSectionLabel: string | null;
  exactQuestionText: string;
  answerText: string;
  extractionStatus: string;
  sourceLocator: string | null;
  provenanceClass: string;
  mappedFieldIds: string[];
  excelRelPath: string;
  pdfAvailable: boolean;
}

async function upsertDocument(client: PoolClient, d: HistoricalImportPayloadDoc) {
  await client.query(
    `INSERT INTO historical_rfp_documents (
      historical_rfp_id, title, source_type, document_kinds, intended_use,
      excel_rel_path, excel_sha256, pdf_rel_path, pdf_sha256, has_pdf,
      evaluation_eligibility, manifest_json, notes, imported_at, updated_at
    ) VALUES (
      $1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,NOW(),NOW()
    )
    ON CONFLICT (historical_rfp_id) DO UPDATE SET
      title = EXCLUDED.title,
      source_type = EXCLUDED.source_type,
      document_kinds = EXCLUDED.document_kinds,
      intended_use = EXCLUDED.intended_use,
      excel_rel_path = EXCLUDED.excel_rel_path,
      excel_sha256 = EXCLUDED.excel_sha256,
      pdf_rel_path = EXCLUDED.pdf_rel_path,
      pdf_sha256 = EXCLUDED.pdf_sha256,
      has_pdf = EXCLUDED.has_pdf,
      evaluation_eligibility = EXCLUDED.evaluation_eligibility,
      manifest_json = EXCLUDED.manifest_json,
      notes = EXCLUDED.notes,
      updated_at = NOW()`,
    [
      d.historicalRfpId,
      d.title,
      d.sourceType,
      JSON.stringify(d.documentKinds),
      JSON.stringify(d.intendedUse),
      d.excelRelPath,
      d.excelSha256,
      d.pdfRelPath,
      d.pdfSha256,
      d.hasPdf,
      JSON.stringify(d.evaluationEligibility),
      JSON.stringify(d.manifestJson),
      JSON.stringify(d.notes),
    ],
  );
}

async function upsertAnswer(client: PoolClient, a: HistoricalImportPayloadAnswer) {
  await client.query(
    `INSERT INTO historical_question_answers (
      answer_id, historical_rfp_id, source_sheet, source_sheet_kind, source_row,
      source_question_id, canonical_question_id, is_canonical, question_section_label,
      exact_question_text, answer_text, extraction_status, source_locator,
      provenance_class, mapped_field_ids, excel_rel_path, pdf_available,
      imported_at, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'REFERENCE',$14::jsonb,$15,$16,NOW(),NOW()
    )
    ON CONFLICT (historical_rfp_id, source_sheet, source_question_id) DO UPDATE SET
      answer_id = EXCLUDED.answer_id,
      source_sheet_kind = EXCLUDED.source_sheet_kind,
      source_row = EXCLUDED.source_row,
      canonical_question_id = EXCLUDED.canonical_question_id,
      is_canonical = EXCLUDED.is_canonical,
      question_section_label = EXCLUDED.question_section_label,
      exact_question_text = EXCLUDED.exact_question_text,
      answer_text = EXCLUDED.answer_text,
      extraction_status = EXCLUDED.extraction_status,
      source_locator = EXCLUDED.source_locator,
      provenance_class = 'REFERENCE',
      mapped_field_ids = EXCLUDED.mapped_field_ids,
      excel_rel_path = EXCLUDED.excel_rel_path,
      pdf_available = EXCLUDED.pdf_available,
      updated_at = NOW()`,
    [
      a.answerId,
      a.historicalRfpId,
      a.sourceSheet,
      a.sourceSheetKind,
      a.sourceRow,
      a.sourceQuestionId,
      a.canonicalQuestionId,
      a.isCanonical,
      a.questionSectionLabel,
      a.exactQuestionText,
      a.answerText,
      a.extractionStatus,
      a.sourceLocator,
      JSON.stringify(mergeHistoricalMappedFields(a.mappedFieldIds, a.exactQuestionText)),
      a.excelRelPath,
      a.pdfAvailable,
    ],
  );
}

export async function upsertHistoricalImport(payload: {
  documents: HistoricalImportPayloadDoc[];
  answers: HistoricalImportPayloadAnswer[];
}): Promise<{ documents: number; answers: number }> {
  return withTransaction(async (client) => {
    for (const d of payload.documents) {
      await upsertDocument(client, d);
    }
    for (const a of payload.answers) {
      await upsertAnswer(client, a);
    }
    return { documents: payload.documents.length, answers: payload.answers.length };
  });
}

export async function listHistoricalDocuments(): Promise<HistoricalRfpDocument[]> {
  const r = await query<DocRow>(
    `SELECT * FROM historical_rfp_documents ORDER BY historical_rfp_id`,
  );
  return r.rows.map(mapDoc);
}

export async function getHistoricalDocument(
  historicalRfpId: string,
): Promise<HistoricalRfpDocument | null> {
  const r = await query<DocRow>(
    `SELECT * FROM historical_rfp_documents WHERE historical_rfp_id = $1`,
    [historicalRfpId],
  );
  return r.rows[0] ? mapDoc(r.rows[0]) : null;
}

export async function listHistoricalAnswers(opts?: {
  historicalRfpId?: string;
  canonicalOnly?: boolean;
  questionId?: string;
  fieldId?: string;
}): Promise<HistoricalQuestionAnswer[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts?.historicalRfpId) {
    params.push(opts.historicalRfpId);
    clauses.push(`historical_rfp_id = $${params.length}`);
  }
  if (opts?.canonicalOnly) {
    clauses.push(`is_canonical = TRUE`);
  }
  if (opts?.questionId) {
    params.push(opts.questionId);
    clauses.push(`(canonical_question_id = $${params.length} OR source_question_id = $${params.length})`);
  }
  if (opts?.fieldId) {
    params.push(JSON.stringify([opts.fieldId]));
    clauses.push(`mapped_field_ids @> $${params.length}::jsonb`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const r = await query<AnswerRow>(
    `SELECT * FROM historical_question_answers ${where}
     ORDER BY historical_rfp_id, source_sheet, source_question_id`,
    params,
  );
  return r.rows.map(mapAnswer);
}

export async function countHistoricalTables(): Promise<{
  documents: number;
  answers: number;
  canonicalAnswers: number;
  noncanonicalAnswers: number;
}> {
  const r = await query<{
    documents: string;
    answers: string;
    canonical: string;
    noncanonical: string;
  }>(`
    SELECT
      (SELECT COUNT(*)::text FROM historical_rfp_documents) AS documents,
      (SELECT COUNT(*)::text FROM historical_question_answers) AS answers,
      (SELECT COUNT(*)::text FROM historical_question_answers WHERE is_canonical) AS canonical,
      (SELECT COUNT(*)::text FROM historical_question_answers WHERE NOT is_canonical) AS noncanonical
  `);
  const row = r.rows[0];
  return {
    documents: Number(row.documents),
    answers: Number(row.answers),
    canonicalAnswers: Number(row.canonical),
    noncanonicalAnswers: Number(row.noncanonical),
  };
}

export async function countLiveProjectFacts(): Promise<number> {
  const r = await query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM project_facts`);
  return Number(r.rows[0].n);
}

/**
 * Deterministic promoted-Field backfill on existing historical Q&A rows.
 * Question-text patterns only — no LLM inference.
 */
export async function backfillPromotedHistoricalFieldMappings(): Promise<{
  answersScanned: number;
  answersUpdated: number;
  byField: Record<string, number>;
}> {
  const answers = await listHistoricalAnswers();
  const byField: Record<string, number> = {};
  let answersUpdated = 0;
  await withTransaction(async (client) => {
    for (const a of answers) {
      const merged = mergeHistoricalMappedFields(a.mappedFieldIds, a.exactQuestionText);
      const changed =
        merged.length !== a.mappedFieldIds.length ||
        merged.some((f) => !a.mappedFieldIds.includes(f));
      if (changed) {
        await client.query(
          `UPDATE historical_question_answers
           SET mapped_field_ids = $1::jsonb, updated_at = NOW()
           WHERE answer_id = $2`,
          [JSON.stringify(merged), a.answerId],
        );
        answersUpdated += 1;
      }
      for (const f of merged) {
        byField[f] = (byField[f] ?? 0) + 1;
      }
    }
  });
  return { answersScanned: answers.length, answersUpdated, byField };
}

export async function countLiveProjectTables(): Promise<Record<string, number>> {
  const tables = [
    'projects',
    'project_facts',
    'messages',
    'project_runtime',
    'project_section_contents',
  ] as const;
  const out: Record<string, number> = {};
  for (const t of tables) {
    const r = await query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${t}`);
    out[t] = Number(r.rows[0].n);
  }
  return out;
}
