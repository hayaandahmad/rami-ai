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

## D. Historical RFP Resource Library + structured layer

Path: `resources/historical-rfps/`

| Item | Status |
|---|---|
| Datasets | **7** Excel + **4** PDFs |
| Structured PostgreSQL import | **Yes** — `historical_rfp_documents` + `historical_question_answers` |
| Canonical QA rows | **434** (7×62) |
| Suggested Addition rows | **127** (noncanonical, collision-safe IDs) |
| Separation from ProjectFacts | **Enforced** (import boundary validated) |
| Golden evaluation foundation | **Yes** (coverage + extraction contract) |
| RAG | **NOT IMPLEMENTED** |
| Embeddings / pgvector | **NOT IMPLEMENTED** |

```bash
npm run db:migrate
npm run historical:import
npm run historical:check
npm run validate:historical
```

See `resources/historical-rfps/README.md` and `derived/GAP_REPORT.md`.

## E. NOT implemented yet

- RAG / pgvector / historical retrieval into generation
- Fine-tuning / LoRA
- Expanding the 52-field model from gap report (decide explicitly later)

## F. Exact next task

RAG / chunk design against the structured historical layer — still no silent ProjectFacts promotion. See `NEXT_STEPS.md`.
