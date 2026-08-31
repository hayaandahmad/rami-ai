# Rami — Current Implementation State
Last updated: 2026-08-31 (full GitHub consolidation + shared DB snapshot refresh)

Authoritative HEAD: `origin/main` (`git log -1`). Shared snapshot refresh: `ff11a1cb7fa84c07bca7c77067f7bcb6ca8f69c3`.

## Runtime truth

### Persistence
- PostgreSQL is authoritative for live project state
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

### Controlled RAG (live chat)
- Policy-gated retrieval only
- REFERENCE → PROPOSED (`historical_field_proposals`) → BA CONFIRM → ProjectFact
- Pending proposals never write `project_facts`

### Generation-time RAG
- BA **Use as drafting reference** → `project_generation_references`
- Section-scoped; never auto-retrieve on Generate / assemble / DOCX
- Never writes ProjectFacts; never changes readiness/gap semantics

### Shared snapshot validation
- `npm run validate:shared-dump` — TOC + metadata SHA
- `npm run db:verify-shared-restore` — isolated restore into `rami_ai_shared_restore_test` (live `rami_ai` untouched)

## Next
Optional pgvector when the corpus grows. Do not start productionization or training.
