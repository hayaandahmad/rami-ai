import type { CapturedAnswer, GroupedCapturedAnswers } from "@/types/interview";
import { interviewSections } from "@/data/interviewSections";

/**
 * Groups captured answers by interview section, preserving the canonical
 * section order defined in interviewSections.
 * Sections with no saved answers are omitted from the result.
 */
export function groupCapturedAnswersBySection(
  answers: Record<string, CapturedAnswer>,
): GroupedCapturedAnswers[] {
  const answerList = Object.values(answers);

  return interviewSections.flatMap((section) => {
    const sectionAnswers = answerList.filter(
      (answer) => answer.sectionId === section.id,
    );

    if (sectionAnswers.length === 0) return [];

    return [
      {
        sectionId: section.id,
        sectionLabel: section.label,
        answers: sectionAnswers,
      },
    ];
  });
}
