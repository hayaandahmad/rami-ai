export type DocumentType =
  | "system-implementation"
  | "framework-agreement"
  | "consulting"
  | "assessment"
  | "support"
  | "connectivity-telecom"
  | "other";

export type DocumentStatus =
  | "not-started"
  | "in-progress"
  | "needs-clarification"
  | "ready-for-review"
  | "generating"
  | "draft-generated";

export type DocumentNextAction =
  | "continue-interview"
  | "review-inputs"
  | "open-draft"
  | "create";

export interface DocumentProject {
  id: string;
  title: string;
  documentType: DocumentType;
  beneficiary: string;
  status: DocumentStatus;
  progressPercent: number;
  lastUpdated: string;
  nextAction: DocumentNextAction;
  interviewCompleted: boolean;
  draftGeneratedAt?: string;
}
