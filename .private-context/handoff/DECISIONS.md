# Rami — Architecture Decisions

Durable decisions that must not be silently reversed in future implementation passes.

Second-laptop reproduce-and-run (not a behavior change): `.private-context/handoff/SECOND_MACHINE_HANDOFF.md`.

---

## #1 — Zero paid AI API cost constraint
**Decision**: All LLM inference uses local open-weight models only (Ollama).
**Rationale**: Cost and data-sovereignty requirement.
**Status**: Active.
**If constraint relaxes**: A new `PaidApiProvider implements RamiModelProvider` can be added without touching the pipeline.

---

## #2 — LLM is for language; TypeScript is for logic
**Decision**: Qwen interprets/generates language. Deterministic TypeScript owns workflow: gaps, packs, provenance, next-question, **Section Readiness**, and generation **gates**. Qwen never decides readiness or invents unresolved business facts.
**Rationale**: Prevents non-deterministic, untestable business logic drift into the model.
**Status**: Active. Hard rule.

---

## #3 — REFERENCE provenance never silently becomes CONFIRMED
**Decision**: A `REFERENCE` value (from historical RAG) must pass through `PROPOSED` before a BA can accept it as `CONFIRMED`. No code path from `REFERENCE → CONFIRMED` directly.
**Rationale**: Prevents historical RFP data from silently contaminating current project facts.
**Status**: Active. Enforced in `updateMemoryField()` in `src/types/provenance.ts`.

---

## #4 — Canonical 20-section RFP schema is the single source of truth
**Decision**: `src/schema/rfpSchema.ts` `RFP_SECTIONS` (20 sections) is the only authoritative definition of RFP structure. The legacy 13-section `interviewSections.ts` is not a constraint.
**Status**: Active.

---

## #5 — Canonical information model is the memory definition
**Decision**: `src/schema/projectMemoryFields.ts` `PROJECT_MEMORY_FIELDS` defines what can be stored in `ProjectMemory`. The LLM extraction schema validates against this set.
**Status**: **Superseded count by #43** (52 → 59) **then #52** (59 → 60 with `issuerEntity`). The rule (Fields are the only memory keys) remains Active.

---

## #6 — Section state machine transitions are enforced
**Decision**: Section lifecycle transitions follow the state machine in `src/types/sectionState.ts`. Invalid transitions throw at call time.
**Status**: Active.

---

## #7 — Google Sheets is for answer persistence, not conversational state
**Decision**: The existing Google Sheets boundary (`/api/interview/save`) is preserved for legacy RFP answers. Conversational `ProjectMemory` and session state are NOT written to Sheets in Phase 2.
**Rationale**: Writing to Sheets on every conversational turn would block the AI response. Conversation must remain non-blocking.
**Phase 3 action**: Evaluate batching Sheets writes after section completion gates, not per message.
**Status**: Active.

---

## #8 — Provider abstraction: LocalModelProvider only
**Decision**: Originally only `LocalModelProvider`.
**Status**: **Superseded.** Local and Modal inference remain interchangeable behind `RamiModelProvider`. Default remains `local`. Chat must not auto-start GPU. Persistence is independent of the provider. Do not break this abstraction.

---

## #9 — Ollama streaming via AsyncGenerator
**Decision**: The response generation step uses `LocalModelProvider.completeStream()` which returns an `AsyncGenerator<string>`. Extraction uses non-streaming `extractStructured()`.
**Rationale**: Extraction needs schema-constrained output (Ollama `format` field); streaming is not needed there. Response generation benefits from streaming for UX.
**Status**: Active.

---

## #10 — Qwen3 thinking blocks are stripped server-side
**Decision**: Qwen3 may prepend `<think>...</think>` reasoning blocks. The `ThinkStripper` class in `LocalModelProvider.ts` strips these before yielding to the client.
**Rationale**: BA should see only the conversational response, not model reasoning.
**Status**: Active.

---

## #11 — RAG deferred to Phase 3
**Decision**: RAG does not exist yet. No embedding, PDF ingestion, vector index, or retrieval. Historical RFP files in Git are **reference**, never current ProjectFacts. Do **not** start RAG / pgvector as part of RFP Generation Core.
**Status**: **Superseded by #40** (offline RAG foundation exists; live injection still forbidden).

---

## #12 — Section drafting deferred until Generation Core exists
**Decision**: A4 preview (`DocumentPreviewShell`) was a placeholder while Generation Core was built.
**Status**: **Superseded for backend.** Generation Core exists. A4/UI wiring is the next first-developer task. Preview still does not consume `GeneratedSection` yet.

---

## #13 — Interview route replaced, legacy code retained
**Decision**: `/documents/[documentId]/interview` now renders `RamiChatWorkspace`. The legacy `GuidedDocumentInterviewPage` is retained in `src/views/GuidedDocumentInterview/` but not linked.
**Retirement**: Planned for Phase 4 when the conversational workspace is complete.
**Status**: Active.

---

## #14 — Knowledge files are versioned in Git (updated Aug 2026)
**Decision**: Approved RFP reference files (`.private-context/knowledge/*.pdf`, `.docx`, `.doc`) are intentionally tracked in Git.
**Supersedes**: Earlier decision to exclude them from Git.
**Rationale**: The project owner has approved their inclusion. They are internal reference documents, not secrets.
**Status**: Active.

---

## #15 — Phase 2 persistence: in-memory + localStorage
**Decision**: Phase 2 used server-side in-memory Map + localStorage.
**Status**: **Superseded by #27.**

---

## #27 — PostgreSQL is the authoritative project store
**Decision**: Conversational `ProjectMemory`, messages, and ProjectContext classifier snapshots persist in PostgreSQL. The server Map is a cache. localStorage is a UI cache and loses to PostgreSQL on hydrate.
**ProjectContext**: classifier fields (`documentStage`, `contractingGranularity`, `primaryDomain`, `secondaryDomains`, `complexity`) are persisted because `classifyProject()` is not restart-identical without previous context and per-turn LLM signals. `activePacks` and `collectionSufficient` are recomputed after hydrate.
**Qwen never receives DB credentials or executes SQL.**
**Budget** is stored on `projects.budget_jod` after deterministic FX conversion. **Duration** is stored as months.
**Status**: Active.

---

## #16 — Bilingual conversation: Arabic + English (Phase 2.1)
**Decision**: Rami replies in the user's dominant conversational language (Arabic or English). Language is detected deterministically by Arabic-character ratio (threshold: >15% of message chars). No LLM call for language detection.
**Language tracking**: `ConversationLanguage` (`'ar' | 'en'`) stored in session and in each `ConversationMessage`. Returned in SSE `done` event so client can tag messages.
**RTL**: Arabic messages use `dir="rtl"` on the message text container only. The application layout (sidebar, preview pane) remains LTR.
**Document language**: RFP document content, section headings, and formal templates remain English regardless of conversation language. Conversation language and document language are separate concerns.
**Status**: Active.

---

## #17 — Conditional section applicability is server-computed (Phase 2.1)
**Decision**: `isSectionApplicable()` uses `documentType` and `engagementType` from `ProjectMemory` to determine which of the 8 conditional RFP sections are active. The result (`applicableSectionCount`) is returned in SSE events so the client reflects the correct count.
**Example**: `system-implementation` → 19 applicable sections. `consulting` → 12 (mandatory only).
**No hardcoding by project name**: Section activation is based on canonical `documentType` values in `rfpSchema.ts`, not project name strings.
**Status**: Active.

---

## #18 — Next-question priority model (Phase 2.1)
**Decision**: Fields are prioritized by a deterministic `FIELD_BUSINESS_PRIORITY` map in `gapEngine.ts`. Business-critical fields (documentType, businessNeed, users, scope, integrations) are asked before administrative details (documentTitle, tenderNumber, proposalDeadline).
**Implementation**: Composite score = `businessPriority × 100 + sectionOrder + explicitAskBonus`. LLM has no control over question order.
**Working title**: If `documentTitle` is unknown, discovery is not blocked. The absence of a formal title does not prevent Rami from asking about scope, users, and requirements first.
**Status**: Active.

---

## #19 — Users field normalization (Phase 2.1)
**Decision**: LLM may extract `users` as a plain string ("150 employees"), an array, or an object. `normalizeUsersValue()` in `memoryUpdater.ts` converts all these into the canonical `UsersValue` shape: `{ internal: string[], external: string[] }`.
**Rule**: "citizen/external/public/customer" strings are classified as `external`; others as `internal`.
**The canonical type is NOT weakened**: The `UsersValue` interface remains strongly typed. Normalization is a translation step in the updater.
**Status**: Active.

---

## #20 — ProjectContext is the control plane; ProjectMemory stays facts (Phase 2.2)
**Decision**: `documentStage`, `contractingGranularity`, `primaryDomain`, `secondaryDomains`, `complexity`, and `activePacks` live only on `ProjectContext`. They are never duplicated into `ProjectMemory`. Existing `documentType` / `engagementType` memory fields remain as compatibility + classification signals only.
**Status**: Active. Hard rule.

---

## #21 — UNDETERMINED classifiers + CORE-only packs (Phase 2.2)
**Decision**: Unresolved classifiers use `UNDETERMINED` (not silent FULL_RFP / SINGLE_PROJECT defaults). While stage / granularity / primaryDomain is UNDETERMINED, `activePacks = CORE` only unless evidence explicitly supports another pack. Preview outline visibility does not imply required/missing.
**Status**: Active.

---

## #22 — PackId freeze (Phase 2.2)
**Decision**: Pack names are frozen: CORE, PROCUREMENT, PRE_QUALIFICATION, FRAMEWORK, BPR, DOWNSTREAM_DT_RFP, SYSTEM_IMPLEMENTATION, DATA_PLATFORM, CONNECTIVITY, AI_AGENTIC, SECURITY, PMO, TRAINING_CHANGE, SLA_SUPPORT, ASSESSMENT_TESTING. Packs are metadata tags on fields, not duplicated engines. Phase 2.3 may expand catalogs under these IDs but must not rename them casually.
**Status**: Active.

---

## #23 — Five axes stay separate (Phase 2.2)
**Decision**: Applicability ≠ materiality ≠ depth ≠ GapStatus ≠ ProvenanceStatus. LOW complexity never auto-means NOT_APPLICABLE. Provenance TBC remains @deprecated compatibility and maps to GapStatus UNKNOWN in gap logic.
**Status**: Active.

---

## #24 — NextAction ASK cluster + typed contradiction targets (Phase 2.2)
**Decision**: `ASK_REQUIREMENTS` is 1 primary + 0–2 related (max 3 field IDs). `CLARIFY_CONTRADICTION` uses `targetKind: 'memory_field' | 'project_context'` + `targetId` so either a memory field or a classifier conflict can be clarified.
**Status**: Active.

---

## #25 — Materiality-only stop + safe UNKNOWN (Phase 2.2)
**Decision**: `collectionSufficient` / `STOP_COLLECTION` use materiality rules only — never answered-field-count thresholds. UNKNOWN is non-blocking only when materiality is STANDARD/LOW, it does not block a CRITICAL/HIGH dependency, and it is not needed to resolve scope, acceptance, legal/commercial structure, or another blocking requirement.
**Status**: Active.

---

## #26 — Correction vs contradiction (Phase 2.2)
**Decision**: Correction requires superseding language or `updateKind=correction` (history kept; not CONTRADICTORY). Conflict requires competing language, `updateKind=conflict`, or two values without clear supersession → CONTRADICTORY + clarify. Ambiguous HIGH/CRITICAL conflicts without supersession prefer clarify over silent overwrite. Do not treat “same field + two ba-messages” alone as correction.
**Status**: Active.

---

## #28 — Spoken TBC is completeness, not a field value
**Decision**: When the BA’s *entire* extracted value is a not-yet-known phrase (“TBC”, “to be confirmed”, “we don’t know yet”, …), RAMI stores provenance `TBC`, GapStatus `UNKNOWN` (or `DEFERRED`), `collection_state=TBC`, and `value_json=null`. It must not store the literal string `"TBC"` as EXTRACTED business content. Whole-value match only — text that merely contains the letters TBC stays an answer. English-focused.
**Status**: Active.

---

## #29 — Information readiness ≠ document approval
**Decision**: `SectionInformationReadiness` (`NOT_APPLICABLE` | `NOT_READY` | `DRAFTABLE_WITH_TBC` | `READY_TO_DRAFT`) is computed by TypeScript from ProjectFacts. It is not `SectionLifecycleState` (DRAFTING / REVIEW / APPROVED). Qwen does not decide readiness. `DRAFTABLE_WITH_TBC` may later produce a draft with TBC markers but is never treated as approved. Field↔Section mapping is many-to-many (`section_fields`); `fields.section_id` is a convenience FK only.
**Status**: Active.

---

## #30 — Generation must not invent unresolved facts; TBC stays TBC
**Decision**: When generating RFP prose, unresolved business facts must remain TBC (professional marker). Do not invent dates, budgets, SLAs, quantities, legal terms, evaluation percentages, technologies, users, or procurement requirements. Do not send the entire DB or chat history to Qwen. Do not treat historical/reference content as current ProjectFacts.
**Status**: Active. Binding on RFP Generation Core.

---

## #31 — One reusable generated-section representation
**Decision**: Persist, preview, and later DOCX should share one `GeneratedSection` (or equivalent) model. Do not create a separate generation implementation per section. Regeneration must not silently destroy approved content. Generated content must survive server restart (PostgreSQL).
**Status**: Active. Binding on RFP Generation Core.

---

## #32 — Question ≠ Field
**Decision**: Questions collect; Fields store. A Field may belong to multiple Sections (`section_fields`). One ProjectFact row per Field — never duplicate facts per section.
**Status**: Active.

---

## #33 — Generated section content lives in project_section_contents
**Decision**: Generated RFP prose is stored in `project_section_contents` (versioned, `DRAFT`/`APPROVED`, `is_current`). `project_section_states` remains lifecycle-only. `project_facts` remain business truth and are never overwritten by generation.
**Regeneration**: Creating a new version supersedes the previous current row but keeps history. Approving content (`APPROVED`) cannot be silently overwritten — callers must pass `reopenApproved=true` to create a new `DRAFT` version.
**Status**: Active. Binding.

---

## #34 — One generation pipeline for all sections
**Decision**: `generateRfpSection` / `buildSectionGenerationContext` are section-agnostic. Section-specific shape comes from canonical `RFP_SECTIONS` subsections + mapped facts. Do not create per-section generator modules.
**Status**: Active.

---

## #35 — Document UI consumes GeneratedSection; no parallel preview model
**Decision**: A4 preview and section actions use `GeneratedSection` / `AssembledRfp` from PostgreSQL via generation APIs. Do not invent PreviewSection / UiGeneratedSection models. Information readiness and document approval status are shown separately. Manual edits create a new DRAFT version (`POST /api/rami/generation/edit`) and never mutate ProjectFacts.
**Status**: Active.

---

## #36 — DOCX is a render of persisted AssembledRfp only
**Decision**: Word export builds from the same `AssembledRfp` + `GeneratedSection` blocks used by the browser preview. Export must not call Qwen, invent missing sections, or strip TBC markers. Filename is derived safely from document title / documentKey.
**Status**: Active. Binding on DOCX export.

---

## #37 — Unknown commercial/legal demo values use TBC via real fact path
**Decision**: For evaluation weights/rules, pricing/tax structure, and legal/JV/penalty terms that MoDEE has not confirmed, apply `TBC` through `applyExtractedFacts` (same path as chat extraction), then generate with `DRAFTABLE_WITH_TBC`. Do not invent percentages, currencies, governing law, bonds, or penalties for the demo.
**Status**: Active.

---

## #38 — Historical RFP resources are reference-only
**Decision**: Files under `resources/historical-rfps/` are immutable source artifacts (Excel Question Bank extractions + optional PDFs) for REFERENCE, EVALUATION, and future RAG_CANDIDATE use. They must never silently become current `ProjectFacts`, training data, or live project state. `source/` is immutable; `derived/` holds audits/normalized exports only. Historical retrieval may propose REFERENCE/PROPOSED content only after BA confirmation.
**Status**: Active. Binding before any RAG/ingestion work.

---

## #39 — Historical structured data lives in dedicated PostgreSQL tables
**Decision**: Import historical Question Bank answers into `historical_rfp_documents` + `historical_question_answers` only. Provenance class is always `REFERENCE`. Noncanonical Suggested Addition IDs are namespaced by `{historicalRfpId}::{sheet}::{sourceQuestionId}` to avoid cross-RFP collisions. Import is idempotent and must not mutate live project tables. Golden evaluation reads these tables; RAG/embeddings remain a later step and are not created by this import.
**Status**: Active for import boundary. **RAG layer added separately in #40** (does not change import tables).

---

## #40 — Historical RAG is offline REFERENCE retrieval (not live agent)
**Decision**: Build deterministic chunks (`QUESTION_ANSWER` / `SECTION` / `MULTI_QA_TOPIC`) into `historical_knowledge_chunks` and versioned embeddings into `historical_chunk_embeddings`. Default embedding model is local Ollama `nomic-embed-text` (768-d, Apache-2.0) behind `RamiEmbeddingProvider`. Retrieval modes: structured / vector / hybrid via `retrieveHistoricalReferences` → `HistoricalReference` with `provenanceClass=REFERENCE`.
**pgvector**: Not installed on local PostgreSQL 18. Interim storage is `REAL[]` + app-side cosine.
**Status**: Active for offline foundation. **Live surfacing governed by #42.**

---

## #41 — Chunk boundaries are deterministic (no LLM chunking)
**Decision**: Chunk IDs/content are derived from historical Q&A rows with stable hashing. Qwen must not decide chunk boundaries for the baseline. SECTION/MULTI_QA_TOPIC groups split when soft-max length (~4500 chars) is exceeded. Embedding input may truncate for model context; stored `chunk_text` stays full for traceability.
**Status**: Active.

---

## #42 — Controlled live RAG: policy-gated REFERENCE + PROPOSED proposals
**Decision**: Live chat may retrieve only when `evaluateHistoricalRetrievalPolicy` triggers (explicit example / past-RFP / guidance with field focus). Missing fields alone never trigger retrieval. Mode: **structured-first** when Field/Section/Question IDs known (eval showed stronger MRR); **hybrid** for free-text; vector-only is not default. Surfaced cards are labeled REFERENCE. PENDING proposals live in `historical_field_proposals` and **must not** write `project_facts`. BA Accept (optionally modified) writes `CONFIRMED` ProjectFact with `sourceType=historical-retrieval` and PROPOSED lineage in history. Reject stores REJECTED and blocks immediate re-propose of the same chunk+field. Extraction continues to use the BA message only. Generation-time RAG is **not** this proposal flow — see **#44**. `procurementStage` is not a canonical Field and must not be inferred from retrieval alone.
**Status**: Active. Binding.

---

## #43 — Evidence-driven canonical information-model expansion (52→59 / 62→69)
**Decision**: Promote only the minimum Fields/Questions justified by the 7 historical RFPs. Reject frequency-only and boilerplate Suggested Additions. Historical workbook IDs stay 62; new Questions use `18.x` to avoid `13.x`–`17.x` collisions.

| Kind | Items |
|---|---|
| ProjectMemory Fields | `awardModel`, `callOffOrSowProcess`, `namedKeyPersonnel`, `clarificationContact`, `submissionChannel`, `governanceCadence`, `knowledgeTransferRequirements` |
| ProjectContext | `documentStage` remains the procurement-stage classifier — **no** `procurementStage` Field |
| Rejected / REFERENCE | bid bond, eligibility/PQ micro-criteria, proposal format/copies, domain 13.x–17.x, implementation milestones (use `engagementPhases`) |
| Sections | Still 20 — no 21st section |

Applicability: call-off only for FRAMEWORK / ASSIGNMENT / SOW; named personnel only when PMO / FRAMEWORK / SYSTEM packs apply; admin Fields are supporting + TBC; they must not block unrelated sections. Historical REFERENCE → PROPOSED → BA confirm is unchanged. Do not mass-infer historical mappings with Qwen.
**Status**: Active for the 52→59 promotion. Current catalog count is **60 Fields / 70 Questions** after **#52** (`issuerEntity`). Binding until a later evidence pass.

---

## #44 — Generation-time RAG is BA-approved, section-scoped drafting guidance only
**Decision**: Historical content may assist section drafting **only** after an explicit BA action **Use as drafting reference**. Persist in `project_generation_references` (`ACTIVE` | `REVOKED`, usage scope `STRUCTURE_AND_LANGUAGE`). This is **not** ProjectFact acceptance and must never write `project_facts`.

Hierarchy at generation time:
1. Current **ProjectFacts** are authoritative.
2. BA-approved historical references are optional examples (structure / language / level of detail).
3. Missing / TBC stays TBC.

Hard rules:
- Do **not** retrieve on Generate, assemble, or DOCX. Use pre-approved ACTIVE refs for that project+section only.
- Default scope is **one Section**. A Deliverables reference does not enter Financial / Legal / Evaluation unless separately approved.
- Max **3** ACTIVE refs per section. High-risk sections use shorter excerpts.
- Adding/removing a reference must **not** silently regenerate an APPROVED section.
- Regeneration uses current ACTIVE refs; previous versions keep their historical-reference IDs.
- Prompt + deterministic leakage sanitizer: historical numbers/names that are not independently in ProjectFacts must not appear as current truth.
- Drafting lineage is UI metadata, not official RFP citation, and is not written into DOCX.
- Local and Modal stay behind `RamiModelProvider` — no provider-specific RAG generators.
- pgvector remains deferred. Canonical model is **60 Fields / 70 Questions / 20 Sections** (see #52).

**Status**: Active. Binding.

---

## #45 — Git-tracked shared dump is development handoff only
**Decision**: `dev/database/rami_ai_shared.dump` (+ `rami_ai_shared.metadata.json`) is the portable **development** snapshot of local `rami_ai`. It is not a production backup, not a live PostgreSQL server, and must not include `.env.local` / passwords / API keys. Private dumps stay in `.rami-db-backups/` (gitignored) via `npm run db:backup`. Restore uses `npm run db:restore-shared -- --confirm-replace-local-rami-ai` and refuses non-loopback hosts. Snapshot must include current migrations (through `007`), historical/RAG tables, controlled proposals, and generation references when those exist in the source DB. Historical resources under `resources/historical-rfps/` remain REFERENCE. Generation references never automatically become ProjectFacts.

**Status**: Active. Binding.

---

## #46 — Live Qwen generation-RAG quality validation (2026-08-31)
**Decision**: Mock safety validation (`validate:generation-rag`) and live Qwen quality validation (`validate:generation-rag-live`) are **separate evidence layers**. Live validation uses real `qwen3:8b` via `RamiModelProvider` (ollama-local for the recorded run) with identical ProjectFacts ± approved drafting reference as the only A/B variable.

Recorded outcome (4 cases on `rami-rag-live-eval`):
- **Safety**: ProjectFact/readiness isolation passed; TBC preserved; deterministic + semantic/name leakage reviews found no material leaks; high-risk evaluation weights remained TBC.
- **Quality**: **Inconsistent** — 0 CLEAR_IMPROVEMENT, 2 MIXED, 2 WORSE. Do **not** claim historical references generally improve drafting quality.
- **Gate**: **B — SAFE BUT QUALITY BENEFIT UNCLEAR**. Safe to proceed to Golden End-to-End RFP evaluation; not safe to claim broad quality uplift.

Artifact: `resources/historical-rfps/derived/generation-rag-live-eval.json`. Browser UI flow remains manually verifiable; service/API paths exist.

**Status**: Active. Binding for handoff until superseded by Golden End-to-End results.

---

## #47 — Manual document edit does not mutate ProjectFacts (Phase 5)
**Decision**: BA manual section editing (`editRfpSection` / `ManualBlockEditor`) modifies `project_section_contents` only. It creates a new DRAFT version. It does not answer Fields, change readiness, or promote TBC to confirmed facts. TBC blocks are protected in the structured editor.

**Status**: Active.

---

## #48 — Section version history is immutable; restore creates new version (Phase 5)
**Decision**: `project_section_contents` rows are never overwritten. Restore copies historical `blocks` into a **new** current version with `model_used` suffix `restored-from-vN`. Historical rows remain queryable.

**Status**: Active.

---

## #49 — AI Edit with Rami is a separate generation pipeline (Phase 4–5)
**Decision**: `aiEditRfpSection` is not routed through chat extraction. It uses `SectionEditContext`, creates a new DRAFT version (`+ai-edit`), and must not mutate ProjectFacts. Approved sections require explicit reopen.

**Status**: Active.

---

## #50 — Project deletion uses existing FK CASCADE (Phase 5)
**Decision**: `DELETE FROM projects WHERE document_key = $1` cascades to all project-owned tables (facts, messages, runtime, section states/contents, proposals, generation references). No new migration required. Server clears `sessionStore` cache on delete. Dashboard uses kebab menu + confirmation.

**Status**: Active.

---

## #51 — Engine panel dismiss interactions (Phase 5)
**Decision**: Expanded Rami engine panel collapses on chevron, header click, outside pointer-down, and Escape. Inner action controls must not accidentally collapse. Drag uses threshold without sticky `movedRef` blocking subsequent collapse. Dismiss persists collapsed state to `localStorage`.

**Status**: Active.

---

## #52 — Generic issuer vs beneficiary + structural RFP assembly
**Decision**: `issuerEntity` (Issuing / Procuring Entity) is a generic canonical Field, distinct from `beneficiaryEntity`. Do not infer one from the other. Same organization in both fields is valid. Conflicts are field-specific. Cover **Issued by** uses `issuerEntity` when known and **TBC** otherwise; missing issuer must not block Cover rendering. Question **0.8** collects issuer; do not overload 0.3 / 3.1.

Cover Page, Table of Contents, and the organization standard Annex pack are TypeScript-rendered (no Qwen). Introduction is AI-drafted from foundational who / what / why ProjectFacts; the BA does not supply Introduction prose. Standard Annex titles are automatic for ordinary full RFPs; project-specific annexes append from `requiredAnnexes`. The repository does **not** currently store reusable annex form files — placeholders must not claim a form is attached.

PostgreSQL remains persistent authority. Hydration must not silently hide stored contradictions. Full RFP / DOCX must not emit internal generation diagnostic strings as document text. AI drafted counts must not include automatically prepared structural sections.

Production source must remain generic — no project-specific (Natiq) corrective logic.

**Status**: Active. Binding.


