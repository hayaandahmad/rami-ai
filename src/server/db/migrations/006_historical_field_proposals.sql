-- Historical field proposals — PENDING suggestions never write project_facts.
-- Lifecycle: PENDING → ACCEPTED | REJECTED
-- Accepted proposals promote to ProjectFacts only via BA confirmation.

CREATE TABLE IF NOT EXISTS historical_field_proposals (
  proposal_id TEXT PRIMARY KEY,
  project_id UUID NOT NULL
    REFERENCES projects (project_id) ON DELETE CASCADE,
  field_id TEXT NOT NULL,
  proposed_value_json JSONB NOT NULL,
  proposed_text TEXT NOT NULL,
  status TEXT NOT NULL,
  source_chunk_ids TEXT[] NOT NULL DEFAULT '{}',
  source_references_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  retrieval_mode TEXT,
  retrieval_query TEXT,
  retrieval_debug_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ba_modified_value_json JSONB,
  final_value_json JSONB,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT historical_field_proposals_status_chk
    CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS historical_field_proposals_project_idx
  ON historical_field_proposals (project_id);

CREATE INDEX IF NOT EXISTS historical_field_proposals_project_field_status_idx
  ON historical_field_proposals (project_id, field_id, status);

CREATE INDEX IF NOT EXISTS historical_field_proposals_pending_idx
  ON historical_field_proposals (project_id, status)
  WHERE status = 'PENDING';
