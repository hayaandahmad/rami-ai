import { getInterviewSectionLabel } from "@/data/interviewSections";

interface QuestionHeaderProps {
  sectionId: string;
  prompt: string;
  questionId: string;
}

export function QuestionHeader({ sectionId, prompt, questionId }: QuestionHeaderProps) {
  const headingId = `question-heading-${questionId}`;

  return (
    <div className="space-y-2.5">
      <p className="text-caption font-semibold uppercase tracking-widest text-[var(--color-primary-700)]">
        {getInterviewSectionLabel(sectionId)}
      </p>
      <h2
        id={headingId}
        className="max-w-3xl text-[1.625rem] font-semibold leading-[1.35] tracking-tight text-text-primary sm:text-[1.75rem]"
      >
        {prompt}
      </h2>
    </div>
  );
}
