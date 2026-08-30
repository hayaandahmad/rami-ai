# START HERE — Rami

Read this first in a new Cursor session or on a second machine.

Do not treat `README.md` as authoritative.

## A. Authoritative commit

After pull, these must be equal:

```text
git rev-parse HEAD
git rev-parse origin/main
```

Last **feature** milestone (RFP Generation Core backend):

```text
git log -1 --oneline
# expect: feat: implement RFP generation core backend
```

`git log -1` on a clean `origin/main` is the current authoritative HEAD.

## B. Product goal

RAMI is an AI-assisted BA/RFP workspace. Qwen3 8B is language only. TypeScript owns workflow, persistence, readiness, and generation gates.

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
- **RFP Generation Core (backend)** — contract, context builder, readiness gates, persistence, regenerate, approve, assemble APIs

## D. NOT implemented

- A4 preview still a **placeholder shell** (`DocumentPreviewShell`) — does not yet render `GeneratedSection` blocks
- Generate / Regenerate / Edit / Approve **UI** (APIs exist)
- DOCX export
- RAG / pgvector / embeddings
- Fine-tuning / LoRA / Qwen 14B
- Phase 2.3 domain catalogs
- Full RFP with every applicable section generated/approved (pipeline is generalized; not all sections drafted)

## E. Architecture (one screen)

| Layer | Owner |
|---|---|
| Chat wording + extraction JSON + section prose | Qwen3 8B via `RamiModelProvider` (`local` or `modal`) |
| Gaps, packs, readiness, provenance, generation gates | Deterministic TypeScript |
| Project truth | PostgreSQL (`project_facts`) |
| Generated document prose | PostgreSQL (`project_section_contents`) |
| Runtime facts | `ProjectMemory` (52 fields) |
| Control plane | `ProjectContext` (classifiers persisted; `activePacks` recomputed) |

Question ≠ Field. One Field may map to many Sections (`section_fields`). Historical RFP files in Git are **reference**, never current ProjectFacts.

## F. PostgreSQL

Live-validated. Server-only `.env.local` (`RAMI_DB_*`, never `NEXT_PUBLIC_`).  
Database name must be `rami_ai`. Port may differ by machine (this handoff machine used `127.0.0.1:5432`).

Git **does** contain a portable **development** snapshot:

```text
dev/database/rami_ai_shared.dump
```

Includes migration `003_project_section_contents.sql`, demo project `rami-gen-core-demo`, and generated Background + Scope drafts.

Second machine:

```text
npm run db:restore-shared -- --confirm-replace-local-rami-ai
npm run db:check
npm run db:migrate   # no-op if snapshot already applied 003
```

## G. Modal

Optional paid GPU. Default `RAMI_MODEL_PROVIDER=local`. Do not auto-start GPU on chat. Do not burn credits for docs or unit tests.

## H. RFP generation / readiness

Information readiness **and** prose generation are implemented.

Readiness states: `NOT_APPLICABLE` | `NOT_READY` | `DRAFTABLE_WITH_TBC` | `READY_TO_DRAFT`.  
Qwen must not decide readiness. See `rfp-section-readiness.md` + `rfp-generation-architecture.md`.

Generation approval statuses: `DRAFT` | `APPROVED` (document workflow — not readiness).

## I. UI / backend contract (for first developer)

| Action | Endpoint |
|---|---|
| Get section readiness + current generated content | `GET /api/rami/generation/section?documentKey=&sectionId=` |
| Generate / regenerate section | `POST /api/rami/generation/section` body `{ documentKey, sectionId, regenerate?, reopenApproved? }` |
| Approve current section content | `POST /api/rami/generation/approve` body `{ documentKey, sectionId }` |
| List generated sections + assembled RFP | `GET /api/rami/generation/document?documentKey=` |

Structured content shape: `GeneratedSection` in `src/types/generatedSection.ts` (`blocks`: heading / paragraph / bullet_list / numbered_list / table / tbc).

Demo document key with proven Background + Scope: **`rami-gen-core-demo`**.

## J. Exact next implementation task

**RFP document experience / UI** — wire A4 preview to `GeneratedSection`, Generate/Regenerate/Approve controls, section navigation, visual TBC, then DOCX if contract stays stable.

See `NEXT_STEPS.md`.

## K. Reading order

1. `.private-context/handoff/START_HERE.md` (this file)
2. `.private-context/handoff/CURRENT_STATE.md`
3. `.private-context/handoff/DECISIONS.md`
4. `.private-context/handoff/NEXT_STEPS.md`
5. `rfp-generation-architecture.md`, `rfp-section-readiness.md`, `postgresql-persistence.md`
6. Inspect: `src/types/generatedSection.ts`, `src/server/rami/sectionGeneration.ts`, `src/app/api/rami/generation/`

---

## NEW MACHINE / NEW CURSOR SESSION

1. `git status` → fetch → `git pull --ff-only origin main`
2. Verify clean tree and `HEAD == origin/main`
3. Read this file → CURRENT_STATE → DECISIONS → NEXT_STEPS
4. `.env.local` with `RAMI_DB_*` (loopback, `RAMI_DB_NAME=rami_ai`, local password)
5. `npm run db:restore-shared -- --confirm-replace-local-rami-ai` → `npm run db:check`
6. Continue from `NEXT_STEPS.md` (UI / A4 preview)

---

## BEFORE HANDING BACK TO ANOTHER DEVELOPER

1. Run tests including `validate:rfp-generation`
2. Update handoff docs
3. Commit (never `.env.local` / passwords / Modal secrets / `.rami-db-backups/`)
4. Push `origin/main`; verify HEAD == origin/main; clean tree
5. Tell the next developer the **exact final commit hash**
