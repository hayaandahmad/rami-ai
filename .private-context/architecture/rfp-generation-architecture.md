# RFP Section Generation Architecture

Status: **Generation Core backend implemented.** A4/UI wiring is next.

Information readiness (can we draft?) is **not** this lifecycle. See `rfp-section-readiness.md`.

Generation is always **section-level**, never whole-document. A section is only drafted when information readiness is `READY_TO_DRAFT` or `DRAFTABLE_WITH_TBC`.

## Implemented contract (code authority)

| Type / service | Location |
|---|---|
| `GeneratedSection` / `GeneratedBlock` / `SectionGenerationContext` / `AssembledRfp` | `src/types/generatedSection.ts` |
| Context builder | `src/server/rami/sectionGenerationContext.ts` |
| Generate / regenerate / approve / assemble | `src/server/rami/sectionGeneration.ts` |
| Persistence | `project_section_contents` via `ProjectSectionContentRepository` |
| HTTP | `/api/rami/generation/section`, `/approve`, `/document` |

### GeneratedBlock kinds
`heading` | `paragraph` | `bullet_list` | `numbered_list` | `table` | `tbc`

### Approval vs readiness
- Readiness = information sufficiency (`SectionInformationReadiness`)
- Approval = document workflow on generated content (`DRAFT` | `APPROVED`)
- Lifecycle (`SectionLifecycleState`) still tracked in `project_section_states`

### Regeneration rule
- New version becomes `is_current`; previous current is superseded (history kept)
- If current is `APPROVED`, refuse unless `reopenApproved=true` (new `DRAFT` version)

### Assembly
`assembleRfpDocument` walks canonical 20-section order, respects applicability, attaches persisted content, flags `missingGeneration`. Does not invent absent prose.

### Anti-hallucination
TypeScript gates + prompt rules + deterministic TBC block enforcement. No RAG. No historical RFPs as facts.

## 1. Section state machine (final)

```text
NOT_STARTED → COLLECTING → READY_TO_DRAFT → DRAFTING → REVIEW → APPROVED
                                                  ↑          ↓
                                                  └── REVISING
                                                             ↓
                                              (from APPROVED) REOPENED → COLLECTING
```

(See `src/types/sectionState.ts` for enforced transitions.)

## 2. Generation context (implemented)

```text
SectionGenerationContext {
  sectionId, title, subsections
  applicable: true
  readiness: READY_TO_DRAFT | DRAFTABLE_WITH_TBC
  answeredFacts, sharedFacts
  tbcFields, notApplicableFields
  documentMeta (title/beneficiary/type/duration when answered)
  antiHallucinationRules
}
```

No full DB dump. No full chat history. No `historicalEvidence` / RAG in v1.

## 3. Final assembly

Backend assembly exists. Full approved-RFP completeness requires every applicable section generated **and** APPROVED. UI + remaining section drafting remain.

## 4. Related documents

- Readiness: `rfp-section-readiness.md`
- Persistence: `postgresql-persistence.md`
- Handoff: `.private-context/handoff/START_HERE.md`
