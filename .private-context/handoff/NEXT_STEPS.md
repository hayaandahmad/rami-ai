# Rami — Next Steps

Last updated: 2026-08-25

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

## Known Phase 2 limitations
1. **Sessions reset on server restart** — in-memory store; client-side localStorage provides recovery of history but memory is lost. Mitigate by adding SQLite store in Phase 3.
2. **Section progress not yet accurate** — right pane shows all 20 sections with NOT_STARTED state because section state transitions are deterministic (Phase 4). The completion percent is approximate.
3. **Document title/beneficiary not shown in A4 shell** — these live in server memory and aren't synced to the client in Phase 2 (planned for Phase 3 with a GET /api/rami/session endpoint).
4. **`users` field** — extraction returns simple string "200 staff"; the ProjectMemory type expects `UsersValue` (`{ internal: string[], external: string[] }`). Phase 3 should add normalization for complex field values.
5. **No BA confirmation UI** — EXTRACTED values need a path to CONFIRMED. Phase 4 should add inline confirmation actions.

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
