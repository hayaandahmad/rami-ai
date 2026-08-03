"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BASE_INTERVIEW_SCRIPT,
  FOLLOW_UP_STEPS,
  mockInterviewScript,
} from "@/data/mockInterviewScript";
import { interviewSections } from "@/data/interviewSections";
import { useDocumentDispatch, useDocumentStore } from "@/hooks/useDocumentStore";
import { useSaveStatus } from "@/hooks/useSaveStatus";
import { TBC_VALUE } from "@/utils/tbc";
import { matchesFollowUpTrigger } from "@/utils/followUpTrigger";
import { groupCapturedAnswersBySection } from "@/utils/capturedAnswers";
import {
  buildVisibleScript,
  calculateInterviewProgressPercent,
  computeSectionStates,
  createInitialInterviewProgress,
} from "@/utils/interviewProgress";
import type {
  CapturedAnswer,
  GroupedCapturedAnswers,
  InterviewProgress,
  MockAttachment,
  QuestionStep,
  SaveState,
  SectionState,
} from "@/types/interview";
import type { DocumentProject } from "@/types/document";
import type { InterviewSection } from "@/types/interview";

// After mock-save completes (400ms), show thinking for this additional duration.
const THINKING_EXTRA_MS = 300; // total from click: 400 + 300 = 700ms

// ─── Return type ──────────────────────────────────────────────────────────────

export interface InterviewEngineResult {
  document: DocumentProject | null;
  error: string | null;

  visibleScript: QuestionStep[];
  currentQuestion: QuestionStep | null;
  currentIndex: number;
  totalSteps: number;

  answers: Record<string, CapturedAnswer>;
  groupedCapturedAnswers: GroupedCapturedAnswers[];
  lastSavedField: string | null;

  progressPercent: number;

  sections: InterviewSection[];
  sectionStates: Record<string, SectionState>;

  attachment: MockAttachment | null;

  saveState: SaveState;
  validationError: string | null;

  /** True when the interview has no completed questions — first-time entry. */
  isFirstEntry: boolean;
  /** True during the AI thinking state before a follow-up question appears. */
  showThinking: boolean;

  isComplete: boolean;
  canGoBack: boolean;
  isOnLastQuestion: boolean;

  saveAnswer: (value: string) => void;
  markTbc: () => void;
  goBack: () => void;
  setAttachment: (name: string) => void;
  removeAttachment: () => void;
  completeInterview: () => void;
  saveAndExit: () => void;
  clearSaveError: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInterviewEngine(
  documentId: string | undefined,
): InterviewEngineResult {
  const router = useRouter();
  const { state } = useDocumentStore();
  const dispatch = useDocumentDispatch();
  const { saveState, triggerSave, clearError } = useSaveStatus();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showThinking, setShowThinking] = useState(false);
  const [lastSavedField, setLastSavedField] = useState<string | null>(null);

  // ── Derived state from store ──────────────────────────────────────────────

  const document = useMemo<DocumentProject | null>(
    () =>
      documentId
        ? (state.documents.find((d) => d.id === documentId) ?? null)
        : null,
    [documentId, state.documents],
  );

  const rawProgress = useMemo(
    () =>
      documentId
        ? state.interviewProgressByDocumentId[documentId]
        : undefined,
    [documentId, state.interviewProgressByDocumentId],
  );

  const answers = useMemo<Record<string, CapturedAnswer>>(
    () => (documentId ? (state.answersByDocumentId[documentId] ?? {}) : {}),
    [documentId, state.answersByDocumentId],
  );

  const attachment = useMemo<MockAttachment | null>(
    () =>
      documentId ? (state.attachmentByDocumentId[documentId] ?? null) : null,
    [documentId, state.attachmentByDocumentId],
  );

  // ── Initialise progress on first entry ────────────────────────────────────

  useEffect(() => {
    if (!documentId || rawProgress || !BASE_INTERVIEW_SCRIPT[0]) return;
    dispatch({
      type: "SET_INTERVIEW_PROGRESS",
      documentId,
      progress: createInitialInterviewProgress(BASE_INTERVIEW_SCRIPT[0].id),
    });
  }, [documentId, rawProgress, dispatch]);

  // ── Resolved progress ─────────────────────────────────────────────────────

  const progress = useMemo<InterviewProgress>(
    () =>
      rawProgress ??
      createInitialInterviewProgress(BASE_INTERVIEW_SCRIPT[0]?.id ?? "q1"),
    [rawProgress],
  );

  // ── Visible script ────────────────────────────────────────────────────────

  const visibleScript = useMemo<QuestionStep[]>(
    () => buildVisibleScript(mockInterviewScript, progress.followUpInsertedIds),
    [progress.followUpInsertedIds],
  );

  const currentIndex = useMemo(
    () => visibleScript.findIndex((q) => q.id === progress.currentQuestionId),
    [visibleScript, progress.currentQuestionId],
  );

  const currentQuestion = useMemo<QuestionStep | null>(
    () => visibleScript[currentIndex] ?? null,
    [visibleScript, currentIndex],
  );

  // ── Computed values ───────────────────────────────────────────────────────

  const progressPercent = useMemo(
    () =>
      calculateInterviewProgressPercent(
        progress.completedQuestionIds.length,
        visibleScript.length,
      ),
    [progress.completedQuestionIds.length, visibleScript.length],
  );

  const sectionStates = useMemo(
    () =>
      computeSectionStates(
        visibleScript,
        progress.completedQuestionIds,
        progress.currentQuestionId,
        answers,
      ),
    [visibleScript, progress.completedQuestionIds, progress.currentQuestionId, answers],
  );

  const groupedCapturedAnswers = useMemo<GroupedCapturedAnswers[]>(
    () => groupCapturedAnswersBySection(answers),
    [answers],
  );

  const isOnLastQuestion =
    visibleScript.length > 0 && currentIndex === visibleScript.length - 1;
  const canGoBack = currentIndex > 0;
  const isComplete = document?.interviewCompleted ?? false;
  const isFirstEntry = progress.completedQuestionIds.length === 0 && currentIndex === 0;

  const error = useMemo<string | null>(() => {
    if (!documentId) return "missing-document";
    if (!document) return "unknown-document";
    return null;
  }, [documentId, document]);

  // ── Persist helpers ───────────────────────────────────────────────────────

  const persistAnswer = useCallback(
    (answer: CapturedAnswer): void => {
      if (!documentId) return;
      dispatch({ type: "SAVE_ANSWER", documentId, answer });
    },
    [documentId, dispatch],
  );

  const persistProgress = useCallback(
    (newProgress: InterviewProgress): void => {
      if (!documentId) return;
      dispatch({ type: "SET_INTERVIEW_PROGRESS", documentId, progress: newProgress });
    },
    [documentId, dispatch],
  );

  const syncDocumentProgress = useCallback(
    (percent: number): void => {
      if (!documentId) return;
      dispatch({
        type: "UPDATE_DOCUMENT",
        documentId,
        updates: { progressPercent: percent, status: "in-progress" },
      });
    },
    [documentId, dispatch],
  );

  // ── Advance logic ─────────────────────────────────────────────────────────

  const advanceAfterSave = useCallback(
    (
      currentQ: QuestionStep,
      capturedAnswer: CapturedAnswer,
      newFollowUpInsertedIds: string[],
    ): void => {
      const newScript = buildVisibleScript(mockInterviewScript, newFollowUpInsertedIds);
      const idx = newScript.findIndex((q) => q.id === currentQ.id);
      const nextQuestion = newScript[idx + 1];

      const newCompletedIds = progress.completedQuestionIds.includes(currentQ.id)
        ? progress.completedQuestionIds
        : [...progress.completedQuestionIds, currentQ.id];

      const nextQuestionId = nextQuestion?.id ?? currentQ.id;

      const mergedAnswers: Record<string, CapturedAnswer> = {
        ...answers,
        [currentQ.answerField]: capturedAnswer,
      };

      const newSectionStates = computeSectionStates(
        newScript,
        newCompletedIds,
        nextQuestionId,
        mergedAnswers,
      );

      persistProgress({
        currentQuestionId: nextQuestionId,
        completedQuestionIds: newCompletedIds,
        sectionStates: newSectionStates,
        followUpInsertedIds: newFollowUpInsertedIds,
      });

      syncDocumentProgress(
        calculateInterviewProgressPercent(newCompletedIds.length, newScript.length),
      );
    },
    [progress, answers, persistProgress, syncDocumentProgress],
  );

  // ── Actions ───────────────────────────────────────────────────────────────

  const saveAnswer = useCallback(
    (value: string): void => {
      if (!documentId || !currentQuestion) return;
      setValidationError(null);

      if (currentQuestion.required && !value.trim()) {
        setValidationError(
          "This field is required. Please enter an answer before continuing.",
        );
        return;
      }

      // Detect follow-up trigger before saving so thinking state can start immediately.
      const willTriggerFollowUp =
        !!currentQuestion.followUp &&
        matchesFollowUpTrigger(value, currentQuestion.followUp.triggerMatch) &&
        !progress.followUpInsertedIds.includes(currentQuestion.followUp.questionId) &&
        !!FOLLOW_UP_STEPS[currentQuestion.followUp.questionId];

      if (willTriggerFollowUp) {
        setShowThinking(true);
      }

      triggerSave(() => {
        const capturedAnswer: CapturedAnswer = {
          field: currentQuestion.answerField,
          label: currentQuestion.label,
          value: value.trim(),
          sectionId: currentQuestion.sectionId,
          isTbc: value.trim() === TBC_VALUE,
          updatedAt: new Date().toISOString(),
        };

        persistAnswer(capturedAnswer);
        setLastSavedField(currentQuestion.answerField);

        const newFollowUpInsertedIds = willTriggerFollowUp
          ? [...progress.followUpInsertedIds, currentQuestion.followUp!.questionId]
          : progress.followUpInsertedIds;

        if (willTriggerFollowUp) {
          setTimeout(() => {
            setShowThinking(false);
            advanceAfterSave(currentQuestion, capturedAnswer, newFollowUpInsertedIds);
          }, THINKING_EXTRA_MS);
        } else {
          advanceAfterSave(currentQuestion, capturedAnswer, newFollowUpInsertedIds);
        }
      });
    },
    [
      documentId,
      currentQuestion,
      progress.followUpInsertedIds,
      triggerSave,
      persistAnswer,
      advanceAfterSave,
    ],
  );

  const markTbc = useCallback((): void => {
    if (!documentId || !currentQuestion || !currentQuestion.allowTbc) return;
    setValidationError(null);

    triggerSave(() => {
      const capturedAnswer: CapturedAnswer = {
        field: currentQuestion.answerField,
        label: currentQuestion.label,
        value: TBC_VALUE,
        sectionId: currentQuestion.sectionId,
        isTbc: true,
        updatedAt: new Date().toISOString(),
      };

      persistAnswer(capturedAnswer);
      setLastSavedField(currentQuestion.answerField);
      advanceAfterSave(currentQuestion, capturedAnswer, progress.followUpInsertedIds);
    });
  }, [
    documentId,
    currentQuestion,
    progress.followUpInsertedIds,
    triggerSave,
    persistAnswer,
    advanceAfterSave,
  ]);

  const goBack = useCallback((): void => {
    if (!documentId || !canGoBack) return;
    setValidationError(null);

    const prevQuestion = visibleScript[currentIndex - 1];
    if (!prevQuestion) return;

    const newSectionStates = computeSectionStates(
      visibleScript,
      progress.completedQuestionIds,
      prevQuestion.id,
      answers,
    );

    persistProgress({
      ...progress,
      currentQuestionId: prevQuestion.id,
      sectionStates: newSectionStates,
    });
  }, [
    documentId,
    canGoBack,
    visibleScript,
    currentIndex,
    progress,
    answers,
    persistProgress,
  ]);

  const setAttachment = useCallback(
    (name: string): void => {
      if (!documentId) return;
      dispatch({ type: "SET_ATTACHMENT", documentId, attachment: { name } });
    },
    [documentId, dispatch],
  );

  const removeAttachment = useCallback((): void => {
    if (!documentId) return;
    dispatch({ type: "REMOVE_ATTACHMENT", documentId });
  }, [documentId, dispatch]);

  const completeInterview = useCallback((): void => {
    if (!documentId) return;
    dispatch({ type: "COMPLETE_INTERVIEW", documentId });
    router.push(`/documents/${documentId}/review`);
  }, [documentId, dispatch, router]);

  const saveAndExit = useCallback((): void => {
    if (!documentId) return;
    dispatch({
      type: "UPDATE_DOCUMENT",
      documentId,
      updates: { progressPercent, status: "in-progress" },
    });
    router.push("/workspace");
  }, [documentId, dispatch, progressPercent, router]);

  // ── Result ────────────────────────────────────────────────────────────────

  return {
    document,
    error,
    visibleScript,
    currentQuestion,
    currentIndex,
    totalSteps: visibleScript.length,
    answers,
    groupedCapturedAnswers,
    lastSavedField,
    progressPercent,
    sections: interviewSections,
    sectionStates,
    attachment,
    saveState,
    validationError,
    isFirstEntry,
    showThinking,
    isComplete,
    canGoBack,
    isOnLastQuestion,
    saveAnswer,
    markTbc,
    goBack,
    setAttachment,
    removeAttachment,
    completeInterview,
    saveAndExit,
    clearSaveError: clearError,
  };
}
