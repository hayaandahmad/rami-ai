# Conversational RFP Workflow (BA-Facing Product Experience)

Status: **Final design for current architecture pass. Not implemented yet** — the current app implements a fixed 13-section, 17–18 question linear script (`src/hooks/useInterviewEngine.ts`, `src/data/mockInterviewScript.ts`), not this workflow. See `handoff/CURRENT_STATE.md` for exactly what exists today.

## 1. Top-level flow

```text
open Rami
  ↓
natural conversation (chat-first, no forced first question)
  ↓
RFP intent recognized (documentType / engagementType emerges from conversation, per question-information-mapping.md §0.1/§2.1)
  ↓
split workspace activates
  ↓
current section collection (deterministic gap-detection drives what Rami asks next)
  ↓
Rami has enough information for the active section
  ↓
draft appears in live preview
  ↓
BA review / revision
  ↓
approval
  ↓
next section
  ↓
final RFP (all mandatory sections approved → assembly, Phase 5)
```

## 2. UX states

### Initial state: chat-first

Before any RFP-identifying information exists, Rami behaves like a plain conversational assistant — a single chat surface, no split layout, no section navigator, no forced question order. The BA can open with anything from "I need to write an RFP for a new case management system" to a vague "I need help with a tender." Rami's first job is natural conversation toward identifying `documentType`/`engagementType` (Group 0/2 fields) — it does not front-load the old fixed question script.

### Active RFP state: split workspace

Once enough is known to start structured collection, the UI transitions to a two-pane layout:

```text
┌─────────────────────────────┬──────────────────────────────┐
│   RAMI CONVERSATION          │   LIVE RFP PREVIEW            │
│   (left)                     │   (right)                     │
│                               │                               │
│   - natural conversation      │   - fixed 20-section structure │
│   - questions                 │     (canonical-rfp-schema.md) │
│   - clarifications            │   - HTML/React, Word-like A4   │
│   - proposals (PROPOSED       │     page rendering             │
│     values needing BA         │   - section-by-section drafts  │
│     confirmation)             │   - per-section approval state │
│   - revisions                 │     (rfp-generation-           │
│                               │      architecture.md state      │
│                               │      machine)                  │
└─────────────────────────────┴──────────────────────────────┘
```

- **Section navigation is compact/collapsible and dynamic** — it reflects only the sections applicable to the current `documentType`/`engagementType` (per each section's `applicable-when` rule in `canonical-rfp-schema.md`), and shows each section's live state (`NOT_STARTED` / `COLLECTING` / `READY_TO_DRAFT` / `DRAFTING` / `REVIEW` / `APPROVED` / `REOPENED`).
- **The current 13-section fixed demo navigator (`InterviewNavigator`, `interviewSections.ts`) is explicitly not a product constraint** going forward — it reflected a fixed linear questionnaire, not the dynamic, applicability-driven canonical structure. Its section taxonomy and general layout intuition remain a useful visual/UX starting point (see the ADAPT verdict in `CURRENT_STATE.md`), but the fixed 13-item, always-fully-visible list must become a dynamic, state-aware view over the 20-section canonical schema.

## 3. Section-by-section loop (BA perspective)

For each applicable section, in canonical order (subject to the BA jumping ahead if they volunteer information early — see §4):

1. Rami asks/clarifies only the fields still missing for this section (never re-asks a `CONFIRMED` field).
2. Where a strong default exists (template boilerplate, historical precedent), Rami proposes it rather than asking a blank question — the BA accepts, edits, or rejects.
3. Once the section's gate passes (`rfp-generation-architecture.md` §1), a draft appears in the right-hand preview.
4. The BA reads the draft, requests changes in plain language, or approves it.
5. On approval, Rami moves attention to the next applicable section; the navigator shows the completed section as `APPROVED` and remains available for the BA to reopen at any time.

## 4. Specific behaviors to handle

- **Multi-fact BA messages:** a single message may resolve several fields across one or more sections at once (`rami-agent-architecture.md` §4) — Rami must not force one-fact-per-turn, and must not ask again for anything already resolved by an earlier message.
- **Duplicate-question avoidance:** before asking, Rami always checks current project memory; a field already `CONFIRMED`/`EXTRACTED`/accepted-`TBC` is never re-asked unless it becomes stale via the reopening flow.
- **BA saying "I don't know":** the field is marked `TBC`; Rami states plainly that the section can still proceed with this gap flagged, and moves on rather than blocking.
- **Historical suggestions:** when a field has strong support from `approved-historical` knowledge (see `rfp-knowledge-architecture.md`), Rami offers it as a labeled proposal ("Based on a similar prior RFP, response time for Severity 1 is typically 2 hours — use this, or set your own?") — never asserted as the BA's own fact until explicitly accepted.
- **TBC in a drafted section:** the preview visibly flags each outstanding `TBC` item inline; approving a section with open TBCs is allowed but the BA sees exactly what remains open.
- **Section revisions:** a revision request on an `APPROVED` or in-`REVIEW` section may itself surface new sub-questions (e.g. "make the SLA stricter" prompts Rami to ask for the specific target) — these are handled through the same core loop, not a separate mechanism.

## 5. Example dialogue sketch (illustrative only, not literal copy)

```text
BA: We need an RFP for a new case management system for the passport
    directorate. Nothing exists today, it's all paper-based.

Rami: Got it — a system implementation RFP for the Passport Directorate,
      moving off a paper-based process. I'll start capturing the
      background. Roughly how many staff would use this day to day,
      and is there a rough timeline in mind?

BA: About 40 staff, and we're hoping to go live within 8 months.

Rami: Noted — 40 internal users, 8-month target timeline. [Preview pane
      begins showing Cover Page + Introduction as sections reach
      READY_TO_DRAFT.] Since this replaces a paper process, should I
      draft the standard data-migration clause, or is there no legacy
      data to migrate?
```

## 6. Relationship to existing UI (migration notes)

A detailed KEEP/ADAPT/RETIRE/NEW verdict for every current file was produced during codebase analysis and is preserved verbatim in `handoff/CURRENT_STATE.md` §"Migration verdicts" for implementation reference. Summary for product purposes:

- **Reusable as-is or with light adaptation:** the RFP section taxonomy concept, the draft-block schema (`src/types/draft.ts`), the captured-answers side panel concept, the TBC marking semantics, the overall app-shell/routing structure, and the Google Sheets persistence boundary pattern.
- **To be retired:** the fixed linear script (`mockInterviewScript.ts`), the single-question-at-a-time engine (`useInterviewEngine.ts`), the exact-string-match follow-up mechanism, and the always-fully-visible 13-section navigator's fixed-list behavior (its section-state iconography concept is adaptable; its fixed linear list is not).
- **Net effect:** the conversational engine and chat UI are new construction (Phase 2); the live preview and section state UI evolve from the existing captured-answers/draft-type groundwork (Phase 4) rather than starting from zero.
