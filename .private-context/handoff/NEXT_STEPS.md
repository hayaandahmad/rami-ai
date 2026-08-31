# Rami — Next Steps

Last updated: 2026-08-31 (Phases 1–5 checkpoint published)

Entrypoint: `.private-context/handoff/START_HERE.md`

## DONE (this checkpoint)

- Phases 1–5 UI/engine/document workspace (see `CURRENT_STATE.md`)
- Edit with Rami + manual structured editor + version history + Delete RFP
- Live PostgreSQL integration verified (`final-handoff-integration.ts`, delete test)
- Live Modal qwen3:8b Edit-with-Rami on `rami-gen-core-demo` (introduction v1→v2)
- Shared development snapshot refreshed (`dev/database/rami_ai_shared.dump`)
- Handoff docs updated for Device 2

```bash
npm run db:restore-shared -- --confirm-replace-local-rami-ai
npm run db:check
npm run validate:shared-dump
npm run validate:edit-with-rami
npm run validate:manual-editor-versioning
npm run validate:project-delete
npx tsx scripts/final-handoff-integration.ts
```

## NEXT (do not start automatically)

**Golden End-to-End RFP evaluation** — full BA journey through interview, generation, edit, approve, export. Use existing demo projects; do not mutate production-like data without PO approval.

Then, only if measured need:
- Optional **pgvector** when corpus/latency requires it
- Broader two-column workspace redesign (deferred)

## LATER

- Production auth / deployment
- Fine-tuning / LoRA
- Paid embedding APIs
- Mass import of 127 Suggested Additions
- Another Field/Question expansion without new evidence

## Do not start automatically

Silent retrieval on Generate · automatic ProjectFact filling · productionization · training · Field expansion · pgvector unless measured need · Modal redeploy unless required.
