# START HERE — Rami

**READ THIS FIRST** on a new machine or new Cursor session.

Do not treat root `README.md` as authoritative for architecture or handoff.

## Reading order (required)

1. **This file** — `START_HERE.md`
2. `CURRENT_STATE.md` — what is implemented now
3. `DECISIONS.md` — non-negotiable architecture rules
4. `NEXT_STEPS.md` — what to do next (do not auto-start)
5. Only then inspect implementation files as needed

## A. Authoritative Git checkpoint

After `git pull origin main`, verify:

```bash
git rev-parse HEAD
git rev-parse origin/main
```

These must match. The checkpoint commit message begins with `feat(rami): complete AI-assisted RFP workspace checkpoint`.

**Historical base before Phases 1–5:** `0a79af4fb6e7317daa34100f8d1afa992cb8017f`  
**Current tip:** see `git log -1` after pull (includes Phases 1–5 + refreshed shared DB snapshot).

## B. What RAMI is

RAMI is an AI-assisted BA/RFP workspace. **Qwen3 8B** handles language only. **TypeScript** owns workflow, persistence, readiness, generation gates, and trust boundaries.

- **PostgreSQL** is authoritative for project state
- **ProjectFacts** are business truth; document prose is separate
- **Question ≠ Field** (69 Questions, 59 Fields, 20 Sections)
- **Local Ollama** and **Modal GPU** are interchangeable behind `RamiModelProvider`

## C. Current product milestone (Phases 1–5 complete)

| Capability | Status |
|---|---|
| PostgreSQL persistence | **Yes** — migrations through `007` |
| Canonical model | **20** Sections · **59** Fields · **69** Questions |
| Workspace dashboard (PostgreSQL-backed) | **Yes** |
| Interview + Project Understanding | **Yes** — Phases A1–A2, B2 |
| RFP generation + versioning | **Yes** |
| Edit with Rami (AI section edit) | **Yes** — Phase 4 |
| Manual structured section editor | **Yes** — Phase 5 |
| Section version history + restore-as-new-version | **Yes** — Phase 5 |
| Delete RFP from dashboard | **Yes** — Phase 5 |
| Full RFP preview + DOCX export | **Yes** |
| Historical library + offline RAG (732 chunks) | **Yes** — `REAL[]`, pgvector deferred |
| Controlled chat REFERENCE → PROPOSED → CONFIRM | **Yes** |
| Generation-time drafting references | **Yes** — BA-approved, section-scoped only |
| Engine panel (Start/Stop/Extend, timers, dismiss) | **Yes** — Phases 1–2, 5 |
| Collapsible desktop sidebar | **Yes** — Phases 2–3 |

**URLs (local dev):**  
- Workspace: `http://localhost:3000/workspace`  
- Demo project: `http://localhost:3000/documents/rami-gen-core-demo/interview`

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
npm run validate:shared-dump
```

Then read `CURRENT_STATE.md` and `NEXT_STEPS.md`.

Private backups (`npm run db:backup` → `.rami-db-backups/`) are **gitignored**.

**Note:** Each machine may use a different PostgreSQL port — set `RAMI_DB_PORT` in `.env.local` accordingly.

## E. Modal (machine-local, not in Git)

Modal credentials and `.venv-modal` are **not committed**.

Existing deployed resources (reuse — do not redeploy unless required):

| Item | Value |
|---|---|
| App | `rami-qwen-poc` |
| Class | `QwenInfer` |
| Model | `qwen3:8b` |
| GPU | T4 |
| Volume | `rami-qwen-poc-ollama` |

Use product **Start Rami / Stop Rami** in the UI. Set `RAMI_MODEL_PROVIDER=modal` in `.env.local` when using Modal.

## F. Run and validate

```bash
npm run dev          # single dev server only — avoid parallel dev+build on .next
npm run validate:ui-phase-b1
npm run validate:ui-phase-b2
npm run validate:ui-phase-b3
npm run validate:edit-with-rami
npm run validate:ui-phase-b5
npm run validate:manual-editor-versioning
npm run validate:project-delete
npm run validate:document-experience
npm run validate:rfp-generation
npx tsx scripts/final-handoff-integration.ts
```

## G. Known limitations

- pgvector not installed (corpus small; `REAL[]` acceptable)
- No production auth / deployment
- Golden End-to-End RFP evaluation **not yet run** — see `NEXT_STEPS.md`
- Shared dump = development handoff checkpoint, **not** production backup

## H. Exact next task

**Golden End-to-End RFP evaluation** — do not start automatically. See `NEXT_STEPS.md`.
