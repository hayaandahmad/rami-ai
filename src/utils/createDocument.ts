import type { DocumentProject, DocumentType } from "@/types/document";

export function createMockDocument(documentType: DocumentType): DocumentProject {
  const id = `doc-${Date.now()}`;

  return {
    id,
    title: "New Document",
    documentType,
    beneficiary: "[To be confirmed]",
    status: "not-started",
    progressPercent: 0,
    lastUpdated: "Today",
    nextAction: "continue-interview",
    interviewCompleted: false,
  };
}
