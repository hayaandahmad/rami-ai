import type {
  CapturedAnswer,
  InterviewProgress,
  QuestionStep,
  SectionState,
} from "@/types/interview";
import { interviewSections } from "@/data/interviewSections";

export function createInitialInterviewProgress(
  firstQuestionId: string,
): InterviewProgress {
  const sectionStates = Object.fromEntries(
    interviewSections.map((section, index) => [
      section.id,
      (index === 0 ? "current" : "not-started") satisfies SectionState,
    ]),
  ) as Record<string, SectionState>;

  return {
    currentQuestionId: firstQuestionId,
    completedQuestionIds: [],
    sectionStates,
    followUpInsertedIds: [],
  };
}

export function calculateInterviewProgressPercent(
  completedCount: number,
  totalCount: number,
): number {
  if (totalCount <= 0) {
    return 0;
  }

  return Math.round((completedCount / totalCount) * 100);
}

export function getSectionIdForQuestion(question: QuestionStep): string {
  return question.sectionId;
}

/**
 * Builds the ordered visible script for the current interview state.
 *
 * The base script is all non-follow-up steps in their defined order.
 * A follow-up step is inserted immediately after its parent step when
 * its id appears in followUpInsertedIds — and never more than once.
 */
export function buildVisibleScript(
  allSteps: QuestionStep[],
  followUpInsertedIds: string[],
): QuestionStep[] {
  const base = allSteps.filter((step) => !step.isFollowUpQuestion);
  const result: QuestionStep[] = [];

  for (const step of base) {
    result.push(step);

    if (
      step.followUp &&
      followUpInsertedIds.includes(step.followUp.questionId)
    ) {
      const followUpStep = allSteps.find(
        (s) => s.id === step.followUp!.questionId,
      );
      if (followUpStep) {
        result.push(followUpStep);
      }
    }
  }

  return result;
}

/**
 * Computes the current state for every interview section.
 *
 * Rules:
 * - Sections absent from the visible script → "not-started"
 * - Section containing the current question → "current"
 * - Section where all visible questions are completed:
 *   - any TBC answer → "needs-clarification"
 *   - otherwise → "completed"
 * - All other sections → "not-started"
 */
export function computeSectionStates(
  visibleScript: QuestionStep[],
  completedQuestionIds: string[],
  currentQuestionId: string,
  answers: Record<string, CapturedAnswer>,
): Record<string, SectionState> {
  const states: Record<string, SectionState> = {};

  for (const section of interviewSections) {
    const sectionQuestions = visibleScript.filter(
      (q) => q.sectionId === section.id,
    );

    if (sectionQuestions.length === 0) {
      states[section.id] = "not-started";
      continue;
    }

    const hasCurrent = sectionQuestions.some(
      (q) => q.id === currentQuestionId,
    );

    if (hasCurrent) {
      states[section.id] = "current";
      continue;
    }

    const allCompleted = sectionQuestions.every((q) =>
      completedQuestionIds.includes(q.id),
    );

    if (allCompleted) {
      const hasTbc = sectionQuestions.some(
        (q) => answers[q.answerField]?.isTbc === true,
      );
      states[section.id] = hasTbc ? "needs-clarification" : "completed";
    } else {
      states[section.id] = "not-started";
    }
  }

  return states;
}
