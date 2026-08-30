# Rami — Next Steps

Last updated: 2026-08-31 (historical structured layer complete)

Entrypoint: `.private-context/handoff/START_HERE.md`

## Checkpoint now

Demo RFP + DOCX ✅ · Historical library ✅ · Structured historical PG + golden eval ✅

```bash
npm run historical:import && npm run validate:historical
```

## Path remaining

1. **RAG design** — optional `historical_rfp_sections` / `knowledge_chunks` then pgvector (after provenance rules)
2. Wire retrieval as REFERENCE only (never auto ProjectFacts)
3. Optional Field/Question promotions from `derived/GAP_REPORT.md` — explicit decision
4. Run extraction evaluation against golden cases (local/Modal when intentionally requested)
5. Training / LoRA — later

## Do not start automatically

Embeddings, vector search, RAG prompt injection into live generation, silent Field-model expansion.
