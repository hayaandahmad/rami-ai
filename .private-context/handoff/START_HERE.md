# START HERE — Rami

Read this first in a new Cursor session or on a second machine.

Do not treat `README.md` as authoritative.

## A. Authoritative commit

After pull, these must be equal:

```text
git rev-parse HEAD
git rev-parse origin/main
```

Shared DB snapshot refresh commit: `ff11a1cb7fa84c07bca7c77067f7bcb6ca8f69c3`  
(Current `origin/main` tip may include small handoff-doc follow-ups after that.)

## B. Product goal

RAMI is an AI-assisted BA/RFP workspace. Qwen3 8B is language only. TypeScript owns workflow, persistence, readiness, and generation gates.

## C. Current product milestone (2026-08-31)

| Capability | Status |
|---|---|
| PostgreSQL authoritative persistence | **Yes** — migrations through `007` |
| Canonical model | **20** Sections · **59** Fields · **69** Questions |
| RFP section generation + versioning | **Yes** |
| Full RFP preview + DOCX export | **Yes** |
| Historical library (7 Excel + 4 PDF) | **Yes** |
| Offline RAG (732 chunks + embeddings) | **Yes** — `REAL[]`, pgvector **not** installed |
| Controlled chat REFERENCE → PROPOSED → CONFIRM | **Yes** |
| Generation-time RAG | **Yes** — BA-approved, section-scoped only |
| Silent retrieval on Generate / DOCX | **No** |
| Auto ProjectFact from history | **No** |
| Workspace dashboard (PostgreSQL-backed) | **Yes** — UI Phase A1 |
| Project workspace BA UX | **Yes** — UI Phase A2 (progress, understanding, human blockers) |

Workspace: `http://localhost:3000/workspace`  
Demo: `http://localhost:3000/documents/rami-gen-core-demo/interview`  
Live RAG eval project: `rami-rag-live-eval` (see `generation-rag-live-eval.json`)

## D. Second-machine restore (required)

Git contains a **portable development snapshot**, not a live PostgreSQL server.

```text
dev/database/rami_ai_shared.dump
dev/database/rami_ai_shared.metadata.json
```

```bash
# 1. Install PostgreSQL locally; create a role that can create databases
# 2. Copy .env.example → .env.local; set RAMI_DB_* (loopback host; RAMI_DB_NAME=rami_ai)
#    Password stays only in .env.local — never commit it
npm install
npm run db:restore-shared -- --confirm-replace-local-rami-ai
npm run db:check
npm run historical:check
npm run validate:generation-rag
```

Then read this file and `NEXT_STEPS.md`.

Private backups (`npm run db:backup` → `.rami-db-backups/`) are **gitignored**.

## E. Canonical information model

| Item | Count |
|---|---:|
| Canonical Fields | **59** |
| Canonical Questions | **69** |
| Canonical Sections | **20** |

`procurementStage` is **not** a Field. It remains `ProjectContext.documentStage`.

## F. Known limitations

- pgvector not installed (corpus small; `REAL[]` acceptable)
- Live generation-RAG **mock safety** validated (`npm run validate:generation-rag`); **live Qwen quality** validated separately (`npm run validate:generation-rag-live`, 2026-08-31, ollama-local / qwen3:8b, gate **B** — safe, quality benefit unclear)
- No production auth / deployment
- Historical Suggested Additions (127) remain REFERENCE unless a future evidence pass promotes them

## G. Exact next task

**Golden End-to-End RFP evaluation** (do not start automatically from this continuation). Then optional **pgvector** only if corpus/latency requires it. Do **not** start productionization, training, or another Field expansion. See `NEXT_STEPS.md`.
