# START HERE — Rami

Read this first in a new Cursor session or on a second machine.

Do not treat `README.md` as authoritative.

## A. Authoritative commit

After pull, these must be equal:

```text
git rev-parse HEAD
git rev-parse origin/main
```

Last **feature** milestone: **Final RFP completion + DOCX export**

```text
2546bfb40b1d1d1fc0ec8615d6e27d73e0525ee7
```

## B. Product goal

RAMI is an AI-assisted BA/RFP workspace. Qwen3 8B is language only. TypeScript owns workflow, persistence, readiness, and generation gates.

## C. Demo project status (`rami-gen-core-demo`)

| Metric | Value |
|---|---|
| Applicable sections | **12** |
| Generated | **12** |
| Approved | **1** (`background`) |
| NOT_READY | **0** (commercial/legal drafted with explicit TBC) |
| TBC blocks in assembled RFP | **12** |
| DOCX | **Available** — `GET /api/rami/generation/document/docx?documentKey=` |

## D. Fully completed

- Persistence, Section Readiness, Modal integration, RFP Generation Core
- A4 document experience + Full RFP preview
- Remaining applicable sections generated (Modal used when local Ollama timed out)
- Commercial/legal blockers completed via real `applyExtractedFacts` **TBC** path (not invented percentages/legal clauses)
- Deliverables regenerated/edited from ProjectFacts when model returned headings-only
- **DOCX export** from the same persisted `AssembledRfp` / `GeneratedSection` (no Qwen on export)
- Download Word control in document toolbar

## E. NOT implemented (post-demo)

- RAG / pgvector / historical RFP retrieval
- Fine-tuning / LoRA / model replacement
- Phase 2.3 domain catalogs
- Auto-approving all sections (approval remains a BA action)

## F. Demo entry

```text
http://localhost:3000/documents/rami-gen-core-demo/interview
```

### Manager demo flow

1. Open interview URL — persisted BA conversation + project state
2. Open RFP Document pane
3. Navigate sections (readiness vs document status)
4. Show a TBC marker (evaluation / financial / legal)
5. Generate / Regenerate a DRAFT; show APPROVED protection on `background`
6. Full RFP preview
7. **Download Word** — open DOCX; structure matches browser assembly

## G. API contract (document)

| Action | Endpoint |
|---|---|
| Document + assembly + readiness | `GET /api/rami/generation/document?documentKey=` |
| Generate / regenerate | `POST /api/rami/generation/section` |
| Approve | `POST /api/rami/generation/approve` |
| Manual edit | `POST /api/rami/generation/edit` |
| **DOCX download** | `GET /api/rami/generation/document/docx?documentKey=` |

## H. Known limitations

- Local `qwen3:8b` on this device often times out on heavy sections; use Modal (`RAMI_MODEL_PROVIDER=modal` + Start GPU) for live generation demos, then stop GPU
- Commercial/legal content is **TBC-drafted**, not procurement-final
- Not every section is APPROVED (intentional)

## I. Exact next task (post-demo)

RAG / retrieval over historical RFPs — only after manager demo. See `NEXT_STEPS.md`.
