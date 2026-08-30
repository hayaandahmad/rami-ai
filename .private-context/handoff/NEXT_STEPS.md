# Rami — Next Steps

Last updated: 2026-08-30 (handoff: RFP Generation Core backend complete → UI next)

Entrypoint: `.private-context/handoff/START_HERE.md`  
Authoritative HEAD: `origin/main` (`git log -1` after pull).  
Last feature milestone: RFP Generation Core backend (this handoff).

---

## Checkpoint now

PostgreSQL live-validated. Shared development snapshot refreshed with generation demo fixtures.  
Section Readiness implemented. **RFP Generation Core backend implemented and proven.**

Bootstrap: PostgreSQL → `.env.local` → `npm run db:restore-shared -- --confirm-replace-local-rami-ai` → `npm run db:check` → continue **UI / A4 preview**.

---

## Path from now to the first complete generated RFP

1. ~~Define generation contract + GeneratedSection~~ ✅
2. ~~Persistent ProjectSections content storage~~ ✅
3. ~~SectionGenerationContext builder~~ ✅
4. ~~Anti-hallucination / TBC rules~~ ✅
5. ~~Generate ONE real section end-to-end~~ ✅ (`background` on `rami-gen-core-demo`)
6. ~~Persist and reload~~ ✅
7. ~~Regenerate / approve backend~~ ✅
8. ~~Generalize pipeline~~ ✅ (same service; also generated `scopeOfWork`)
9. ~~Full RFP assembly backend (skeleton)~~ ✅ (`assembleRfpDocument` — does not invent missing sections)
10. **Connect real generated content to A4/document preview** ← NEXT
11. Implement UI actions and document experience
12. Implement real DOCX export
13. Run a complete real-RFP evaluation from collected facts to final document

---

## FIRST DEVELOPER — RFP UI / A4 PREVIEW / DOCUMENT EXPERIENCE

**Frontend priority. Backend contract is ready.**

Pull latest `main`. Read `START_HERE.md` UI contract section.

Focus:

- Render `GeneratedSection.blocks` in A4 / Word-style preview (`DocumentPreviewShell`)
- Section navigation + readiness + approval status
- Wire Generate / Regenerate / Approve to:
  - `POST /api/rami/generation/section`
  - `POST /api/rami/generation/approve`
  - `GET /api/rami/generation/section`
  - `GET /api/rami/generation/document`
- Visual TBC treatment for `type: 'tbc'` blocks
- Full-RFP preview from assembled payload
- DOCX/export integration using the same `GeneratedSection` model
- Demo polish using `documentKey=rami-gen-core-demo`

Do **not** redesign readiness, generation gates, or PostgreSQL authority.
Do **not** start RAG / Phase 2.3 / training.

Minimum backend services already available:

```text
src/server/rami/sectionGeneration.ts
src/types/generatedSection.ts
src/app/api/rami/generation/*
```

---

## Generation risks (still hard)

1. Do not let Qwen decide readiness — use `getSectionReadiness()`.
2. Do not send the entire DB or chat history blindly.
3. Do not invent missing dates, budgets, SLAs, quantities, legal terms, evaluation percentages, technologies, users, or procurement requirements.
4. Preserve TBC explicitly. Do not treat TBC as an answer.
5. Do not treat historical/reference content as current ProjectFacts.
6. Keep one reusable `GeneratedSection` for persistence / preview / DOCX.
7. Do not create a separate generation implementation per section.
8. Generated content must survive server restart (PostgreSQL).
9. Regeneration must not silently destroy approved content (`reopenApproved` required).
10. Do not break PostgreSQL hydration.
11. Do not break Local/Modal `RamiModelProvider` abstraction.
12. Do not start RAG as part of this critical path.

---

## Still later (do not start)

- Phase 2.3 domain catalogs
- Phase 3 RAG / embeddings / PDF ingestion
- Fine-tuning / LoRA

---

## Known limitations

1. Other machines: local PostgreSQL + `.env.local` + shared snapshot restore
2. Field coverage gaps: `namedRoles`; admin `clarificationContact` / `submissionChannel`; PMO `governanceCadence`
3. No BA CONFIRMED promotion UI
4. Spoken-TBC is English whole-value matching only
5. Information readiness ≠ document APPROVED
6. Not all applicable sections are generated yet — assembly reports `missingGeneration`
7. A4 preview is still a placeholder until UI wiring
