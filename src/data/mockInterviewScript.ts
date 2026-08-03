import type { QuestionStep } from "@/types/interview";

/**
 * Complete System Implementation interview script.
 *
 * Questions follow the canonical section order defined in interviewSections.ts.
 * All 13 interview sections have at least one question.
 * Q3B is a focused follow-up, inserted dynamically after Q3 when triggered.
 *
 * Primary questions: 17
 * Conditional follow-up: 1 (q3b)
 * Total visible when triggered: 18
 */
export const mockInterviewScript: QuestionStep[] = [
  // ── 1. Document Setup ──────────────────────────────────────────────────────

  {
    id: "q1",
    sectionId: "document-setup",
    prompt: "What is the document title?",
    inputType: "text",
    answerField: "documentTitle",
    label: "Document Title",
    required: true,
    allowTbc: false,
  },
  {
    id: "q2",
    sectionId: "document-setup",
    prompt: "Who is the beneficiary entity?",
    inputType: "text",
    answerField: "beneficiaryEntity",
    label: "Beneficiary Entity",
    required: true,
    allowTbc: true,
  },

  // ── 2. Background and Business Need ────────────────────────────────────────

  {
    id: "q3",
    sectionId: "background",
    prompt: "What is the current situation?",
    helperText:
      "Describe the existing process, platform, or environment and the main limitations affecting users or operations.",
    inputType: "long-text",
    answerField: "currentSituation",
    label: "Current Situation",
    required: true,
    allowTbc: true,
    followUp: {
      triggerMatch: "The current platform is not good.",
      questionId: "q3b",
    },
  },

  // Q3B — focused follow-up, inserted dynamically after Q3 when triggered.
  {
    id: "q3b",
    sectionId: "background",
    prompt:
      "To describe the business need accurately, which specific limitations affect the current platform?",
    inputType: "choice",
    choices: [
      "Performance",
      "Manual processes",
      "Integration gaps",
      "Reporting",
      "User experience",
      "Other",
    ],
    answerField: "specificLimitation",
    label: "Specific Limitation",
    required: true,
    allowTbc: false,
    isFollowUpQuestion: true,
    followUpTriggeredBy: "q3",
  },

  {
    id: "q4",
    sectionId: "background",
    prompt: "What problem should this project solve?",
    helperText:
      "Focus on the business outcome rather than describing a preferred technology.",
    inputType: "long-text",
    answerField: "problemToSolve",
    label: "Problem to Solve",
    required: true,
    allowTbc: true,
  },

  // ── 3. Engagement Type ─────────────────────────────────────────────────────

  {
    id: "q-eng",
    sectionId: "engagement",
    prompt: "What is the expected duration of this engagement?",
    inputType: "text",
    answerField: "expectedDuration",
    label: "Expected Duration",
    required: true,
    allowTbc: true,
  },

  // ── 4. Stakeholders and Users ──────────────────────────────────────────────

  {
    id: "q-stake",
    sectionId: "stakeholders",
    prompt: "Who are the main users or beneficiaries of the system?",
    helperText:
      "Describe who will use the system, their roles, and the approximate number of users if known.",
    inputType: "long-text",
    answerField: "mainUsers",
    label: "Main Users",
    required: true,
    allowTbc: true,
  },

  // ── 5. Scope of Work ───────────────────────────────────────────────────────

  {
    id: "q5",
    sectionId: "scope",
    prompt: "What is in scope for this project?",
    inputType: "long-text",
    answerField: "inScope",
    label: "In Scope",
    required: true,
    allowTbc: true,
  },
  {
    id: "q6",
    sectionId: "scope",
    prompt: "What is explicitly out of scope?",
    inputType: "long-text",
    answerField: "outOfScope",
    label: "Out of Scope",
    required: false,
    allowTbc: true,
  },

  // ── 6. Functional Requirements ─────────────────────────────────────────────

  {
    id: "q-func",
    sectionId: "functional",
    prompt: "What are the core functional capabilities required from the system?",
    helperText:
      "List the main features and capabilities the system must deliver to meet business objectives.",
    inputType: "long-text",
    answerField: "functionalRequirements",
    label: "Functional Requirements",
    required: true,
    allowTbc: true,
  },

  // ── 7. Technical and Non-Functional Requirements ───────────────────────────

  {
    id: "q-tech",
    sectionId: "technical",
    prompt: "What are the key technical and non-functional requirements?",
    helperText:
      "Include performance targets, security standards, integration needs, and infrastructure constraints.",
    inputType: "long-text",
    answerField: "technicalRequirements",
    label: "Technical Requirements",
    required: true,
    allowTbc: true,
  },

  // ── 8. Deliverables ────────────────────────────────────────────────────────

  {
    id: "q-del",
    sectionId: "deliverables",
    prompt: "What are the key deliverables expected from the vendor?",
    inputType: "long-text",
    answerField: "keyDeliverables",
    label: "Key Deliverables",
    required: true,
    allowTbc: true,
  },

  // ── 9. Implementation and Acceptance ──────────────────────────────────────

  {
    id: "q-impl",
    sectionId: "implementation",
    prompt: "What are the expected implementation timeline and acceptance criteria?",
    helperText:
      "Describe the major milestones, go-live expectations, and how successful delivery will be confirmed.",
    inputType: "long-text",
    answerField: "implementationTimeline",
    label: "Implementation Timeline",
    required: true,
    allowTbc: true,
  },

  // ── 10. Support and SLA ────────────────────────────────────────────────────

  {
    id: "q-sup",
    sectionId: "support",
    prompt: "What post-delivery support and service level requirements are expected?",
    helperText:
      "Describe maintenance expectations, response time requirements, and ongoing support scope.",
    inputType: "long-text",
    answerField: "supportRequirements",
    label: "Support and SLA",
    required: true,
    allowTbc: true,
  },

  // ── 11. Evaluation and Financials ──────────────────────────────────────────

  {
    id: "q-eval",
    sectionId: "evaluation",
    prompt: "What is the evaluation framework or expected budget range for this engagement?",
    helperText:
      "Describe how vendors will be evaluated and whether a budget ceiling or range applies.",
    inputType: "long-text",
    answerField: "evaluationFramework",
    label: "Evaluation and Budget",
    required: true,
    allowTbc: true,
  },

  // ── 12. Legal and Annexes ──────────────────────────────────────────────────

  {
    id: "q-legal",
    sectionId: "legal",
    prompt: "Are there specific regulatory, compliance, or legal requirements that apply?",
    helperText:
      "Include any applicable government regulations, data protection standards, or contractual obligations.",
    inputType: "long-text",
    answerField: "legalRequirements",
    label: "Legal and Compliance",
    required: false,
    allowTbc: true,
  },

  // ── 13. Final Gap Check ────────────────────────────────────────────────────

  {
    id: "q10",
    sectionId: "gap-check",
    prompt: "What information is still unknown or pending confirmation?",
    helperText:
      "List any open decisions, missing approvals, or details that still require confirmation.",
    inputType: "long-text",
    answerField: "unknownInformation",
    label: "Unknown Information",
    required: false,
    allowTbc: false,
  },
  {
    id: "q11",
    sectionId: "gap-check",
    prompt: "Please confirm that the collected information is ready for review.",
    inputType: "confirm",
    answerField: "finalConfirmation",
    label: "Final Confirmation",
    required: true,
    allowTbc: false,
  },
];

/**
 * The ordered base sequence (excludes follow-up questions).
 * Follow-ups are inserted at runtime by the interview engine.
 */
export const BASE_INTERVIEW_SCRIPT: QuestionStep[] = mockInterviewScript.filter(
  (step) => !step.isFollowUpQuestion,
);

/**
 * All follow-up question steps keyed by id, for O(1) lookup.
 */
export const FOLLOW_UP_STEPS: Record<string, QuestionStep> = Object.fromEntries(
  mockInterviewScript
    .filter((step) => step.isFollowUpQuestion)
    .map((step) => [step.id, step]),
);
