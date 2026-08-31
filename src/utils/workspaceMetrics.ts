import type { DocumentProject, DocumentStatus } from "@/types/document";

export interface WorkspaceMetrics {
  totalDocuments: number;
  inProgress: number;
  needsClarification: number;
  draftsGenerated: number;
}

/**
 * Deterministic workspace metrics from PostgreSQL-backed document summaries.
 *
 * - totalDocuments: all projects in the environment
 * - inProgress: active projects still being collected or reviewed (excludes draft-generated)
 * - needsClarification: projects with TBC, gaps, or contradictions
 * - draftsGenerated: projects with at least one generated RFP section
 */
export function deriveWorkspaceMetrics(
  documents: DocumentProject[],
): WorkspaceMetrics {
  return {
    totalDocuments: documents.length,
    inProgress: documents.filter(
      (document) =>
        document.status === "in-progress" ||
        document.status === "not-started" ||
        document.status === "ready-for-review" ||
        document.status === "generating",
    ).length,
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
