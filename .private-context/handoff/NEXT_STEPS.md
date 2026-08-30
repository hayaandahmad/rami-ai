# Rami — Next Steps

Last updated: 2026-08-30 (handoff: RFP Generation Core is next)

Entrypoint: `.private-context/handoff/START_HERE.md`  
Authoritative HEAD: `origin/main` (`git log -1` after pull).  
Last feature milestone: `cd69fb5` (Section Readiness).

---

## Checkpoint now

PostgreSQL live-validated. Shared development snapshot is in Git (`dev/database/rami_ai_shared.dump`). Section Readiness implemented. **No RFP prose generation yet.**

Second-machine bootstrap: install PostgreSQL → `.env.local` (`RAMI_DB_NAME=rami_ai`, loopback, local password) → `npm run db:restore-shared -- --confirm-replace-local-rami-ai` → `npm run db:check` → continue RFP Generation Core.

---

## Path from now to the first complete generated RFP

1. Define/finalize the generation contract and one reusable generated-section model
2. Add persistent ProjectSections **content** storage (migration + repository)
3. Implement `SectionGenerationContext` builder (controlled facts only)
4. Implement anti-hallucination / TBC generation rules
5. Generate **ONE** real section end-to-end first
6. Persist and reload that generated section (survives restart)
7. Implement regenerate / edit / approve **backend** state
8. Generalize the same pipeline across applicable sections (not one implementation per section)
9. Implement full RFP assembly (backend)
10. Connect real generated content to A4/document preview
11. Implement UI actions and document experience
12. Implement real DOCX export
13. Run a complete real-RFP evaluation from collected facts to final document

---

## SECOND DEVELOPER — RFP GENERATION CORE (~4 hours)

**Backend priority. Not RAG. Not training. Not Phase 2.3. Not UI redesign.**

Inspect first:

- `.private-context/architecture/rfp-section-readiness.md`
- `.private-context/architecture/rfp-generation-architecture.md`
- `src/server/rami/sectionReadiness.ts`
- `src/server/ai/` (`RamiModelProvider`, Local + Modal)
- `src/server/db/` + repositories (do not break hydration)

Primary focus:

- Finalize `SectionGenerationContext` + one reusable `GeneratedSection` (or equivalent) used for persistence, later preview, and later DOCX
- PostgreSQL migration + repository for generated section content (additive, non-destructive)
- Controlled context builder (not full DB, not full chat, not historical RFPs as current facts)
- Anti-hallucination / TBC prompt rules
- Call existing `RamiModelProvider` (local default; Modal only if already READY — do not auto-start GPU)
- Generate the **first real meaningful RFP section** for a `READY_TO_DRAFT` or `DRAFTABLE_WITH_TBC` applicable section
- Persist + reload generated content
- If time: regenerate backend; approval state backend; generalize pipeline to more applicable sections
- Full-RFP assembly backend **only if** the one-section pipeline is stable

Minimum frontend allowed: only what is required to **manually verify** generation. Main document experience is not this session.

Do **not** prioritize: RAG, pgvector, LoRA, Qwen 14B, large UI redesign, visual polish.

---

## FIRST DEVELOPER — after second developer pushes

Pull latest `main`. Continue from whatever checkpoint `START_HERE` / this file then record.

Expected focus:

- Real A4 / Word-style preview of generated structure
- Section navigation / status
- Generate / Regenerate / Edit / Approve UI wiring
- Full-RFP document preview
- Visual TBC handling
- Interaction polish
- DOCX/export integration **if** the backend contract exists
- End-to-end manager demo preparation

Do not bind work to files that do not exist yet.

---

## Generation risks (hard)

1. Do not let Qwen decide readiness — use `getSectionReadiness()`.
2. Do not send the entire DB or chat history blindly.
3. Do not invent missing dates, budgets, SLAs, quantities, legal terms, evaluation percentages, technologies, users, or procurement requirements.
4. Preserve TBC explicitly (`[To be confirmed]` / equivalent). Do not treat TBC as an answer.
5. Do not treat historical/reference content as current ProjectFacts.
6. Use one reusable document representation for persistence / preview / DOCX where practical.
7. Do not create a separate generation implementation per section.
8. Generated content must survive server restart (PostgreSQL).
9. Regeneration must not silently destroy approved content.
10. Do not break PostgreSQL hydration (`getOrHydrateSession` / `hydrateProject`).
11. Do not break Local/Modal `RamiModelProvider` abstraction.
12. Do not start RAG as part of this critical path.

---

## Still later (do not start)

- Phase 2.3 domain catalogs
- Phase 3 RAG / embeddings / PDF ingestion
- Fine-tuning / LoRA

---

## Known limitations

1. Other machines: local PostgreSQL + `.env.local` + `npm run db:restore-shared -- --confirm-replace-local-rami-ai` (do not rebuild project data from scratch)
2. Field coverage gaps: `namedRoles` (CRITICAL when manpower applies); admin `clarificationContact` / `submissionChannel` (IMPORTANT); PMO `governanceCadence` (IMPORTANT)
3. No BA CONFIRMED promotion UI
4. Spoken-TBC is English whole-value matching only
5. Information readiness ≠ document APPROVED
