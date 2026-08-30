# START HERE — Rami

Read this first in a new Cursor session or on a second machine.

## Current baseline

- **Authoritative git**: `origin/main` (this work started from `e24fc68`; after pull, `git log -1` should show the Section Readiness foundation commit)
- **Product phase**: Conversational RFP workspace + PostgreSQL persistence + **Section Readiness foundation**
- **Do not start**: actual RFP section generation, A4 prose, Approve/Regenerate, DOCX, RAG, pgvector, fine-tuning, Phase 2.3 catalogs

## Fully complete

- Phase 1 local AI (Ollama + `qwen3:8b`)
- Phase 2 / 2.1 conversational workspace (bilingual, applicability, users norm)
- Phase 2.2 Adaptive Control Plane (ProjectContext, packs, GapStatus, NextAction)
- LocalModelProvider + ModalModelProvider (real Modal streaming; chat does not auto-start GPU)
- PostgreSQL persistence **live-validated** (Map = cache, localStorage = UI cache)
- Spoken-TBC normalization
- Deterministic Section Readiness engine (information readiness only)

## Architecture in one screen

| Layer | Owner |
|---|---|
| Language / extraction JSON | Qwen3 8B via Local or Modal provider |
| Workflow, gaps, packs, readiness | Deterministic TypeScript |
| Project truth | PostgreSQL (`rami_ai`, this laptop port **5433**) |
| Runtime facts | `ProjectMemory` (52 fields) hydrated from `project_facts` |
| Control plane | `ProjectContext` (persisted classifiers; packs/gaps recomputed) |

Canonical counts: **20** RFP sections, **52** ProjectMemory fields, **62** questions, **59** QuestionFields, **68** section_fields links.

## PostgreSQL

Live-validated. Config in `.env.local` only (`RAMI_DB_*`, never `NEXT_PUBLIC_`).  
`npm run db:migrate && npm run db:seed && npm run db:check`  
Restore only into a separate DB (e.g. `rami_ai_restore_test`).

## Modal

Optional paid GPU. Default `RAMI_MODEL_PROVIDER=local`. Do not auto-start GPU on chat.

## Current limitations

- No RFP prose generation yet
- 52 fields do not fully cover PMO / manpower / admin procurement detail (documented gaps)
- A4 preview is still a placeholder shell
- No BA CONFIRMED promotion UI
- Spoken-TBC is English-focused whole-value matching

## Exact current task (this commit)

RFP generation **foundation**: TBC normalization + Field↔Section mapping + Section Readiness + generation contract (design only).

## Exact next task

**First section generation** for one applicable `READY_TO_DRAFT` or `DRAFTABLE_WITH_TBC` section, using the contract in `rfp-section-readiness.md`. Do not start until the human asks.

## Deeper documents

See reading order below. Do not treat `README.md` as authoritative.

---

## FOR A NEW CURSOR SESSION / SECOND MACHINE

Exact reading order:

1. `.private-context/handoff/START_HERE.md` (this file)
2. `.private-context/handoff/CURRENT_STATE.md`
3. `.private-context/handoff/DECISIONS.md`
4. `.private-context/handoff/NEXT_STEPS.md`
5. `.private-context/architecture/rfp-section-readiness.md`
6. Relevant architecture as needed:
   - `.private-context/architecture/postgresql-persistence.md`
   - `.private-context/architecture/adaptive-question-architecture.md`
   - `.private-context/architecture/rfp-generation-architecture.md` (lifecycle; not yet implemented)
   - `.private-context/architecture/local-ai-deployment.md`

Reproduce-and-run only (no code changes): `.private-context/handoff/SECOND_MACHINE_HANDOFF.md`
