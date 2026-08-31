import type { DocumentNextAction } from "@/types/document";
import type { ReviewPageState } from "@/types/interview";

export function getDocumentActionHref(
  documentId: string,
  nextAction: DocumentNextAction,
): string {
  switch (nextAction) {
    case "continue-interview":
    case "review-inputs":
    case "open-draft":
      // Conversational workspace is the live BA surface; /review is a retained stub.
      return `/documents/${documentId}/interview`;
    case "create":
      return "/documents/new";
    default:
      return `/documents/${documentId}/interview`;
  }
}

export function getReviewStateForAction(
  nextAction: DocumentNextAction,
): ReviewPageState | null {
  if (nextAction === "review-inputs") {
    return "input-review";
  }

  if (nextAction === "open-draft") {
    return "draft-preview";
  }

  return null;
}
