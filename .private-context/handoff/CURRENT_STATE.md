# Rami — Current Implementation State

Last updated: 2026-08-31 (Phases 1–5 checkpoint — ready for Device 2 handoff)

Authoritative HEAD: `origin/main` (`git log -1` after pull).

## Runtime truth

### Persistence
- PostgreSQL is authoritative for live project state
- Dashboard loads from `GET /api/rami/workspace`
- Create document: `POST /api/rami/projects` → `/documents/{documentKey}/interview`
- Delete document: `DELETE /api/rami/projects/{documentKey}` (CASCADE via existing FKs)
- Shared snapshot: `dev/database/rami_ai_shared.dump` + `rami_ai_shared.metadata.json`
- Private dumps: `.rami-db-backups/` (gitignored)

### Migrations
Latest: **`007_project_generation_references.sql`** (7 migrations total).

### Information model
| Item | Count |
|---|---:|
| Sections | 20 |
| Fields | 59 |
| Questions | 69 |
| QuestionFields | 66 |
| SectionFields | 78 |

### Live DB inventory (snapshot metadata — 2026-08-31)
See `dev/database/rami_ai_shared.metadata.json` for authoritative counts at checkpoint time.

| Table / metric | Count (checkpoint) |
|---|---:|
| projects | 25 |
| project_facts | 187 |
| messages | 28 |
| project_section_contents | 105 |
| historical_knowledge_chunks | 732 |
| historical_chunk_embeddings | 732 |
| historical_field_proposals | 13 |
| project_generation_references | 6 |

Embeddings: `nomic-embed-text` / 768-d / `REAL[]`.

### Demo / proof projects
- `rami-gen-core-demo` — generated RFP + DOCX; live Modal AI-edit verified (introduction v2)
- `rami-model-expansion-demo` — 59-field conversational proof
- `rami-gen-rag-demo` — generation-reference proof
- `rami-rag-controlled-demo` — controlled chat RAG
- `rami-rag-live-eval` — live Qwen generation-RAG A/B

## Phases 1–5 (this checkpoint)

### Phase 1 — Engine & chat polish
- Thinking indicator visible during `thinking` / empty streaming
- Unicode round-trip through Modal bridge (`utf8BridgeEnv`, `thinkStripper`)
- Engine timers interpolate client-side (5s poll + 1s tick)
- Stop Rami reassurance; generation disabled when engine OFF

### Phase 2 — Layout & understanding
- Desktop sidebar collapse + `localStorage` persistence
- Engine panel OFF vs ERROR distinction; performance disclosure
- Project Understanding panel compact by default

### Phase 3 — Document workspace
- Sidebar collapse icon at top (icon-only)
- RFP Document panel layout polish; compact SectionProgress strip
- Document-scoped `sessionStorage` for section/view mode

### Phase 4 — Edit with Rami
- Separate AI edit pipeline (`aiEditRfpSection`) — not chat-routed
- Creates new DRAFT version; ProjectFacts unchanged
- Approved sections require reopen
- Validator: `npm run validate:edit-with-rami`

### Phase 5 — Editor, history, delete
- Engine panel: outside-click, Escape, header/chevron collapse (no `movedRef` bug)
- Manual structured block editor + Advanced JSON disclosure
- Version history UI; read-only preview; restore → new version
- Dashboard kebab → Delete RFP with confirmation
- Validators: `validate:ui-phase-b5`, `validate:manual-editor-versioning`, `validate:project-delete`

## Non-negotiable invariants (unchanged)

- ProjectFacts authoritative; manual/AI document edits do not mutate facts
- TBC blocks protected in manual editor
- Section version history immutable; restore creates new version
- No automatic historical retrieval during generation or AI edit
- Drafting references never affect readiness
- Section mode vs Full RFP mode remain distinct
- DOCX assembles persisted PostgreSQL content

## Validation commands

```bash
npm run db:check
npm run historical:check
npm run validate:shared-dump
npm run validate:edit-with-rami
npm run validate:manual-editor-versioning
npm run validate:project-delete
npm run validate:ui-phase-b5
npx tsx scripts/final-handoff-integration.ts
```

## Next
Golden End-to-End RFP evaluation. See `NEXT_STEPS.md`.
