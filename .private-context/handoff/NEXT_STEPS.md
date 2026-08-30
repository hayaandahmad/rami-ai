# Rami — Next Steps

Last updated: 2026-08-31 (historical RFP library audited)

Entrypoint: `.private-context/handoff/START_HERE.md`

## Checkpoint now

Demo RFP + DOCX ✅ · Historical resource library organized + audited ✅

Library: `resources/historical-rfps/` (see README + `derived/AUDIT_SUMMARY.md`)

## Path remaining

1. **Historical ingestion design** — `historical_rfp_documents` + `historical_question_answers` from Excel (provenance required)
2. Golden evaluation harness (extraction / question coverage) using the 7 datasets
3. PDF chunking + pgvector embeddings — only after (1)
4. Retrieval as REFERENCE (never silent ProjectFacts)
5. Optional Field/Question expansions from audit gaps (procurement, named roles, call-off) — decide explicitly
6. Training / LoRA — much later

## Do not start yet

Embeddings, pgvector install, RAG UI, fine-tuning, auto-import of historical answers into live projects.
