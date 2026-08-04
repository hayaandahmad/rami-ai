# Rami AI — Guided Document Interview System Design

**Document ID:** RAMI-P2-SD-001  
**Version:** 1.0  
**Status:** Approved implementation specification for Page 2  
**Page:** Guided Document Interview  
**Route:** `/documents/[documentId]/interview`  
**Implementation target:** Next.js App Router + TypeScript + Tailwind CSS  
**Audience:** Product owner, UX/UI designer, frontend developer, Cursor agent  
**Primary working path:** System Implementation  
**Language:** English only  
**Source of truth:** `.private-context/`  
**Last updated:** 2026-08-03

---

# 1. Purpose

This document defines the complete product, UX, UI, interaction, motion, accessibility, state, and implementation requirements for Page 2 of Rami AI: the Guided Document Interview.

This page is the core product experience.

Page 1 explains the product and lets the user start or continue work.

Page 2 proves that Rami is an intelligent document assistant.

Page 3 allows the user to review and generate the professional document.

The Guided Document Interview must therefore feel:

- intelligent;
- structured;
- calm;
- professional;
- responsive;
- trustworthy;
- enterprise-ready;
- clearly AI-assisted without becoming a generic chat application.

This page must not look like:

- a long form;
- a chatbot clone;
- a survey;
- a wizard with tiny steps;
- a plain textarea with Next and Back buttons;
- a generic admin dashboard.

It must feel like an experienced consultant is guiding the user through a structured discovery session.

---

# 2. Product Role

## 2.1 What This Page Does

The Guided Document Interview:

1. presents one question at a time;
2. explains why the question matters where useful;
3. collects the user’s answer;
4. saves the answer into structured state;
5. updates the document progress;
6. updates the captured-information panel;
7. asks a follow-up when an answer is unclear;
8. allows uncertain information to be marked `[To be confirmed]`;
9. gives the user confidence that the document is being built progressively;
10. moves the user to the Review and Generate page when ready.

## 2.2 What This Page Does Not Do

It does not:

- generate the final document yet;
- expose the full question bank at once;
- show raw prompt engineering;
- simulate unsupported AI reasoning;
- score user answers;
- invent missing facts;
- publish or submit the document;
- implement real AI in the current demo;
- upload real files;
- provide authentication;
- expose backend or infrastructure details.

---

# 3. Product Principles

## 3.1 One Visible Question at a Time

Only one current question may be presented as the primary task.

The interface may show:

- previous answer context;
- follow-up context;
- progress;
- captured information;
- section navigation.

It must not display several unanswered questions in one form.

## 3.2 Rami Leads the Interview

The user should always know what to answer next.

The user should not need to decide:

- which section to fill;
- which requirement to write first;
- how to structure the document;
- what wording to use for the final RFP.

## 3.3 Every Answer Has a Destination

Every answer maps to:

- a named field;
- an interview section;
- a future document section;
- a review item.

The interface must reinforce that answers are being organized rather than lost in a chat transcript.

## 3.4 No Invented Information

When the user does not know something, the UI must support:

```text
[To be confirmed]
```

The system must never turn uncertainty into fabricated content.

## 3.5 Human Control

The user can:

- go back;
- edit an earlier answer;
- save and exit;
- mark uncertainty;
- review captured inputs;
- choose when to continue to review.

## 3.6 Calm AI Experience

AI identity should come from:

- Rami’s clear language;
- intelligent follow-up;
- active state transitions;
- captured-information updates;
- subtle motion;
- responsive feedback;
- progress continuity.

It should not come from:

- glowing neon everywhere;
- fake thinking percentages;
- robot imagery;
- chat bubbles filling the page;
- excessive animation;
- unsupported claims.

---

# 4. User Journey

## 4.1 Entry

The user enters Page 2 from one of these actions:

- `Create New Document` after selecting System Implementation;
- `Continue Interview` from the workspace;
- `Edit Answer` from Page 3;
- `Continue Working` from the hero on Page 1.

## 4.2 First-Time Entry

The page should:

1. load the selected mock document;
2. show the project title and type;
3. show the current section;
4. show the first unanswered question;
5. show progress at 0% or the correct seeded value;
6. show an empty captured-information panel with helpful guidance;
7. place keyboard focus on the answer field.

## 4.3 Returning Entry

The page should:

1. restore the current question;
2. restore saved answers;
3. restore section states;
4. restore the mock attachment;
5. restore progress;
6. clearly show that work was saved.

## 4.4 Standard Question Flow

```text
Question displayed
→ user enters answer
→ Save and Continue
→ saving feedback
→ answer appears in captured information
→ progress updates
→ next question transitions in
```

## 4.5 Follow-Up Flow

```text
Current situation question
→ user enters vague answer
→ Save and Continue
→ Rami detects demo trigger
→ focused follow-up appears
→ user chooses one or more limitations
→ follow-up saved
→ interview continues
```

## 4.6 TBC Flow

```text
Question displayed
→ user selects Mark as To be Confirmed
→ exact TBC value saved
→ TBC appears in captured information
→ progress updates
→ next question appears
```

## 4.7 Exit Flow

```text
Save and Exit
→ state preserved
→ return to workspace
→ document card shows updated status and progress
```

## 4.8 Completion Flow

```text
Final confirmation
→ interview marked complete
→ status becomes Ready for Review
→ navigate to /documents/[documentId]/review
```

---

# 5. Emotional Journey

The experience should move the user through these feelings:

## Beginning

> I do not know how to write this document.

## After the First Questions

> This is easier than starting from a blank page.

## During Follow-Up

> Rami understands when my answer is not specific enough.

## Midway

> My answers are being organized into something useful.

## Near Completion

> I can see exactly what is complete and what is still missing.

## Completion

> I am ready to review a professional first draft.

This emotional progression is a core UX success criterion.

---

# 6. Information Architecture

## 6.1 Main Route

```text
/documents/[documentId]/interview
```

## 6.2 Breadcrumb Structure

```text
Dashboard / Workspace
› Digital Services Platform
› Interview
```

Rules:

- Workspace is clickable.
- Document title is clickable only if a document overview route exists later; for this demo, it may remain non-clickable.
- Interview is the current page and not clickable.
- Use clear chevrons.
- Preserve keyboard access.

## 6.3 Page-Level Regions

1. Global application header
2. Interview page header
3. Interview section navigator
4. Main AI interview workspace
5. Captured-information panel
6. Sticky action area
7. Feedback layer for toast/error states

---

# 7. Desktop Layout

## 7.1 Overall Structure

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Global Header: Breadcrumbs                              User Identity       │
├─────────────────────────────────────────────────────────────────────────────┤
│ Interview Header: Title | Type | Beneficiary | Progress | Save status      │
├───────────────────┬───────────────────────────────────┬─────────────────────┤
│ Interview Progress│ Main AI Interview Workspace       │ Captured Inputs     │
│                   │                                   │                     │
│ Section list      │ Rami identity                     │ Live summary        │
│ Progress          │ Current question                  │ Missing info        │
│ State legend      │ Guidance                          │ TBC markers         │
│                   │ Answer control                    │                     │
│                   │ Feedback                          │                     │
├───────────────────┴───────────────────────────────────┴─────────────────────┤
│ Sticky Actions: Back | Mark TBC | Attach Reference | Save and Continue     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 7.2 Column Emphasis

Recommended proportions on large screens:

- Left navigator: 240–280px
- Main workspace: flexible, dominant
- Right panel: 300–360px

The main workspace must remain the visual focus.

## 7.3 Viewport Behavior

- The global sidebar remains fixed.
- The page content area uses the available viewport height.
- The interview navigator and captured-information panel may remain sticky within the page.
- The main question region may scroll when content is long.
- Avoid multiple visible scrollbars.
- The sticky action area remains reachable.

---

# 8. Global Header

Use the application shell already established on Page 1.

## 8.1 Contents

Left:

- breadcrumbs

Right:

- avatar;
- Ahmad Mahmoud;
- Business Analyst.

## 8.2 Behavior

- Remains visually consistent with Page 1.
- Does not repeat the page title as another `h1`.
- The page view owns the page heading.
- No unused Help icon.
- No real account menu.

---

# 9. Interview Page Header

## 9.1 Purpose

Provide document context before the user focuses on the question.

## 9.2 Required Content

- Page title: `Guided Document Interview`
- Document title: `Digital Services Platform`
- Document type: `System Implementation`
- Beneficiary: `MODEE` when known
- Current section
- Overall progress
- Save status
- Save and Exit action

## 9.3 Recommended Layout

Left:

```text
Guided Document Interview
Digital Services Platform · System Implementation
```

Right:

```text
42% complete
Saved just now
[Save and Exit]
```

## 9.4 Save Status

States:

- `All changes saved`
- `Saving...`
- `Unsaved changes`
- `Save failed`

The demo may use controlled mock timing.

Do not show fake cloud-sync details.

---

# 10. Left Panel — Interview Navigator

## 10.1 Purpose

The navigator answers:

- Where am I?
- What is complete?
- What remains?
- Which section needs clarification?

## 10.2 Sections

Use exactly these 13 sections:

1. Document Setup
2. Background and Business Need
3. Engagement Type
4. Stakeholders and Users
5. Scope of Work
6. Functional Requirements
7. Technical and Non-Functional Requirements
8. Deliverables
9. Implementation and Acceptance
10. Support and SLA
11. Evaluation and Financials
12. Legal and Annexes
13. Final Gap Check

## 10.3 Section States

- `not-started`
- `current`
- `completed`
- `needs-clarification`

## 10.4 Visual State Rules

### Current

- strongest emphasis;
- active indicator;
- readable icon;
- clear label;
- subtle AI accent.

### Completed

- check icon;
- reduced emphasis;
- still readable;
- clickable only if the product supports revisiting.

### Needs Clarification

- warning icon;
- text label;
- not color-only.

### Not Started

- neutral;
- no implication of error.

## 10.5 Interaction Rules

For the demo:

- completed sections may be selectable if a stable question mapping exists;
- future sections should not allow skipping required unanswered questions;
- clicking a locked future section should show a concise explanation;
- keyboard navigation must work.

## 10.6 Progress Summary

At the top of the panel:

- `Step 3 of 11`
- progress bar
- `Background and Business Need`
- section status

Do not show estimated time unless the source provides it.

---

# 11. Center Panel — Main AI Interview Workspace

## 11.1 Purpose

This is the primary task zone.

It must feel like Rami is conducting a professional interview.

## 11.2 Visual Structure

```text
Rami identity row
Current section label
Question title
Question explanation or guidance
Answer control
Contextual options
Validation / save feedback
```

## 11.3 Rami Identity

Show:

- Rami icon or mark;
- `Rami`;
- `AI Document Assistant`;
- small active indicator.

The identity should be compact and professional.

Do not use a cartoon robot.

## 11.4 Current Question

The question is the strongest text on the screen after the page title.

Requirements:

- concise;
- clear;
- readable line length;
- no unnecessary technical vocabulary;
- exact source-approved wording where defined.

## 11.5 Helper Content

Helper content may explain:

- what kind of answer is useful;
- why Rami is asking;
- an example structure;
- what not to include.

It must not:

- fabricate the answer;
- provide unsupported recommendations;
- become long documentation.

## 11.6 Question Transition

When progressing:

1. current content fades and moves upward slightly;
2. progress updates;
3. captured information updates;
4. next question fades in;
5. focus moves to the new answer control.

Recommended duration:

- 180–240ms;
- ease-out;
- disabled under reduced motion.

---

# 12. Approved Demo Question Script

The working demo path is System Implementation.

## Q1 — Document Title

Section: Document Setup

Question:

> What is the document title?

Input:

- single-line text

Demo answer:

> Digital Services Platform

Required:

- yes

TBC:

- no

Captured field:

- Document Title

---

## Q2 — Beneficiary Entity

Section: Document Setup

Question:

> Who is the beneficiary entity?

Input:

- single-line text

Demo answer:

> MODEE

Required:

- yes

TBC:

- yes, if product owner allows it

Captured field:

- Beneficiary Entity

---

## Q3 — Current Situation

Section: Background and Business Need

Question:

> What is the current situation?

Input:

- long text

Required:

- yes

TBC:

- yes

Helper:

> Describe the existing process, platform, or environment and the main limitations affecting users or operations.

Exact demo trigger:

> The current platform is not good.

---

## Q3B — Focused Follow-Up

Section: Background and Business Need

Question:

> To describe the business need accurately, which specific limitations affect the current platform?

Input:

- multiple choice

Choices:

- Performance
- Manual processes
- Integration gaps
- Reporting
- User experience
- Other

Required:

- yes when triggered

TBC:

- no

Behavior:

- appears only once;
- does not duplicate after navigating back and forward;
- saves to a separate captured field;
- may mark the section completed after answer.

---

## Q4 — Problem to Solve

Section: Background and Business Need

Question:

> What problem should this project solve?

Input:

- long text

Required:

- yes

TBC:

- yes

Helper:

> Focus on the business outcome rather than describing a preferred technology.

---

## Q5 — In Scope

Section: Scope of Work

Question:

> What is in scope?

Input:

- long text

Required:

- yes

TBC:

- yes

---

## Q6 — Out of Scope

Section: Scope of Work

Question:

> What is out of scope?

Input:

- long text

Required:

- no, but strongly recommended

TBC:

- yes

---

## Q7 — Main Users

Section: Stakeholders and Users

Question:

> Who are the main users?

Input:

- long text

Required:

- yes

TBC:

- yes

---

## Q8 — Key Deliverables

Section: Deliverables

Question:

> What are the key deliverables?

Input:

- long text

Required:

- yes

TBC:

- yes

---

## Q9 — Expected Duration

Section: Engagement Type

Question:

> What is the expected duration?

Input:

- single-line text

Required:

- yes

TBC:

- yes

Preferred TBC demonstration.

---

## Q10 — Unknown Information

Section: Final Gap Check

Question:

> What information is still unknown?

Input:

- long text

Required:

- no

TBC:

- no

Helper:

> List any open decisions, missing approvals, or details that still require confirmation.

---

## Q11 — Final Confirmation

Section: Final Gap Check

Question:

> Please confirm that the collected information is ready for review.

Input:

- confirmation checkbox or explicit confirmation action

Required:

- yes

TBC:

- no

Primary action:

- Continue to Review

---

# 13. Answer Controls

## 13.1 Single-Line Text

Use for:

- title;
- beneficiary;
- duration.

Requirements:

- visible label;
- optional helper;
- clear focus state;
- inline validation;
- Enter may continue only if intentional and safe.

## 13.2 Long Text

Use for:

- current situation;
- problem;
- scope;
- users;
- deliverables;
- unknown information.

Requirements:

- comfortable height;
- autosize within a reasonable limit;
- no horizontal resize;
- preserve input on validation error;
- show character count only if required.

## 13.3 Choice Group

Use proper radio or checkbox semantics.

For the demo follow-up:

- allow one or more limitations only if the product requirement supports it;
- if single choice, use radio semantics;
- if multiple choice, use checkbox semantics;
- `Other` may expose a small text field.

The simplest reliable demo is single selection.

## 13.4 Confirmation

Use:

- checkbox plus explanation; or
- explicit `Confirm Inputs` action.

The user must understand that review is still required.

---

# 14. AI Guidance Component

## 14.1 Purpose

Help the user understand how to answer without supplying invented content.

## 14.2 Allowed Content

- what kind of detail is useful;
- a short example structure;
- a reminder to distinguish business need from solution;
- a reminder that unknown details may be marked TBC.

## 14.3 Visual Style

- subtle surface;
- Rami icon;
- short text;
- not visually stronger than the question;
- no large chat bubble.

## 14.4 Interaction

May be:

- always visible for complex questions;
- collapsible;
- shown after the user focuses the input.

Do not show guidance for every trivial question.

---

# 15. Captured Information Panel

## 15.1 Purpose

Show that Rami is transforming conversation into structured document inputs.

This is one of the strongest AI cues on the page.

## 15.2 Content

Group captured values by section.

Example:

```text
Document Setup
• Document Title: Digital Services Platform
• Beneficiary Entity: MODEE

Background and Business Need
• Current Situation: The current platform is not good.
• Specific Limitation: Manual processes

Engagement Type
• Expected Duration: [To be confirmed]
```

## 15.3 Item Structure

Each captured item includes:

- label;
- value;
- TBC state where applicable;
- optional edit shortcut.

## 15.4 Empty State

Before answers exist:

> Your confirmed answers will appear here as Rami structures the document.

Do not leave a blank panel.

## 15.5 Update Motion

After saving:

- highlight the updated item briefly;
- fade in new content;
- avoid large movement;
- announce important update politely for screen readers if useful.

## 15.6 Panel Behavior

Desktop:

- visible as right column;
- sticky where practical.

Tablet:

- collapsible panel below or beside workspace.

Mobile:

- accordion or bottom sheet;
- current question remains primary.

---

# 16. Sticky Action Area

## 16.1 Actions

Left group:

- Back

Middle or secondary group:

- Mark as To be Confirmed
- Attach Reference

Right group:

- Save and Continue

On final step:

- Continue to Review

## 16.2 Button Priority

Primary:

- Save and Continue

Secondary:

- Back

Ghost or subtle:

- Mark as To be Confirmed
- Attach Reference

## 16.3 Behavior

- fixed or sticky within the interview viewport;
- never obscures input content;
- mobile-safe with bottom padding;
- keyboard accessible;
- clear disabled states.

## 16.4 Continue Validation

If required answer is empty:

- keep the user on the current question;
- show inline message;
- focus the input;
- do not use an alert modal.

---

# 17. Mark as To Be Confirmed

## 17.1 Exact Value

Always use:

```text
[To be confirmed]
```

## 17.2 User Experience

When selected:

1. show a brief confirmation;
2. save the exact value;
3. display TBC in captured information;
4. update the section state;
5. continue to the next question.

## 17.3 Visual Treatment

- readable badge or marked text;
- warning-neutral, not error-red;
- accessible label;
- consistent across Page 2 and Page 3.

---

# 18. Mock Attachment

## 18.1 Purpose

Demonstrate that the future product can accept reference material.

## 18.2 Demo Behavior

On click:

- show a mock file chip;
- use a safe sample name;
- allow removal;
- display confirmation feedback.

Example:

```text
current-platform-overview.pdf
```

## 18.3 Constraints

- no real upload;
- no file parsing;
- no storage;
- no hidden input required unless already trivial;
- clearly demo-only.

---

# 19. Save and Exit

## 19.1 Purpose

Support interrupted work.

## 19.2 Behavior

On click:

1. save current answer if valid;
2. preserve state;
3. update progress;
4. return to workspace;
5. card reflects current status;
6. reopening restores the exact question.

## 19.3 Confirmation

If there are unsaved changes and save fails:

- prevent accidental loss;
- show inline or modal confirmation only when necessary.

For the mock demo, a stable save path is preferred.

---

# 20. Save Feedback

## 20.1 States

- idle;
- saving;
- saved;
- error.

## 20.2 Timing

Suggested mock behavior:

- saving: 300–600ms;
- saved state visible briefly;
- no excessive delay.

## 20.3 Error State

Message:

> We could not save this answer. Please try again.

Requirements:

- keep input;
- retry action;
- no technical stack trace;
- no progress change until success.

A controlled demo trigger may be implemented, but it must not accidentally appear during the executive walkthrough.

---

# 21. Follow-Up Logic

## 21.1 Demo Trigger

Normalize whitespace and case.

Trigger only when the current situation answer matches:

```text
The current platform is not good.
```

## 21.2 Requirements

- insert follow-up immediately after Q3;
- only once;
- preserve answer when navigating;
- do not retrigger duplicates;
- progress calculation accounts for the inserted step;
- captured information stores the result.

## 21.3 AI State Cue

Before follow-up appears, a very short state may show:

```text
Rami is checking whether more detail is needed...
```

Duration:

- 500–900ms maximum;
- optional;
- must not feel fake or slow;
- disabled under reduced motion.

---

# 22. AI Identity and Visual Language

## 22.1 Design Direction

Enterprise AI assistant.

Use:

- deep blue;
- white;
- subtle cool surfaces;
- restrained accent;
- clean typography;
- soft motion;
- clear structure.

Avoid:

- neon purple;
- gaming effects;
- glowing robot heads;
- excessive glassmorphism;
- chat-app clones;
- playful illustrations.

## 22.2 Background Motion

The page may use:

- very subtle radial light;
- faint node pattern;
- small active status pulse;
- gentle question transitions.

The answer area must remain quiet and readable.

## 22.3 Thinking State

Use only when a state transition benefits from feedback.

Allowed:

- three small calm dots;
- thin progress shimmer;
- short Rami status line.

Do not use:

- fake chain of thought;
- “reasoning” text;
- fake confidence scores;
- long waiting animations.

---

# 23. Motion System

## 23.1 Principles

Motion communicates:

- save;
- progress;
- transition;
- AI checking;
- panel update.

Motion does not decorate every element.

## 23.2 Durations

- button hover: 120–160ms
- question transition: 180–240ms
- captured-item update: 200–300ms
- status pulse: 1.8–2.4s loop
- mock thinking: 500–900ms
- panel open/close: 180–260ms

## 23.3 Reduced Motion

When `prefers-reduced-motion: reduce`:

- remove translate animations;
- remove decorative pulse;
- show question immediately;
- show captured information immediately;
- keep essential state changes clear.

---

# 24. Responsive Design

## 24.1 Desktop — 1200px and Above

- full three-column layout;
- left navigator visible;
- right captured panel visible;
- sticky action bar;
- generous main workspace.

## 24.2 Small Desktop / Tablet Landscape — 1024–1199px

- navigator narrower;
- captured panel may collapse;
- main workspace remains dominant;
- toggle button opens captured inputs.

## 24.3 Tablet — 768–1023px

Preferred layout:

- section progress as horizontal/compact panel;
- main question full width;
- captured inputs below in accordion;
- sticky bottom actions;
- no cramped three-column layout.

## 24.4 Mobile — Below 768px

- single column;
- compact page header;
- progress button opens drawer or sheet;
- captured information accordion;
- answer input full width;
- bottom actions stack or use a clear primary button;
- 44px minimum touch targets;
- no horizontal overflow.

---

# 25. Accessibility

## 25.1 Structure

Use:

- `main`
- `nav`
- `aside`
- `section`
- one `h1`

## 25.2 Focus

After question transition:

- move focus to the question heading or answer control;
- do not disorient screen-reader users;
- preserve visible focus.

## 25.3 Forms

- connected labels;
- helper text via `aria-describedby`;
- inline error association;
- radio and checkbox semantics;
- no placeholder-only labels.

## 25.4 Progress

Use:

- `role="progressbar"`
- `aria-valuemin`
- `aria-valuemax`
- `aria-valuenow`
- `aria-valuetext`

## 25.5 Live Regions

Use restrained `aria-live="polite"` for:

- saved state;
- follow-up insertion;
- captured information update;
- save error.

## 25.6 Motion

Respect reduced motion.

## 25.7 Color

Status must never rely on color alone.

Target WCAG AA contrast.

---

# 26. Component Architecture

## 26.1 Page View

```text
GuidedDocumentInterviewPage
```

Responsibilities:

- read document ID;
- connect store and engine;
- compose page layout;
- manage responsive panels;
- pass state to components.

It should not contain the entire interview logic inline.

## 26.2 Required Components

### Layout

- `InterviewPageHeader`
- `InterviewLayout`
- `InterviewNavigator`
- `CapturedInputsPanel`
- `InterviewActionBar`

### AI Workspace

- `RamiIdentity`
- `QuestionStage`
- `QuestionHeader`
- `QuestionGuidance`
- `AnswerControl`
- `ChoiceButtonGroup`
- `ThinkingState`
- `InlineValidation`
- `SaveStatus`

### Captured Inputs

- `CapturedInputGroup`
- `CapturedInputItem`
- `TbcMarker`
- `CapturedInputsEmptyState`

### Supporting UI

- `AttachmentChip`
- `MarkTbcAction`
- `ProgressBar`
- `StatusBadge`
- `Accordion`
- `Toast`
- `ErrorState`

---

# 27. Hook and State Architecture

## 27.1 `useInterviewEngine`

Responsibilities:

- determine current question;
- calculate visible script;
- inject follow-up;
- prevent duplicate follow-up;
- validate answers;
- save answer;
- mark TBC;
- navigate back;
- navigate forward;
- calculate progress;
- update section states;
- determine completion;
- route to review.

## 27.2 Store Requirements

State should include:

- active document ID;
- answers by document ID;
- current question ID;
- completed question IDs;
- section states;
- pending or completed follow-up state;
- mock attachment;
- save state;
- review readiness.

## 27.3 Suggested Types

```ts
type SaveState = "idle" | "saving" | "saved" | "error";

type QuestionInputType =
  | "text"
  | "long-text"
  | "choice"
  | "confirm";

interface QuestionStep {
  id: string;
  sectionId: string;
  prompt: string;
  helperText?: string;
  inputType: QuestionInputType;
  choices?: string[];
  answerField: string;
  answerLabel: string;
  required: boolean;
  allowTbc: boolean;
  followUp?: {
    triggerMatch: string;
    questionId: string;
  };
}
```

---

# 28. Data Requirements

Populate:

```text
src/data/mockInterviewScript.ts
```

The data must contain:

- 11 primary steps;
- the focused follow-up definition;
- section mapping;
- helper text;
- required flags;
- TBC flags;
- answer labels;
- input types.

Do not hardcode question copy across several components.

---

# 29. Visual Specifications

## 29.1 Main Workspace Surface

- white or slightly tinted surface;
- 16px panel radius;
- subtle border;
- restrained shadow;
- comfortable padding;
- max readable line width.

## 29.2 Current Question

- 24–30px;
- strong weight;
- line-height 1.3–1.4;
- dark neutral;
- clear section label above.

## 29.3 Answer Area

- 8px radius;
- clear border;
- strong focus ring;
- minimum comfortable height;
- no unnecessary internal decoration.

## 29.4 Left Navigator

- subtle surface contrast;
- clear active item;
- compact spacing;
- not visually heavier than question area.

## 29.5 Right Panel

- slightly quieter surface;
- structured groups;
- TBC highlighted carefully;
- no raw chat transcript.

## 29.6 Sticky Action Bar

- clear separation line or shadow;
- stable height;
- primary action at far right on desktop;
- mobile-safe.

---

# 30. Content and Microcopy

## 30.1 General Style

- concise;
- professional;
- direct;
- helpful;
- no hype;
- no unsupported AI claims.

## 30.2 Example AI Guidance

Good:

> Describe the current process and the limitations affecting users or operations.

Bad:

> Tell Rami everything about your amazing project!

## 30.3 Save Feedback

Good:

- `Saving...`
- `All changes saved`
- `We could not save this answer. Try again.`

## 30.4 TBC Feedback

> This item will remain marked as [To be confirmed] in the draft.

---

# 31. Edge Cases

## 31.1 Missing Document ID

Show a safe error state:

> We could not open this interview.

Actions:

- Back to Workspace

## 31.2 Unknown Document

Same safe fallback.

## 31.3 Empty Required Answer

Inline validation.

## 31.4 Back from First Question

Navigate to workspace or disable Back.

Preferred:

- Back to document type selection only for a new document;
- otherwise workspace.

## 31.5 Edit from Review

Open the correct question using query state or store state.

## 31.6 Reopening Completed Interview

Open at final confirmation or first clarification item.

Do not reset answers.

---

# 32. Performance

- avoid re-rendering the full page on every keystroke where unnecessary;
- memoize derived section progress if helpful;
- no heavy animation library required;
- use CSS transitions and existing React state;
- no unnecessary dependencies;
- production build must pass.

---

# 33. Quality Gates

Before Page 2 is approved:

- all 11 questions work;
- exact follow-up triggers;
- duplicate follow-up does not occur;
- TBC works;
- Back works;
- Save and Exit works;
- reopening restores state;
- captured information updates;
- progress updates;
- final confirmation routes to review;
- desktop, tablet, and mobile are usable;
- keyboard navigation works;
- reduced motion works;
- TypeScript passes;
- ESLint passes;
- production build passes;
- no console errors;
- no backend or real AI code added.

---

# 34. Definition of Done

Page 2 is complete when the user can:

1. enter from the workspace;
2. understand the current document;
3. answer one question at a time;
4. trigger the focused follow-up;
5. mark duration TBC;
6. see answers structured in the right panel;
7. move backward and forward;
8. save and exit;
9. reopen at the correct position;
10. finish the interview;
11. continue to review.

The complete demo path must remain stable and finish in a few minutes.

---

# 35. Implementation Order

1. Populate the question script
2. Complete interview state types
3. Implement `useInterviewEngine`
4. Build page header
5. Build navigator
6. Build current-question stage
7. Build answer controls
8. Implement saving and validation
9. Implement follow-up
10. Implement TBC
11. Build captured-information panel
12. Build sticky actions
13. Implement Save and Exit
14. Implement completion routing
15. Add responsive behavior
16. Add accessibility
17. Add motion
18. Run quality checks
19. Stop and report before Page 3

---

# 36. Non-Negotiable Rules for Cursor

Cursor must:

- follow this file;
- keep Page 1 behavior unchanged;
- use the existing application shell;
- use Next.js App Router;
- use TypeScript;
- use Tailwind CSS;
- use source-approved question wording;
- show one question at a time;
- implement the exact follow-up;
- support `[To be confirmed]`;
- preserve answers;
- keep captured information structured;
- stop after Page 2.

Cursor must not:

- implement Page 3;
- add a backend;
- add API routes;
- add authentication;
- add a database;
- add real AI;
- add Azure;
- add real file upload;
- add real export;
- add scoring;
- expose private context;
- invent new document types;
- add fake predictions;
- display fake chain-of-thought;
- turn the page into a generic chatbot.

---

# 37. Final Cursor Implementation Prompt

Use this prompt after placing this file at:

```text
.private-context/design/03-guided-document-interview-system-design.md
```

```text
Page 1 is approved and complete.

Read `.private-context/design/03-guided-document-interview-system-design.md` completely.

Treat it as the authoritative UX, UI, interaction, state, accessibility, motion, and implementation contract for Page 2.

Implement Page 2 only:

Guided Document Interview

Route:
`/documents/[documentId]/interview`

Primary demo path:
System Implementation

Core requirements:

1. Preserve the existing application shell, Page 1, routes, semantic tokens, sidebar, header, and shared components.

2. Build the full three-zone interview experience:
- interview navigator;
- main Rami question workspace;
- captured-information panel;
- sticky action area.

3. Populate the approved 11-step System Implementation question script and the exact focused follow-up.

4. Show exactly one primary question at a time.

5. Implement:
- Save and Continue;
- Back;
- Mark as `[To be confirmed]`;
- mock Attach Reference;
- Save and Exit;
- Continue to Review.

6. Implement the exact vague-answer trigger:
“The current platform is not good.”

Then show:
“To describe the business need accurately, which specific limitations affect the current platform?”

Choices:
- Performance
- Manual processes
- Integration gaps
- Reporting
- User experience
- Other

7. Prevent duplicate follow-up insertion.

8. Save answers in the existing frontend store.

9. Update:
- progress;
- completed questions;
- active section;
- section states;
- captured information;
- workspace document progress.

10. Restore the current position after Save and Exit.

11. Use expected duration as the preferred `[To be confirmed]` demonstration.

12. Implement a professional Enterprise AI experience:
- Rami identity;
- subtle active state;
- short optional thinking state;
- calm question transitions;
- structured captured-information updates;
- no chat clone;
- no excessive motion.

13. Implement the responsive behavior from the specification.

14. Implement all required accessibility behavior:
- one h1;
- labeled controls;
- keyboard navigation;
- visible focus;
- ARIA progress;
- polite live feedback;
- reduced-motion support;
- no color-only statuses.

15. Keep mock behavior deterministic and reliable for the management demo.

Constraints:

- Do not implement Page 3.
- Do not add backend, API routes, authentication, database, real AI, Azure, real file upload, or real export.
- Do not edit `.private-context`.
- Do not invent questions, document types, scoring, predictions, or capabilities.
- Do not change approved Page 1 behavior unless fixing a shared defect.
- Do not introduce unnecessary dependencies.

Implementation sequence:

1. question script;
2. types and store updates;
3. interview engine;
4. layout;
5. question controls;
6. follow-up;
7. TBC;
8. captured information;
9. save/exit and restore;
10. responsive;
11. accessibility;
12. motion;
13. quality checks.

After implementation:

- run TypeScript checks;
- run ESLint;
- run the production build;
- manually verify the full interview flow;
- verify Save and Exit;
- verify follow-up;
- verify TBC;
- verify restore behavior;
- verify desktop, tablet, and mobile;
- verify reduced motion.

Then report:

- files created;
- files modified;
- components implemented;
- question script;
- interview-engine behavior;
- follow-up behavior;
- TBC behavior;
- save and restore behavior;
- responsive work;
- accessibility work;
- motion work;
- TypeScript, lint, and build results;
- remaining gaps before Page 3.

Stop after Page 2.

Finish with:

“Page 2 complete. Waiting for visual and UX review before Page 3.”
```

---

# 38. Recommended Cursor Model

For implementing this page, choose the strongest available model in Cursor that is best at long-context instruction following, frontend architecture, and polished UI work.

Recommended order:

1. **Claude Sonnet 4 / newest available Sonnet**
2. **GPT-5.5 or GPT-5.6**
3. **Gemini Pro newest available**

Use one model for the full implementation pass to reduce style drift.

For the first build, prefer Claude Sonnet if available.

For code review and debugging, GPT-5.6 is an excellent second-pass reviewer.

Do not use Auto if it frequently switches models during the same implementation task.

---

# Approval

This document is the approved implementation specification for Page 2.

Any meaningful deviation must be reported before implementation.
