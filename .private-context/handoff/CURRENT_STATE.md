# Rami — Current Implementation State
Last updated: 2026-08-30 (handoff: RFP Generation Core is next)

Authoritative HEAD: `origin/main` after this handoff (`git log -1`).  
Last feature milestone: `cd69fb55e0acd611abb26fa1550dc79e11008406` (Section Readiness).

## New session
Start at `.private-context/handoff/START_HERE.md` only.

`SECOND_MACHINE_HANDOFF.md` / `SECOND_MACHINE_PROMPT_2.md` are reproduce-and-run for the persistence/readiness baseline. They are **not** the next-feature prompt. Next implementation is **RFP Generation Core**.

---

## Runtime truth (must match code)

### PostgreSQL — live-validated
- PostgreSQL **18.6**, this laptop: `127.0.0.1:5433`, database `rami_ai` (other machines set their own host/port/name in gitignored `.env.local`).
- Driver: `pg`. No ORM. Migrations: `001_init.sql` + `002_section_fields.sql`.
- Seed (idempotent): Sections **20**, Fields **52**, Questions **62**, QuestionFields **59**, `section_fields` **68**.
- Authority: PostgreSQL. Server `Map` = cache (`POST /api/rami/cache/clear`). `localStorage` = UI cache; PostgreSQL wins on `GET /api/rami/session`.
- Qwen never gets DB credentials or SQL.
- Restore: never overwrite live `rami_ai` without `--overwrite-live`; use `rami_ai_restore_test`.

### ProjectMemory hydration
- Facts live in `project_facts`. Hydrate: `hydrateProject` → `factRowsToProjectMemory`.
- Missing-project hydrate throws `HYDRATION_FAILED` (does not invent a blank project).
- Spoken-TBC hydrate rewrites stale EXTRACTED `"TBC"` string rows to provenance `TBC` + `value_json=null`.

### ProjectContext
- Classifier snapshot persisted in `project_runtime` (`documentStage`, `contractingGranularity`, `primaryDomain`, `secondaryDomains`, `complexity`, contradictions, intent, language, active section).
- After hydrate, `activePacks` and `collectionSufficient` are **recomputed** (`applyDerivedContext`). They are not the persisted source of truth.

### `project_section_states`
- Persists **lifecycle** records (`SectionLifecycleState`: NOT_STARTED … APPROVED) plus optional `draft_field_snapshot` (field IDs for reopen detection).
- Does **not** store generated RFP prose. Generated-section **content** persistence is **not implemented**.

### Local / Modal
- `RamiModelProvider` with `LocalModelProvider` (default) and `ModalModelProvider`.
- `RAMI_MODEL_PROVIDER=local|modal`. Chat must **not** auto-start GPU. Do not burn Modal credits for docs or unit tests.

### Canonical structure
- 20 sections, 52 fields, 62 questions, 59 question↔field links, 68 section↔field links (many-to-many).
- `fields.section_id` is convenience FK only. Real mapping: `src/schema/sectionFieldMap.ts` seeded to `section_fields`.
- Question ≠ Field. One Field may belong to many Sections. One ProjectFact per Field.

### Spoken TBC
- `src/server/rami/spokenTbc.ts`: whole-value English phrases only (`TBC`, `to be confirmed`, `we don't know yet`, deferrals).
- Stores provenance `TBC`, GapStatus `UNKNOWN`/`DEFERRED`, `collection_state=TBC`, `value_json=null`.
- Does not match letters TBC inside a real answer.

### Section Readiness (information only)
- `getSectionReadiness` in `src/server/rami/sectionReadiness.ts`.
- States: `NOT_APPLICABLE` | `NOT_READY` | `DRAFTABLE_WITH_TBC` | `READY_TO_DRAFT`.
- **Not** the same as `SectionLifecycleState`. Qwen does not decide readiness.
- Scripts: `npm run validate:section-readiness` (13/13), `npm run report:section-readiness`.

### Generated-document status (code authority)
- **Actual RFP prose generation is NOT implemented.** No `generateRfpSection` / `SectionGenerationContext` builder in `src/`.
- **ProjectSections generated-content persistence is NOT implemented.** (`project_section_states` is lifecycle only.)
- **A4 preview does not contain real generated prose.** `DocumentPreviewShell` is a placeholder shell ("Draft pending").
- **DOCX generation is NOT implemented.**

---

## Phase status
- **Phase 1**: ✅ Complete — local AI foundations (commit `dbf362a`)
- **Phase 2**: ✅ Complete — conversational AI workspace
- **Phase 2.1**: ✅ Complete — bilingual polish, section applicability, progress semantics, question priority, users normalization
- **Phase 2.2**: ✅ Complete — Adaptive Control Plane (on `main`)
- **Phase 2.3**: ⏳ Pending — Domain Requirement Catalog Expansion (do not start)
- **Persistence**: ✅ PostgreSQL is the authoritative store (live-validated)
- **Section Readiness**: ✅ Deterministic information-readiness engine (no prose generation)
- **RFP Generation Core**: ⏳ **Next** — backend (second developer)
- **Phase 3**: ⏳ Pending — historical RAG, embeddings, PDF ingestion (not on the critical path)
- **Document preview / UI**: ⏳ After generation core lands — first developer
- **Phase 5**: ⏳ Pending — final RFP assembly + DOCX

---

## Local AI stack (verified working)
- **Ollama 0.32.15** on Windows, local HTTP at `http://localhost:11434`
- **qwen3:8b** — default model (chat + extraction)
- **qwen3:4b** — lightweight fallback
- **Hardware**: RTX 4060 Laptop GPU (8 GB VRAM), i9-14900HX, 15.6 GB RAM
- **Health check**: `npm run ai:check` — all passes

---

## Phase 2 files created

### Types
- `src/types/conversation.ts` — `ConversationMessage`, `RfpIntent`, `ExtractedFact`, `GapAnalysis`, `StreamEvent`

### Server-side AI
- `src/server/ai/ramiSystemPrompt.ts` — Rami persona prompt + context builder
- `src/server/ai/extractionSchema.ts` — JSON schema + validation for structured extraction

### Server-side logic (no LLM calls)
- `src/server/rami/sessionStore.ts` — in-memory session store (global singleton, HMR-safe)
- `src/server/rami/gapEngine.ts` — deterministic gap analysis and active section detection
- `src/server/rami/memoryUpdater.ts` — `applyExtractedFacts()` with provenance rules
- `src/server/rami/intentDetector.ts` — RFP intent state machine

### API route
- `src/app/api/rami/chat/route.ts` — SSE streaming endpoint, full pipeline

### LocalModelProvider extensions
- `src/server/ai/LocalModelProvider.ts` — added `completeStream()` (AsyncGenerator) + `ThinkStripper`

### Client hooks
- `src/hooks/useRamiChat.ts` — SSE reader, streaming state, localStorage backup

### UI components
- `src/components/chat/ThinkingIndicator.tsx` — animated thinking dots
- `src/components/chat/RamiMessage.tsx` — assistant message with Markdown support
- `src/components/chat/UserMessage.tsx` — user message
- `src/components/chat/ChatMessages.tsx` — scrollable list with auto-scroll
- `src/components/chat/ChatComposer.tsx` — premium auto-grow composer
- `src/components/rfp/SectionProgress.tsx` — compact dynamic progress control
- `src/components/rfp/DocumentPreviewShell.tsx` — A4 document preview shell

### Layouts and views
- `src/layouts/ChatLayout.tsx` — full-height sidebar layout (no padding main)
- `src/views/RamiChat/RamiChatWorkspace.tsx` — main workspace view (initial → split)

### CSS additions
- `src/styles/globals.css` — Rami message body styles, streaming cursor, cursor blink animation

### Routes modified
- `src/app/documents/[documentId]/interview/page.tsx` — now renders RamiChatWorkspace

---

## Persistence (current)
- **PostgreSQL**: authoritative for Projects, ProjectFacts, Messages, ProjectContext classifier snapshot
- **Server Map**: process cache only (`clearAllSessionCache()` forces hydrate)
- **localStorage**: optional UI cache; PostgreSQL wins on load
- **Google Sheets**: still unused for conversational state
- Authority: `.private-context/architecture/postgresql-persistence.md`

### Live validation (this machine, 2026-08-30)
- PostgreSQL **18.6** at `127.0.0.1:5433`, database `rami_ai` (do not change the port)
- Seed: Sections 20, Fields 52, Questions 62, QuestionFields 59, section_fields 68; migrate/seed idempotent
- Acceptance project: `document_key=rami-persist-accept-20260830`, name `RAMI Persistence Acceptance Test`, `project_id=96345d36-d17b-46cb-869d-188e305040bf`
- Live chat write-through (local Ollama `qwen3:8b`): BA + RAMI messages, multiple `project_facts`, `project_runtime` classifiers (`FULL_RFP` / `SINGLE_PROJECT` / `ASSESSMENT`)
- Full Next.js restart + `POST /api/rami/cache/clear` hydrate from PostgreSQL; did not re-ask beneficiary / duration / objectives
- Correction: duration current `18 months`, history keeps `24 months`, `projects.duration_months=18`, survives cache-clear
- Backup `.rami-db-backups/*.dump` (gitignored); restore only into `rami_ai_restore_test` (live restore refused without `--overwrite-live`)
- Missing-project hydrate throws `HYDRATION_FAILED` (no blank invent); chat persist failures emit `error`, not `done`
- **Spoken-TBC (fixed)**: whole-value unknown/deferral → provenance `TBC` + GapStatus `UNKNOWN`/`DEFERRED`; literal `"TBC"` is not stored as an answer. English phrases only.
- **Do not start RAG / Phase 2.3 / training from this result.** Next feature work is RFP Generation Core (see `NEXT_STEPS.md`).

---

## What is working (Phase 2 + 2.1)
- Full conversational loop: message → extraction → memory → gap → response
- Real Ollama streaming for responses (`completeStream()` AsyncGenerator)
- `<think>...</think>` blocks stripped automatically from Qwen3 output
- Multi-fact extraction from one BA message (verified: 10 fields in one turn)
- `ProjectMemory` updated via `applyExtractedFacts()` with provenance (EXTRACTED)
- Duplicate question prevention (gap engine skips filled fields)
- RFP intent detection: NONE → POSSIBLE → CREATE_RFP
- Smooth transition to split workspace on `CREATE_RFP`
- Premium initial state (centered hero)
- Streaming thinking indicator (three dots)
- Streaming text cursor (blinking bar)
- Auto-scroll with "jump to latest" override
- Mobile tab switcher (Chat / Document)
- Tablet collapsed sidebar
- Section progress control (dynamic from `getApplicableSections()`)
- A4 document preview shell
- Polished error experience (Ollama unavailable message, retry)
- localStorage persistence (conversation survives page refresh)
- **Phase 2.1 additions:**
  - Bilingual Arabic/English conversation (replies in user's language)
  - RTL rendering for Arabic messages (`dir="rtl"` per message, not app-wide)
  - Language detection: deterministic Arabic-character ratio (no LLM call)
  - Language tracked in session + returned in SSE `done` event
  - Conditional RFP sections correctly activated (HR system → 19/20, consulting → 12)
  - `applicableSectionCount` returned in SSE events; synced to client
  - Progress UI separated: "Sections X/Y approved" + "Information Z% gathered"
  - Next-best-question priority: business-critical fields first, admin details last
  - `users` field normalized to `UsersValue` shape regardless of LLM output format
  - Arabic line-height CSS increased for readability
- **Phase 2.2 additions:**
  - ProjectContext classifiers (UNDETERMINED → evidence); CORE-only packs while unresolved
  - GapStatus + materiality stop + safe UNKNOWN; ASK_REQUIREMENTS cluster (≤3 IDs)
  - Correction vs contradiction in memoryUpdater; CLARIFY with targetKind/targetId
  - Server-driven `completionPercent` / `collectionSufficient` / `nextActionType` on SSE (no client +3 heuristic)

---

## Phase 2.2 Adaptive Control Plane (implemented)

Authority: `.private-context/architecture/adaptive-question-architecture.md`

### Created
- `src/types/projectContext.ts` — classifiers + PackId freeze + ComplexityProfile (not duplicated into ProjectMemory)
- `src/types/gapStatus.ts` — GapStatus / Materiality / FieldGapState
- `src/types/nextAction.ts` — ASK_REQUIREMENTS, CLARIFY_CONTRADICTION (`targetKind`/`targetId`), STOP_COLLECTION, OPEN_ENDED + placeholders
- `src/schema/fieldControlMeta.ts` — packs / materiality / depth tags for all 52 fields
- `src/server/rami/projectClassifier.ts` — signals → ProjectContext (UNDETERMINED defaults)
- `src/server/rami/questionPackEngine.ts` — activatePacks; CORE-only while unresolved
- `scripts/validate-phase2-adaptive.ts` + `npm run validate:phase2-adaptive`

### Sensitive modified
- `gapEngine.ts` — pack applicability, GapStatus, ASK cluster, materiality stop, safe UNKNOWN, context contradiction
- `memoryUpdater.ts` — correction vs conflict (superseding / competing); no silent HIGH overwrite
- `route.ts` — extract → apply → classify → packs → gaps; SSE `completionPercent` / `collectionSufficient` / `nextActionType`
- Also: provenance alias, conversation, sessionStore, extractionSchema, ramiSystemPrompt, rfpSchema, projectMemoryFields, useRamiChat, RamiChatWorkspace (removed +3 heuristic)

### Locked clarifications applied
1. Classifiers live only on ProjectContext
2. PackId names frozen (CORE … ASSESSMENT_TESTING); no 2.3 catalogs
3. Safe UNKNOWN defined for stop
4. CLARIFY_CONTRADICTION targets `memory_field` or `project_context`

---

## What is NOT implemented yet
- **RFP prose generation** — no `generateRfpSection`, no `SectionGenerationContext` builder
- **Generated-section content storage** — `project_section_states` is lifecycle only; no GeneratedSection payload
- **A4 real prose** — `DocumentPreviewShell` is still a placeholder
- **Generate / Regenerate / Edit / Approve** product flow (lifecycle types exist; generation path does not)
- **Full RFP assembly**
- **DOCX export**
- **Phase 2.3 domain catalogs**
- **RAG / embeddings / pgvector / PDF ingestion**
- **Fine-tuning / LoRA / Qwen 14B**
- **BA confirmation flow**: EXTRACTED → CONFIRMED promotion UI
- Other machines still need `.env.local` + `db:migrate` + `db:seed` (this laptop: port 5433 / `rami_ai`)

---

## Legacy interview code
`src/views/GuidedDocumentInterview/GuidedDocumentInterviewPage.tsx` and related files remain in place but are NOT linked from any route. The interview route now renders the new `RamiChatWorkspace`. The legacy components are clearly namespaced under `/interview/` and can be retired in Phase 4.

---

## Files a future agent must read first
See `START_HERE.md` reading order. For RFP Generation Core:

```
.private-context/handoff/START_HERE.md
.private-context/handoff/CURRENT_STATE.md
.private-context/handoff/DECISIONS.md
.private-context/handoff/NEXT_STEPS.md
.private-context/architecture/rfp-section-readiness.md
.private-context/architecture/rfp-generation-architecture.md
src/server/rami/sectionReadiness.ts
src/server/ai/   (RamiModelProvider, Local, Modal)
src/server/rami/projectPersistence.ts
```
