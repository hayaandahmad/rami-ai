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
import { persistInterview } from "@/lib/persistInterview";
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
import type {
  AnswerPersistencePayload,
  SessionPersistencePayload,
} from "@/types/persistence";

// After a successful save, show thinking for this duration before a
// triggered follow-up question appears.
const THINKING_EXTRA_MS = 300;

// The answerField that represents the document's own title. When this
// question is answered, DocumentProject.title must be kept in sync with
// the captured value — it is not just another interview field.
const DOCUMENT_TITLE_ANSWER_FIELD = "documentTitle";

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

// ─── Internal: pure progress projection ──────────────────────────────────────

interface AdvanceComputation {
  nextQuestionId: string;
  newCompletedIds: string[];
  newSectionStates: Record<string, SectionState>;
  newFollowUpInsertedIds: string[];
  newProgressPercent: number;
}

interface FollowUpTransition {
  /** True when this answer newly satisfies a configured follow-up trigger. */
  willTriggerFollowUp: boolean;
  followUpInsertedIds: string[];
  /**
   * question_ids whose previously captured answer is no longer part of
   * Rami's current structured interview (their triggering parent answer
   * changed and no longer satisfies the follow-up condition).
   */
  staleAnswerQuestionIds: string[];
}

/**
 * Pure function: given the question being answered, its new value, and
 * the currently-inserted follow-up ids, determines whether a follow-up
 * should newly appear, and whether a previously-inserted follow-up has
 * become stale (parent answer changed and no longer triggers it).
 *
 * Used identically for normal answers, TBC, and edits — there is only
 * one follow-up transition algorithm.
 */
function resolveFollowUpTransition(
  currentQ: QuestionStep,
  newValue: string,
  followUpInsertedIds: string[],
): FollowUpTransition {
  const followUpConfig = currentQ.followUp;

  if (!followUpConfig || !FOLLOW_UP_STEPS[followUpConfig.questionId]) {
    return {
      willTriggerFollowUp: false,
      followUpInsertedIds,
      staleAnswerQuestionIds: [],
    };
  }

  const alreadyInserted = followUpInsertedIds.includes(followUpConfig.questionId);
  const matchesTrigger = matchesFollowUpTrigger(newValue, followUpConfig.triggerMatch);

  if (!alreadyInserted && matchesTrigger) {
    return {
      willTriggerFollowUp: true,
      followUpInsertedIds: [...followUpInsertedIds, followUpConfig.questionId],
      staleAnswerQuestionIds: [],
    };
  }

  if (alreadyInserted && !matchesTrigger) {
    // The parent answer changed and no longer satisfies the follow-up
    // trigger: the follow-up question (and any answer already captured
    // for it) is no longer part of Rami's current structured interview.
    return {
      willTriggerFollowUp: false,
      followUpInsertedIds: followUpInsertedIds.filter(
        (id) => id !== followUpConfig.questionId,
      ),
      staleAnswerQuestionIds: [followUpConfig.questionId],
    };
  }

  return {
    willTriggerFollowUp: false,
    followUpInsertedIds,
    staleAnswerQuestionIds: [],
  };
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

  // ── Persist helpers (local store) ─────────────────────────────────────────

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

  // ── Progress projection ────────────────────────────────────────────────────
  //
  // Single source of truth for "what will progress look like after this
  // answer is saved". Used both to build the session payload sent to
  // Google Sheets (before remote persistence) and to actually advance the
  // local store (after remote persistence succeeds) — so the Sheet and
  // Rami's local progress can never disagree about the algorithm used.

  const computeAdvance = useCallback(
    (
      currentQ: QuestionStep,
      capturedAnswer: CapturedAnswer,
      newFollowUpInsertedIds: string[],
      staleAnswerQuestionIds: string[] = [],
    ): AdvanceComputation => {
      const newScript = buildVisibleScript(mockInterviewScript, newFollowUpInsertedIds);
      const idx = newScript.findIndex((q) => q.id === currentQ.id);
      const nextQuestion = newScript[idx + 1];

      // Drop stale follow-up ids from the completed set first, so a
      // question that no longer exists in the visible script never keeps
      // inflating the numerator of the progress calculation below.
      const completedIdsWithoutStale = progress.completedQuestionIds.filter(
        (id) => !staleAnswerQuestionIds.includes(id),
      );

      const newCompletedIds = completedIdsWithoutStale.includes(currentQ.id)
        ? completedIdsWithoutStale
        : [...completedIdsWithoutStale, currentQ.id];

      const nextQuestionId = nextQuestion?.id ?? currentQ.id;

      const mergedAnswers: Record<string, CapturedAnswer> = { ...answers };
      for (const staleId of staleAnswerQuestionIds) {
        const staleStep = mockInterviewScript.find((q) => q.id === staleId);
        if (staleStep) delete mergedAnswers[staleStep.answerField];
      }
      mergedAnswers[currentQ.answerField] = capturedAnswer;

      const newSectionStates = computeSectionStates(
        newScript,
        newCompletedIds,
        nextQuestionId,
        mergedAnswers,
      );

      return {
        nextQuestionId,
        newCompletedIds,
        newSectionStates,
        newFollowUpInsertedIds,
        newProgressPercent: calculateInterviewProgressPercent(
          newCompletedIds.length,
          newScript.length,
        ),
      };
    },
    [progress.completedQuestionIds, answers],
  );

  const applyAdvance = useCallback(
    (computation: AdvanceComputation, staleAnswerQuestionIds: string[] = []): void => {
      if (documentId) {
        for (const staleId of staleAnswerQuestionIds) {
          const staleStep = mockInterviewScript.find((q) => q.id === staleId);
          if (staleStep) {
            dispatch({ type: "REMOVE_ANSWER", documentId, field: staleStep.answerField });
          }
        }
      }

      persistProgress({
        currentQuestionId: computation.nextQuestionId,
        completedQuestionIds: computation.newCompletedIds,
        sectionStates: computation.newSectionStates,
        followUpInsertedIds: computation.newFollowUpInsertedIds,
      });

      syncDocumentProgress(computation.newProgressPercent);
    },
    [documentId, dispatch, persistProgress, syncDocumentProgress],
  );

  // ── Actions ───────────────────────────────────────────────────────────────

  // Shared submit path for normal answers, TBC, and edits of either kind.
  // There is exactly one persistence mechanism: local save first, then an
  // awaited remote save, then advance only on success. `isTbc` is passed
  // in explicitly (from the actual structured answer state) rather than
  // re-derived later by parsing the stored value.
  const submitAnswer = useCallback(
    (currentQ: QuestionStep, rawValue: string, isTbc: boolean): void => {
      if (!documentId || !document) return;

      const capturedAnswer: CapturedAnswer = {
        field: currentQ.answerField,
        label: currentQ.label,
        value: rawValue,
        sectionId: currentQ.sectionId,
        isTbc,
        updatedAt: new Date().toISOString(),
      };

      // Save locally first — the BA's answer is preserved in the store
      // immediately, even if the remote persistence request below fails.
      persistAnswer(capturedAnswer);
      setLastSavedField(currentQ.answerField);

      // The document title is both an interview answer AND a top-level
      // DocumentProject field (used elsewhere in the UI, e.g. workspace
      // cards). Keep them in sync the moment this question is answered.
      const isDocumentTitleAnswer = currentQ.answerField === DOCUMENT_TITLE_ANSWER_FIELD;

      if (isDocumentTitleAnswer) {
        dispatch({
          type: "UPDATE_DOCUMENT",
          documentId,
          updates: { title: capturedAnswer.value },
        });
      }

      // React state from the dispatch above will not be visible in
      // `document.title` until the next render, so project the new title
      // explicitly rather than relying on stale closure state — this
      // value, not `document.title`, is what the session payload must use.
      const projectedDocumentTitle = isDocumentTitleAnswer
        ? capturedAnswer.value
        : document.title;

      const { willTriggerFollowUp, followUpInsertedIds: newFollowUpInsertedIds, staleAnswerQuestionIds } =
        resolveFollowUpTransition(currentQ, rawValue, progress.followUpInsertedIds);

      // Project post-save progress now so the Sheet session row reflects
      // where Rami will be after this save succeeds, not stale prior state.
      const advanceComputation = computeAdvance(
        currentQ,
        capturedAnswer,
        newFollowUpInsertedIds,
        staleAnswerQuestionIds,
      );

      const answerPayload: AnswerPersistencePayload = {
        documentId,
        documentType: document.documentType,
        questionId: currentQ.id,
        answerField: currentQ.answerField,
        sectionId: currentQ.sectionId,
        questionText: currentQ.prompt,
        value: capturedAnswer.value,
        isTbc: capturedAnswer.isTbc,
        isFollowUp: currentQ.isFollowUpQuestion ?? false,
        updatedAt: capturedAnswer.updatedAt,
      };

      const sessionPayload: SessionPersistencePayload = {
        documentId,
        documentTitle: projectedDocumentTitle,
        documentType: document.documentType,
        beneficiary: document.beneficiary,
        status: "in-progress",
        progressPercent: advanceComputation.newProgressPercent,
        interviewCompleted: document.interviewCompleted,
        updatedAt: capturedAnswer.updatedAt,
      };

      if (willTriggerFollowUp) {
        setShowThinking(true);
      }

      void triggerSave(async () => {
        const result = await persistInterview({
          answer: answerPayload,
          session: sessionPayload,
          ...(staleAnswerQuestionIds.length > 0 ? { staleAnswerQuestionIds } : {}),
        });

        if (!result.ok) {
          throw new Error(result.error);
        }
      }).then(async (succeeded) => {
        if (!succeeded) {
          // Remote save failed: keep the locally saved answer, stay on
          // this question, and let the existing error UI offer a retry.
          // Retrying is safe — Sheets UPSERT by document_id + question_id
          // means the same request never creates a duplicate row.
          setShowThinking(false);
          return;
        }

        if (willTriggerFollowUp) {
          await new Promise((resolve) => setTimeout(resolve, THINKING_EXTRA_MS));
          setShowThinking(false);
        }

        applyAdvance(advanceComputation, staleAnswerQuestionIds);
      });
    },
    [
      documentId,
      document,
      progress.followUpInsertedIds,
      dispatch,
      persistAnswer,
      computeAdvance,
      triggerSave,
      applyAdvance,
    ],
  );

  const saveAnswer = useCallback(
    (value: string): void => {
      if (!documentId || !currentQuestion || !document) return;
      if (saveState === "saving") return; // ignore double-submit while a save is in flight
      setValidationError(null);

      const trimmed = value.trim();

      if (currentQuestion.required && !trimmed) {
        setValidationError(
          "This field is required. Please enter an answer before continuing.",
        );
        return;
      }

      submitAnswer(currentQuestion, trimmed, trimmed === TBC_VALUE);
    },
    [documentId, currentQuestion, document, saveState, submitAnswer],
  );

  const markTbc = useCallback((): void => {
    if (!documentId || !currentQuestion || !currentQuestion.allowTbc || !document) return;
    if (saveState === "saving") return; // ignore double-submit while a save is in flight
    setValidationError(null);

    submitAnswer(currentQuestion, TBC_VALUE, true);
  }, [documentId, currentQuestion, document, saveState, submitAnswer]);

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
