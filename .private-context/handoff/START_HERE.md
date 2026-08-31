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

These must match. The current checkpoint commit message begins with `feat(rami): harden generic RFP extraction and document assembly`.

**Historical base before this corrective tree:** `dcc7f6baf6ab6af90d9c40ca9183c7bb154dbc58`  
**Current tip:** see `git log -1` after pull.

## B. What RAMI is

RAMI is an AI-assisted BA/RFP workspace. **Qwen3 8B** handles language only. **TypeScript** owns workflow, persistence, readiness, generation gates, and trust boundaries.

- **PostgreSQL** is authoritative for project state
- **ProjectFacts** are business truth; document prose is separate
- **Question ≠ Field** (70 Questions, 60 Fields, 20 Sections)
- **`issuerEntity` is not `beneficiaryEntity`** — issuing / procuring organization vs beneficiary
- **Local Ollama** and **Modal GPU** are interchangeable behind `RamiModelProvider`

## C. Current product milestone

| Capability | Status |
|---|---|
| PostgreSQL persistence | **Yes** — migrations through `007` |
| Canonical model | **20** Sections · **60** Fields · **70** Questions |
| Generic extraction hardening | **Yes** — issuer / beneficiary / users / audience separated |
| Deterministic Cover Page | **Yes** — metadata + TBC; `issuerEntity` drives Issued by |
| Deterministic Table of Contents | **Yes** |
| Standard Annex pack | **Yes** — titles + placeholders; form bodies not stored yet |
| AI-generated Introduction | **Yes** — from who / what / why ProjectFacts |
| Clean Full RFP / DOCX | **Yes** — no internal `[not generated]` document text |
| Workspace dashboard (PostgreSQL-backed) | **Yes** |
| Interview + Project Understanding | **Yes** — Phases A1–A2, B2 |
| RFP generation + versioning | **Yes** |
| Edit with Rami (AI section edit) | **Yes** — Phase 4 |
| Manual structured section editor | **Yes** — Phase 5 |
| Section version history + restore-as-new-version | **Yes** — Phase 5 |
| Delete RFP from dashboard | **Yes** — Phase 5 |
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

The snapshot includes the seeded catalog: **20 Sections · 60 Fields · 70 Questions** including `issuerEntity`. Restore does not require a hidden manual SQL fix.

```bash
git pull
npm install
# Copy .env.example → .env.local; set RAMI_DB_* (loopback host; RAMI_DB_NAME=rami_ai)
# Password stays only in .env.local — never commit it
npm run db:restore-shared -- --confirm-replace-local-rami-ai
npm run db:check
npm run historical:check
npm run validate:shared-dump
```

Then read `CURRENT_STATE.md` and `NEXT_STEPS.md`.

Private backups (`npm run db:backup` → `.rami-db-backups/`) are **gitignored**.

**Note:** Each machine may use a different PostgreSQL port — set `RAMI_DB_PORT` in `.env.local` accordingly. Do not hardcode port or password.

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

Use product **Start Rami / Stop Rami** in the UI. Set `RAMI_MODEL_PROVIDER=modal` in `.env.local` when using Modal. Leave Modal **OFF** unless a live generation check needs it.

## F. Run and validate

```bash
npm run dev          # single dev server only — avoid parallel dev+build on .next
npm run db:check
npm run historical:check
npm run validate:golden-readiness-structural
npm run validate:standard-annex-pack
npm run validate:section-readiness
npm run validate:phase1
npm run validate:phase2-adaptive
npm run validate:shared-dump
npm run validate:edit-with-rami
npm run validate:manual-editor-versioning
npm run validate:project-delete
npx tsx scripts/final-handoff-integration.ts
```

## G. Known limitations

- pgvector not installed (corpus small; `REAL[]` acceptable)
- No production auth / deployment
- Standard Annex **titles and placeholders** exist; reusable form **bodies/files are not stored**
- Deterministic Cover/TOC/Annexes are assembled automatically; persisted structural version history remains deferred
- Golden End-to-End RFP evaluation **not yet completed as a BA journey** — see `NEXT_STEPS.md`
- Shared dump = development handoff checkpoint, **not** production backup

## H. Exact next task

**Golden End-to-End RFP evaluation** — do not start automatically. See `NEXT_STEPS.md`.
