import type { Dispatch } from "react";
import type { DocumentProject } from "@/types/document";
import type {
  CapturedAnswer,
  InterviewProgress,
  MockAttachment,
  ReviewPageState,
} from "@/types/interview";

export interface DocumentStoreState {
  documents: DocumentProject[];
  activeDocumentId: string | null;
  answersByDocumentId: Record<string, Record<string, CapturedAnswer>>;
  interviewProgressByDocumentId: Record<string, InterviewProgress>;
  attachmentByDocumentId: Record<string, MockAttachment>;
  reviewConfirmedByDocumentId: Record<string, boolean>;
  reviewPageStateByDocumentId: Record<string, ReviewPageState>;
}

export type DocumentStoreAction =
  | { type: "SET_ACTIVE_DOCUMENT"; documentId: string }
  | { type: "CREATE_DOCUMENT"; document: DocumentProject }
  | { type: "SAVE_ANSWER"; documentId: string; answer: CapturedAnswer }
  | { type: "SET_INTERVIEW_PROGRESS"; documentId: string; progress: InterviewProgress }
  | { type: "COMPLETE_INTERVIEW"; documentId: string }
  | { type: "CONFIRM_REVIEW"; documentId: string; confirmed: boolean }
  | { type: "SET_REVIEW_STATE"; documentId: string; state: ReviewPageState }
  | { type: "UPDATE_DOCUMENT"; documentId: string; updates: Partial<DocumentProject> }
  | { type: "SET_ATTACHMENT"; documentId: string; attachment: MockAttachment }
  | { type: "REMOVE_ATTACHMENT"; documentId: string };

export interface DocumentStoreContextValue {
  state: DocumentStoreState;
  dispatch: Dispatch<DocumentStoreAction>;
}
