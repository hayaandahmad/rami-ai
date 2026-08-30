-- Persistent generated RFP section content (prose / structured blocks).
-- project_section_states remains lifecycle-only. ProjectFacts remain business truth.
-- Additive / non-destructive.

CREATE TABLE IF NOT EXISTS project_section_contents (
  content_id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects (project_id) ON DELETE CASCADE,
  section_id TEXT NOT NULL REFERENCES sections (section_id),
  version INTEGER NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'DRAFT',
  content_json JSONB NOT NULL,
  readiness_at_generation TEXT NOT NULL,
  model_used TEXT,
  source_field_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  tbc_field_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  superseded_at TIMESTAMPTZ,
  UNIQUE (project_id, section_id, version),
  CONSTRAINT project_section_contents_approval_chk
    CHECK (approval_status IN ('DRAFT', 'APPROVED')),
  CONSTRAINT project_section_contents_readiness_chk
    CHECK (readiness_at_generation IN ('READY_TO_DRAFT', 'DRAFTABLE_WITH_TBC'))
);

CREATE UNIQUE INDEX IF NOT EXISTS project_section_contents_current_idx
  ON project_section_contents (project_id, section_id)
  WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS project_section_contents_project_idx
  ON project_section_contents (project_id);
