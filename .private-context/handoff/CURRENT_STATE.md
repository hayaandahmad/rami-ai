```text
FOR FUTURE CURSOR SESSIONS:
Read CURRENT_STATE.md, DECISIONS.md, and NEXT_STEPS.md before modifying Rami.
```

# Current State of Rami

Status: accurate as of **Phase 1 implementation complete (Aug 2026)**. This is a handoff snapshot — see `../architecture/`, `../analysis/`, and `../product/` for the target design.

## 1. Repository state

- Git repo on branch `main`, tracking `origin/main`.
- Phase 1 commit: `Implement Rami local AI and structured memory foundation`
- **Newly versioned (Phase 1):** `.private-context/knowledge/*.pdf` and `.private-context/knowledge/*.docx` — the project owner approved these for Git. See `DECISIONS.md` #14-updated.
- All Markdown under `.private-context/architecture/`, `.private-context/analysis/`, `.private-context/product/`, `.private-context/handoff/` — committed.

## 2. What Phase 1 implemented

Phase 1 added the canonical knowledge and local AI foundation. **No UI was changed. No Google Sheets logic was changed.**

### New TypeScript files

| File | Purpose |
|---|---|
| `src/schema/rfpSchema.ts` | 20-section canonical RFP schema as typed const. Authority for all section identity/order/classification in Rami. |
| `src/schema/projectMemoryFields.ts` | 52 canonical information requirements, typed, with metadata (targetSections, requirement, historicalRetrievalSupported, baConfirmationRequired, etc.). |
| `src/types/provenance.ts` | `InformationStatus` union, `ProjectMemoryField<T>`, `InformationEntry<T>`, provenance transition rules, `createMemoryField`, `updateMemoryField` (enforces hard rule: REFERENCE → CONFIRMED illegal). |
| `src/types/sectionState.ts` | `SectionLifecycleState` union, transition rules, `assertSectionTransition`, `advanceSectionState`, `SectionStateRecord`. |
| `src/types/projectMemory.ts` | `ProjectMemory` interface (one typed field per canonical ID), compound value types (`UsersValue`, `AssumptionsValue`, `SlaTier[]`, etc.), `ProjectSession`, `createEmptyProjectMemory`. |
| `src/server/ai/RamiModelProvider.ts` | Provider-independent interface: `complete()`, `extractStructured()`, `embed()`, `healthCheck()`. |
| `src/server/ai/LocalModelProvider.ts` | Ollama-backed implementation. Reads manifest, uses Ollama `format` for schema-constrained JSON, handles errors/timeouts. |
| `src/server/ai/modelManifest.ts` | Reads and caches `config/model-manifest.json`. |
| `src/server/ai/index.ts` | Barrel; `getDefaultProvider()` singleton factory. |

### New config / scripts

| File | Purpose |
|---|---|
| `config/model-manifest.json` | Model roles (default: qwen3:8b, lightweight: qwen3:4b, quality: qwen3:14b, embeddings: nomic-embed-text), Ollama base URL. |
| `scripts/setup-local-ai.ps1` | Idempotent setup: installs Ollama if missing (winget), starts service, pulls configured models. |
| `scripts/check-local-ai.ps1` | Health-check: manifest, Ollama, service, models, smoke-test inference. |
| `scripts/validate-phase1.ts` | Deterministic validation: 20 sections, 52 fields, transition rules, no duplicates, manifest parses. Run via `npm run validate:phase1`. |

### npm scripts added

```json
"validate:phase1": "tsx scripts/validate-phase1.ts",
"ai:setup": "powershell ... scripts/setup-local-ai.ps1",
"ai:setup:quality": "powershell ... scripts/setup-local-ai.ps1 -PullQuality",
"ai:check": "powershell ... scripts/check-local-ai.ps1"
```

## 3. Local AI hardware and model status

| Component | Value |
|---|---|
| GPU | NVIDIA GeForce RTX 4060 Laptop GPU |
| VRAM | 8,188 MiB (~8 GB) |
| CPU | Intel Core i9-14900HX |
| RAM | 15.6 GB |
| Ollama version | 0.32.15 (installed via winget, Aug 2026) |
| Default model | qwen3:8b — installed ✓ |
| Lightweight model | qwen3:4b — installed ✓ |
| Quality model | qwen3:14b — NOT pulled (optional, borderline for 8GB VRAM) |
| Embedding model | nomic-embed-text — NOT pulled (Phase 3) |

## 4. What Rami currently does (as of this pass)

Rami today is still a **fixed, linear, mock-data-driven questionnaire prototype** for its UI — Phase 1 added only the foundational backend structures:

- A BA picks a document type on `/documents/new` (only `system-implementation` is demo-enabled).
- `createMockDocument()` creates an **in-memory-only** `DocumentProject`.
- The interview walks a **static, hardcoded array of 17–18 questions**, one at a time, in a fixed order.
- Each answer save is **written to Google Sheets** (real, working persistence).
- **Phase 1 new:** the canonical schema, 52-field memory, provenance types, section state machine, and Ollama provider are all in the codebase but **not yet wired to the UI** — they are the foundation for Phase 2.
- There is **no chat UI, no LLM call from the UI, no RAG** yet.

## 5. Google Sheets persistence — exact current position

Same as previous snapshot (unchanged by Phase 1):

- **Real and working:** `answers` tab and `sessions` tab via `POST /api/interview/save`.
- **Write-only overall** — no read/hydration path exists.
- **Known gaps** (still open): interview completion not persisted; `saveAndExit` local only; `beneficiaryEntity` not synced back.
- **Phase 2** will decide how structured `ProjectMemory` adapts the current persistence boundary.

## 6. Existing UI

Unchanged by Phase 1. See previous snapshot for migration verdicts (KEEP/ADAPT/RETIRE).

## 7. What is implemented vs. not

| Capability | Status |
|---|---|
| 20-section canonical schema (TypeScript) | **Implemented** (Phase 1) |
| 52-field information requirements (TypeScript) | **Implemented** (Phase 1) |
| ProjectMemory + provenance types | **Implemented** (Phase 1) |
| Section state machine foundation | **Implemented** (Phase 1) |
| RamiModelProvider interface | **Implemented** (Phase 1) |
| LocalModelProvider (Ollama) | **Implemented** (Phase 1) |
| Ollama installed and running | **Yes** (Phase 1) |
| Default model (qwen3:8b) | **Installed** (Phase 1) |
| Structured-output smoke test | **Passed** (Phase 1) |
| Chat UI / conversational engine | Not implemented — Phase 2 |
| Google Sheets read/hydration | Not implemented — Phase 2 |
| RAG / local knowledge index | Not implemented — Phase 3 |
| Section drafting / live preview | Not implemented — Phase 4 |
| DOCX export | Not implemented — Phase 5 |

## 8. Files a future agent must read first

1. This file, `DECISIONS.md`, `NEXT_STEPS.md` (this folder).
2. `../analysis/canonical-rfp-schema.md` and `../analysis/question-information-mapping.md` — the information model.
3. `../architecture/rami-agent-architecture.md`, `rfp-knowledge-architecture.md`, `rfp-generation-architecture.md`, `local-ai-deployment.md` — the target system design.
4. `../product/conversational-rfp-workflow.md` — the target UX.
5. Only then, if implementing, `src/schema/`, `src/types/`, `src/server/ai/` — the Phase 1 types.

## 9. Known limitations (current app, Phase 1)

- Phase 1 types are not yet consumed by any UI or API route — they exist as a correct, tested foundation.
- Google Sheets schema has not been extended for `ProjectMemory` yet (Phase 2 scope).
- `qwen3:14b` was not tested on this machine's 8GB VRAM; validate before enabling it.
- README.md description of "no backend, no APIs" is outdated (has been since the Sheets API was added — pre-Phase 1).

## 10. Last completed phase

Phase 1: Canonical knowledge + structured memory + local AI foundation.
TypeScript/typecheck: **PASS**
Lint: **PASS**
Build: **PASS** (legacy UI unchanged)
Phase 1 validation script: **PASS** (20 sections, 52 fields, all transitions)
Local AI smoke test: **PASS** (structured output from qwen3:8b)
