# Rami — Current Implementation State
Last updated: 2026-08-31 (historical structured layer + golden eval)

Authoritative HEAD: `origin/main` (`git log -1`).

## Runtime truth

### Live demo
- `rami-gen-core-demo`: 12 generated sections, DOCX, TBC commercial/legal — unchanged by historical import

### Historical structured data
- Migration `004_historical_rfp.sql`
- Tables: `historical_rfp_documents`, `historical_question_answers`
- Import: `npm run historical:import` (Excel via Python extract → idempotent upsert)
- Counts: **7** docs · **434** canonical QA · **127** suggested additions
- PDF-backed: 4 · PDF unavailable: 3 (Excel provenance retained; no fabricated pages)
- Provenance class always `REFERENCE`
- Query helpers: `historicalQuery.ts` (SQL only — not RAG)
- Golden eval: `goldenEvaluation.ts` + `validate:historical`
- Gap report: `resources/historical-rfps/derived/GAP_REPORT.md` (52 Fields **not** modified)

### Boundary
Historical import does not mutate `projects` / `project_facts` / `messages` / `project_runtime` / `project_section_contents`.

## Phase status
- Generation / document UI / DOCX: ✅
- Historical resource library: ✅
- Historical PostgreSQL + golden foundation: ✅
- RAG / embeddings: ❌ not started
- Field-model expansion: ⏳ decide from GAP_REPORT later

## Next
Design RAG chunking/retrieval against historical tables — no embeddings until provenance+chunk schema agreed.
