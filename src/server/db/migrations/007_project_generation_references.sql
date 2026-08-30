-- BA-approved historical references for section drafting guidance only.
-- NEVER write ProjectFacts. NEVER used as readiness evidence.
-- Distinct from historical_field_proposals (those can become CONFIRMED facts).
-- Additive / non-destructive.

CREATE TABLE IF NOT EXISTS project_generation_references (
  generation_reference_id TEXT PRIMARY KEY,
  project_id UUID NOT NULL
    REFERENCES projects (project_id) ON DELETE CASCADE,
  section_id TEXT NOT NULL
    REFERENCES sections (section_id),
  historical_chunk_id TEXT NOT NULL
    REFERENCES historical_knowledge_chunks (chunk_id) ON DELETE RESTRICT,
  usage_scope TEXT NOT NULL DEFAULT 'STRUCTURE_AND_LANGUAGE',
  status TEXT NOT NULL,
  approved_by TEXT,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CONSTRAINT project_generation_references_status_chk
    CHECK (status IN ('ACTIVE', 'REVOKED')),
  CONSTRAINT project_generation_references_scope_chk
    CHECK (usage_scope IN ('STRUCTURE_AND_LANGUAGE'))
);

CREATE UNIQUE INDEX IF NOT EXISTS project_generation_references_active_uniq
  ON project_generation_references (project_id, section_id, historical_chunk_id)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS project_generation_references_project_section_idx
  ON project_generation_references (project_id, section_id, status);
