# START HERE — Rami

Read this first in a new Cursor session or on a second machine.

Do not treat `README.md` as authoritative.

## A. Authoritative commit

After pull, these must be equal:

```text
git rev-parse HEAD
git rev-parse origin/main
```

Last **feature** milestone (RFP document experience UI):

```text
git log -1 --oneline
# expect document-experience / A4 preview commit on main
```

Feature backend milestone still:

```text
d8e7f678b01b3ab5342f57c70098a61c85cc7f0b
```

## B. Product goal

RAMI is an AI-assisted BA/RFP workspace. Qwen3 8B is language only. TypeScript owns workflow, persistence, readiness, and generation gates.

## C. Fully completed

- All prior persistence / readiness / Modal / generation-core items
- **A4 document experience** consuming persisted `GeneratedSection`
- Generic block renderer (heading, paragraph, lists, table, tbc)
- Section navigation with **information readiness** and **document status** separated
- Generate / Regenerate / Approve / Edit UI wired to generation APIs
- Full RFP assembled preview (canonical order; missing sections marked, not invented)
- Manual edit backend (`POST /api/rami/generation/edit`) — new DRAFT version; APPROVED protected
- Demo project `rami-gen-core-demo` with multiple generated sections

## D. NOT implemented

- DOCX export
- RAG / pgvector / embeddings
- Fine-tuning / LoRA / Qwen 14B
- Phase 2.3 domain catalogs
- Every applicable section generated+approved (evaluation/financial/legal still NOT_READY by design)

## E. Demo entry

Open:

```text
http://localhost:3000/documents/rami-gen-core-demo/interview
```

Document pane opens automatically when PostgreSQL already has generated content.

## F. UI / backend contract

| Action | Endpoint |
|---|---|
| Document + assembly + readiness | `GET /api/rami/generation/document?documentKey=` |
| Section + readiness | `GET /api/rami/generation/section?documentKey=&sectionId=` |
| Generate / regenerate | `POST /api/rami/generation/section` |
| Approve | `POST /api/rami/generation/approve` |
| Manual edit | `POST /api/rami/generation/edit` `{ documentKey, sectionId, blocks, reopenApproved? }` |

Primary UI: `src/components/rfp/RfpDocumentPanel.tsx` + `GeneratedSectionBlocks.tsx`.

## G. Exact next task

**DOCX export** from the same `AssembledRfp` / `GeneratedSection` model (no re-generation). Optionally fill remaining NOT_READY sections through legitimate BA facts + TBC, then approve key sections for the manager demo.

See `NEXT_STEPS.md`.
