import { DOCUMENT_TYPES } from "@/data/documentTypes";
import type { DocumentStatus, DocumentType } from "@/types/document";
import type {
  AnswerPersistencePayload,
  InterviewSaveRequest,
  SessionPersistencePayload,
} from "@/types/persistence";

/**
 * Runtime validation for POST /api/interview/save request bodies.
 * Kept separate from the Google Sheets client so the shape contract
 * can be reused if the persistence backend changes later.
 */

const VALID_DOCUMENT_STATUSES: readonly DocumentStatus[] = [
  "not-started",
  "in-progress",
  "needs-clarification",
  "ready-for-review",
  "generating",
  "draft-generated",
];

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function validateInterviewSaveRequest(
  body: unknown,
): ValidationResult<InterviewSaveRequest> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const record = body as Record<string, unknown>;

  const sessionResult = validateSession(record.session);
  if (!sessionResult.ok) return sessionResult;

  const staleAnswerQuestionIdsResult = validateStaleAnswerQuestionIds(
    record.staleAnswerQuestionIds,
  );
  if (!staleAnswerQuestionIdsResult.ok) return staleAnswerQuestionIdsResult;

  const base: InterviewSaveRequest = {
    session: sessionResult.value,
    ...(staleAnswerQuestionIdsResult.value
      ? { staleAnswerQuestionIds: staleAnswerQuestionIdsResult.value }
      : {}),
  };

  if (record.answer === undefined) {
    return { ok: true, value: base };
  }

  const answerResult = validateAnswer(record.answer);
  if (!answerResult.ok) return answerResult;

  return {
    ok: true,
    value: { ...base, answer: answerResult.value },
  };
}

function validateStaleAnswerQuestionIds(
  input: unknown,
): ValidationResult<string[] | undefined> {
  if (input === undefined) {
    return { ok: true, value: undefined };
  }

  if (
    !Array.isArray(input) ||
    !input.every((id) => typeof id === "string" && id.length > 0)
  ) {
    return {
      ok: false,
      error: "staleAnswerQuestionIds must be an array of non-empty strings when provided.",
    };
  }

  return { ok: true, value: input as string[] };
}

function validateAnswer(
  input: unknown,
): ValidationResult<AnswerPersistencePayload> {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "answer must be an object when provided." };
  }

  const a = input as Record<string, unknown>;

  const requiredStrings: Array<keyof AnswerPersistencePayload> = [
    "documentId",
    "questionId",
    "answerField",
    "sectionId",
    "questionText",
    "value",
    "updatedAt",
  ];

  for (const field of requiredStrings) {
    if (typeof a[field] !== "string" || (a[field] as string).length === 0) {
      return { ok: false, error: `answer.${field} must be a non-empty string.` };
    }
  }

  if (!isDocumentType(a.documentType)) {
    return { ok: false, error: "answer.documentType must be a known document type." };
  }
  if (typeof a.isTbc !== "boolean") {
    return { ok: false, error: "answer.isTbc must be a boolean." };
  }
  if (typeof a.isFollowUp !== "boolean") {
    return { ok: false, error: "answer.isFollowUp must be a boolean." };
  }

  return {
    ok: true,
    value: {
      documentId: a.documentId as string,
      documentType: a.documentType,
      questionId: a.questionId as string,
      answerField: a.answerField as string,
      sectionId: a.sectionId as string,
      questionText: a.questionText as string,
      value: a.value as string,
      isTbc: a.isTbc,
      isFollowUp: a.isFollowUp,
      updatedAt: a.updatedAt as string,
    },
  };
}

function validateSession(
  input: unknown,
): ValidationResult<SessionPersistencePayload> {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "session must be an object." };
  }

  const s = input as Record<string, unknown>;

  const requiredStrings: Array<keyof SessionPersistencePayload> = [
    "documentId",
    "documentTitle",
    "beneficiary",
    "updatedAt",
  ];

  for (const field of requiredStrings) {
    if (typeof s[field] !== "string" || (s[field] as string).length === 0) {
      return { ok: false, error: `session.${field} must be a non-empty string.` };
    }
  }

  if (!isDocumentType(s.documentType)) {
    return { ok: false, error: "session.documentType must be a known document type." };
  }
  if (!isDocumentStatus(s.status)) {
    return { ok: false, error: "session.status must be a known document status." };
  }
  if (typeof s.progressPercent !== "number" || Number.isNaN(s.progressPercent)) {
    return { ok: false, error: "session.progressPercent must be a number." };
  }
  if (typeof s.interviewCompleted !== "boolean") {
    return { ok: false, error: "session.interviewCompleted must be a boolean." };
  }

  return {
    ok: true,
    value: {
      documentId: s.documentId as string,
      documentTitle: s.documentTitle as string,
      documentType: s.documentType,
      beneficiary: s.beneficiary as string,
      status: s.status,
      progressPercent: s.progressPercent,
      interviewCompleted: s.interviewCompleted,
      updatedAt: s.updatedAt as string,
    },
  };
}

function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === "string" && (DOCUMENT_TYPES as readonly string[]).includes(value);
}

function isDocumentStatus(value: unknown): value is DocumentStatus {
  return (
    typeof value === "string" &&
    (VALID_DOCUMENT_STATUSES as readonly string[]).includes(value)
  );
}
