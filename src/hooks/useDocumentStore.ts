"use client";

import type { Dispatch } from "react";
import { useDocumentStoreContext } from "@/app/providers/DocumentStoreProvider";
import type { DocumentProject } from "@/types/document";
import type {
  CapturedAnswer,
  GroupedCapturedAnswers,
  InterviewProgress,
  MockAttachment,
  ReviewPageState,
} from "@/types/interview";
import type { DocumentStoreAction } from "@/types/store";
import { groupCapturedAnswersBySection } from "@/utils/capturedAnswers";

export function useDocumentStore() {
  const { state, dispatch } = useDocumentStoreContext();

  return {
    state,
    dispatch,
    documents: state.documents,
    activeDocumentId: state.activeDocumentId,
    getDocument: (documentId: string): DocumentProject | undefined =>
      state.documents.find((document) => document.id === documentId),
    getAnswers: (documentId: string): Record<string, CapturedAnswer> =>
      state.answersByDocumentId[documentId] ?? {},
    getInterviewProgress: (documentId: string): InterviewProgress | undefined =>
      state.interviewProgressByDocumentId[documentId],
    getAttachment: (documentId: string): MockAttachment | null =>
      state.attachmentByDocumentId[documentId] ?? null,
    getGroupedCapturedAnswers: (documentId: string): GroupedCapturedAnswers[] =>
      groupCapturedAnswersBySection(state.answersByDocumentId[documentId] ?? {}),
    getReviewConfirmed: (documentId: string): boolean =>
      state.reviewConfirmedByDocumentId[documentId] ?? false,
    getReviewPageState: (documentId: string): ReviewPageState =>
      state.reviewPageStateByDocumentId[documentId] ?? "input-review",
  };
}

export function useDocumentDispatch() {
  const { dispatch } = useDocumentStoreContext();
  return dispatch as Dispatch<DocumentStoreAction>;
}
