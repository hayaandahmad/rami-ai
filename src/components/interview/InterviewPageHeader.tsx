import { LogOut, Sparkles } from "lucide-react";
import type { DocumentProject } from "@/types/document";
import type { SaveState } from "@/types/interview";
import { Button } from "@/components/ui";
import { SaveStatus } from "./SaveStatus";

interface InterviewPageHeaderProps {
  document: DocumentProject;
  progressPercent: number;
  saveState: SaveState;
  onSaveAndExit: () => void;
  onClearSaveError: () => void;
  currentSectionLabel?: string;
  questionNumber?: number;
  totalQuestions?: number;
  isFirstEntry?: boolean;
  isLastQuestion?: boolean;
}

function getGuidanceMessage(
  progressPercent: number,
  isFirstEntry?: boolean,
  isLastQuestion?: boolean,
): string {
  if (isFirstEntry) {
    return "Rami will guide you section by section. Answer each question at your own pace — your responses shape the professional draft.";
  }
  if (isLastQuestion) {
    return "Final steps ahead. Confirm your responses, then continue to review the structured document.";
  }
  if (progressPercent >= 75) {
    return "You're in the final stretch. Rami is organizing your captured inputs into the document structure.";
  }
  if (progressPercent >= 40) {
    return "Good progress. Continue providing detail — each answer refines the professional draft.";
  }
  return "Answer thoughtfully. Rami captures and structures your responses as you move through each section.";
}

export function InterviewPageHeader({
  document,
  progressPercent,
  saveState,
  onSaveAndExit,
  onClearSaveError,
  currentSectionLabel,
  questionNumber,
  totalQuestions,
  isFirstEntry,
  isLastQuestion,
}: InterviewPageHeaderProps) {
  const docTypeLabel = document.documentType
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const guidanceMessage = getGuidanceMessage(
    progressPercent,
    isFirstEntry,
    isLastQuestion,
  );

  return (
    <header className="interview-hero mb-8">
      <div className="interview-hero-accent" aria-hidden="true" />

      <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10 lg:p-8">
        {/* Left — context and AI guidance */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles
                aria-hidden="true"
                className="h-4 w-4 text-[var(--color-primary-700)]"
                strokeWidth={1.75}
              />
              <p className="text-caption font-semibold uppercase tracking-wider text-[var(--color-primary-700)]">
                Guided Document Interview
              </p>
            </div>
            <h1 className="text-page-title font-semibold tracking-tight text-text-primary">
              {document.title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-pill border border-border bg-surface px-3 py-1 text-caption font-medium text-text-secondary">
              {docTypeLabel}
            </span>
            {currentSectionLabel ? (
              <span className="inline-flex items-center rounded-pill border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-3 py-1 text-caption font-medium text-[var(--color-primary-800)]">
                {currentSectionLabel}
              </span>
            ) : null}
          </div>

          <p className="max-w-2xl text-small leading-relaxed text-text-secondary">
            {guidanceMessage}
          </p>
        </div>

        {/* Right — save controls and progress */}
        <div className="flex w-full shrink-0 flex-col gap-4 lg:w-72">
          <div className="flex items-center justify-between gap-3">
            <SaveStatus saveState={saveState} onRetry={onClearSaveError} />
            <Button
              variant="secondary"
              size="sm"
              onClick={onSaveAndExit}
              title="Save progress and return to workspace"
              className="btn-press shrink-0"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
              Save and Exit
            </Button>
          </div>

          <div className="rounded-card border border-border bg-surface/80 p-4 backdrop-blur-sm">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <span className="text-caption font-medium text-text-muted">
                Interview progress
              </span>
              <span className="text-card-title font-semibold tabular-nums text-text-primary">
                {progressPercent}%
              </span>
            </div>

            <div
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${progressPercent}% of interview complete`}
              aria-valuetext={`${progressPercent} percent complete`}
              className="h-2 overflow-hidden rounded-pill bg-[var(--color-neutral-200)]"
            >
              <div
                className="h-full rounded-pill bg-gradient-to-r from-[var(--color-primary-700)] to-[var(--color-primary-600)] transition-panel"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {questionNumber !== undefined && totalQuestions !== undefined ? (
              <p className="mt-2.5 text-caption text-text-muted">
                Question {questionNumber} of {totalQuestions}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
