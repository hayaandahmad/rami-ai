# Historical RFP Resource Library

Location: `resources/historical-rfps/`

## What these files are

Excel workbooks that map **RAMI’s historical 62-question Question Bank** (groups 0–12) to answers extracted from **real historical MoDEE / government RFPs** (and pre-qualification documents), including **Status** and **Source (RFP)** page references where available.

The live canonical Question Bank is now **69** questions (`18.1`–`18.7` added). Workbooks were **not** rewritten. Promoted Field mappings are applied deterministically at import.

Optional **original RFP PDFs** live beside the Excel files when supplied.

## Why RAMI keeps them

- **REFERENCE** — examples of how real RFPs answer RAMI questions  
- **EVALUATION** — golden sets for coverage / extraction / retrieval checks  
- **RAG_CANDIDATE** — offline retrieval foundation (live agent injection **not** implemented)

They are **not** live project state.

## Hard rules

| These are | These are NOT |
|---|---|
| Historical / reference resources | Current `ProjectFacts` |
| Source artifacts under `source/` | Model training data |
| Structured PostgreSQL historical tables | Live chat prompt context |
| Offline RAG chunks + embeddings | Auto-injected generation context (Generate never retrieves) |

**Historical answer ≠ current project truth.**  
Provenance class is always `REFERENCE`.

## Layout

```text
resources/historical-rfps/
  README.md
  manifest.json
  source/excel/   ← immutable workbooks
  source/pdf/     ← immutable PDFs when available
  derived/        ← audits, coverage/gap reports, retrieval-eval-report.json
```

## Structured PostgreSQL layer

Migration: `004_historical_rfp.sql`

| Table | Purpose |
|---|---|
| `historical_rfp_documents` | One row per historical RFP |
| `historical_question_answers` | Q&A rows (canonical + Suggested Additions), REFERENCE |

```bash
npm run historical:import
npm run historical:check
npm run validate:historical
```

## RAG foundation (offline)

Migration: `005_historical_rag_chunks.sql`

| Table | Purpose |
|---|---|
| `historical_knowledge_chunks` | Deterministic chunks + structured metadata |
| `historical_chunk_embeddings` | Versioned vectors (`REAL[]` until pgvector) |
| `historical_rag_runtime` | Capability flags (e.g. pgvector status) |

### Chunk types

| Type | Source | Use |
|---|---|---|
| `QUESTION_ANSWER` | One historical Q&A row | Field/question examples |
| `SECTION` | Canonical answers grouped by Question Bank section (split if long) | Writing patterns / section examples |
| `MULTI_QA_TOPIC` | Suggested packs + procurement-gap themes | Cross-question topics |

Metadata (Field/Question/Section IDs, provenance, locators) is stored in columns — **not** only inside `chunk_text`.

### Embedding model

| Item | Value |
|---|---|
| Model | `nomic-embed-text` (Ollama) |
| Dims | 768 |
| Version | `nomic-embed-text-v1.5-ollama-prefixed` |
| License | Apache-2.0 |
| Size | ~274 MB |
| Why | Local embedding model; not chat LLM; no paid API |

Prefixes: `search_document:` / `search_query:`. Input truncated for model context; full text remains in DB.

### Commands

```bash
npm run historical:chunks              # rebuild deterministic chunks
npm run historical:embed               # embed (explicit; not on install/build)
npm run historical:retrieve -- "query" # smoke retrieval CLI
npm run historical:evaluate-retrieval  # structured vs vector vs hybrid
npm run validate:rag
```

### Retrieval

`retrieveHistoricalReferences(query, options)` supports `structured` | `vector` | `hybrid`, Field/Section/Question filters, leave-one-RFP-out exclusion.

Returns `HistoricalReference` with score, chunk text, RFP identity, mappings, provenance=`REFERENCE`.

### Controlled live integration

| Rule | Behavior |
|---|---|
| Trigger | Explicit example / past-RFP / guidance+field focus only — **not** every chat turn |
| Mode | Structured-first when Field/Section IDs known; hybrid for free-text |
| UI | Historical reference cards labeled **REFERENCE — not this project** |
| PROPOSED | `historical_field_proposals` PENDING — does **not** write `project_facts` |
| Accept | BA confirm → `CONFIRMED` ProjectFact + historical lineage |
| Reject | No ProjectFact; blocks same chunk+field re-propose |
| Generation RAG | **BA-approved section drafting references only — no silent retrieve** |
| procurementStage | Weak leave-one-out; **not** a canonical Field |

```bash
npm run validate:controlled-rag
```

### pgvector status

Local PostgreSQL 18 does **not** have the `vector` extension available.

**Developer install (Windows) when ready:**

1. Obtain a pgvector build matching PostgreSQL 18 (same major version as the running server).
2. Install extension files into the PostgreSQL `lib` / `share/extension` directories.
3. As a superuser: `CREATE EXTENSION vector;`
4. Then add a follow-up migration to move `REAL[]` → `vector(768)` and add an HNSW/IVFFlat index.

Until then, RAMI uses `REAL[]` + app-side cosine similarity (still PostgreSQL — not a separate vector DB).

### Eval snapshot (7 RFPs)

See `derived/retrieval-eval-report.json`. Aggregate Hit@8 ≈ **0.93** for all three modes; structured leads MRR when IDs are known; hybrid is used for free-text live requests; vector-only ranks weakest. Gap topics mostly retrieve; leave-one-out `procurementStage` is weak.

## How to add another historical RFP

1. Add Excel under `source/excel/` (and PDF under `source/pdf/` if available).  
2. Update manifest.  
3. `npm run historical:import`  
4. `npm run historical:chunks && npm run historical:embed`  
5. `npm run validate:historical && npm run validate:rag && npm run validate:controlled-rag && npm run validate:generation-rag`  
6. Never import into `project_facts`.

## Status

- Resource library: **7** datasets  
- Structured import: **yes**  
- Canonical model after evidence pass: **59 Fields / 69 Questions / 20 Sections**  
- RAG foundation + retrieval eval: **yes** (offline)  
- Controlled live REFERENCE/PROPOSED/CONFIRM: **yes**  
- Generation-time RAG: **BA-approved, section-scoped drafting references** (`project_generation_references`)
- Silent retrieval on Generate / assemble / DOCX: **no**
- Eval fixture: `derived/generation-rag-eval.json`
- Shared development DB snapshot (`dev/database/rami_ai_shared.dump`) includes historical docs, Q&A, chunks, embeddings, proposals, and generation references so a second machine can restore without re-embedding unless intentionally required.
