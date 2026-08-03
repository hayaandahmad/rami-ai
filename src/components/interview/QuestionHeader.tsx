import { getInterviewSectionLabel } from "@/data/interviewSections";

interface QuestionHeaderProps {
  sectionId: string;
  prompt: string;
  questionId: string;
}

export function QuestionHeader({ sectionId, prompt, questionId }: QuestionHeaderProps) {
  const headingId = `question-heading-${questionId}`;

  return (
    <div className="space-y-1.5">
      <p className="text-caption font-semibold uppercase tracking-wider text-[var(--color-primary-700)]">
        {getInterviewSectionLabel(sectionId)}
      </p>
      <h2
        id={headingId}
        className="text-[1.625rem] font-semibold leading-[1.35] text-text-primary"
      >
        {prompt}
      </h2>
    </div>
  );
}
