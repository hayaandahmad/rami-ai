# Architecture Decisions

Status: durable decision log for the conversational, local-AI Rami direction. Format per decision: **Decision / Why / Alternatives / Consequence**.

---

### 1. Conversational Rami replaces rigid questionnaire UX

**Decision:** Rami becomes a chat-first conversational agent, not a fixed one-question-at-a-time linear script.
**Why:** A rigid script cannot handle multi-fact messages, natural BA phrasing, or dynamic section applicability; it does not scale to a 20-section canonical schema with conditional sections.
**Alternative:** Keep and extend the existing `useInterviewEngine` linear model. Rejected — fundamentally incompatible with free-form input and non-linear information arrival.
**Consequence:** `useInterviewEngine.ts`, `mockInterviewScript.ts`, `followUpTrigger.ts`, and the fixed 13-section navigator's linear behavior are retired (see `CURRENT_STATE.md` migration verdicts); a new chat orchestration layer is built (`architecture/rami-agent-architecture.md`).

### 2. Question Bank becomes information requirements

**Decision:** `01-question-bank.txt` is treated as a source for a canonical information-requirement model (52 fields), not as literal chat prompts.
**Why:** Many question lines are duplicates, agent heuristics, or system defaults, not distinct project facts (`analysis/question-information-mapping.md`).
**Alternative:** Ask all 62 lines verbatim in sequence. Rejected — reproduces the rigid-script problem and asks agent-only heuristics as if they were BA questions.
**Consequence:** The question bank file itself is left untouched as a historical source; `analysis/question-information-mapping.md` is now the authoritative reference for what Rami actually needs to know.

### 3. Canonical RFP structure is fixed at 20 sections

**Decision:** The 20-section schema in `analysis/canonical-rfp-schema.md` (sourced primarily from `02-rfp-master-structure.txt`) is the fixed target structure for all RFPs Rami generates.
**Why:** Cross-checked independently against 3 historical PDFs and `GeneralTemplate.docx` (the ministry's own template) — all four sources corroborate the same section set and mandatory/conditional split, with only minor documented internal inconsistencies in the template's own self-summary.
**Alternative:** A fully dynamic, per-engagement section list. Rejected for the current stage — adds complexity without evidence of need; conditional applicability logic already covers real per-engagement variation.
**Consequence:** Section identity/order/classification changes require re-validating against all 4 sources, not an ad hoc edit.

### 4. Historical RFPs are references, not current facts

**Decision:** Content retrieved from historical RFPs is always `REFERENCE`/`PROPOSED` provenance, never silently written as a `CONFIRMED` fact for the current engagement.
**Why:** A prior project's SLA targets, pricing, or scope are evidence, not truth, for a new project.
**Alternative:** Auto-populate fields from the most similar historical RFP. Rejected — risks silently importing wrong facts into a real government tender document.
**Consequence:** Every retrieval-sourced value requires an explicit BA accept/edit action before it affects a draft (`architecture/rfp-knowledge-architecture.md` §2).

### 5. Provenance is mandatory

**Decision:** Every structured project-memory field carries one of `CONFIRMED / EXTRACTED / REFERENCE / PROPOSED / TBC`, with `history[]` retained.
**Why:** Needed for auditability, safe re-drafting after upstream changes, and the trust-lifecycle rule in decision #13.
**Alternative:** Store plain key-value facts with no status. Rejected — cannot distinguish a BA-confirmed fact from an unconfirmed LLM guess, which is unacceptable for an official government document.
**Consequence:** Every write path (extraction, retrieval, proposal, BA confirmation) must be provenance-aware from day one of implementation.

### 6. RAG instead of fine-tuning for current stage

**Decision:** Historical-RFP knowledge is delivered via retrieval-augmented generation over a local index, not by fine-tuning a model.
**Why:** RAG is source-attributable (required for trust/provenance), updatable without retraining, and dramatically cheaper/simpler at the current corpus size (4 documents).
**Alternative:** Fine-tune a local open-weight model on historical RFPs. Rejected for current stage — no clear quality benefit at this corpus size, loses per-fact source attribution, adds nontrivial local compute/tooling cost.
**Consequence:** `architecture/rfp-knowledge-architecture.md` defines parsing/chunking/embedding/retrieval; no training pipeline is planned.

### 7. Zero paid external AI API dependency

**Decision:** Rami must function with **no required paid AI API** — all inference, embeddings, and retrieval run locally/self-hosted.
**Why:** Explicit hard constraint from the current product owner for this stage (cost control, no per-token billing exposure, no dependency on external API availability for a ministry-facing tool).
**Alternative — explicitly superseded:** `research/04-tools-and-stack.txt` recommends Azure OpenAI as the "preferred enterprise AI API option," and `research/05-azure-costs.txt` provides detailed Azure OpenAI pricing (GPT-4.1/4o family, ~$0.10–$10 per million tokens). **This recommendation is superseded by the current zero-paid-API mandate.** The research files are left in place (not deleted, not edited) as historical context; they no longer represent the current architectural direction.
**Consequence:** All model/runtime decisions in `architecture/local-ai-deployment.md` are built around Ollama + local open-weight models; no Azure/OpenAI SDK or credentials are to be added while this constraint holds. If a future business decision changes this constraint, it must produce a new dated decision entry here, not a silent reversal.

### 8. Ollama / local-model provider is the current default architecture

**Decision:** Ollama is the default local inference runtime; Qwen3 8B is the default balanced model, with Qwen3 4B as a lightweight fallback and Qwen3 14B as an aspirational higher-quality option pending hardware verification.
**Why:** Simple cross-platform local setup, OpenAI-compatible API, built-in JSON-schema-constrained structured output — directly supports the extraction responsibility in `architecture/rami-agent-architecture.md`.
**Alternative:** Raw llama.cpp server, vLLM, LM Studio. Not rejected outright — documented as viable future swaps behind the provider abstraction (decision #9) — just not the current default, mainly for setup-simplicity reasons.
**Consequence:** `config/model-manifest.json` and setup/health-check scripts (planned, not yet built) target Ollama's CLI/API surface first.

### 9. Provider abstraction prevents model/runtime lock-in

**Decision:** All model access goes through a `RamiModelProvider` interface, currently implemented only by `LocalModelProvider` (Ollama-backed).
**Why:** Keeps the zero-paid-API constraint (decision #7) and the runtime choice (decision #8) swappable without touching agent/generation logic if either changes later.
**Alternative:** Call Ollama's API directly from agent code. Rejected — couples business logic to a specific runtime and makes future portability (or, if ever authorized, a paid-API fallback) a large refactor instead of a new provider implementation.
**Consequence:** New implementation work must go through the provider interface, never call an inference API directly from agent/generation code.

### 10. Section-by-section generation

**Decision:** RFP content is drafted one canonical section at a time, gated by a completeness check, never as a single whole-document generation pass.
**Why:** Matches the BA review/approval workflow, keeps LLM context bounded and relevant, and allows partial progress/reopening without re-drafting the whole document.
**Alternative:** Single end-to-end document generation once "enough" information exists. Rejected — poor BA control, harder to audit/approve, harder to handle TBC gaps section-by-section.
**Consequence:** `architecture/rfp-generation-architecture.md` defines the section state machine and generation-context composition as the core generation unit.

### 11. Mandatory BA review

**Decision:** No section may reach `APPROVED` without an explicit BA approval action; no automatic approval on any condition.
**Why:** This is an official government-facing document; unreviewed AI output must never be presented as final.
**Alternative:** Auto-approve sections above some confidence threshold. Rejected outright — no confidence threshold is an acceptable substitute for human sign-off on a real RFP.
**Consequence:** The state machine (`rfp-generation-architecture.md` §1) has no `REVIEW → APPROVED` path that doesn't require an explicit BA action.

### 12. HTML/React live document preview before DOCX export

**Decision:** The live preview during drafting is an HTML/React, Word-like A4-page rendering; DOCX (or other) export is a later, separate concern.
**Why:** Enables fast in-browser iteration (edits, re-drafts, inline TBC flags) without round-tripping through a binary document format during active collaboration.
**Alternative:** Generate a real `.docx` for every intermediate draft. Rejected for the active-drafting phase — slower iteration loop, harder to render inline state (approval status, TBC flags) directly in the document.
**Consequence:** DOCX export is scoped to Phase 5 (final assembly), operating on already-approved section content, not on the live editing surface.

### 13. Approved documents only become future trusted knowledge through explicit promotion

**Decision:** A Rami-generated document that reaches final BA/ministry approval does not automatically become retrievable reference knowledge — a separate, explicit trust-promotion action is required before indexing.
**Why:** Prevents silent knowledge-quality drift; keeps a human accountable for what enters the corpus that future RAG retrieval treats as trustworthy.
**Alternative:** Auto-index every approved document. Rejected — "approved for delivery" and "approved as a reusable reference pattern" are different judgments (e.g. a document approved under unusual, non-representative circumstances).
**Consequence:** `architecture/rfp-knowledge-architecture.md` §5 defines this as a two-step process; Phase 5/6 implementation must include an explicit promotion action, not just a status flag flip.

### 14. Model weights and production secrets stay out of Git (knowledge files now intentionally versioned)

**Decision (updated Aug 2026 — Phase 1 implementation):** The `.gitignore` rules previously blocking `.private-context/knowledge/*.pdf`, `*.docx`, `*.doc` have been removed. The approved RFP source documents are now **intentionally versioned** in Git. Model weights, Google Sheets secrets, `.env.local`, credentials, and generated AI artifacts remain permanently excluded.

**Original decision (Aug 2026 — documentation pass):** No model weights, no Google Sheets secrets, and no sensitive RFP source files (PDFs/DOCX under `.private-context/knowledge/`) are ever committed. This pass added explicit `.gitignore` rules as defense-in-depth.

**Why original was superseded:** The project owner explicitly reviewed the knowledge files and approved their inclusion in this repository. They contain no information considered confidential for this repository's scope. The "private" in `.private-context` is a folder name convention only, not a security boundary.

**What stays permanently excluded:**
- `.env.local`, `.env.production.local`, any secrets/credentials/tokens
- Google Sheets shared secrets
- Ollama model weight files and local model caches
- Generated multi-GB AI artifacts
- Temporary extraction directories

**Consequence:** The Phase 1 commit includes the `.private-context/knowledge/` source files. Future agents and developers must not re-add ignore rules for these files without explicit project-owner approval. Removing the rules was the Phase 1 implementation's first action.

### 15. Google Sheets remains current structured persistence but not RAG storage

**Decision:** Google Sheets continues as the structured-facts persistence boundary (project memory), adapted over time (new entities, read endpoints); it is never used to store embeddings/chunks for retrieval.
**Why:** It is real, working infrastructure already in place; replacing it prematurely would be wasted effort, but it is architecturally the wrong tool for vector storage/similarity search.
**Alternative:** Migrate persistence to a different database immediately. Rejected for the current stage — no evidence the current Sheets approach can't be adapted (see `CURRENT_STATE.md` §3 gaps); revisit only if adaptation proves insufficient.
**Consequence:** `architecture/rfp-knowledge-architecture.md` §4/§6 draws a hard line: local flat-file/SQLite index for RAG, Sheets (adapted) for project-memory facts — these must never merge into one store.

---

## Superseded research (for the record)

`research/04-tools-and-stack.txt` and `research/05-azure-costs.txt` are **not deleted or edited**. They remain as historical research context but are **explicitly superseded** by decision #7 above for as long as the zero-paid-AI-API constraint holds. Any future agent that finds these files must treat them as historical, not current, guidance, and defer to this file.
