# Rami — Next Steps

Last updated: 2026-08-26 (Phase 2.1 complete; second-machine handoff added)

## If you are setting up a second Windows laptop

You are **not** here to start Phase 3.

Read `.private-context/handoff/SECOND_MACHINE_HANDOFF.md` and stop until the human pastes Prompt 2 from `.private-context/handoff/SECOND_MACHINE_PROMPT_2.md`.

---

## Phase 2.1 — Complete ✅
All six Phase 2.1 correction items are done:
1. ✅ Bilingual Arabic/English conversation — Rami replies in the user's language
2. ✅ Conditional section applicability — system-impl shows 18–19 sections; consulting shows 12
3. ✅ Progress semantics — "Sections X/Y approved" and "Information Z% gathered" clearly separated
4. ✅ Next-question priority — business-critical fields before administrative details
5. ✅ Users normalization — `UsersValue` shape enforced via `normalizeUsersValue()`
6. ✅ RTL rendering — Arabic messages use `dir="rtl"` per message, not app-wide

---

## Immediate: Phase 3 — Historical RFP Knowledge (RAG)

Phase 2 is complete. Phase 3 immediately follows.

### Phase 3 objectives
1. **Ingest approved historical RFPs** — parse `.private-context/knowledge/*.pdf` (MoDEE Stage 3, OFA MPLS, RFP eGovt 2026) and `GeneralTemplate.docx` into text chunks
2. **Generate embeddings** — use `nomic-embed-text` (already in manifest) to create vector embeddings per chunk
3. **Build local vector index** — flat-file or SQLite-backed (stored in `.rami-index/`, already gitignored)
4. **Implement retrieval** — given a missing field or section context, retrieve source-attributed chunks
5. **Provenance**: retrieval results MUST carry source metadata and arrive as `REFERENCE` status — never as `CONFIRMED`
6. **`SEARCH_HISTORICAL_RFPS` action type** — already defined in `src/types/conversation.ts` as a placeholder; implement it in Phase 3
7. **`PROPOSE_VALUE` action type** — when a `REFERENCE` chunk strongly matches a missing field, propose it to the BA with attribution

### Files to create in Phase 3
- `src/server/rag/ingestionPipeline.ts`
- `src/server/rag/chunkStrategy.ts`
- `src/server/rag/vectorIndex.ts`
- `src/server/rag/retrieval.ts`
- `scripts/ingest-knowledge.ts`
- `scripts/build-rag-index.ts`

---

## Phase 4 — Live Section Drafting

### Objectives
- Generate real draft prose for each RFP section when `READY_TO_DRAFT`
- Display draft in the right pane (replace placeholder with real content)
- BA review and approval flow
- Section revision via conversation ("make the SLA stricter")
- `CONFIRMED` status for accepted drafts
- Implement section state transitions in the full UI

---

## Phase 5 — Final RFP Assembly and Export
- Assemble all `APPROVED` section drafts into a complete RFP document
- DOCX export (using docx.js or similar)
- Cover page with metadata from ProjectMemory
- Table of contents

---

## Known limitations (post Phase 2.1)
1. **Sessions reset on server restart** — in-memory store; client-side localStorage provides recovery of history but memory is lost. Mitigate by adding SQLite store in Phase 3.
2. **Section progress not yet accurate** — right pane shows all applicable sections with NOT_STARTED state because section state transitions are Phase 4. The information completion percent is approximate (client-side optimistic update).
3. **Document title/beneficiary not shown in A4 shell** — these live in server memory and aren't synced to the client (planned for Phase 3 with a GET /api/rami/session endpoint).
4. **No BA confirmation UI** — EXTRACTED values need a path to CONFIRMED. Phase 4 should add inline confirmation actions.
5. **`completionPercent` is optimistic** — current calculation bumps by 3% per extracted field as client-side heuristic. Real calculation requires server to return `gaps.completionPercent` in the done event. Phase 3 should include this in the SSE payload.

---

## Phase 3 first action
Read:
```
.private-context/handoff/CURRENT_STATE.md
.private-context/handoff/DECISIONS.md
.private-context/architecture/rfp-knowledge-architecture.md
.private-context/analysis/historical-rfp-findings.md
```

Then read the Phase 2 API route and session store to understand the runtime architecture before adding RAG integration.
