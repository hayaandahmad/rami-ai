# RAMI — Frontend System Design Specification

**Document ID:** RAMI-FE-SD-001  
**Version:** 1.0  
**Status:** Approved baseline for the management UI demo  
**Audience:** Product owner, Business Analyst, UI/UX designer, frontend developer, Cursor agent  
**Implementation target:** Next.js App Router + TypeScript + Tailwind CSS  
**Immediate delivery:** Three-page frontend-only management demo  
**Primary working document path:** System Implementation  
**Language:** English only  
**Source-of-truth context:** `.private-context/`  
**Last updated:** 2026-08-03

---

## 1. Document Purpose

This specification is the implementation contract for the Rami management demo.

It defines:

- what the frontend must communicate;
- the exact three-page user journey;
- the information architecture;
- the required page sections and components;
- navigation and state transitions;
- mock behaviors;
- responsive rules;
- accessibility rules;
- design-system foundations;
- implementation boundaries;
- acceptance criteria.

This document is intentionally more detailed than a normal page brief. Cursor must use it to avoid guessing, adding unrelated features, or changing the approved product flow.

This document does **not** define the future backend, database, AI orchestration, Azure architecture, authentication, or real document export.

---

## 2. Source Hierarchy

When implementation decisions conflict, use this priority order:

1. This frontend system design specification
2. `product/01-rami-system-design.md`
3. `rami-dna/01-identity.txt`
4. `rami-dna/02-soul.txt`
5. `rami-dna/03-user.txt`
6. `knowledge/01-question-bank.txt`
7. `knowledge/02-rfp-master-structure.txt`
8. `product/03-build-requirements.txt`
9. Research and cost files

Cursor must not modify, move, rename, expose, or commit `.private-context/`.

---

## 3. Product Definition

Rami is a guided AI business-document assistant for MODEE Business Development.

The current source files focus primarily on professional RFP creation. The frontend must also communicate that the product can support multiple approved document or engagement types without inventing types that do not exist in the source material.

The only document types that may appear are:

1. System Implementation
2. Framework Agreement
3. Consulting
4. Assessment
5. Support
6. Connectivity / Telecom
7. Other

For the current demo:

- **System Implementation** is the only fully working path.
- The other source-approved types may be displayed in the type-selection interface.
- They must not receive invented interview flows.
- Selecting a non-demo type shows clear informational feedback that the type is outside the current demo path.

---

## 4. Product Promise

The interface must make this promise understandable within the first minute:

> Start a document, answer guided questions, review the captured information, and receive a professional first draft without starting from a blank page.

The product must visibly reinforce that:

- Rami asks one question at a time.
- Rami saves and organizes answers.
- Rami detects unclear or incomplete information.
- Rami asks focused follow-up questions.
- Rami never invents missing facts.
- Unknown information is marked `[To be confirmed]`.
- The Business Analyst reviews inputs before generation.
- Human approval remains mandatory.

---

## 5. Immediate Demo Objective

The management demo should take approximately three to five minutes.

The manager should be able to see:

1. A credible dashboard and document workspace
2. Multiple source-approved document types
3. Existing projects with statuses and progress
4. A working System Implementation selection
5. A guided interview with one visible question
6. A focused follow-up after a vague answer
7. A `[To be confirmed]` example
8. A review gate before generation
9. A short generation sequence
10. A realistic professional draft preview
11. Mock editing, regeneration, and export actions

The demo does not need real AI or persistence to communicate the future product value.

---

## 6. Scope

### 6.1 Included

- Next.js App Router frontend
- TypeScript
- Tailwind CSS
- Three main UI pages
- Shared application shell
- Mock document projects
- Source-approved document-type selection
- Working System Implementation demo path
- In-memory state
- Question navigation
- One hardcoded follow-up scenario
- TBC handling
- Review confirmation
- Generation animation
- Professional mock draft preview
- Responsive desktop, tablet, and mobile layouts
- Accessibility baseline
- Netlify-compatible production build

### 6.2 Excluded

- Authentication
- User management
- Admin functions
- Backend APIs
- Database
- Real AI integration
- Azure integration
- Real file upload
- Real Word or PDF export
- Real template management
- Real knowledge-base management
- Document scoring or grading
- Vendor selection or award decisions
- Arabic or bilingual generation
- Automatic publishing or submission
- Full support for all seven document types

---

## 7. Core User

### 7.1 Primary Persona

A MODEE Business Analyst responsible for preparing professional documents.

### 7.2 User Characteristics

- Busy and time-constrained
- May not have all information at the beginning
- May provide vague or incomplete answers
- Needs to stop and continue work later
- Needs a professional structured result
- Must remain responsible for review and approval

### 7.3 UX Implications

The UI must:

- reduce cognitive load;
- avoid displaying the entire question bank;
- make the next action obvious;
- keep progress visible;
- make saved information easy to review;
- visibly distinguish unknown information;
- avoid technical language where it is not necessary;
- preserve user control.

---

## 8. Rami Interaction Character

Rami must feel like a smart professional colleague, not a casual chatbot.

### 8.1 Tone

- Professional
- Formal
- Clear
- Confident
- Concise
- Polite
- Helpful
- Analytical
- Cautious with uncertain information

### 8.2 Behavioral Rules

- Ask one visible question at a time.
- Work within one active interview area at a time.
- Check whether an answer is sufficiently complete.
- Ask a focused follow-up if the answer is vague.
- Never create missing facts.
- Allow `[To be confirmed]`.
- Confirm the collected summary before generation.
- Keep the Business Analyst in control.

### 8.3 Demo Follow-Up Scenario

Trigger answer:

> The current platform is not good.

Rami response:

> To describe the business need accurately, which specific limitations affect the current platform?

Choices:

- Performance
- Manual processes
- Integration gaps
- Reporting
- User experience
- Other

This scenario must work exactly and reliably during the demo.

---

## 9. Information Architecture

### 9.1 Main Product Flow

```text
Dashboard / Document Workspace
        ↓
Choose Document Type
        ↓
Guided Document Interview
        ↓
Review Collected Information
        ↓
Generate Document
        ↓
Document Draft Preview
```

### 9.2 Required Routes

```text
/                                      → redirect to /workspace
/workspace                             → Page 1
/documents/new                         → document type selection
/documents/[documentId]/interview      → Page 2
/documents/[documentId]/review         → Page 3
```

The review route contains three UI states:

```text
input-review
generating
draft-preview
```

A separate `/draft` route is not required for this demo.

---

## 10. Global Application Shell

All main pages use one shared shell.

### 10.1 Desktop Structure

```text
┌───────────────────────────────────────────────────────────────┐
│ Top Header                                                    │
├───────────────┬───────────────────────────────────────────────┤
│ Sidebar       │ Main Content                                  │
│               │                                               │
│               │ Page Header                                   │
│               │ Page Content                                  │
│               │ Optional Sticky Actions                       │
└───────────────┴───────────────────────────────────────────────┘
```

### 10.2 Sidebar

#### Required visible navigation

1. Dashboard / Workspace
2. My Documents

For the demo:

- Dashboard / Workspace is fully active.
- My Documents may navigate to the workspace with an `all documents` view or filter.
- Do not show Templates, Knowledge Base, Settings, Admin, Analytics, or Notifications in this first demo unless they are intentionally disabled and approved later.

#### Sidebar content order

1. Rami product mark/name
2. Primary navigation
3. Optional small “Demo” environment label
4. User identity block at the bottom
5. Collapse control on tablet

#### Sidebar behavior

- Fixed on desktop
- Collapsible on tablet
- Drawer on mobile
- Active item must be visually clear
- Navigation labels must remain visible when expanded
- Icons must use one consistent library

### 10.3 Top Header

Contains:

- Current page title
- Optional breadcrumb on inner pages
- Help icon or text button, visual only
- Static user profile area
- Mobile sidebar trigger

Do not implement:

- real search;
- notifications;
- account menu logic;
- authentication.

### 10.4 Main Content Width

- Full usable enterprise application width
- Maximum comfortable content width where long text requires readability
- Document preview should use a narrower paper-like reading column
- Page-level horizontal padding must respond to viewport size

---

# 11. Page 1 — Dashboard and Document Workspace

## 11.1 Purpose

The first page must perform two roles:

1. Provide a strong dashboard-like first impression
2. Function as the working document workspace

It must immediately explain what Rami does and show ongoing document work.

## 11.2 Page Goal

The user can:

- understand the product;
- start a new document;
- see supported source-approved types;
- continue an existing document;
- open a document ready for review;
- open a generated draft;
- understand current statuses and progress.

## 11.3 Page Sections

### Section A — Welcome Header

Required content:

- Page title: `Document Workspace`
- Short product statement
- Primary button: `Create New Document`

Recommended text:

> Create, continue, and review professional documents through Rami’s guided workflow.

Do not use exaggerated marketing language.

### Section B — Summary Cards

Use a compact summary row to create a dashboard experience.

Recommended metrics:

- Total Documents
- In Progress
- Needs Clarification
- Drafts Generated

These values come only from mock project data.

Do not add business metrics unsupported by project data, such as time saved, quality score, AI accuracy, cost, or approval rate.

### Section C — Supported Document Types

Display the seven source-approved types.

Each type card includes:

- Type label
- Short neutral category description where safely derivable
- Availability state

Availability:

- System Implementation: `Available in Demo`
- Other types: `Available Type — demo path not configured`

Do not label a type `Coming Soon` unless the team explicitly wants roadmap language. A safer demo message is:

> This document type is recognized by Rami but is not configured in this demo.

### Section D — Recent Documents

Show exactly three seeded projects:

#### Project 1

- Title: Digital Services Platform
- Type: System Implementation
- Beneficiary: MODEE
- Status: In Progress
- Progress: 42%
- Action: Continue Interview

#### Project 2

- Title: Cybersecurity Assessment
- Type: Assessment
- Beneficiary: Government Entity
- Status: Draft Generated
- Progress: 100%
- Action: Open Draft

#### Project 3

- Title: Government Cloud Support
- Type: Support
- Beneficiary: MODEE
- Status: Needs Clarification
- Progress: 68%
- Action: Review Inputs

Do not use `Approved` in the current demo.

### Section E — Filters

Client-side filters:

- All
- In Progress
- Needs Clarification
- Ready for Review
- Draft Generated

Filtering must update the visible cards.

### Section F — Empty State

When no document matches a filter:

- clear message;
- no alarming error treatment;
- button to clear filters;
- optional create action.

Example:

> No documents match this view.

### Section G — Create New Document

The `Create New Document` action navigates to `/documents/new`.

The type-selection interface can be:

- a dedicated page; or
- a large modal.

For route clarity and reliable demos, the dedicated page is preferred.

## 11.4 Create Document Type Selection

Required content:

- Title: `Choose Document Type`
- Brief explanation
- Seven source-approved type options
- System Implementation active
- Other types selectable only to show informational feedback
- Back action
- Continue action

On selecting System Implementation:

1. Create a mock document record
2. Set status to `Not Started` or `In Progress`
3. Navigate to the interview route

On selecting another type:

- do not create an invented workflow;
- show a concise message;
- keep the user on selection;
- allow changing the selection.

## 11.5 Workspace Components

- `WorkspaceSummaryCard`
- `DocumentTypeCard`
- `DocumentCard`
- `DocumentFilterBar`
- `StatusBadge`
- `ProgressBar`
- `EmptyState`
- `PageHeader`
- `PrimaryButton`
- `SecondaryButton`

## 11.6 Workspace Acceptance Criteria

The page is complete when:

- the product purpose is clear;
- all seven approved types are displayed;
- no invented type appears;
- all three document cards appear;
- filters work;
- each action routes correctly;
- System Implementation starts the demo;
- unsupported demo types produce safe feedback;
- responsive layout is usable;
- no backend call is made.

---

# 12. Page 2 — Guided Document Interview

## 12.1 Purpose

This page demonstrates Rami’s main product value: guided input collection.

It must not look like a generic large form.

## 12.2 Desktop Layout

```text
┌────────────────────┬──────────────────────────────┬───────────────────┐
│ Interview Progress │ Conversation / Current Q&A   │ Captured Inputs   │
└────────────────────┴──────────────────────────────┴───────────────────┘
```

### Recommended relative emphasis

- Progress: compact
- Conversation: dominant
- Captured Inputs: supportive

## 12.3 Page Header

Contains:

- Document title
- Document type
- Beneficiary if known
- Overall progress
- `Save and Exit`
- Optional breadcrumb back to workspace

## 12.4 Left Panel — Interview Progress

Display the full relevant section map, even though only a short question script is used.

Sections:

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

Section states:

- Not Started
- Current
- Completed
- Needs Clarification

A state must use text or an icon plus text, not color alone.

## 12.5 Center Panel — Conversation

Only one current question is visible as the primary task.

The panel includes:

- Rami identity label or avatar
- Current section label
- Question
- Optional helper text
- Input control
- TBC action
- Attachment mock action
- Previous answer only when required for follow-up context
- Back and Continue controls

### Input variants

- Single-line text
- Long text
- Multiple choice
- Confirmation

### Button priorities

Primary:

- Save and Continue
- Continue to Review on final step

Secondary:

- Back
- Mark as To be Confirmed
- Attach Reference
- Save and Exit

## 12.6 Right Panel — Captured Inputs

Live summary grouped by section.

Each item contains:

- Field label
- Current value
- TBC indication where relevant
- Optional edit shortcut

The panel must not become a full second form.

The panel’s role is awareness and confidence.

## 12.7 Demo Question Script

The working System Implementation path uses the following sequence.

### Question 1 — Document Setup

> What is the document title?

Input: text

Demo answer:

> Digital Services Platform

### Question 2 — Document Setup

> Who is the beneficiary entity?

Input: text

Demo answer:

> MODEE

### Question 3 — Background and Business Need

> What is the current situation?

Input: long text

Trigger answer:

> The current platform is not good.

This inserts the required follow-up.

### Question 3B — Follow-Up

> To describe the business need accurately, which specific limitations affect the current platform?

Input: multiple choice

Choices:

- Performance
- Manual processes
- Integration gaps
- Reporting
- User experience
- Other

### Question 4 — Background and Business Need

> What problem should this project solve?

Input: long text

### Question 5 — Scope of Work

> What is in scope?

Input: long text

### Question 6 — Scope of Work

> What is out of scope?

Input: long text

### Question 7 — Stakeholders and Users

> Who are the main users?

Input: long text

### Question 8 — Deliverables

> What are the key deliverables?

Input: long text

### Question 9 — Engagement Type

> What is the expected duration?

Input: text

This question is the preferred TBC demonstration.

### Question 10 — Final Gap Check

> What information is still unknown?

Input: long text

### Question 11 — Final Confirmation

> Please confirm that the collected information is ready for review.

Input: confirmation

## 12.8 Follow-Up Logic

For the demo, exact string matching is acceptable.

When the normalized answer equals:

```text
the current platform is not good.
```

Insert the follow-up step.

Do not build a real AI completeness engine in this phase.

## 12.9 TBC Behavior

When the user selects `Mark as To be Confirmed`:

- store the exact visible value `[To be confirmed]`;
- mark the answer `isTbc = true`;
- advance to the next question;
- mark the section appropriately;
- display the TBC value in captured inputs;
- carry the same marker into review and preview.

## 12.10 Attachment Behavior

Attachment is mock-only.

On click:

- display a sample filename chip;
- do not open real upload unless already trivial and safe;
- do not store a file;
- communicate that reference material has been attached for the demo.

## 12.11 Save and Exit

On click:

- preserve in-memory progress;
- navigate to workspace;
- update card progress and status;
- reopening the card returns to the current question.

Session storage is optional only after the core journey is stable.

## 12.12 Interview Error State

A static or triggerable mock state may show:

> We could not save this answer. Please try again.

Requirements:

- user answer remains visible;
- retry action;
- no navigation until success;
- avoid technical error details.

## 12.13 Interview Acceptance Criteria

- exactly one question is primary at a time;
- progress sections remain visible;
- answers update captured inputs;
- Back works;
- the follow-up triggers exactly;
- TBC works;
- Save and Exit works;
- final step routes to Review;
- mobile experience remains usable;
- no full question form appears.

---

# 13. Page 3 — Review and Generate

## 13.1 Purpose

This page provides the required human review gate and shows the final product value.

It has three states:

1. Input Review
2. Generating
3. Draft Preview

---

## 13.2 State A — Input Review

### Header

- Title: `Review Your Inputs`
- Document title
- Document type
- Short explanation

Recommended helper text:

> Confirm the collected information before Rami prepares the first draft.

### Completion Summary

Show section cards or rows containing:

- Section label
- Status
- Number of captured fields if useful
- Expand control

Statuses:

- Complete
- Needs Clarification
- To Be Confirmed
- Not Provided

### Expandable Section Details

Each section displays:

- Question label
- Answer
- TBC state
- Edit action

`Edit Answer` returns the user to the exact interview question.

### Confirmation Gate

Before generation:

- show a required confirmation checkbox or explicit confirmation action;
- state that the Business Analyst remains responsible for review;
- keep `Generate Document` disabled until confirmation.

Required fields may either:

- contain an answer; or
- be explicitly TBC.

### Input Review Actions

- Return to Interview
- Edit Answer
- Confirm Inputs
- Generate Document

---

## 13.3 State B — Generating

Display a calm professional progress experience.

Generation steps:

1. Preparing the MODEE master structure
2. Loading relevant document sections
3. Applying confirmed project inputs
4. Marking missing information
5. Generating the English document draft
6. Preparing the document preview

Behavior:

- approximately three to five seconds;
- progressive step completion;
- use `aria-live="polite"`;
- do not simulate fake percentages if unnecessary;
- automatically transition to preview.

---

## 13.4 State C — Draft Preview

### Layout

```text
┌─────────────────────────┬───────────────────────────────────────┐
│ Document Section Nav    │ Professional Document Preview         │
└─────────────────────────┴───────────────────────────────────────┘
```

### Section Navigation

For the System Implementation demo, use the relevant subset:

1. Cover Page
2. Table of Contents
3. Introduction
4. Background and Business Need
5. Engagement Definition
6. Scope of Work
7. Functional Requirements
8. Technical and Non-Functional Requirements
9. Deliverables
10. Project Management and Governance
11. Acceptance Criteria and Go-Live
12. Proposal Evaluation Criteria
13. Legal and Contractual Terms
14. Annexes

Do not imply that every type always uses the same set.

### Document Preview

The preview must resemble a professional document, not a dashboard card.

Requirements:

- white paper surface;
- readable document width;
- clear section numbering;
- professional headings;
- paragraphs;
- numbered requirements;
- one simple table where useful;
- visible TBC marker;
- generated-draft status;
- last generated timestamp.

### Content Rules

- Use realistic neutral mock content.
- Derive content from the captured demo answers.
- Use safe neutral bridging language only where required.
- Do not invent specific legal clauses, security standards, integrations, timelines, budgets, or requirements.
- Unknown content remains `[To be confirmed]`.

### Mock Actions

- Edit Section
- Regenerate Section
- Add Comment
- Mark for Review
- Export Word
- Export PDF
- Back to Workspace

Mock action response:

- use toast or tooltip;
- clearly state the function is not active in this demo;
- do not create empty files.

## 13.5 Review Page Acceptance Criteria

- answers are grouped correctly;
- TBC values are visible;
- edit returns to the right question;
- generate is gated by confirmation;
- generation sequence completes;
- preview is professional and believable;
- section navigation works;
- mock actions provide feedback;
- no real export occurs.

---

# 14. Shared Component Architecture

## 14.1 Layout Components

- `AppShell`
- `Sidebar`
- `TopHeader`
- `MobileNavigationDrawer`
- `PageHeader`
- `Breadcrumbs`
- `StickyActionBar`

## 14.2 Generic UI Components

- `Button`
- `IconButton`
- `StatusBadge`
- `ProgressBar`
- `Card`
- `Modal`
- `Toast`
- `Tooltip`
- `EmptyState`
- `ErrorState`
- `LoadingIndicator`
- `Accordion`
- `Checkbox`
- `TextInput`
- `TextArea`
- `RadioGroup`

Avoid separate `PrimaryButton` and `SecondaryButton` components if a single typed `Button` with variants is cleaner.

Recommended button API:

```ts
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";
```

## 14.3 Workspace Components

- `WorkspaceSummary`
- `WorkspaceSummaryCard`
- `DocumentTypeGrid`
- `DocumentTypeCard`
- `DocumentFilterBar`
- `DocumentGrid`
- `DocumentCard`

## 14.4 Interview Components

- `InterviewSectionList`
- `InterviewSectionItem`
- `QuestionPanel`
- `RamiMessage`
- `AnswerControl`
- `ChoiceButtonGroup`
- `CapturedInputsPanel`
- `CapturedInputItem`
- `AttachmentChip`
- `TbcAction`

## 14.5 Review Components

- `ReviewSummary`
- `ReviewSectionAccordion`
- `ReviewAnswerRow`
- `GenerationProgress`
- `DocumentSectionNavigation`
- `DocumentPreview`
- `DraftToolbar`
- `TbcMarker`

---

# 15. State Model

## 15.1 Document Project

Minimum fields:

```ts
interface DocumentProject {
  id: string;
  title: string;
  documentType: DocumentType;
  beneficiary: string;
  status: DocumentStatus;
  progressPercent: number;
  lastUpdated: string;
  nextAction:
    | "continue-interview"
    | "review-inputs"
    | "open-draft"
    | "create";
  interviewCompleted: boolean;
  draftGeneratedAt?: string;
}
```

## 15.2 Document Types

```ts
type DocumentType =
  | "system-implementation"
  | "framework-agreement"
  | "consulting"
  | "assessment"
  | "support"
  | "connectivity-telecom"
  | "other";
```

No additional types are allowed without source approval.

## 15.3 Document Status

```ts
type DocumentStatus =
  | "not-started"
  | "in-progress"
  | "needs-clarification"
  | "ready-for-review"
  | "generating"
  | "draft-generated";
```

## 15.4 Interview State

- current question
- completed questions
- answers
- active section
- section statuses
- optional follow-up
- mock attachment
- save state

## 15.5 Review State

```ts
type ReviewPageState =
  | "input-review"
  | "generating"
  | "draft-preview";
```

---

# 16. Design System Baseline

## 16.1 Important Branding Constraint

No official MODEE brand guideline, official color palette, typography specification, or approved logo package was provided.

Therefore:

- this specification must not claim that its visual values are official MODEE branding;
- the following values are a professional, replaceable demo baseline;
- all values must be implemented as semantic design tokens;
- replacing the palette later must not require rewriting components.

## 16.2 Visual Principles

The UI should feel:

- professional;
- trustworthy;
- calm;
- structured;
- modern;
- government-enterprise appropriate;
- clear rather than decorative;
- spacious without wasting screen area.

Avoid:

- playful gradients;
- excessive glassmorphism;
- oversized rounded cards;
- neon accents;
- heavy animations;
- consumer-chat-app styling;
- emoji as functional icons.

## 16.3 Color Tokens — Provisional Demo Baseline

```css
--color-primary-900: #123B63;
--color-primary-800: #194F80;
--color-primary-700: #1F629D;
--color-primary-600: #2877B8;
--color-primary-100: #EAF3FA;
--color-primary-50:  #F4F9FD;

--color-neutral-950: #111827;
--color-neutral-800: #1F2937;
--color-neutral-700: #374151;
--color-neutral-600: #4B5563;
--color-neutral-500: #6B7280;
--color-neutral-300: #D1D5DB;
--color-neutral-200: #E5E7EB;
--color-neutral-100: #F3F4F6;
--color-neutral-50:  #F8FAFC;
--color-white:       #FFFFFF;

--color-success-700: #15803D;
--color-success-100: #DCFCE7;
--color-warning-700: #A16207;
--color-warning-100: #FEF3C7;
--color-error-700:   #B91C1C;
--color-error-100:   #FEE2E2;
--color-info-700:    #1D4ED8;
--color-info-100:    #DBEAFE;
```

Semantic use:

```css
--color-page-background: var(--color-neutral-50);
--color-surface: var(--color-white);
--color-surface-subtle: var(--color-neutral-100);
--color-text-primary: var(--color-neutral-950);
--color-text-secondary: var(--color-neutral-600);
--color-border: var(--color-neutral-200);
--color-focus: var(--color-primary-600);
--color-action-primary: var(--color-primary-800);
--color-action-primary-hover: var(--color-primary-900);
```

## 16.4 Typography

Preferred baseline:

```text
Font family: Inter, with system sans-serif fallback
```

If a ministry-approved font is supplied later, replace the font token only.

Scale:

```text
Display / dashboard welcome: 32px, 700, line-height 40px
Page title:                  28px, 700, line-height 36px
Section title:               20px, 650, line-height 28px
Card title:                  16px, 650, line-height 24px
Body:                        15px or 16px, 400, line-height 24px
Body strong:                 15px or 16px, 600
Small:                       14px, 400, line-height 20px
Caption:                     12px, 500, line-height 16px
Document preview body:       15px, 400, line-height 25px
```

Use no more than four font weights.

## 16.5 Spacing Scale

Use a 4px base scale:

```text
1  = 4px
2  = 8px
3  = 12px
4  = 16px
5  = 20px
6  = 24px
8  = 32px
10 = 40px
12 = 48px
16 = 64px
```

Recommended usage:

- icon-to-label: 8px
- label-to-input: 8px
- related controls: 12–16px
- card padding: 20–24px
- section gap: 32px
- page vertical gap: 32–40px
- desktop page horizontal padding: 32px
- mobile page horizontal padding: 16px

## 16.6 Border Radius

```text
Small controls: 6px
Buttons and inputs: 8px
Cards: 12px
Large panels and modals: 16px
Pills and badges: 999px
```

Avoid using large 24–32px radii throughout the enterprise interface.

## 16.7 Borders

Default:

```text
1px solid semantic border color
```

Use borders before shadows for structural separation.

## 16.8 Shadows

Use subtly.

```text
Card default: 0 1px 2px rgba(15, 23, 42, 0.05)
Card elevated: 0 8px 24px rgba(15, 23, 42, 0.08)
Modal: 0 20px 50px rgba(15, 23, 42, 0.16)
```

No strong dark shadows.

## 16.9 Buttons

### Primary

- filled primary color;
- white text;
- used once per decision area;
- clear hover and focus states.

### Secondary

- white or subtle surface;
- border;
- dark text.

### Ghost

- no filled background by default;
- used for low-priority navigation.

### Danger

- reserved for destructive actions;
- likely unused in this demo.

Button rules:

- minimum height 40px desktop;
- minimum touch target 44px mobile;
- loading state preserves width;
- disabled state remains readable;
- icons do not replace labels for critical actions.

## 16.10 Inputs

Inputs include:

- label;
- optional helper text;
- visible focus state;
- error message when relevant;
- disabled style;
- sufficient height;
- placeholder not used as the only label.

Text area:

- comfortable minimum height;
- resize optional;
- character limits only if required.

## 16.11 Cards

Base card:

- white surface;
- subtle border;
- 12px radius;
- 20–24px padding;
- restrained shadow.

Interactive card:

- visible hover;
- keyboard focus;
- entire card may be clickable only if semantics are correct;
- primary action remains explicit.

## 16.12 Status Badges

Every status has:

- icon or dot;
- text label;
- background tint;
- accessible label.

Do not rely on color alone.

## 16.13 Icons

Recommended library:

```text
Lucide React
```

Rules:

- outline style only;
- default 18–20px;
- 16px for compact labels;
- 24px for page-level features;
- consistent stroke width;
- no mixed icon libraries;
- no emoji icons.

## 16.14 Motion

Motion must support comprehension.

Recommended:

- hover transitions: 120–180ms;
- panel transitions: 180–240ms;
- drawer: 200–280ms;
- generation step transitions: 300–500ms;
- respect `prefers-reduced-motion`.

Avoid decorative continuous animation.

---

# 17. Responsive Design

## 17.1 Desktop — 1024px and Above

- full sidebar;
- dashboard summary grid;
- document cards up to three columns;
- interview three-column layout;
- review preview side-by-side;
- sticky action bars allowed.

## 17.2 Tablet — 768px to 1023px

- collapsible sidebar;
- dashboard cards two columns;
- interview progress becomes compact side panel or top stepper;
- captured inputs below conversation or collapsible;
- preview navigation collapsible.

## 17.3 Mobile — Below 768px

- sidebar becomes drawer;
- dashboard cards one column;
- document type cards one column or two compact columns where safe;
- interview single column;
- progress opened through a button or accordion;
- captured inputs accordion;
- bottom sticky primary action;
- draft section navigation dropdown or drawer;
- preview horizontally safe;
- no hidden critical information.

---

# 18. Accessibility Requirements

Required from initial implementation:

- semantic `header`, `nav`, `main`, `aside`, and `section`;
- skip link;
- one `h1` per page;
- logical heading hierarchy;
- keyboard-accessible controls;
- visible `focus-visible` styles;
- form labels connected to controls;
- radio semantics for choices;
- progress ARIA values;
- generation `aria-live`;
- accessible modal focus management;
- status text in addition to color;
- TBC marker readable by screen readers;
- 44px mobile touch target;
- color contrast suitable for WCAG AA;
- reduced-motion support.

---

# 19. Content and Microcopy Rules

## 19.1 Language

All UI content is English in Phase 1.

Do not show a language selector.

A read-only project metadata label may show:

```text
Language: English
```

## 19.2 Writing Style

- concise;
- direct;
- professional;
- no technical implementation language;
- no exaggerated AI claims;
- no promises of accuracy or compliance unsupported by the system.

## 19.3 Missing Information

Always display exactly:

```text
[To be confirmed]
```

Do not replace with:

- TBD
- Unknown
- Missing
- N/A

unless the product owner changes the standard.

## 19.4 Disabled Demo Features

Preferred feedback:

> This action is not available in the current demo.

Do not use:

- “Coming soon!!!”
- vague non-functional controls;
- silent clicks.

---

# 20. Loading, Empty, Error, and Feedback States

## 20.1 Loading

Use skeletons for:

- workspace cards;
- review sections;
- draft preview.

Generation uses the dedicated progress state.

## 20.2 Empty

Every list or filter must have a designed empty state.

## 20.3 Error

Errors must include:

- plain-language message;
- next action;
- preserved user input where possible.

## 20.4 Success

Use small toast feedback for:

- answer saved;
- mock file attached;
- review confirmed;
- mock export action.

Avoid excessive toasts during normal question progression.

---

# 21. Implementation Architecture Alignment

The existing Next.js adaptation using `src/views/` is approved.

Recommended structure:

```text
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── workspace/page.tsx
│   └── documents/
│       ├── new/page.tsx
│       └── [documentId]/
│           ├── interview/page.tsx
│           └── review/page.tsx
├── views/
│   ├── DocumentWorkspace/
│   ├── DocumentTypeSelection/
│   ├── GuidedDocumentInterview/
│   └── ReviewAndGenerate/
├── layouts/
│   └── AppShell/
├── components/
│   ├── ui/
│   ├── workspace/
│   ├── interview/
│   └── review/
├── data/
├── hooks/
├── types/
├── utils/
└── styles/
```

Use route files as thin composition layers. Business/demo behavior belongs in views, hooks, data, and providers.

Do not create both `pages/` and `views/`.

---

# 22. Implementation Order

1. Apply this system design to semantic tokens
2. Verify shared shell
3. Implement Page 1 workspace
4. Implement type selection
5. Review Page 1
6. Implement Page 2 shell
7. Implement interview script
8. Implement follow-up and TBC
9. Review Page 2
10. Implement Page 3 input review
11. Implement generation state
12. Implement draft preview
13. Complete navigation
14. Responsive pass
15. Accessibility pass
16. Production build
17. Netlify deployment
18. Demo rehearsal

Cursor must stop after each main page and summarize:

- files created or changed;
- behaviors completed;
- build status;
- known gaps;
- screenshots or local route to review.

---

# 23. Quality Gates

Before moving to the next page:

- TypeScript passes
- ESLint passes
- production build passes
- no console errors
- no broken route
- no accidental backend code
- no official-brand claim
- no invented document types
- no invented product capability
- keyboard navigation works
- mobile layout is not broken

---

# 24. Demo Script

1. Open Document Workspace
2. Explain the dashboard and project statuses
3. Click Create New Document
4. Show the seven approved document types
5. Select System Implementation
6. Enter document title and beneficiary
7. Enter the vague current-situation answer
8. Show Rami’s follow-up
9. Continue through selected questions
10. Mark duration `[To be confirmed]`
11. Open Review
12. Expand one completed section
13. Show the TBC section
14. Confirm inputs
15. Generate document
16. Show generation sequence
17. Navigate draft sections
18. Highlight Scope of Work and TBC
19. Click Export Word
20. Show demo feedback

---

# 25. Non-Negotiable Rules for Cursor

Cursor must:

- follow this file;
- use Next.js App Router;
- use TypeScript;
- use Tailwind CSS;
- preserve `.private-context/`;
- build only the approved frontend demo;
- use only source-approved document types;
- keep System Implementation as the working path;
- ask one visible question at a time;
- show the required follow-up;
- preserve `[To be confirmed]`;
- require review before generation;
- avoid real integrations;
- avoid unnecessary libraries;
- keep components reusable;
- stop after each page for review.

Cursor must not:

- add login;
- add a backend;
- add APIs;
- add database code;
- add Azure;
- add real AI;
- add real export;
- add document scoring;
- add Arabic;
- add unsupported document types;
- add unrelated dashboard analytics;
- claim provisional colors are official MODEE branding;
- rewrite private context files.

---

# 26. Definition of Demo Completion

The demo is complete when a manager can follow the full journey without explanation of technical limitations:

```text
Workspace
→ Type Selection
→ Guided Interview
→ Follow-Up
→ TBC
→ Review
→ Generate
→ Professional Draft Preview
```

The entire journey must:

- work without runtime errors;
- feel visually consistent;
- remain professional;
- finish within five minutes;
- clearly communicate the future product;
- remain honest about mock functionality.

---

# 27. Cursor Instruction After Adding This File

Use the following prompt after placing this file under:

```text
.private-context/design/02-frontend-system-design.md
```

```text
Read `.private-context/design/02-frontend-system-design.md` completely.

Treat it as the authoritative frontend UX/UI system design and implementation contract for the current management demo.

Compare the existing project foundation against this file.

Do not implement a page yet.

First provide a concise compliance review containing:

1. What already matches
2. What conflicts
3. What foundation files must be adjusted
4. What placeholder design tokens must be replaced
5. The exact implementation sequence for Page 1
6. Any blocking question that cannot be answered from the context

Do not modify `.private-context`.
Do not add backend, API, authentication, database, AI, Azure, or real export functionality.

After the compliance review, wait for approval.

Finish with:
"System design reviewed. Waiting for approval to align the foundation and implement Page 1."
```

---

## Approval

This document is the approved frontend system-design baseline for the Rami management demo.

Any future deviation must be explicitly approved before implementation.
