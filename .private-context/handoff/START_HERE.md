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

## D. Historical RFP Resource Library + structured layer + RAG foundation

Path: `resources/historical-rfps/`

| Item | Status |
|---|---|
| Datasets | **7** Excel + **4** PDFs |
| Structured PostgreSQL import | **Yes** — `historical_rfp_documents` + `historical_question_answers` |
| Canonical QA rows | **434** (7×62) |
| Suggested Addition rows | **127** (noncanonical, collision-safe IDs) |
| Separation from ProjectFacts | **Enforced** |
| Golden evaluation foundation | **Yes** |
| RAG chunks + retrieval | **Yes** — offline foundation (not live chat) |
| Embeddings | **Yes** — local `nomic-embed-text` (768-d) |
| pgvector | **Not installed** — vectors stored as `REAL[]` + app-side cosine |
| Live chat / generation injection | **NOT IMPLEMENTED** |
| REFERENCE → ProjectFact promotion | **NOT IMPLEMENTED** |

```bash
npm run db:migrate
npm run historical:import
npm run historical:chunks
npm run historical:embed
npm run historical:evaluate-retrieval
npm run validate:rag
```

See `resources/historical-rfps/README.md` and `derived/retrieval-eval-report.json`.

## E. NOT implemented yet

- Injecting historical references into `/api/rami/chat` or section generation
- PROPOSED → BA confirm → ProjectFact workflow
- Expanding the 52-field model from gap report (decide explicitly later)
- Native pgvector indexes (optional upgrade when extension is installed)

## F. Exact next task

Controlled RAMI integration: expose `HistoricalReference` as REFERENCE suggestions in UI/chat **without** writing ProjectFacts. See `NEXT_STEPS.md`.
