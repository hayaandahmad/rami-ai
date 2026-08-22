import type { DocumentStatus, DocumentType } from "@/types/document";

/**
 * One captured interview answer, ready to be upserted into the
 * Google Sheets "answers" tab by document_id + question_id.
 */
export interface AnswerPersistencePayload {
  documentId: string;
  documentType: DocumentType;
  questionId: string;
  answerField: string;
  sectionId: string;
  /** Snapshot of the question prompt at save time (wording may change later). */
  questionText: string;
  value: string;
  isTbc: boolean;
  isFollowUp: boolean;
  updatedAt: string;
}

/**
 * One interview/document session, ready to be upserted into the
 * Google Sheets "sessions" tab by document_id.
 */
export interface SessionPersistencePayload {
  documentId: string;
  documentTitle: string;
  documentType: DocumentType;
  beneficiary: string;
  status: DocumentStatus;
  progressPercent: number;
  interviewCompleted: boolean;
  updatedAt: string;
}

/**
 * Request body accepted by POST /api/interview/save.
 * `answer` is omitted for session-only saves (e.g. interview completion).
 *
 * `staleAnswerQuestionIds` lists question_ids whose CURRENT answer row
 * must be removed from the "answers" sheet in the same locked operation.
 * This is used when a parent answer changes such that a previously
 * triggered follow-up question (e.g. q3b) is no longer part of Rami's
 * current structured interview — the row is deleted outright rather than
 * soft-deleted, since "answers" is a current-state table, not a history.
 */
export interface InterviewSaveRequest {
  answer?: AnswerPersistencePayload;
  session: SessionPersistencePayload;
  staleAnswerQuestionIds?: string[];
}

export interface InterviewSaveSuccessResponse {
  ok: true;
}

export interface InterviewSaveErrorResponse {
  ok: false;
  error: string;
}

export type InterviewSaveResponse =
  | InterviewSaveSuccessResponse
  | InterviewSaveErrorResponse;
