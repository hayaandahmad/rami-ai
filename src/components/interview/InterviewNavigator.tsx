import { AlertTriangle, CheckCircle2, ChevronRight, Circle, Map } from "lucide-react";
import type { InterviewSection, SectionState } from "@/types/interview";

interface InterviewNavigatorProps {
  sections: InterviewSection[];
  sectionStates: Record<string, SectionState>;
  currentSectionId: string | null;
  currentIndex: number;
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
    <nav aria-label="Interview sections" className="interview-panel">
      {/* Header */}
      <div className="interview-panel-header">
        <div className="flex items-center gap-2">
          <Map
            aria-hidden="true"
            className="h-4 w-4 text-[var(--color-primary-700)]"
            strokeWidth={1.75}
          />
          <span className="text-caption font-semibold text-text-primary">
            Interview Sections
          </span>
        </div>
        <p className="mt-1.5 text-caption font-medium text-[var(--color-primary-700)]">
          {questionLabel}
        </p>
        {currentSection ? (
          <p className="mt-0.5 text-caption leading-snug text-text-muted">
            {currentSection.label}
          </p>
        ) : null}
      </div>

      {/* Section list */}
      <div className="max-h-[calc(100vh-18rem)] overflow-y-auto py-2">
        <ul role="list" className="space-y-0.5 px-2">
          {sections.map((section, index) => {
            const state = sectionStates[section.id] ?? "not-started";
            const isCurrent = section.id === currentSectionId;

            return (
              <li key={section.id}>
                <div
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`${index + 1}. ${section.label} — ${stateLabel(state)}`}
                  className={`relative flex items-start gap-2.5 rounded-control px-3 py-2.5 transition-hover ${
                    isCurrent
                      ? "bg-[var(--color-primary-50)] shadow-[inset_3px_0_0_var(--color-primary-600)]"
                      : state === "completed"
                        ? "hover:bg-surface-subtle"
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

      {/* Compact legend */}
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
