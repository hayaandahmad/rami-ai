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

## #5 — Canonical 52-field information model is the memory definition
**Decision**: `src/schema/projectMemoryFields.ts` `PROJECT_MEMORY_FIELDS` (52 fields) defines what can be stored in `ProjectMemory`. The LLM extraction schema validates against this set.
**Status**: Active.

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
**Status**: Active.

---

## #12 — Section drafting deferred until Generation Core exists
**Decision**: A4 preview (`DocumentPreviewShell`) is still a placeholder. **RFP Generation Core (backend)** is the next implementation. UI preview wiring is the first developer's follow-up after generated content exists and persists.
**Status**: Active — generation not implemented yet. No fine-tuning exists.

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


