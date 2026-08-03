import type { DocumentProject, DocumentStatus } from "@/types/document";

export interface WorkspaceMetrics {
  totalDocuments: number;
  inProgress: number;
  needsClarification: number;
  draftsGenerated: number;
}

export function deriveWorkspaceMetrics(
  documents: DocumentProject[],
): WorkspaceMetrics {
  return {
    totalDocuments: documents.length,
    inProgress: documents.filter((document) => document.status === "in-progress")
      .length,
    needsClarification: documents.filter(
      (document) => document.status === "needs-clarification",
    ).length,
    draftsGenerated: documents.filter(
      (document) => document.status === "draft-generated",
    ).length,
  };
}

export function matchesWorkspaceFilter(
  document: DocumentProject,
  filter: string,
): boolean {
  if (filter === "all") {
    return true;
  }

  return document.status === (filter as DocumentStatus);
}
