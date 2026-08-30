# Rami — Next Steps

Last updated: 2026-08-31 (canonical information-model expansion complete)

Entrypoint: `.private-context/handoff/START_HERE.md`

## Checkpoint now

Demo RFP ✅ · Historical library ✅ · Offline RAG ✅ · Controlled chat REFERENCE/PROPOSED/CONFIRM ✅ · Evidence-driven 59-field / 69-question model ✅

```bash
npm run validate:model-expansion && npm run validate:controlled-rag && npm run validate:rag
```

## Exact next step

**Generation-time RAG (optional, explicit only)**

- Do not inject historical chunks into every section generation prompt.
- If added: only BA-approved / explicitly requested references; current ProjectFacts remain generation truth.
- Optional later: pgvector install for PG 18.

Do **not** automatically start another information-model expansion.

## Do not start automatically

Silent ProjectFact promotion · auto-fill Fields from RAG · Fine-tuning / LoRA · paid embedding APIs · importing all 127 Suggested Additions.
