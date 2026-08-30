# START HERE — Rami

Read this first in a new Cursor session or on a second machine.

Do not treat `README.md` as authoritative.

## A. Authoritative commit

After pull, these must be equal:

```text
git rev-parse HEAD
git rev-parse origin/main
```

Last **feature** milestone (Section Readiness; no prose generation):

```text
cd69fb55e0acd611abb26fa1550dc79e11008406
feat: add deterministic RFP section readiness foundation
```

This handoff documentation sits on `main` after that commit. `git log -1` on a clean `origin/main` is the current authoritative HEAD.

## B. Product goal

RAMI is an AI-assisted BA/RFP workspace. Qwen3 8B is language only. TypeScript owns workflow, persistence, readiness, and (next) generation gates.

## C. Fully completed

- Local Ollama `qwen3:8b` + `LocalModelProvider`
- `ModalModelProvider` + Start/Stop/status + real streaming (chat does **not** auto-start GPU)
- PostgreSQL 18 live persistence (authoritative project store)
- `ProjectMemory` hydration from `project_facts`
- `ProjectContext` classifier snapshot persist + packs/gaps recomputed after hydrate
- Server `Map` = cache only; `localStorage` = UI cache only
- 20 canonical RFP sections, 52 Fields, 62 Questions, 59 QuestionFields, 68 `section_fields`
- Spoken-TBC normalization (English whole-value)
- Deterministic Section Readiness (`getSectionReadiness`)

## D. NOT implemented

- Actual RFP **prose** generation (`generateRfpSection` does not exist)
- Persistent generated-section **content** (no GeneratedSection table/payload)
- A4 preview still a **placeholder shell** (`DocumentPreviewShell`)
- Generate / Regenerate / Edit / Approve UI
- Full RFP assembly
- DOCX export
- RAG / pgvector / embeddings
- Fine-tuning / LoRA / Qwen 14B
- Phase 2.3 domain catalogs

## E. Architecture (one screen)

| Layer | Owner |
|---|---|
| Chat wording + extraction JSON | Qwen3 8B via `RamiModelProvider` (`local` or `modal`) |
| Gaps, packs, readiness, provenance | Deterministic TypeScript |
| Project truth | PostgreSQL |
| Runtime facts | `ProjectMemory` (52 fields) |
| Control plane | `ProjectContext` (classifiers persisted; `activePacks` recomputed) |

Question ≠ Field. One Field may map to many Sections (`section_fields`). Historical RFP files in Git are **reference**, never current ProjectFacts.

## F. PostgreSQL

Live-validated. Server-only `.env.local` (`RAMI_DB_*`, never `NEXT_PUBLIC_`).  
This laptop: `127.0.0.1:5433` / database `rami_ai`. Other machines set host/port/name from their install.  
`npm run db:migrate && npm run db:seed && npm run db:check`  
Restore only into a **separate** DB (e.g. `rami_ai_restore_test`).

## G. Modal

Optional paid GPU. Default `RAMI_MODEL_PROVIDER=local`. Do not auto-start GPU on chat. Do not burn credits for docs or unit tests.

## H. RFP generation / readiness

Information readiness is implemented. Generation is **not**.  
States: `NOT_APPLICABLE` | `NOT_READY` | `DRAFTABLE_WITH_TBC` | `READY_TO_DRAFT`.  
Qwen must not decide readiness. See `rfp-section-readiness.md`.

## I. Known limitations

- Coverage gaps (manpower `namedRoles` when that section applies; admin/PMO fields) — documented, not added
- Spoken-TBC is English whole-value matching only
- `EXTRACTED` is not BA `CONFIRMED`
- Other machines need their own `.env.local` + migrate/seed

## J. Exact next implementation task

**RFP GENERATION CORE (backend)** — not RAG, not training, not Phase 2.3, not UI redesign.

See `NEXT_STEPS.md` for the second-developer 4-hour scope and the first-developer UI follow-up.

## K. Reading order

1. `.private-context/handoff/START_HERE.md` (this file)
2. `.private-context/handoff/CURRENT_STATE.md`
3. `.private-context/handoff/DECISIONS.md`
4. `.private-context/handoff/NEXT_STEPS.md`
5. Architecture for the assigned task:
   - Generation core → `rfp-section-readiness.md` then `rfp-generation-architecture.md`
   - Persistence → `postgresql-persistence.md`
   - Asking/gaps → `adaptive-question-architecture.md`
   - Local/Modal runtime → `local-ai-deployment.md`
6. Inspect actual code before editing

Reproduce-and-run only (no feature work): `SECOND_MACHINE_HANDOFF.md`.

---

## NEW MACHINE / NEW CURSOR SESSION

1. `git status`
2. `git fetch origin`
3. `git pull --ff-only origin main`
4. Verify clean tree and `HEAD == origin/main`
5. Read `START_HERE.md`
6. Read `CURRENT_STATE.md`
7. Read `DECISIONS.md`
8. Read `NEXT_STEPS.md`
9. Read the architecture document for the assigned task
10. Inspect actual code before modifying
11. Continue from the exact checkpoint in `NEXT_STEPS.md`

Setup: copy `.env.example` → `.env.local` (no `NEXT_PUBLIC_` DB vars). Local Ollama + `qwen3:8b` for default inference. `npm run db:migrate && npm run db:seed && npm run db:check`.

---

## BEFORE HANDING BACK TO ANOTHER DEVELOPER

1. Run tests (`tsc --noEmit`, lint, `validate:phase1`, `validate:phase2-adaptive`, `validate:modal-integration`, `validate:persistence`, `validate:users-norm`, `validate:section-readiness`; build if you touched app code)
2. Update `START_HERE` / `CURRENT_STATE` / `DECISIONS` / `NEXT_STEPS` as needed
3. Record what is done and what remains
4. Commit (never `.env.local`, dumps, passwords, Modal secrets)
5. Push `origin/main`
6. Verify `origin/main == local main`
7. Verify clean tree
8. Tell the next developer the **exact final commit hash**
