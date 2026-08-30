# START HERE — Rami

Read this first in a new Cursor session or on a second machine.

Do not treat `README.md` as authoritative.

## A. Authoritative commit

After pull, these must be equal:

```text
git rev-parse HEAD
git rev-parse origin/main
```

## B. Product goal

RAMI is an AI-assisted BA/RFP workspace. Qwen3 8B is language only. TypeScript owns workflow, persistence, readiness, and generation gates.

## C. Demo project (`rami-gen-core-demo`)

12/12 applicable sections generated · DOCX available · commercial/legal TBC-drafted · approval remains a BA action.

Demo: `http://localhost:3000/documents/rami-gen-core-demo/interview`

## D. Historical knowledge + controlled RAG

| Item | Status |
|---|---|
| Historical datasets | **7** Excel + **4** PDFs |
| Structured import + chunks + embeddings | **Yes** |
| Live chat retrieval | **Yes** — policy-gated only |
| REFERENCE → PROPOSED → BA confirm | **Yes** |
| Auto ProjectFact from history | **No** |
| Generation-time RAG | **NOT IMPLEMENTED** |
| pgvector | **Not installed** (`REAL[]` interim) |

```bash
npm run db:migrate
npm run validate:controlled-rag
```

Ask in chat: *“Show me examples for deliverables from previous RFPs”* → historical cards appear → **Use as suggestion** / **Accept** / **Reject**.

## E. Canonical information model (2026-08)

| Item | Count |
|---|---:|
| Canonical Fields | **59** (was 52; +7 evidence-promoted) |
| Canonical Questions | **69** (was 62; +7 `18.x`) |
| Canonical Sections | **20** (unchanged) |

`procurementStage` is **not** a Field. It remains `ProjectContext.documentStage`.

## F. Exact next task

Optional generation-time RAG (explicit BA-approved only). Do not auto-inject historical text into section drafts. See `NEXT_STEPS.md`.
