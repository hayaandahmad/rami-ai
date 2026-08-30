-- Historical knowledge chunks + embeddings (RAG foundation).
-- Vectors stored as REAL[] until pgvector is installed on this PostgreSQL.
-- NEVER write into project_facts / live generation automatically.
-- Additive / non-destructive.

CREATE TABLE IF NOT EXISTS historical_knowledge_chunks (
  chunk_id TEXT PRIMARY KEY,
  historical_rfp_id TEXT NOT NULL
    REFERENCES historical_rfp_documents (historical_rfp_id) ON DELETE CASCADE,
  chunk_type TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  source_sheet TEXT,
  source_rows INTEGER[] NOT NULL DEFAULT '{}',
  source_answer_ids TEXT[] NOT NULL DEFAULT '{}',
  source_question_ids TEXT[] NOT NULL DEFAULT '{}',
  canonical_question_ids TEXT[] NOT NULL DEFAULT '{}',
  mapped_field_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  section_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  extraction_statuses JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_locators JSONB NOT NULL DEFAULT '[]'::jsonb,
  excel_rel_path TEXT NOT NULL,
  excel_sha256 TEXT NOT NULL,
  pdf_available BOOLEAN NOT NULL DEFAULT FALSE,
  provenance_class TEXT NOT NULL DEFAULT 'REFERENCE',
  topic_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT historical_chunks_type_chk
    CHECK (chunk_type IN ('QUESTION_ANSWER', 'SECTION', 'MULTI_QA_TOPIC')),
  CONSTRAINT historical_chunks_provenance_chk
    CHECK (provenance_class = 'REFERENCE')
);

CREATE INDEX IF NOT EXISTS historical_chunks_rfp_idx
  ON historical_knowledge_chunks (historical_rfp_id);

CREATE INDEX IF NOT EXISTS historical_chunks_type_idx
  ON historical_knowledge_chunks (chunk_type);

CREATE INDEX IF NOT EXISTS historical_chunks_field_gin_idx
  ON historical_knowledge_chunks USING GIN (mapped_field_ids);

CREATE INDEX IF NOT EXISTS historical_chunks_section_gin_idx
  ON historical_knowledge_chunks USING GIN (section_ids);

-- Embedding rows versioned by model; REAL[] until pgvector available.
CREATE TABLE IF NOT EXISTS historical_chunk_embeddings (
  chunk_id TEXT NOT NULL
    REFERENCES historical_knowledge_chunks (chunk_id) ON DELETE CASCADE,
  embedding_model TEXT NOT NULL,
  embedding_dims INTEGER NOT NULL,
  embedding_version TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding REAL[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chunk_id, embedding_model, embedding_version),
  CONSTRAINT historical_chunk_embeddings_dims_chk
    CHECK (embedding_dims > 0)
);

CREATE INDEX IF NOT EXISTS historical_chunk_embeddings_model_idx
  ON historical_chunk_embeddings (embedding_model, embedding_version);

-- Optional capability flag table for operators
CREATE TABLE IF NOT EXISTS historical_rag_runtime (
  key TEXT PRIMARY KEY,
  value_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO historical_rag_runtime (key, value_json)
VALUES (
  'pgvector',
  '{"installed": false, "storage": "real_array", "note": "Install pgvector for PostgreSQL 18 to enable native vector indexes; app-side cosine works meanwhile."}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
