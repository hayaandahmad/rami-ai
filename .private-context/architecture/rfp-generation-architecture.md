# RFP Section Generation Architecture

Status: **Final design for current architecture pass. Not implemented yet.**

Generation is always **section-level**, never whole-document. A section is only ever drafted once its required fields are resolved (`CONFIRMED` or accepted-`TBC`) per the deterministic gate in `rami-agent-architecture.md`.

## 1. Section state machine (final)

```text
NOT_STARTED → COLLECTING → READY_TO_DRAFT → DRAFTING → REVIEW → APPROVED
                                                  ↑          ↓
                                                  └── REVISING
                                                             ↓
                                              (from APPROVED) REOPENED → COLLECTING
```

| State | Meaning | Entry condition |
|---|---|---|
| `NOT_STARTED` | Section not yet engaged in conversation | Initial state for every applicable section |
| `COLLECTING` | Rami is actively gathering/confirming fields for this section | First relevant BA message or first Rami question for this section |
| `READY_TO_DRAFT` | All `Required` fields (per current applicability) are `CONFIRMED` or BA-acknowledged `TBC`; all `Conditional` fields are either resolved or explicitly skipped by the BA | Deterministic gate passes (see `rami-agent-architecture.md` §2) |
| `DRAFTING` | LLM is generating section prose/tables from the frozen generation context (§2 below) | Triggered from `READY_TO_DRAFT`, automatically or on BA request |
| `REVIEW` | Draft is presented in the live preview; BA is reading/reacting | Draft generation completes |
| `REVISING` | BA requested changes; Rami is applying them (may involve new questions if the revision needs new information) | BA feedback in `REVIEW` |
| `APPROVED` | BA explicitly approved this section's current draft | Explicit BA approval action in `REVIEW` |
| `REOPENED` | An upstream fact that this section depended on changed after approval, or the BA explicitly reopens it | Upstream field change detected, or explicit BA action on an `APPROVED` section |

### Explicit transition rules

- **`TBC` fields do not block `READY_TO_DRAFT`.** A section can enter drafting with some fields still `TBC`; the draft must visibly flag each `TBC` gap inline (e.g. a highlighted placeholder) rather than silently omitting it or inventing a value.
- **`REVIEW → REVISING`** happens on any BA feedback that isn't a clean approval. `REVISING → DRAFTING` (implicitly, a re-draft) once the revision's required new information (if any) is resolved; `REVISING` can loop back through `COLLECTING`-like sub-questions without leaving the section's overall `REVISING` state from the BA's point of view.
- **`REVIEW → APPROVED`** requires an explicit BA approval action — never inferred from silence or from moving on to the next section in conversation.
- **`APPROVED → REOPENED`** happens in exactly two cases: (1) a project-memory field this section's draft depended on changes value after approval (detected deterministically by comparing the section's recorded field-dependency snapshot to current project memory), or (2) the BA explicitly asks to revisit an approved section. Both cases require the BA to see *why* it reopened (which field changed, or that it was a manual reopen) before continuing.
- **`REOPENED → COLLECTING`**, not directly back to `DRAFTING` — any changed/added information first goes through the normal collection/confirmation gate again, even if only one field changed, so the completeness gate is never bypassed.
- A section's `history[]` of prior drafts is retained across `REVISING` and `REOPENED` cycles for auditability (mirrors the project-memory `history[]` pattern in `rfp-knowledge-architecture.md`).

## 2. Generation context composition (what the LLM sees when drafting a section)

When a section enters `DRAFTING`, the deterministic layer assembles a frozen context — the LLM never queries project memory or the retrieval index live during generation:

```text
SectionGenerationContext {
  sectionId, title, canonical subsections (from canonical-rfp-schema.md)
  currentProjectFacts: { fieldId → value }   // only CONFIRMED and accepted-TBC fields relevant to this section
  proposals: { fieldId → { value, sourceRef } }   // any still-PROPOSED items shown as pending, not asserted as fact
  tbcGaps: fieldId[]                         // must be rendered as visible placeholders, never invented
  historicalEvidence: RankedChunk[]          // top-k retrieval results relevant to this section, always with attribution
  templateDefaults: object                   // reusable skeletons from GeneralTemplate.docx findings (tables, boilerplate clauses)
  priorDraftVersion?: string                 // present only on REVISING/REOPENED re-drafts
  revisionInstruction?: string               // present only on REVISING
}
```

- **CONFIRMED facts are asserted as fact in the draft.**
- **PROPOSED/REFERENCE evidence is never asserted as fact** — if surfaced in a draft at all (e.g. a suggested SLA table), it must be visually/textually marked as a suggestion pending BA confirmation, consistent with the provenance hard rule in `rfp-knowledge-architecture.md`.
- **TBC gaps are rendered as explicit placeholders** (e.g. `[TO BE CONFIRMED: response time targets]`), never silently dropped or invented.

## 3. Final assembly

Final document assembly (Phase 5) concatenates all `APPROVED` sections in canonical order, applies the `chapterGroup`/`volumeHint` rollup from `canonical-rfp-schema.md` §4 if configured for the engagement, and is the only point at which DOCX export is considered. Assembly requires every `Mandatory` section (per current applicability) to be `APPROVED` — `Conditional` sections that were explicitly marked not-applicable are skipped, not treated as missing.

## 4. What this document intentionally does not cover

- Field-level provenance rules → `rfp-knowledge-architecture.md`.
- The conversational UX around collection/review → `product/conversational-rfp-workflow.md`.
- Model/runtime used for drafting → `local-ai-deployment.md`.
