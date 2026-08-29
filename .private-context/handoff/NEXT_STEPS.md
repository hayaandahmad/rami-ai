# Rami — Next Steps

Last updated: 2026-08-26 (Phase 2.2 Adaptive Control Plane complete; not committed)

## If you are setting up a second Windows laptop

You are **not** here to start Phase 3.

Read `.private-context/handoff/SECOND_MACHINE_HANDOFF.md` and stop until the human pastes Prompt 2 from `.private-context/handoff/SECOND_MACHINE_PROMPT_2.md`.

---

## Phase 2.2 — Complete ✅ (working tree; commit only when human asks)

Adaptive Control Plane implemented:
- ProjectContext classifiers (UNDETERMINED defaults; not duplicated into ProjectMemory)
- PackId freeze + field tags on existing 52 fields
- GapStatus / materiality / depth / NextAction
- Correction vs contradiction in memoryUpdater
- Materiality-only stop + safe UNKNOWN
- Server `completionPercent` / `collectionSufficient` / `nextActionType` on SSE
- `npm run validate:phase2-adaptive` (16/16)

Authority: `.private-context/architecture/adaptive-question-architecture.md`

---

## Immediate: Phase 2.3 — Domain Requirement Catalog Expansion

Do **not** start until the human asks.

### Objectives
1. Expand domain-specific requirement catalogs (AI/agentic, data platform, connectivity, ARIS/BPR, etc.) beyond the 52-field tags
2. Keep PackId names frozen from Phase 2.2
3. Preserve ProjectContext vs ProjectMemory separation
4. Keep gap/NextAction/stop rules; enrich which fields become applicable per pack/domain

### Explicitly still later
- Phase 3 RAG / embeddings / PDF ingestion
- Phase 4 drafting / confirm UI
- Phase 5 DOCX assembly

---

## Phase 3 — Historical RFP Knowledge (RAG)

After Phase 2.3 (or if human reorders):

1. Ingest approved historical RFPs into text chunks
2. Embeddings via `nomic-embed-text` (manifest already lists it; do not pull in 2.2)
3. Local vector index under `.rami-index/`
4. Retrieval with `REFERENCE` provenance only
5. Implement `SEARCH_HISTORICAL_RFPS` / `PROPOSE_VALUE` placeholders

---

## Phase 4 — Live Section Drafting
- Real draft prose; BA review; CONFIRMED promotion UI; section state transitions

## Phase 5 — Final RFP Assembly and Export
- Assemble APPROVED drafts; DOCX export

---

## Known limitations (post Phase 2.2)
1. Sessions still reset on server restart (in-memory store)
2. Section progress states still mostly NOT_STARTED until Phase 4
3. No BA confirmation UI (EXTRACTED may be KNOWN for questioning; CONFIRMED UI is Phase 4)
4. Domain catalogs still thin (Phase 2.3)
5. No RAG / generation / DOCX yet

---

## Phase 2.3 first action (when asked)
Read:
```
.private-context/architecture/adaptive-question-architecture.md
.private-context/handoff/CURRENT_STATE.md
.private-context/handoff/DECISIONS.md
src/schema/fieldControlMeta.ts
src/types/projectContext.ts
```
