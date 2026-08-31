# Rami — Next Steps

Last updated: 2026-08-31 (GitHub consolidation + shared snapshot refresh)

Entrypoint: `.private-context/handoff/START_HERE.md`

## DONE

- PostgreSQL persistence + migrations through `007`
- Demo RFP generation + DOCX
- Historical library (7) + structured import
- Offline RAG (732 chunks + embeddings, `REAL[]`)
- Controlled chat REFERENCE → PROPOSED → CONFIRM
- Canonical model 59 Fields / 69 Questions / 20 Sections
- BA-approved section-scoped generation references
- Shared development snapshot refreshed and restore-tested
- Handoff docs aligned to current HEAD

```bash
npm run db:restore-shared -- --confirm-replace-local-rami-ai
npm run db:check
npm run validate:generation-rag
npm run validate:controlled-rag
npm run validate:shared-dump
```

## NEXT

**Optional live local generation-RAG quality compare** (same ProjectFacts ± approved drafting reference) using already-running local Ollama — only if useful. Do **not** start Modal GPU for this.

Then, only if needed: **optional pgvector** when corpus/latency requires it.

## LATER

- Production auth / deployment
- Fine-tuning / LoRA
- Paid embedding APIs
- Mass import of 127 Suggested Additions
- Another Field/Question expansion without new evidence

## Do not start automatically

Silent retrieval on Generate · automatic ProjectFact filling · productionization · training · Field expansion · pgvector unless measured need.
