import { LogOut } from "lucide-react";
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
}

export function InterviewPageHeader({
  document,
  progressPercent,
  saveState,
  onSaveAndExit,
  onClearSaveError,
}: InterviewPageHeaderProps) {
  const docTypeLabel = document.documentType
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const hasBeneficiary =
    !!document.beneficiary && document.beneficiary.trim().length > 0;

  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      {/* Left — interview label and document context */}
      <div className="min-w-0">
        <h1 className="text-section-title font-semibold text-text-primary">
          Guided Document Interview
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-small text-text-muted">
          <span className="font-medium text-text-secondary">{document.title}</span>
          <span aria-hidden="true" className="text-text-muted">·</span>
          <span>{docTypeLabel}</span>
          {hasBeneficiary ? (
            <>
              <span aria-hidden="true" className="text-text-muted">·</span>
              <span>{document.beneficiary}</span>
            </>
          ) : null}
        </p>
      </div>

      {/* Right — progress indicator + controls */}
      <div className="flex shrink-0 flex-col items-end gap-2.5">
        <div className="flex items-center gap-3">
          <SaveStatus saveState={saveState} onRetry={onClearSaveError} />
          <Button
            variant="secondary"
            size="sm"
            onClick={onSaveAndExit}
            title="Save progress and return to workspace"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
            Save and Exit
          </Button>
        </div>

        {/* Single overall progress bar — only place it appears on the page */}
        <div className="flex w-52 items-center gap-2.5">
          <div
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progressPercent}% of interview complete`}
            aria-valuetext={`${progressPercent} percent complete`}
            className="h-1.5 flex-1 overflow-hidden rounded-pill bg-[var(--color-neutral-200)]"
          >
            <div
              className="h-full rounded-pill bg-action-primary transition-panel"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="shrink-0 text-caption tabular-nums text-text-muted">
            {progressPercent}%
          </span>
        </div>
      </div>
    </header>
  );
}
