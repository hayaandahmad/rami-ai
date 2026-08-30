-- Historical RFP structured knowledge (REFERENCE only).
-- NEVER join these into live ProjectFacts / generation automatically.
-- Additive / non-destructive. No embeddings / pgvector.

CREATE TABLE IF NOT EXISTS historical_rfp_documents (
  historical_rfp_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  document_kinds JSONB NOT NULL DEFAULT '[]'::jsonb,
  intended_use JSONB NOT NULL DEFAULT '[]'::jsonb,
  excel_rel_path TEXT NOT NULL,
  excel_sha256 TEXT NOT NULL,
  pdf_rel_path TEXT,
  pdf_sha256 TEXT,
  has_pdf BOOLEAN NOT NULL DEFAULT FALSE,
  evaluation_eligibility JSONB NOT NULL DEFAULT '{}'::jsonb,
  manifest_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT historical_rfp_documents_not_project_chk
    CHECK (historical_rfp_id !~* '^project:')
);

CREATE TABLE IF NOT EXISTS historical_question_answers (
  answer_id TEXT PRIMARY KEY,
  historical_rfp_id TEXT NOT NULL
    REFERENCES historical_rfp_documents (historical_rfp_id) ON DELETE CASCADE,
  source_sheet TEXT NOT NULL,
  source_sheet_kind TEXT NOT NULL,
  source_row INTEGER,
  source_question_id TEXT NOT NULL,
  canonical_question_id TEXT,
  is_canonical BOOLEAN NOT NULL DEFAULT FALSE,
  question_section_label TEXT,
  exact_question_text TEXT NOT NULL,
  answer_text TEXT NOT NULL DEFAULT '',
  extraction_status TEXT NOT NULL,
  source_locator TEXT,
  provenance_class TEXT NOT NULL DEFAULT 'REFERENCE',
  mapped_field_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  excel_rel_path TEXT NOT NULL,
  pdf_available BOOLEAN NOT NULL DEFAULT FALSE,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT historical_qa_sheet_kind_chk
    CHECK (source_sheet_kind IN ('qa', 'suggested_additions')),
  CONSTRAINT historical_qa_provenance_chk
    CHECK (provenance_class = 'REFERENCE'),
  CONSTRAINT historical_qa_canonical_consistency_chk
    CHECK (
      (is_canonical = TRUE AND canonical_question_id IS NOT NULL)
      OR (is_canonical = FALSE)
    ),
  UNIQUE (historical_rfp_id, source_sheet, source_question_id)
);

CREATE INDEX IF NOT EXISTS historical_qa_rfp_idx
  ON historical_question_answers (historical_rfp_id);

CREATE INDEX IF NOT EXISTS historical_qa_canonical_qid_idx
  ON historical_question_answers (canonical_question_id)
  WHERE canonical_question_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS historical_qa_is_canonical_idx
  ON historical_question_answers (is_canonical);

CREATE INDEX IF NOT EXISTS historical_qa_field_gin_idx
  ON historical_question_answers USING GIN (mapped_field_ids);
