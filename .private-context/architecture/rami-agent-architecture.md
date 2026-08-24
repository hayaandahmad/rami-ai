# Rami Conversational Agent Architecture

Status: **Final design for current architecture pass. Not implemented yet** (see `handoff/CURRENT_STATE.md` and `handoff/NEXT_STEPS.md`).

## 1. Core loop

```text
BA Message
  ↓
LLM structured extraction
  ↓
Structured Project Memory (merge/update)
  ↓
Deterministic completeness / gap evaluation
  ↓
Next-best action
  ├── ask BA (missing required field)
  ├── retrieve history (RAG evidence for a field or clause)
  ├── propose (PROPOSED value from template/history/default, needs BA confirmation)
  ├── mark TBC (explicitly deferred, drafting may proceed with a flagged gap)
  └── draft section (all required fields for the current section are CONFIRMED or accepted-TBC)
```

Every BA message goes through the same loop regardless of which section is active. The loop is **re-entrant**: a single BA message can update fields belonging to multiple sections at once (see §4).

## 2. Strict separation of responsibilities

### LLM RESPONSIBILITIES (non-deterministic, model-dependent)

- Parse a free-form BA message into zero or more candidate structured field updates (mapped to the canonical fields in `question-information-mapping.md`).
- Classify each candidate update's apparent confidence/source (stated fact vs. hedge vs. question back to Rami).
- Generate natural-language questions, clarifications, and section draft prose from a fully-specified generation context (see `rfp-generation-architecture.md`).
- Summarize retrieved historical evidence into a proposal the BA can accept/reject.

The LLM **never** decides on its own whether a section is "complete enough to draft," which field is asked next, or whether a REFERENCE fact is allowed to become a CONFIRMED fact. Those are deterministic application decisions (below).

### DETERMINISTIC APPLICATION LOGIC (plain TypeScript, no model call)

- Maintains the canonical 20-section schema and the 52-field canonical information model (`canonical-rfp-schema.md`, `question-information-mapping.md`) as the single source of truth for "what must exist."
- Evaluates, per section, whether all `Required` fields (given current `applicable-when` conditions) are `CONFIRMED` or `TBC`-with-BA-acknowledgment — this gate decides `READY_TO_DRAFT` (see the section state machine in `rfp-generation-architecture.md`).
- Chooses the next-best question using fixed priority rules (required-before-conditional, current-section-before-other-sections, undo duplicate questions already answered).
- Enforces the provenance promotion rules (e.g. `REFERENCE → PROPOSED` requires an explicit BA-confirmation step; a bare LLM extraction can never mark a field `CONFIRMED` on its own — see `rfp-knowledge-architecture.md` §Provenance).
- Persists every update to structured project memory (initially backed by the existing Google Sheets boundary — see `handoff/CURRENT_STATE.md`).

### RETRIEVAL RESPONSIBILITIES (local RAG, see `rfp-knowledge-architecture.md`)

- Given a missing/ambiguous field or an upcoming section draft, retrieve source-attributed evidence from the local historical-RFP index.
- Return evidence with mandatory provenance metadata (source filename, section path, trust tier) — retrieval never returns bare text without attribution.
- Retrieval results are always treated as `REFERENCE` until a human explicitly promotes them via the deterministic layer — the retrieval layer itself has no authority to write project memory.

**Hard rule preserved from the prior pass:** future implementations must not let deterministic business rules (gap detection, next-question selection, provenance promotion, section-ready gating) drift into free-form LLM reasoning. If a future engineer is tempted to "just ask the model whether the section is ready," that is a regression against this architecture.

## 3. `RamiModelProvider` abstraction

```text
RamiModelProvider  (interface — extraction, chat, drafting, embeddings)
        ↓
LocalModelProvider  (Phase-1 default implementation)
        ↓
Ollama (local HTTP API)
```

- `RamiModelProvider` is a narrow interface with methods roughly like `extract(message, schema)`, `chat(context)`, `draftSection(context)`, `embed(text)`. It has **no knowledge of Ollama, HTTP, or any specific model**.
- `LocalModelProvider` is the only implementation planned for Phase 1–3. It talks to Ollama's OpenAI-compatible REST API and uses Ollama's JSON-schema-constrained structured output for the `extract()` method so LLM output is always valid against the canonical field schema.
- The provider boundary exists specifically so a future, still-zero-paid-cost alternative runtime (e.g. llama.cpp server, vLLM) can be swapped in without touching the agent loop. It also means that if the "zero paid AI API cost" constraint is ever relaxed by a future business decision, a paid-API provider could be added **without changing any code above this line** — this is a portability/optionality safeguard, not a plan to introduce paid APIs.
- Full model selection, Ollama setup, and hardware considerations are in `local-ai-deployment.md`.

## 4. Multi-fact messages and duplicate-question avoidance

- A single BA message (e.g. "This is a system implementation RFP for the Ministry, the deadline is end of Q2, and we already ran a pilot last year") must be extracted into **multiple** field updates in one LLM call (`documentType`, `proposalDeadline`, `previousPhases`) rather than requiring one message per field.
- Before generating the next question, the deterministic layer always re-checks current project memory state — a field already `CONFIRMED` or `EXTRACTED` from an earlier message is never asked again unless project memory changes make it stale (see the reopening rule in `rfp-generation-architecture.md`).

## 5. What this document intentionally does not cover

- The exact section lifecycle states/transitions → `rfp-generation-architecture.md`.
- The provenance state machine and trust lifecycle → `rfp-knowledge-architecture.md`.
- The BA-facing conversational flow and UX → `product/conversational-rfp-workflow.md`.
- Model/runtime selection details → `local-ai-deployment.md`.
