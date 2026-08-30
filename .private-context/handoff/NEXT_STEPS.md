# Rami — Next Steps

Last updated: 2026-08-31 (RAG retrieval foundation complete)

Entrypoint: `.private-context/handoff/START_HERE.md`

## Checkpoint now

Demo RFP + DOCX ✅ · Historical library ✅ · Structured historical PG ✅ · RAG chunks/embeddings/hybrid retrieval + eval ✅ (offline)

```bash
npm run historical:chunks && npm run historical:embed && npm run historical:evaluate-retrieval && npm run validate:rag
```

## Exact next step

**Controlled RAMI integration (REFERENCE only)**

1. Surface `HistoricalReference` results as optional citations / suggestions in BA UI (not auto-injected into generation prompts until UX + eval gates agreed).
2. Design `REFERENCE → PROPOSED → BA confirm → ProjectFact` as a separate workflow.
3. Do **not** write retrieval results into `project_facts` automatically.
4. Optional later: install pgvector for PG 18 and migrate `REAL[]` → `vector(768)` with HNSW.
5. Optional Field promotions from gap evidence (explicit decision; `procurementStage` leave-one-out is weak).

## Do not start automatically

Silent ProjectFact promotion · expanding the 52-field model without decision · fine-tuning / LoRA · paid embedding APIs.
