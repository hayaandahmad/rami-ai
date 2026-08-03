import type { DocumentProject } from "@/types/document";

export const mockDocuments: DocumentProject[] = [
  {
    id: "doc-001",
    title: "Digital Services Platform",
    documentType: "system-implementation",
    beneficiary: "MODEE",
    status: "in-progress",
    progressPercent: 42,
    lastUpdated: "Today",
    nextAction: "continue-interview",
    interviewCompleted: false,
  },
  {
    id: "doc-002",
    title: "Cybersecurity Assessment",
    documentType: "assessment",
    beneficiary: "Government Entity",
    status: "draft-generated",
    progressPercent: 100,
    lastUpdated: "Yesterday",
    nextAction: "open-draft",
    interviewCompleted: true,
    draftGeneratedAt: "Yesterday",
  },
  {
    id: "doc-003",
    title: "Government Cloud Support",
    documentType: "support",
    beneficiary: "MODEE",
    status: "needs-clarification",
    progressPercent: 68,
    lastUpdated: "2 days ago",
    nextAction: "review-inputs",
    interviewCompleted: false,
  },
];
