import { AlertTriangle, CheckCircle2, ChevronRight, Circle } from "lucide-react";
import type { InterviewSection, SectionState } from "@/types/interview";

interface InterviewNavigatorProps {
  sections: InterviewSection[];
  sectionStates: Record<string, SectionState>;
  currentSectionId: string | null;
  /** 0-based index of the current question. */
  currentIndex: number;
  /** Total number of questions currently visible in the script. */
  totalSteps: number;
}

function SectionStateIcon({ state }: { state: SectionState }) {
  if (state === "completed") {
    return (
      <CheckCircle2
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0 text-[var(--color-success-700)]"
        strokeWidth={2}
      />
    );
  }
  if (state === "needs-clarification") {
    return (
      <AlertTriangle
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0 text-[var(--color-warning-700)]"
        strokeWidth={2}
      />
    );
  }
  if (state === "current") {
    return (
      <ChevronRight
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0 text-[var(--color-primary-700)]"
        strokeWidth={2.5}
      />
    );
  }
  return (
    <Circle
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 text-[var(--color-neutral-300)]"
      strokeWidth={1.5}
    />
  );
}

function stateLabel(state: SectionState): string {
  if (state === "completed") return "complete";
  if (state === "needs-clarification") return "needs clarification";
  if (state === "current") return "current";
  return "not started";
}

export function InterviewNavigator({
  sections,
  sectionStates,
  currentSectionId,
  currentIndex,
  totalSteps,
}: InterviewNavigatorProps) {
  const questionLabel = `Question ${currentIndex + 1} of ${totalSteps}`;
  const currentSection = sections.find((s) => s.id === currentSectionId);

  return (
    <nav
      aria-label="Interview sections"
      className="flex flex-col rounded-panel border border-border bg-surface shadow-card"
    >
      {/* Progress summary */}
      <div className="border-b border-border px-4 py-3.5">
        <p className="text-caption font-semibold text-[var(--color-primary-700)]">
          {questionLabel}
        </p>
        {currentSection ? (
          <p className="mt-0.5 text-caption text-text-muted leading-snug">
            {currentSection.label}
          </p>
        ) : null}
      </div>

      {/* Section list */}
      <div className="flex-1 overflow-y-auto py-1.5">
        <ul role="list" className="space-y-px px-1.5">
          {sections.map((section, index) => {
            const state = sectionStates[section.id] ?? "not-started";
            const isCurrent = section.id === currentSectionId;

            return (
              <li key={section.id}>
                <div
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`${index + 1}. ${section.label} — ${stateLabel(state)}`}
                  className={`flex items-start gap-2 rounded-control px-3 py-2 ${
                    isCurrent
                      ? "bg-[var(--color-primary-50)]"
                      : "hover:bg-surface-subtle"
                  }`}
                >
                  <span className="mt-0.5">
                    <SectionStateIcon state={state} />
                  </span>
                  <span
                    className={`flex-1 text-caption leading-snug ${
                      isCurrent
                        ? "font-semibold text-[var(--color-primary-800)]"
                        : state === "completed"
                          ? "text-text-secondary"
                          : state === "needs-clarification"
                            ? "font-medium text-[var(--color-warning-800)]"
                            : "text-text-muted"
                    }`}
                  >
                    {section.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* State key — compact inline legend */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 aria-hidden="true" className="h-3 w-3 text-[var(--color-success-700)]" strokeWidth={2} />
            <span className="text-[11px] text-text-muted">Done</span>
          </span>
          <span className="flex items-center gap-1.5">
            <AlertTriangle aria-hidden="true" className="h-3 w-3 text-[var(--color-warning-700)]" strokeWidth={2} />
            <span className="text-[11px] text-text-muted">TBC</span>
          </span>
          <span className="flex items-center gap-1.5">
            <ChevronRight aria-hidden="true" className="h-3 w-3 text-[var(--color-primary-700)]" strokeWidth={2.5} />
            <span className="text-[11px] text-text-muted">Active</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Circle aria-hidden="true" className="h-3 w-3 text-[var(--color-neutral-300)]" strokeWidth={1.5} />
            <span className="text-[11px] text-text-muted">Pending</span>
          </span>
        </div>
      </div>
    </nav>
  );
}
