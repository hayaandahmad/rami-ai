import { Layers } from "lucide-react";
import type { GroupedCapturedAnswers } from "@/types/interview";
import { CapturedInputGroup } from "./CapturedInputGroup";
import { CapturedInputsEmptyState } from "./CapturedInputsEmptyState";

interface CapturedInputsPanelProps {
  groups: GroupedCapturedAnswers[];
  lastSavedField?: string | null;
}

export function CapturedInputsPanel({
  groups,
  lastSavedField,
}: CapturedInputsPanelProps) {
  const answerCount = groups.reduce((sum, group) => sum + group.answers.length, 0);

  return (
    <aside
      aria-label="Captured information"
      aria-live="polite"
      aria-atomic="false"
      className="interview-panel bg-surface-subtle"
    >
      <div className="interview-panel-header bg-surface/60">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-control bg-[var(--color-primary-100)]">
              <Layers
                aria-hidden="true"
                className="h-3.5 w-3.5 text-[var(--color-primary-700)]"
                strokeWidth={1.75}
              />
            </div>
            <div>
              <h2 className="text-small font-semibold text-text-primary">
                Captured Information
              </h2>
              <p className="mt-0.5 text-caption text-text-muted">
                Rami is building your document
              </p>
            </div>
          </div>
          {answerCount > 0 ? (
            <span className="shrink-0 rounded-pill bg-[var(--color-primary-100)] px-2 py-0.5 text-caption font-semibold tabular-nums text-[var(--color-primary-800)]">
              {answerCount}
            </span>
          ) : null}
        </div>
      </div>

      <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-5 py-5">
        {groups.length === 0 ? (
          <CapturedInputsEmptyState />
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <CapturedInputGroup
                key={group.sectionId}
                group={group}
                lastSavedField={lastSavedField}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
