-- RAMI PostgreSQL foundation
-- Static definitions vs current project state vs (future) knowledge are separate.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sections (
  section_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  classification TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  question_id TEXT PRIMARY KEY,
  question_text TEXT NOT NULL,
  section_id TEXT REFERENCES sections (section_id)
);

CREATE TABLE IF NOT EXISTS fields (
  field_id TEXT PRIMARY KEY,
  field_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  section_id TEXT NOT NULL REFERENCES sections (section_id)
);

CREATE TABLE IF NOT EXISTS question_fields (
  question_id TEXT NOT NULL REFERENCES questions (question_id),
  field_id TEXT NOT NULL REFERENCES fields (field_id),
  PRIMARY KEY (question_id, field_id)
);

CREATE TABLE IF NOT EXISTS projects (
  project_id UUID PRIMARY KEY,
  document_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  budget_jod NUMERIC,
  duration_months INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  completed_by_user_id UUID REFERENCES users (user_id)
);

CREATE TABLE IF NOT EXISTS project_facts (
  project_id UUID NOT NULL REFERENCES projects (project_id) ON DELETE CASCADE,
  field_id TEXT NOT NULL REFERENCES fields (field_id),
  value_json JSONB,
  collection_state TEXT NOT NULL,
  provenance_status TEXT NOT NULL,
  source_type TEXT,
  source_ref TEXT,
  confirmed_by TEXT,
  updated_at TEXT,
  history_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  gap_status TEXT,
  deferred_to TEXT,
  contradiction_json JSONB,
  PRIMARY KEY (project_id, field_id)
);

CREATE TABLE IF NOT EXISTS messages (
  message_id TEXT PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects (project_id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  user_id UUID REFERENCES users (user_id),
  content TEXT NOT NULL,
  language TEXT,
  sort_order INTEGER NOT NULL,
  extracted_field_ids JSONB,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS messages_project_sort_idx
  ON messages (project_id, sort_order);

CREATE TABLE IF NOT EXISTS project_runtime (
  project_id UUID PRIMARY KEY REFERENCES projects (project_id) ON DELETE CASCADE,
  rfp_intent TEXT NOT NULL DEFAULT 'NONE',
  conversation_language TEXT NOT NULL DEFAULT 'en',
  active_section TEXT,
  document_stage TEXT NOT NULL DEFAULT 'UNDETERMINED',
  contracting_granularity TEXT NOT NULL DEFAULT 'UNDETERMINED',
  primary_domain TEXT NOT NULL DEFAULT 'UNDETERMINED',
  secondary_domains JSONB NOT NULL DEFAULT '[]'::jsonb,
  complexity JSONB NOT NULL DEFAULT '{}'::jsonb,
  context_contradictions JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS project_section_states (
  project_id UUID NOT NULL REFERENCES projects (project_id) ON DELETE CASCADE,
  section_id TEXT NOT NULL REFERENCES sections (section_id),
  state TEXT NOT NULL,
  entered_at TEXT NOT NULL,
  reopen_reason TEXT,
  draft_field_snapshot JSONB,
  PRIMARY KEY (project_id, section_id)
);
