# Rami — Current Implementation State
Last updated: 2026-08-31 (UI Phase A1 — workspace truth + engine control)

Authoritative HEAD: `origin/main` (`git log -1`).

## Runtime truth

### Persistence
- PostgreSQL is authoritative for live project state
- **Dashboard / workspace UI** loads projects from `GET /api/rami/workspace` (no frontend mock registry)
- **Create New Document** persists via `POST /api/rami/projects` → routes to `/documents/{documentKey}/interview`
- Git tracks a **logical** development snapshot only:
  - `dev/database/rami_ai_shared.dump`
  - `dev/database/rami_ai_shared.metadata.json`
- Git does **not** contain the live PostgreSQL server or passwords
- Each machine runs PostgreSQL locally and restores the shared dump
- Private dumps: `npm run db:backup` → `.rami-db-backups/` (gitignored)

### Migrations
Latest: **`007_project_generation_references.sql`**

Applied set: `001` … `007` (7 migrations).

### Information model (DB + code)
| Item | Count |
|---|---:|
| Sections | 20 |
| Fields | 59 |
| Questions | 69 |
| QuestionFields | 66 |
| SectionFields | 78 |

### Live development DB inventory (safe counts at snapshot time)
| Table / metric | Count |
|---|---:|
| projects | 7 |
| project_facts | 61 |
| messages | 14 |
| project_section_contents | 39 |
| historical_rfp_documents | 7 |
| historical_question_answers | 561 |
| historical_knowledge_chunks | 732 |
| historical_chunk_embeddings | 732 |
| historical_rag_runtime | 1 |
| historical_field_proposals | 7 (6 ACCEPTED, 1 REJECTED) |
| project_generation_references | 2 (1 ACTIVE, 1 REVOKED) |

Embeddings: `nomic-embed-text` / `nomic-embed-text-v1.5-ollama-prefixed` / 768-d / `REAL[]`.

### Demo / proof projects
- `rami-gen-core-demo` — generated RFP + DOCX
- `rami-model-expansion-demo` — 59-field conversational proof
- `rami-gen-rag-demo` — generation-reference proof (Deliverables)
- `rami-rag-controlled-demo` — controlled chat RAG
- `rami-persist-accept-20260830` — persistence acceptance fixture
- `rami-rag-live-eval` — live Qwen A/B generation-RAG quality validation (4 cases)

### Controlled RAG (live chat)
- Policy-gated retrieval only
- REFERENCE → PROPOSED (`historical_field_proposals`) → BA CONFIRM → ProjectFact
- Pending proposals never write `project_facts`

### Generation-time RAG
- BA **Use as drafting reference** → `project_generation_references`
- Section-scoped; never auto-retrieve on Generate / assemble / DOCX
- Never writes ProjectFacts; never changes readiness/gap semantics
- **Mock safety**: `npm run validate:generation-rag` (14/14)
- **Live Qwen quality** (2026-08-31): `npm run validate:generation-rag-live` — 4 A/B cases, ollama-local / qwen3:8b, decision gate **B** (safe; quality benefit unclear). Artifact: `resources/historical-rfps/derived/generation-rag-live-eval.json`
- Eval project: `rami-rag-live-eval` (separate from `rami-gen-core-demo`)

### Shared snapshot validation
- `npm run validate:shared-dump` — TOC + metadata SHA
- `npm run db:verify-shared-restore` — isolated restore into `rami_ai_shared_restore_test` (live `rami_ai` untouched)

### Workspace / engine UI (Phase A1)
- `/workspace` — hero, real metrics, Recent Documents, Supported Document Types (last)
- Rami floating control — collapsed drag without opening panel; provider-aware panel
- Local Ollama: health/reachability only; no Modal billing
- Modal: Start/Stop/Extend; session telemetry only; account billing not exposed via API

Validation: `npm run validate:ui-phase-a1`

## Next
Golden End-to-End RFP evaluation. Optional pgvector when the corpus grows.
