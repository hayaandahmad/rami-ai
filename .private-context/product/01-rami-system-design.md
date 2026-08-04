# RAMI — System Design Specification

**Project:** Rami — Guided AI RFP Document Assistant  
**Organization:** MODEE Business Development  
**Document Type:** Product and System Design Specification  
**Phase:** Management Demo / Frontend Prototype  
**Language:** English only  
**Document Scoring:** Out of scope for Phase 1  
**Human Approval:** Required before any final RFP is considered approved

---

## 1. Purpose of This Document

This document defines what the first Rami system demo should contain, how the user moves through it, what each page is responsible for, and what should be included or excluded from the first implementation.

This file is intended to be used as the primary product specification before UI design and coding begin.

It should be read together with:

- Rami identity, soul, and user files
- Rami question bank
- MODEE RFP master structure
- Build requirements
- Tools and stack notes

---

## 2. Product Definition

Rami is a guided AI document assistant for MODEE Business Development.

Rami helps a Business Analyst create a professional English RFP draft by:

1. Asking one relevant question at a time
2. Saving each answer
3. Detecting incomplete, vague, or conflicting information
4. Asking focused follow-up questions
5. Organizing confirmed information into the correct RFP sections
6. Marking unknown information as **[To be confirmed]**
7. Showing the collected information to the Business Analyst for review
8. Generating a structured first draft
9. Keeping the Business Analyst in control of final review and approval

Rami is not a general chatbot, vendor-selection system, or fully autonomous procurement platform.

---

## 3. Main Goal of the First Demo

The first demo must help managers understand the complete value of the system in a few minutes.

The demo should clearly communicate this journey:

```text
Manage RFP Projects
        ↓
Start or Continue an RFP
        ↓
Answer Guided Questions
        ↓
Review Collected Information
        ↓
Generate a Professional RFP Draft
```

The demo should prove that:

- Rami guides the user instead of waiting for a complete brief
- Rami saves and structures information
- Rami asks follow-up questions when answers are weak
- Rami does not invent missing information
- Rami follows the MODEE RFP structure
- The Business Analyst reviews everything before generation
- The final result looks like a professional RFP draft

---

## 4. Target User

### Primary User

A MODEE Business Analyst responsible for preparing professional RFP documents.

### User Needs

The Business Analyst needs:

- A guided process
- Less repetitive drafting
- Clear identification of missing information
- A professional English first draft
- A structured workflow
- The ability to stop and continue later
- Control over final review and approval

### User Constraints

- The user is busy
- The user may not have all project information at the beginning
- Some answers may be vague or incomplete
- Some information may need approval from other stakeholders
- The user must remain responsible for the final document

---

## 5. Demo Scope

The first demo will contain three main product pages.

### Included

1. RFP Workspace
2. Guided RFP Interview
3. Review and Generate

### Included as Mock Behavior

- Project cards
- Progress tracking
- Question progression
- Follow-up questions
- Captured input summary
- Review states
- RFP generation animation
- Generated RFP preview
- Export button appearance
- Edit and regenerate controls

### Not Included

- Real authentication
- Real database
- Real AI integration
- Azure integration
- Real DOCX or PDF generation
- User management
- Admin panel
- Notifications
- Real template management
- Real knowledge-base management
- Document scoring
- Vendor evaluation
- Automatic publishing
- Arabic or bilingual generation

---

# 6. Page 1 — RFP Workspace

## 6.1 Purpose

The RFP Workspace is the main entry point of the system.

It shows that Rami is not only a chat interface. It is a working environment where the Business Analyst can create, continue, review, and manage multiple RFP projects.

## 6.2 User Goal

The user should be able to:

- Start a new RFP
- Continue an existing RFP
- Open a generated draft
- Understand the current status of each project
- See where work stopped
- Identify projects that need clarification or review

## 6.3 Main Sections

### A. Page Header

Contains:

- Page title: **RFP Workspace**
- Short explanation
- User name or profile area
- Main action button: **Create New RFP**

Example text:

> Create, continue, and review guided RFP projects with Rami.

### B. Main Action Area

Primary button:

```text
+ Create New RFP
```

This button starts a new guided RFP session.

### C. Project List or Grid

Each project card should include:

- Project title
- RFP type
- Beneficiary entity
- Current status
- Progress percentage
- Last updated date
- Main next action

Example:

```text
Digital Services Platform

System Implementation RFP
Beneficiary: MODEE

Status: In Progress
Progress: 42%
Last updated: Today

[Continue Interview]
```

### D. Optional Filters

For the demo, simple filters may appear:

- All
- In Progress
- Needs Clarification
- Ready for Review
- Draft Generated

These can be visual-only in the first version.

## 6.4 Project Statuses

The first demo should support these statuses:

- Not Started
- In Progress
- Needs Clarification
- Ready for Review
- Generating
- Draft Generated
- Approved

## 6.5 Empty State

If no projects exist:

```text
No RFP projects yet.

Start your first guided RFP with Rami.

[Create New RFP]
```

## 6.6 Main Navigation

From this page:

- **Create New RFP** → Guided RFP Interview
- **Continue Interview** → Guided RFP Interview
- **Review Inputs** → Review and Generate
- **Open Draft** → Review and Generate, draft preview state

## 6.7 Why This Page Matters

This page demonstrates that:

- Work is saved
- Multiple RFP projects can be managed
- Users can continue later
- Rami supports a real business workflow
- The system is more than a temporary chatbot

---

# 7. Page 2 — Guided RFP Interview

## 7.1 Purpose

The Guided RFP Interview is the core of the Rami product.

Rami asks one question at a time, evaluates the answer, saves the result, and asks a follow-up question when necessary.

## 7.2 User Goal

The user should be able to:

- Answer one question at a time
- Understand the current interview section
- See overall progress
- Review already captured information
- Mark unavailable information as **[To be confirmed]**
- Attach reference material
- Save and exit
- Continue until all required information is captured

## 7.3 Main Layout

For desktop, the page should use three main areas:

```text
Interview Progress | Conversation Area | Captured Inputs
```

### A. Interview Progress Panel

Displays the main interview areas:

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

Each section should show one state:

- Not Started
- Current
- Completed
- Needs Clarification

### B. Conversation Area

Contains:

- Rami identity
- Current question
- Previous answer where relevant
- Follow-up question when needed
- Input field or choice buttons
- Supporting helper text
- Main action buttons

Example:

```text
Rami

What type of RFP are you preparing?

[System Implementation]
[Framework Agreement]
[Consulting Service]
[Assessment]
[Support Contract]
[Other]
```

Example of a follow-up:

```text
Business Analyst:
The current platform is not good.

Rami:
To describe the business need accurately, which specific issues affect the current platform?

[Performance]
[Manual Processes]
[Integration Gaps]
[Reporting]
[User Experience]
[Other]
```

### C. Captured Inputs Panel

Shows a live summary of saved information.

Example:

```text
RFP Type
System Implementation

Title
Digital Services Platform

Beneficiary
MODEE

Expected Duration
[To be confirmed]

Hosting
Government Cloud
```

## 7.4 Main Actions

The page should include:

- Save Answer
- Continue
- Back
- Mark as To be Confirmed
- Attach Reference File
- Save and Exit
- Review Collected Inputs

## 7.5 Required Behaviors

### Ask One Question at a Time

The system should never display the entire question bank as one long form.

### Save Every Answer

After the user continues, the answer should be considered saved in the demo state.

### Detect Weak Answers

When the answer is incomplete, vague, or contradictory, Rami should ask a focused follow-up question.

### Do Not Invent

Rami should never fill missing facts by itself.

### Allow TBC

The user can explicitly mark information as:

```text
[To be confirmed]
```

### Show Progress

The user should always know:

- Current section
- Completed sections
- Remaining sections
- Sections that need clarification

## 7.6 Demo Question Path

The first demo does not need the entire question bank.

It should show a short but realistic path:

1. What type of RFP is this?
2. What is the RFP title?
3. Who is the beneficiary entity?
4. What is the current situation?
5. What problem should the project solve?
6. What is in scope?
7. What is out of scope?
8. Who are the main users?
9. What are the key deliverables?
10. What is the expected duration?
11. What information is still unknown?
12. Confirm collected information

At least one answer should trigger a follow-up question.

At least one field should remain **[To be confirmed]**.

## 7.7 Interview States

The demo should show:

- Normal question
- Multiple-choice question
- Long-text question
- Incomplete answer
- Follow-up question
- Saved answer
- File attached
- Saving state
- Save error state
- Section completed
- Interview completed

## 7.8 Why This Page Matters

This page proves the core intelligence of Rami.

It demonstrates that Rami:

- Guides the Business Analyst
- Asks purposeful questions
- Detects gaps
- Reduces incomplete requirements
- Organizes information
- Avoids guessing
- Saves the Business Analyst from starting with a blank document

---

# 8. Page 3 — Review and Generate

## 8.1 Purpose

This page allows the Business Analyst to review all collected information before Rami generates the draft.

It also displays the generated RFP after confirmation.

This page is important because the Business Analyst must remain in control of final review and approval.

## 8.2 Page States

This page has three states:

1. Input Review
2. Generating
3. Draft Preview

---

## 8.3 State 1 — Input Review

### User Goal

The user should be able to:

- Review all captured information
- Identify incomplete sections
- Edit an answer
- Return to the interview
- Confirm that the information is ready
- Generate the first RFP draft

### Main Sections

#### A. Page Header

```text
Review Your Inputs

Confirm the collected information before Rami generates the first draft.
```

#### B. Section Completion Summary

Example:

```text
Document Setup                     Complete
Background and Business Need       Complete
Stakeholders and Users             Complete
Scope of Work                      Complete
Technical Requirements             Needs Clarification
Deliverables                       Complete
Legal and Annexes                  To be confirmed
```

#### C. Expandable Review Sections

Each section should open and show the captured answers.

Example:

```text
Technical Requirements

Hosting Model
Government Cloud

Data Residency
Jordan

Data Migration
[To be confirmed]
```

#### D. Review Actions

- Edit Answer
- Return to Interview
- Confirm Inputs
- Generate RFP Draft

## 8.4 Generation Readiness Rules

The Generate button should become available when:

- Required information is completed
- Or missing information is explicitly marked **[To be confirmed]**
- The Business Analyst confirms the collected summary

The demo does not need real validation logic, but the UI should communicate this rule.

---

## 8.5 State 2 — Generating

After the user clicks **Generate RFP Draft**, show a short generation sequence.

Example steps:

```text
Preparing the MODEE master structure
Loading relevant RFP sections
Applying confirmed project inputs
Marking missing information
Generating the English RFP draft
Preparing the document preview
```

This can be a short timed animation in the frontend demo.

---

## 8.6 State 3 — Generated RFP Preview

### User Goal

The user should be able to:

- Read the generated document
- Navigate between RFP sections
- Identify TBC content
- Edit or regenerate a section
- Mark content for review
- Export the document

### Main Layout

```text
RFP Section Navigation | Document Preview
```

### A. RFP Section Navigation

The visible sections should be based on the selected RFP type.

Possible sections:

1. Cover Page
2. Table of Contents
3. Abbreviations and Definitions
4. Introduction
5. Background and Business Need
6. Engagement Definition
7. Scope of Work
8. Functional Requirements
9. Technical and Non-Functional Requirements
10. Implementation Requirements
11. Deliverables
12. Project Management and Governance
13. Acceptance Criteria and Go-Live
14. Support and Maintenance
15. Manpower and Resource Requirements
16. Administrative Procedures and Requirements
17. Proposal Evaluation Criteria
18. Financial Proposal Requirements
19. Legal and Contractual Terms
20. Annexes

The demo should not show all sections unless they are relevant to the selected project.

### B. Document Preview

The document area should look like a professional RFP document.

It should display:

- Section titles
- Paragraphs
- Numbered requirements
- Tables where relevant
- Highlighted **[To be confirmed]** values
- Document status
- Last generated time

### C. Draft Actions

- Edit Section
- Regenerate Section
- Add Comment
- Mark for Review
- Export Word
- Export PDF

In the first demo, these actions may be mock interactions.

## 8.7 Why This Page Matters

This page proves that:

- Rami reviews before generating
- Human approval is part of the workflow
- The final output follows a professional structure
- Unknown information remains visible
- The user can control and improve the draft
- Rami produces a usable document, not only chat responses

---

# 9. Complete Demo User Journey

The recommended management demo flow is:

1. Open the RFP Workspace
2. Show existing example projects
3. Click **Create New RFP**
4. Select **System Implementation RFP**
5. Answer a few guided questions
6. Enter one intentionally vague answer
7. Show Rami asking a focused follow-up
8. Mark one answer as **[To be confirmed]**
9. Show captured inputs and progress
10. Open the Review page
11. Show completed and incomplete sections
12. Confirm inputs
13. Click **Generate RFP Draft**
14. Show generation progress
15. Open the generated RFP preview
16. Navigate to Scope of Work
17. Highlight a **[To be confirmed]** item
18. Show Export Word and Export PDF actions

Recommended demo length: **3 to 5 minutes**.

---

# 10. Navigation Structure

Recommended frontend routes:

```text
/workspace
/projects/new
/projects/:projectId/interview
/projects/:projectId/review
/projects/:projectId/draft
```

For the first demo, Review and Draft can share one route and switch between states.

---

# 11. Shared Application Layout

The three pages should use one consistent application shell.

## Sidebar

Possible navigation items:

- RFP Workspace
- My Drafts
- Templates
- Knowledge Base
- Settings

Only the RFP Workspace and demo flow must work in the first version.

## Top Header

Possible content:

- Current page title
- Search
- Help
- User profile

## Main Content Area

Should support:

- Page header
- Breadcrumbs where useful
- Main content
- Sticky action areas where useful

---

# 12. Core Reusable Components

The frontend should be built from reusable components.

Recommended components:

```text
AppShell
Sidebar
TopHeader
PageHeader
PrimaryButton
SecondaryButton
StatusBadge
ProjectCard
ProgressBar
InterviewSectionList
QuestionCard
AnswerInput
ChoiceButtonGroup
CapturedInputCard
ReviewSectionAccordion
GenerationProgress
RfpSectionNavigation
DocumentPreview
EmptyState
ErrorState
ConfirmationModal
ToastMessage
```

---

# 13. Mock Data Required

The demo should include at least three sample projects.

## Project 1

```text
Title: Digital Services Platform
Type: System Implementation RFP
Beneficiary: MODEE
Status: In Progress
Progress: 42%
```

## Project 2

```text
Title: Cybersecurity Assessment
Type: Assessment RFP
Beneficiary: Government Entity
Status: Draft Generated
Progress: 100%
```

## Project 3

```text
Title: Government Cloud Support
Type: Support Contract RFP
Beneficiary: MODEE
Status: Needs Clarification
Progress: 68%
```

The main demo project should be **Digital Services Platform**.

---

# 14. Responsive Requirements

## Desktop

- Full sidebar
- Three-column interview layout
- Project cards in grid
- RFP navigation and preview side by side

## Tablet

- Collapsible sidebar
- Two-column interview layout
- Captured inputs may move below the conversation
- Project cards in two columns

## Mobile

- Sidebar becomes drawer
- All content becomes one column
- Interview progress becomes a top stepper or drawer
- Captured inputs become an accordion
- Main actions remain easy to reach
- Document section navigation becomes a dropdown or drawer

---

# 15. Accessibility Requirements

The interface should:

- Maintain sufficient color contrast
- Support keyboard navigation
- Use visible focus states
- Use labels for all form controls
- Avoid using color as the only status indicator
- Use readable font sizes
- Provide clear error messages
- Use accessible button names
- Support screen-reader-friendly headings

---

# 16. System Rules That Must Always Be Visible in the Product

The design should reinforce these product rules:

1. English only in Phase 1
2. One question at a time
3. Save each answer
4. Ask follow-up questions when needed
5. Do not invent missing information
6. Use **[To be confirmed]** for unknown information
7. Review inputs before generating
8. Human approval is required
9. No document scoring in Phase 1
10. Rami does not publish or submit the RFP

---

# 17. Implementation Approach for Cursor

Before writing code, Cursor should:

1. Read all product, knowledge, and Rami DNA files
2. Read this system design file
3. Produce an implementation plan
4. Identify reusable components
5. Define mock data
6. Define route structure
7. Wait for design-system instructions
8. Only then begin frontend implementation

Recommended first instruction to Cursor:

```text
Read all files under docs/product, docs/knowledge, docs/rami-dna, and this system design specification.

Do not write code yet.

Prepare a frontend implementation plan for the three-page Rami management demo.

For each page, define:
- page purpose
- user goal
- sections
- components
- mock data
- interactions
- states
- navigation
- reusable components
- responsive behavior

Constraints:
- English only
- frontend-only demo
- no real authentication
- no backend
- no database
- no real AI integration
- no document scoring
- human review required
- unknown information must appear as [To be confirmed]

Wait for the design-system file before generating UI code.
```

---

# 18. Final Design Decision

The first Rami demo will use these three pages:

1. **RFP Workspace**
2. **Guided RFP Interview**
3. **Review and Generate**

This is the preferred first scope because it demonstrates the complete product value while avoiding unnecessary technical complexity.

The demo should make the following idea immediately understandable:

> Start an RFP, answer guided questions, review the collected information, and generate a professional first draft.
