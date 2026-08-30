-- Many-to-many Field ↔ Section mapping for Section Readiness.
-- fields.section_id remains the convenience primary section (non-destructive).

CREATE TABLE IF NOT EXISTS section_fields (
  section_id TEXT NOT NULL REFERENCES sections (section_id),
  field_id TEXT NOT NULL REFERENCES fields (field_id),
  role TEXT NOT NULL DEFAULT 'supporting',
  tbc_allows_draft BOOLEAN NOT NULL DEFAULT TRUE,
  na_valid BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (section_id, field_id)
);
