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

**Golden End-to-End RFP evaluation** — only after live generation-RAG safety is accepted (live Qwen run completed 2026-08-31; gate B: safe, quality benefit unclear — see `generation-rag-live-eval.json`).

Then, only if needed: **optional pgvector** when corpus/latency requires it.

## DONE (added 2026-08-31)

- Live Qwen generation-RAG A/B validation harness (`validate:generation-rag-live`)
- 4 live cases on `rami-rag-live-eval`: deliverables, scopeOfWork, background (TBC), evaluationCriteria (high-risk TBC)
- ProjectFact + readiness isolation verified; revoke-reference flow verified; zero deterministic leakage in all cases

## LATER

- Production auth / deployment
- Fine-tuning / LoRA
- Paid embedding APIs
- Mass import of 127 Suggested Additions
- Another Field/Question expansion without new evidence

## Do not start automatically

Silent retrieval on Generate · automatic ProjectFact filling · productionization · training · Field expansion · pgvector unless measured need.
