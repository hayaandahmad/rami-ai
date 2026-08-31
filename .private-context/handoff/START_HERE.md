# START HERE — Rami

Read this first in a new Cursor session or on a second machine.

Do not treat `README.md` as authoritative.

## A. Authoritative commit

After pull, these must be equal:

```text
git rev-parse HEAD
git rev-parse origin/main
```

Expected after this consolidation:

```text
ff11a1cb7fa84c07bca7c77067f7bcb6ca8f69c3
```

(`git log -1` on `origin/main` after pull.)

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

Demo: `http://localhost:3000/documents/rami-gen-core-demo/interview`

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
- Live LLM “quality looks better” eval for generation-RAG is mock-validated; optional local Ollama compare later
- No production auth / deployment
- Historical Suggested Additions (127) remain REFERENCE unless a future evidence pass promotes them

## G. Exact next task

Optional **pgvector** only if corpus/latency requires it. Do **not** start productionization, training, or another Field expansion. See `NEXT_STEPS.md`.
