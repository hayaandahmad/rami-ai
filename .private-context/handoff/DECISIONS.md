# Rami — Architecture Decisions

Durable decisions that must not be silently reversed in future implementation passes.

---

## #1 — Zero paid AI API cost constraint
**Decision**: All LLM inference uses local open-weight models only (Ollama).
**Rationale**: Cost and data-sovereignty requirement.
**Status**: Active.
**If constraint relaxes**: A new `PaidApiProvider implements RamiModelProvider` can be added without touching the pipeline.

---

## #2 — LLM is for language; TypeScript is for logic
**Decision**: The LLM never decides workflow state. Gap detection, section transitions, provenance promotion, and next-question selection are deterministic TypeScript.
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
**Decision**: `RamiModelProvider` interface exists but only `LocalModelProvider` (Ollama) is implemented. Do not add provider implementations until the zero-cost constraint is explicitly relaxed.
**Status**: Active.

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
**Decision**: No embedding, PDF ingestion, vector index, or retrieval in Phase 1 or 2. Phase 3 owns RAG.
**Status**: Active.

---

## #12 — Section drafting deferred to Phase 4
**Decision**: The A4 preview right pane shows a placeholder shell in Phase 2. Real draft content is Phase 4.
**Status**: Active.

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
**Decision**: Phase 2 uses server-side in-memory Map (global singleton) for session state and client-side localStorage for conversation history backup. No database, no Google Sheets for conversational state.
**Trade-off**: Sessions reset if the Node.js process restarts. localStorage provides client-side recovery of conversation history. Acceptable for Phase 2 prototype.
**Phase 3 migration path**: Replace server Map with a lightweight embedded store (e.g. better-sqlite3) keyed by sessionId.
**Status**: Active for Phase 2.
