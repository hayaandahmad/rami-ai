# Rami — Next Steps

Last updated: 2026-08-31 (BA-approved generation-time RAG complete)

Entrypoint: `.private-context/handoff/START_HERE.md`

## Checkpoint now

Demo RFP ✅ · Historical library ✅ · Offline RAG ✅ · Controlled chat REFERENCE/PROPOSED/CONFIRM ✅ · Evidence-driven 59-field / 69-question model ✅ · BA-approved generation references ✅

```bash
npm run validate:generation-rag
npm run validate:controlled-rag
npm run validate:rfp-generation
```

## Exact next step

**Optional pgvector for later scale**

- Current corpus is small; `REAL[]` + app-side cosine remains acceptable.
- Do **not** install pgvector unless retrieval latency / corpus size requires it.
- Do **not** start production auth/deployment, fine-tuning, or another Field expansion.

## Do not start automatically

Silent retrieval on Generate · automatic ProjectFact filling · Fine-tuning / LoRA · paid embedding APIs · importing all 127 Suggested Additions.
