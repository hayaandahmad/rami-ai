# Historical RFP Resource Library

Location: `resources/historical-rfps/`

## What these files are

Excel workbooks that map **RAMI’s current 62-question Question Bank** to answers extracted from **real historical MoDEE / government RFPs** (and pre-qualification documents), including **Status** and **Source (RFP)** page references where available.

Optional **original RFP PDFs** live beside the Excel files when supplied.

## Why RAMI keeps them

- **REFERENCE** — examples of how real RFPs answer RAMI questions  
- **EVALUATION** — golden sets for coverage / future extraction checks  
- **RAG_CANDIDATE** — later retrieval of patterns (not implemented yet)

They are **not** live project state.

## Hard rules

| These are | These are NOT |
|---|---|
| Historical / reference resources | Current `ProjectFacts` |
| Source artifacts under `source/` | Model training data |
| Structured PostgreSQL historical tables after import | RAG embeddings |
| Golden evaluation inputs | Auto-injected generation context |

**Historical answer ≠ current project truth.**  
Provenance class is always `REFERENCE`.

## Layout

```text
resources/historical-rfps/
  README.md
  manifest.json
  source/excel/   ← immutable workbooks
  source/pdf/     ← immutable PDFs when available
  derived/        ← audits, import payload, coverage/gap reports
```

## Structured PostgreSQL layer

Migration: `004_historical_rfp.sql`

| Table | Purpose |
|---|---|
| `historical_rfp_documents` | One row per historical RFP (manifest metadata, hashes, PDF flag, eval eligibility) |
| `historical_question_answers` | Q&A rows (canonical + Suggested Additions) with REFERENCE provenance |

Commands:

```bash
npm run db:migrate
npm run historical:import    # extract Excel → upsert (idempotent)
npm run historical:check
npm run historical:report    # coverage + GAP_REPORT.md
npm run validate:historical
```

Import never writes `projects`, `project_facts`, `messages`, `project_runtime`, or `project_section_contents`.

Noncanonical Suggested Addition IDs (`13.x`–`17.x`) use collision-safe keys:

`{historicalRfpId}::{sheet}::{sourceQuestionId}`

## Golden evaluation

- `GoldenRfpCase` + question/field coverage reports in `src/server/rami/goldenEvaluation.ts`
- Extraction evaluation **contract** ready (no Qwen/Modal runs in this layer)
- Query helpers (structured SQL only): `src/server/rami/historicalQuery.ts` — **not RAG**

## How to add another historical RFP

1. Add Excel under `source/excel/` (and PDF under `source/pdf/` if available).  
2. Update manifest builder / `manifest.json`.  
3. `npm run historical:import`  
4. `npm run validate:historical`  
5. Never import into `project_facts`.

## Status

- Resource library: **7** datasets  
- Structured import: **yes** (`7` docs, `434` canonical QA, `127` suggested)  
- Golden evaluation foundation: **yes**  
- RAG / embeddings / pgvector: **NOT IMPLEMENTED**
