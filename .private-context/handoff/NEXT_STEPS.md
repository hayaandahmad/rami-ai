# Rami — Next Steps

Last updated: 2026-08-30 (Section Readiness foundation — do not start generation until asked)

New Cursor session: read `.private-context/handoff/START_HERE.md` first.

---

## Persistence — live-validated ✅

PostgreSQL is live-validated. Authority: `postgresql-persistence.md`.

---

## Section Readiness — complete ✅ (no prose generation)

Spoken-TBC normalization, many-to-many `section_fields`, and `getSectionReadiness()` are implemented.

Authority: `.private-context/architecture/rfp-section-readiness.md`

`npm run validate:section-readiness`  
`npm run report:section-readiness`

---

## Exact next implementation step (do not start until asked)

**First section generation** for one applicable section that is `READY_TO_DRAFT` or `DRAFTABLE_WITH_TBC`, using `SectionGenerationContext` in `rfp-section-readiness.md`.

Do **not** start: full RFP assembly, DOCX, RAG, Phase 2.3 catalogs, Approve UI.

---

## Immediate: Phase 2.3 — Domain Requirement Catalog Expansion

Do **not** start until the human asks.

---

## Known limitations
1. Other machines still need PostgreSQL + `.env.local` + migrate/seed
2. Coverage gaps: manpower `namedRoles` (CRITICAL when section applies); admin `clarificationContact`/`submissionChannel` (IMPORTANT); PMO `governanceCadence` (IMPORTANT)
3. No BA confirmation UI
4. No RAG / generation / DOCX
5. Spoken-TBC is English whole-value matching only
6. Information readiness ≠ document APPROVED
