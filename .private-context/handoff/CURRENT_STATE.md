# Rami — Current Implementation State

Last updated: 2026-09-01 (chat gap-grounding checkpoint)

Authoritative HEAD: `origin/main` (`git log -1` after pull).

## Runtime truth

### Persistence
- PostgreSQL is authoritative for live project state
- Hydration does **not** silently reconcile or hide stored contradictions
- Dashboard loads from `GET /api/rami/workspace`
- Create document: `POST /api/rami/projects` → `/documents/{documentKey}/interview`
- Delete document: `DELETE /api/rami/projects/{documentKey}` (CASCADE via existing FKs)
- Shared snapshot: `dev/database/rami_ai_shared.dump` + `rami_ai_shared.metadata.json`
- Private dumps: `.rami-db-backups/` (gitignored)

### Migrations
Latest: **`007_project_generation_references.sql`** (7 migrations total).  
`issuerEntity` is a catalog row seeded from TypeScript (`npm run db:seed`), not a new DDL migration.

### Information model
| Item | Count |
|---|---:|
| Sections | 20 |
| Fields | 60 |
| Questions | 70 |
| QuestionFields | 67 |
| SectionFields | 87 |

`issuerEntity` (Issuing / Procuring Entity) is a generic CORE field, distinct from `beneficiaryEntity`. Question **0.8** collects it. Mapped to Cover Page and Administrative Procedures. Same organization in both fields is valid. Missing issuer stays unresolved / Cover **Issued by: TBC**.

### Live DB inventory (snapshot metadata — 2026-08-31)
See `dev/database/rami_ai_shared.metadata.json` for authoritative counts at checkpoint time.

| Table / metric | Count (checkpoint) |
|---|---:|
| projects | 15 |
| project_facts | 135 |
| messages | 50 |
| project_section_contents | 89 |
| historical_knowledge_chunks | 732 |
| historical_chunk_embeddings | 732 |
| historical_field_proposals | 23 |
| project_generation_references | 7 |

Embeddings: `nomic-embed-text` / 768-d / `REAL[]`.

Existing projects may have **no** `issuerEntity` fact until the BA states an issuer. That is expected. Do not SQL-backfill.

### Demo / proof projects
- `rfp-system-implementation-78dcf4` — Golden conversational project (do not SQL-patch)
- `rami-gen-core-demo` — generated RFP + DOCX; live Modal AI-edit verified (introduction v2)
- `rami-model-expansion-demo` — information-model conversational proof (catalog now 60 fields)
- `rami-gen-rag-demo` — generation-reference proof
- `rami-rag-controlled-demo` — controlled chat RAG
- `rami-rag-live-eval` — live Qwen generation-RAG A/B

## Generic Golden corrective (this checkpoint)

### Extraction / semantics
- Natural BA language maps to canonical Fields (title, need, issuer, beneficiary, engagement type)
- **Issuer ≠ beneficiary ≠ users ≠ audience / public**
- PostgreSQL remains persistent authority
- False conflicts are not hidden during hydration
- True same-field conflicts still block

### Structural RFP behavior
- Cover Page is deterministic (no Qwen); BA does not write Cover prose
- Cover is built from authoritative metadata
- `issuerEntity` drives **Issued by** when known; otherwise **TBC**
- Beneficiary remains a separate Cover line
- Table of Contents is deterministic
- Introduction is AI-generated from foundational ProjectFacts (who / what / why)
- BA does not supply Introduction prose; there is no `introductionText` field
- Standard Annex pack is deterministic for ordinary full RFPs
- Project-specific annexes append from `requiredAnnexes`
- PQ / RFI / market-sounding do not force the standard pack unless extras exist
- Actual standard Annex form bodies/files are **not** stored; placeholders must not claim an attachment

### Standard Annex pack (titles only)
1. Technical Proposal Response Format  
2. Financial Proposal Response Format  
3. Compliance Sheet  
4. Confidentiality Undertaking  
5. Joint Venture Agreement  
6. Sample Agreement  
7. Key RFP Dates and Deadlines  

### Document output
- Full RFP / DOCX must not emit raw internal `[section not generated]` strings
- Missing narrative sections remain UI incompleteness, not fake document text

### Metrics
- AI drafted count (`generatedApplicableCount`) is distinct from automatic structural count (`structuralPreparedCount`)
- Approval counts are unchanged

### Chat project-status grounding
- “What is missing?” / “what do you still need?” answers are built from Gap Engine + section readiness, not a free-form model guess
- Pure status questions do **not** call Qwen and do not mutate ProjectFacts
- Mixed status + factual messages extract/persist the facts first, recompute Gap Engine, then return the deterministic status reply
- Canonical section titles only; standard Annexes are not reported as missing BA information

## Phases 1–5 (still in this tree)

Engine/chat polish, layout, document workspace, Edit with Rami, manual editor, version history, delete — see prior checkpoint. Invariants below still hold.

## Non-negotiable invariants (unchanged)

- ProjectFacts authoritative; manual/AI document edits do not mutate facts
- TBC blocks protected in manual editor
- Section version history immutable; restore creates new version
- No automatic historical retrieval during generation or AI edit
- Drafting references never affect readiness
- Section mode vs Full RFP mode remain distinct
- DOCX assembles persisted PostgreSQL content plus deterministic structural sections when applicable
- Production source has no project-specific (Natiq) corrective logic

## Validation commands

```bash
npm run db:check
npm run historical:check
npm run validate:shared-dump
npm run validate:golden-readiness-structural
npm run validate:chat-gap-grounding
npm run validate:standard-annex-pack
npm run validate:section-readiness
npm run validate:phase1
npm run validate:edit-with-rami
npm run validate:manual-editor-versioning
npm run validate:project-delete
npx tsx scripts/final-handoff-integration.ts
```

## Next
Golden End-to-End RFP evaluation (BA journey). See `NEXT_STEPS.md`.
