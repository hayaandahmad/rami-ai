# Rami — Next Steps

Last updated: 2026-08-31 (controlled RAG integration complete)

Entrypoint: `.private-context/handoff/START_HERE.md`

## Checkpoint now

Demo RFP ✅ · Historical library ✅ · Offline RAG ✅ · Controlled chat REFERENCE/PROPOSED/CONFIRM ✅

```bash
npm run validate:controlled-rag && npm run validate:rag
```

## Exact next step

**Generation-time RAG (optional, explicit only)**

- Do not inject historical chunks into every section generation prompt.
- If added: only BA-approved / explicitly requested references; current ProjectFacts remain generation truth.
- Optional later: pgvector install for PG 18; Field promotions from gap report (not `procurementStage` yet).

## Do not start automatically

Silent ProjectFact promotion · auto-fill Fields from RAG · Fine-tuning / LoRA · paid embedding APIs.
