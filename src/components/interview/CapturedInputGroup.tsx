import type { GroupedCapturedAnswers } from "@/types/interview";
import { CapturedInputItem } from "./CapturedInputItem";

interface CapturedInputGroupProps {
  group: GroupedCapturedAnswers;
  lastSavedField?: string | null;
}

export function CapturedInputGroup({ group, lastSavedField }: CapturedInputGroupProps) {
  return (
    <div className="space-y-3">
      <p className="text-caption font-semibold uppercase tracking-wider text-[var(--color-primary-700)]">
        {group.sectionLabel}
      </p>
      <div className="space-y-3.5 rounded-control border border-[var(--color-primary-100)]/60 bg-surface/80 px-3.5 py-3">
        {group.answers.map((answer) => (
          <CapturedInputItem
            key={answer.field}
            answer={answer}
            lastSavedField={lastSavedField}
          />
        ))}
      </div>
    </div>
  );
}
