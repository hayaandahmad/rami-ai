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
| Generation-time RAG | **Yes — BA-approved, section-scoped drafting references only** |
| Silent retrieval on Generate | **No** |
| pgvector | **Not installed** (`REAL[]` interim) |

```bash
npm run db:migrate
npm run validate:controlled-rag
npm run validate:generation-rag
```

Ask in chat: *“Show me examples for deliverables from previous RFPs”* → historical cards appear.

- **Use as suggestion** → PENDING proposal (not a ProjectFact)
- **Accept** → CONFIRMED ProjectFact
- **Use as drafting reference** → section-scoped generation guidance only (does **not** add ProjectFacts)
- **Reject** / **Remove** drafting reference → no fact change

Generation uses **already approved** drafting references. Clicking Generate does **not** retrieve.

## E. Canonical information model (2026-08)

| Item | Count |
|---|---:|
| Canonical Fields | **59** (was 52; +7 evidence-promoted) |
| Canonical Questions | **69** (was 62; +7 `18.x`) |
| Canonical Sections | **20** (unchanged) |

`procurementStage` is **not** a Field. It remains `ProjectContext.documentStage`.

## F. Exact next task

Optional pgvector for later scale. Do **not** start productionization, training, or another Field expansion. See `NEXT_STEPS.md`.
