# Rami Conversational Agent Architecture

Status: **Implemented through Phase 2.2 Adaptive Control Plane.** See `handoff/CURRENT_STATE.md`. Detail for packs / GapStatus / NextAction / stop: `adaptive-question-architecture.md`.

## 1. Core loop (Phase 2.2)

```text
BA Message
  ↓
LLM structured extraction (facts + signals only)
  ↓
applyExtractedFacts (correction vs contradiction)
  ↓
classifyProject → ProjectContext (UNDETERMINED → evidence)
  ↓
withActivePacks (CORE-only while unresolved)
  ↓
analyzeGaps (GapStatus, NextAction, collectionSufficient)
  ↓
NextAction
  ├── ASK_REQUIREMENTS (1 primary + ≤2 related)
  ├── CLARIFY_CONTRADICTION (memory_field | project_context)
  ├── STOP_COLLECTION (materiality-only; safe UNKNOWN)
  ├── OPEN_ENDED
  ├── SEARCH_HISTORICAL_RFPS / PROPOSE_VALUE  (Phase 3 placeholders)
  └── READY_TO_DRAFT                         (Phase 4 placeholder)
```

LLM extracts and phrases. TypeScript owns classification, packs, gaps, NextAction, stop, and provenance transitions.

## 2. Strict separation of responsibilities

### LLM
- Parse free-form BA messages into candidate field updates + signals (`updateKind`, stage/domain signals, deferred, conflicts)
- Phrase one natural question / clarification / stop summary from injected NextAction
- Never choose packs, GapStatus, NextAction cluster, or collectionSufficient

### Deterministic TypeScript
- ProjectMemory (59 facts) + ProjectContext (classifiers / packs / sufficiency)
- GapStatus, materiality stop, ASK clustering, correction vs contradiction
- Provenance: REFERENCE cannot go directly to CONFIRMED; TBC deprecated → maps to UNKNOWN in gaps
- Section applicability (visibility ≠ required while UNDETERMINED)

### Retrieval (Phase 3 — not implemented)
- Historical RAG with REFERENCE provenance only — see `rfp-knowledge-architecture.md`

## 3. `RamiModelProvider` abstraction

Unchanged: LocalModelProvider → Ollama. No model/manifest changes in Phase 2.2.

## 4. Multi-fact messages and duplicate-question avoidance

Unchanged from Phase 2: one BA message can update many fields. Fields already KNOWN (EXTRACTED/CONFIRMED) are not re-asked unless corrected/contradicted or reopened by rules.

## 5. What this document intentionally does not cover

- Adaptive packs / stop / correction detail → `adaptive-question-architecture.md`
- Section lifecycle → `rfp-generation-architecture.md` (Phase 4)
- RAG provenance → `rfp-knowledge-architecture.md` (Phase 3)
- UX flow → `product/conversational-rfp-workflow.md`
- Model/runtime → `local-ai-deployment.md`
