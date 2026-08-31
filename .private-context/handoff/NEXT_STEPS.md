# Rami — Next Steps

Last updated: 2026-08-31 (generic Golden corrective checkpoint published)

Entrypoint: `.private-context/handoff/START_HERE.md`

## DONE (this checkpoint)

- Generic extraction / readiness hardening (issuer ≠ beneficiary ≠ users ≠ audience)
- Deterministic Cover Page (Issued by from `issuerEntity` or TBC)
- Deterministic Table of Contents
- Standard Annex pack (titles + explicit placeholders; form bodies not stored)
- AI-generated Introduction from who / what / why ProjectFacts
- Clean Full RFP / DOCX (no internal generation diagnostics in document text)
- AI drafted vs automatic structural metrics
- Canonical model **20 / 60 / 70** including `issuerEntity`
- Shared development snapshot refreshed (`dev/database/rami_ai_shared.dump`)
- Handoff docs updated

```bash
git pull
npm install
npm run db:restore-shared -- --confirm-replace-local-rami-ai
npm run db:check
npm run historical:check
npm run validate:shared-dump
npm run validate:golden-readiness-structural
npm run validate:standard-annex-pack
```

## NEXT (do not start automatically)

**Golden End-to-End RFP evaluation** — full BA journey through interview, generation, edit, approve, export. Use existing demo / Golden projects; do not mutate production-like data without PO approval. Do not SQL-patch the Golden project.

Then, only if measured need:
- Store actual reusable Annex form bodies/files (then flip attachment wording)
- Optional **pgvector** when corpus/latency requires it
- Broader two-column workspace redesign (deferred)
- Persisted version history for deterministic Cover/TOC/Annexes (currently assembled automatically)

## LATER

- Production auth / deployment
- Fine-tuning / LoRA
- Paid embedding APIs
- Mass import of 127 Suggested Additions
- Another Field/Question expansion without new evidence

## Do not start automatically

Silent retrieval on Generate · automatic ProjectFact filling · productionization · training · Field expansion · pgvector unless measured need · Modal redeploy unless required · SQL-editing Golden facts.
