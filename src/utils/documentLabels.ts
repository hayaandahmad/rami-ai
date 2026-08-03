import type { DocumentNextAction, DocumentStatus } from "@/types/document";

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  "not-started": "Not Started",
  "in-progress": "In Progress",
  "needs-clarification": "Needs Clarification",
  "ready-for-review": "Ready for Review",
  generating: "Generating",
  "draft-generated": "Draft Generated",
};

export const DOCUMENT_NEXT_ACTION_LABELS: Record<DocumentNextAction, string> = {
  "continue-interview": "Continue Interview",
  "review-inputs": "Review Inputs",
  "open-draft": "Open Draft",
  create: "Create New Document",
};

export function getDocumentStatusLabel(status: DocumentStatus): string {
  return DOCUMENT_STATUS_LABELS[status];
}

export function getDocumentNextActionLabel(action: DocumentNextAction): string {
  return DOCUMENT_NEXT_ACTION_LABELS[action];
}
