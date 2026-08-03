import { Info } from "lucide-react";

interface QuestionGuidanceProps {
  helperText: string;
}

export function QuestionGuidance({ helperText }: QuestionGuidanceProps) {
  return (
    <div className="flex gap-3 rounded-control border border-[var(--color-primary-100)] bg-[var(--color-primary-50)] px-4 py-3">
      <Info
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary-700)]"
        strokeWidth={1.75}
      />
      <p className="text-small leading-relaxed text-[var(--color-primary-800)]">
        {helperText}
      </p>
    </div>
  );
}
