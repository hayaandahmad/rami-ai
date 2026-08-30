# Rami — Current Implementation State
Last updated: 2026-08-31 (RAG retrieval foundation)

Authoritative HEAD: `origin/main` (`git log -1`).

## Runtime truth

### Live demo
- `rami-gen-core-demo`: 12 generated sections, DOCX, TBC commercial/legal — unchanged by historical RAG

### Historical structured data
- Migration `004_historical_rfp.sql`
- Tables: `historical_rfp_documents`, `historical_question_answers`
- Counts: **7** docs · **434** canonical QA · **127** suggested additions
- Provenance class always `REFERENCE`

### Historical RAG foundation (offline)
- Migration `005_historical_rag_chunks.sql`
- Tables: `historical_knowledge_chunks`, `historical_chunk_embeddings`, `historical_rag_runtime`
- Chunks: **732** (`QUESTION_ANSWER` 561 · `SECTION` 110 · `MULTI_QA_TOPIC` 61)
- Embeddings: **732** × 768-d via Ollama `nomic-embed-text` (version `nomic-embed-text-v1.5-ollama-prefixed`)
- Storage: `REAL[]` + app-side cosine (**pgvector not installed** on local PG 18)
- Service: `retrieveHistoricalReferences` → `HistoricalReference` (REFERENCE only)
- Eval: `npm run historical:evaluate-retrieval` → `derived/retrieval-eval-report.json`
- Live chat / generation: **not wired**

### Boundary
Chunk/embed/evaluate do not mutate `projects` / `project_facts` / `messages` / `project_runtime` / `project_section_contents`.

## Phase status
- Generation / document UI / DOCX: ✅
- Historical resource library: ✅
- Historical PostgreSQL + golden foundation: ✅
- RAG chunking + hybrid retrieval + eval: ✅ (offline)
- Live RAG integration: ❌
- Field-model expansion: ⏳ decide from gap evidence later

## Next
Controlled integration of `HistoricalReference` into Rami (REFERENCE suggestions only). No automatic ProjectFact writes.
