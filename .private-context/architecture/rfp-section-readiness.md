# RFP Section Readiness

Status: **Implemented (information readiness). Generation Core consumes these gates.**

RFP Generation Core backend is implemented (see `rfp-generation-architecture.md` and handoff `START_HERE.md`). Do not start RAG, training, or unrelated redesign as part of UI follow-up.

This document is the authority for:

- Field ↔ Section mapping used for drafting gates
- Information readiness states
- The `generateRfpSection` readiness contract

Do not confuse this with:

- Gap Engine (`src/server/rami/gapEngine.ts`) — what to ask next
- Section lifecycle (`src/types/sectionState.ts`) — DRAFTING / REVIEW / APPROVED

## 1. Mapping model

`fields.section_id` is a convenience primary FK only. It is **not** sufficient.

The real mapping is many-to-many:

| Source | Role |
|---|---|
| `PROJECT_MEMORY_FIELDS.targetSections[]` | Declared drafting sections |
| Question Bank `sectionId` + `fieldIds` | Ask-time section links |
| Extra shared pairs in `sectionFieldMap.ts` | Audit extras (admin tender number, PMO/manpower stakeholders) |
| PostgreSQL `section_fields` | Seeded idempotently from the TypeScript map |

Runtime TypeScript: `src/schema/sectionFieldMap.ts` → `getSectionFieldLinks()`.

One ProjectFact row per canonical Field. Sections reference that Field; facts are never duplicated.

## 2. Information readiness states

These are **not** document approval states.

| State | Meaning |
|---|---|
| `NOT_APPLICABLE` | `isSectionApplicable()` is false. No missing-field list. |
| `NOT_READY` | Applicable, and at least one **must-have** field is missing or CONTRADICTORY. |
| `DRAFTABLE_WITH_TBC` | No must-have missing/contradiction; at least one TBC/UNKNOWN/DEFERRED field. A later draft may include a professional TBC marker. **Not** complete/approved. |
| `READY_TO_DRAFT` | Must-haves are ANSWERED (or valid N/A). No TBC. Supporting/shared gaps may remain listed. |

TBC is never treated as an answer. Spoken “TBC” / “we don’t know yet” is normalized to provenance `TBC` + GapStatus `UNKNOWN` (or `DEFERRED`).

## 3. Engine

```text
getSectionReadiness(memory, sectionId, projectContext)
getAllSectionReadiness(memory, projectContext)
```

Uses: applicability, `section_fields` map, ProjectMemory/ProjectFacts completeness, pack gating (inactive packs → N/A, not missing).

Live report: `npm run report:section-readiness`

## 4. Coverage gaps (documented, not new Fields)

| Section | Severity | Notes |
|---|---|---|
| tableOfContents / abbreviations | OPTIONAL | Boilerplate / derived |
| administrativeProcedures | IMPORTANT | Propose later: `clarificationContact`, `submissionChannel` |
| projectManagementGovernance | IMPORTANT | Propose later: `governanceCadence` |
| manpowerRequirements | CRITICAL when applicable | Propose later: `namedRoles` |
| implementationRequirements | IMPORTANT | Stages/training/KT not first-class |

Do not add these Fields until asked.

## 5. Generation contract (implemented)

```text
generateRfpSection(documentKey, sectionId) → refused unless readiness is
  READY_TO_DRAFT or DRAFTABLE_WITH_TBC
```

See `src/types/generatedSection.ts` and `src/server/rami/sectionGeneration.ts`.

**Never silently invent:** dates, budget, SLA values, technologies, integrations, users, quantities, evaluation percentages, legal clauses, procurement rules, delivery deadlines, support periods.

Unresolved → professional TBC marker. NOT_APPLICABLE → omit. REFERENCE/historical → never asserted as current ProjectFacts.

## 6. Related documents

- Lifecycle / later drafting UX: `rfp-generation-architecture.md`
- Provenance: `rfp-knowledge-architecture.md`
- Persistence: `postgresql-persistence.md`
- Asking next: `adaptive-question-architecture.md`
