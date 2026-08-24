# Implementation Roadmap

Status: roadmap for implementation phases. **Phase 1 is complete (Aug 2026).** Phase 2 is the immediate next action. This file's most important section is now Phase 2.

Explicit **do-not-build-yet list** (applies until Phase 2 is complete and explicitly signed off): no RAG/vector index, no document generation/DOCX export.

---

## Phase 1 — Canonical knowledge + structured memory + local AI foundation ✅ COMPLETE

**Completed Aug 2026.** All stop conditions passed.

**What was built:**
- `src/schema/rfpSchema.ts` — 20-section canonical schema.
- `src/schema/projectMemoryFields.ts` — 52 canonical information requirements.
- `src/types/provenance.ts` — `InformationStatus`, `ProjectMemoryField<T>`, transition enforcement.
- `src/types/sectionState.ts` — `SectionLifecycleState`, transition rules, `assertSectionTransition`.
- `src/types/projectMemory.ts` — `ProjectMemory`, `ProjectSession`, `createEmptyProjectMemory`.
- `src/server/ai/RamiModelProvider.ts` — provider interface.
- `src/server/ai/LocalModelProvider.ts` — Ollama-backed implementation.
- `src/server/ai/modelManifest.ts` — manifest loader.
- `src/server/ai/index.ts` — barrel + singleton factory.
- `config/model-manifest.json` — qwen3:8b default, qwen3:4b lightweight.
- `scripts/setup-local-ai.ps1` — idempotent Ollama setup.
- `scripts/check-local-ai.ps1` — health-check with smoke test.
- `scripts/validate-phase1.ts` — deterministic validation script.

**Hardware verified:** RTX 4060 Laptop 8GB VRAM / i9-14900HX / 15.6GB RAM. Default model: qwen3:8b. Lightweight: qwen3:4b. Quality (qwen3:14b) not auto-pulled.

**Hardware note (Aug 2026):** Primary dev machine is RTX 4060 Laptop with 8,188 MiB VRAM. qwen3:8b selected as default (fits ~4.7GB VRAM). qwen3:4b pulled as lightweight fallback. qwen3:14b documented as aspirational; borderline for 8GB VRAM — do not pull automatically.

---

## Phase 2 — Conversational Rami engine + chat UX

**Objective:** Build the core conversational loop (`architecture/rami-agent-architecture.md`) and a chat-first UI (`product/conversational-rfp-workflow.md` §2 initial state), operating purely on structured project memory — no drafting/generation yet.

**Dependencies:** Phase 1 (schema consts, `LocalModelProvider`).

**Major modules/files:**
- Deterministic gap-detection/next-question engine (replaces `useInterviewEngine.ts` per the RETIRE verdict in `handoff/CURRENT_STATE.md`).
- Chat UI components (new) + retirement of `QuestionStage.tsx`/`AnswerControl.tsx`/the fixed script.
- Project-memory read/write layer wired to (initially) an adapted Google Sheets boundary, or a local store if Sheets adaptation is deferred — decide explicitly and record the decision in `DECISIONS.md` when this phase starts.

**Tests:** multi-fact message extraction correctness (one message → multiple field updates); duplicate-question avoidance; TBC handling; provenance transition correctness against the state machine in `architecture/rfp-knowledge-architecture.md` §2.

**Documentation update requirement:** any deviation from the agreed provenance transitions or gap-detection priority rules must be reflected back into `architecture/rami-agent-architecture.md`/`rfp-knowledge-architecture.md`, not left implicit in code.

**Stop condition:** a BA can hold a natural chat conversation that correctly populates structured project memory for at least the Group 0/1/2/4 fields (document setup, background, engagement, scope), with correct provenance and no duplicate questions, with no drafting/generation yet.

---

## Phase 3 — Historical RFP retrieval / local RAG

**Objective:** Implement the local RAG pipeline in `architecture/rfp-knowledge-architecture.md` §3–4 over the 4 existing knowledge sources, and wire retrieval into the Phase 2 conversational loop as a "propose from history" capability.

**Dependencies:** Phase 1 (`LocalModelProvider.embed()`), Phase 2 (a place in the loop to call retrieval).

**Major modules/files:** local parser (PDF + DOCX, reusing the read-only XML-extraction technique validated in this pass for DOCX), section/table-aware chunker, embedding step, flat local index (JSON/SQLite as decided in `architecture/rfp-knowledge-architecture.md` §4), `search()` API.

**Tests:** retrieval returns correctly-attributed chunks (filename + sectionPath + trustTier) for known queries against the 4 sources; table chunks are never split mid-table; a retrieved chunk never becomes a `CONFIRMED` project-memory value without passing through `PROPOSED` first (regression test against the provenance hard rule).

**Documentation update requirement:** record actual chunk counts/index size and any deviation from the "no dedicated vector DB" decision (with justification) in `handoff/DECISIONS.md` if corpus growth changes that calculus.

**Stop condition:** for a sample of fields with known historical support (e.g. `slaTiers`, `evaluationWeights`), the system successfully retrieves and proposes attributed evidence during a live conversation.

---

## Phase 4 — Section drafting + live preview + BA review

**Objective:** Implement section-level generation (`architecture/rfp-generation-architecture.md`) and the split-workspace live preview (`product/conversational-rfp-workflow.md` §2 active state).

**Dependencies:** Phase 1 (`LocalModelProvider.draftSection()`), Phase 2 (project memory populated), Phase 3 (historical evidence available for generation context).

**Major modules/files:** section state machine implementation, `SectionGenerationContext` assembly, HTML/React A4-style preview renderer (building on `src/types/draft.ts`, KEEP verdict), dynamic/collapsible section navigator replacing the fixed `InterviewNavigator` list behavior (its state iconography is ADAPT-able, per `handoff/CURRENT_STATE.md`).

**Tests:** a section only reaches `READY_TO_DRAFT` when the deterministic gate passes; `TBC` fields render as visible placeholders in a draft, never invented; `REVIEW → APPROVED` requires an explicit action; the reopening flow correctly detects upstream field changes and routes through `REOPENED → COLLECTING`.

**Documentation update requirement:** none expected unless the state machine needs a transition not covered in `architecture/rfp-generation-architecture.md` §1 — if so, update that file first.

**Stop condition:** a BA can walk at least 3 representative sections (e.g. Introduction, Scope of Work, Functional Requirements) through the full `COLLECTING → DRAFTING → REVIEW → APPROVED` cycle with a real local LLM, including at least one revision cycle and one reopening scenario.

---

## Phase 5 — Final assembly / DOCX export / approved-knowledge ingestion

**Objective:** Assemble all approved sections into a final document (`architecture/rfp-generation-architecture.md` §3), implement DOCX export, and implement the explicit trust-promotion step (`architecture/rfp-knowledge-architecture.md` §5) so approved Rami-generated documents can (with explicit human action) become future reference knowledge.

**Dependencies:** Phase 4 (approved sections exist), Phase 3 (indexing pipeline exists to reuse for promoted documents).

**Major modules/files:** assembly logic respecting `chapterGroup`/`volumeHint` rollups, DOCX export (reusing the read-only parsing lessons from `GeneralTemplate.docx` analysis, but writing rather than just reading), explicit promotion action (UI + backend flag, never automatic).

**Tests:** assembly refuses to complete if any applicable mandatory section is not `APPROVED`; a promoted document appears in subsequent retrieval results with `trustTier = approved-generated`; an approved-but-not-promoted document does not appear in retrieval.

**Documentation update requirement:** update `architecture/rfp-knowledge-architecture.md` §5 if the actual promotion UX differs from the two-step design.

**Stop condition:** at least one complete, multi-section RFP can be assembled end-to-end, exported to DOCX, and (as a separate explicit action) promoted into the knowledge index.

---

## Phase 6 — Hardening / ministry deployment readiness

**Objective:** Make the second-developer/ministry-pilot deployment topology (`architecture/local-ai-deployment.md` §4) real and reliable; address remaining `handoff/CURRENT_STATE.md` gaps (Sheets hydration/read path, session resumption); production-harden error handling, validation, and security review.

**Dependencies:** Phases 1–5 functionally complete.

**Major modules/files:** finalized `scripts/setup-local-ai.ps1`/`check-local-ai.ps1`, Sheets read/hydration endpoints, session-resume UX, security review pass (credentials, input validation, local-network exposure of the Ollama endpoint).

**Tests:** a clean machine can go from `git clone` to a working Rami session using only documented setup steps; a browser refresh mid-session resumes correctly from persisted state.

**Documentation update requirement:** update `handoff/CURRENT_STATE.md` to reflect the new baseline once this phase completes — it should no longer describe the fixed-script prototype as "current."

**Stop condition:** a second machine, following only the documented setup flow, reaches a fully working Rami session with no manual code edits and no paid API keys.

---

## Immediate next action recommendation

Start **Phase 2** exactly as scoped above. Phase 1 is complete and its stop condition has been met. Phase 2 depends on `src/schema/`, `src/types/`, and `src/server/ai/` from Phase 1 — all now available.

**Key Phase 2 decision to make first:** how will `ProjectMemory` be persisted during a session? Options: (a) extend the existing Google Sheets adapter to support `ProjectMemory` facts as rows, or (b) use an in-memory store for Phase 2 and defer Sheets integration to a later sub-phase. Record the decision in `DECISIONS.md` before writing persistence code.
