import type { InterviewSection } from "@/types/interview";

export const interviewSections: InterviewSection[] = [
  { id: "document-setup", label: "Document Setup", order: 1 },
  { id: "background", label: "Background and Business Need", order: 2 },
  { id: "engagement", label: "Engagement Type", order: 3 },
  { id: "stakeholders", label: "Stakeholders and Users", order: 4 },
  { id: "scope", label: "Scope of Work", order: 5 },
  { id: "functional", label: "Functional Requirements", order: 6 },
  { id: "technical", label: "Technical and Non-Functional Requirements", order: 7 },
  { id: "deliverables", label: "Deliverables", order: 8 },
  { id: "implementation", label: "Implementation and Acceptance", order: 9 },
  { id: "support", label: "Support and SLA", order: 10 },
  { id: "evaluation", label: "Evaluation and Financials", order: 11 },
  { id: "legal", label: "Legal and Annexes", order: 12 },
  { id: "gap-check", label: "Final Gap Check", order: 13 },
];

export function getInterviewSectionLabel(sectionId: string): string {
  return interviewSections.find((section) => section.id === sectionId)?.label ?? sectionId;
}
