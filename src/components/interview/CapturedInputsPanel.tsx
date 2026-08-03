import type { GroupedCapturedAnswers } from "@/types/interview";
import { CapturedInputGroup } from "./CapturedInputGroup";
import { CapturedInputsEmptyState } from "./CapturedInputsEmptyState";

interface CapturedInputsPanelProps {
  groups: GroupedCapturedAnswers[];
  /** The most recently saved answer field — used to trigger highlight animation. */
  lastSavedField?: string | null;
}

export function CapturedInputsPanel({
  groups,
  lastSavedField,
}: CapturedInputsPanelProps) {
  return (
    <aside
      aria-label="Captured information"
      aria-live="polite"
      aria-atomic="false"
      className="flex flex-col rounded-panel border border-border bg-surface-subtle shadow-card"
    >
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-small font-semibold text-text-primary">
          Captured Information
        </h2>
        <p className="mt-0.5 text-caption text-text-muted">
          Rami is building your document as you answer
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {groups.length === 0 ? (
          <CapturedInputsEmptyState />
        ) : (
          <div className="space-y-5">
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
