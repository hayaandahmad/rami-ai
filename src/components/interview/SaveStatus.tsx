import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { SaveState } from "@/types/interview";

interface SaveStatusProps {
  saveState: SaveState;
  onRetry?: () => void;
}

export function SaveStatus({ saveState, onRetry }: SaveStatusProps) {
  if (saveState === "idle") return null;

  if (saveState === "saving") {
    return (
      <span
        aria-live="polite"
        aria-atomic="true"
        className="flex items-center gap-1.5 text-small text-text-muted"
      >
        <Loader2
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin"
          strokeWidth={2}
        />
        Saving...
      </span>
    );
  }

  if (saveState === "saved") {
    return (
      <span
        aria-live="polite"
        aria-atomic="true"
        className="flex items-center gap-1.5 text-small text-[var(--color-success-700)]"
      >
        <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
        All changes saved
      </span>
    );
  }

  if (saveState === "error") {
    return (
      <span
        aria-live="assertive"
        aria-atomic="true"
        className="flex items-center gap-1.5 text-small text-[var(--color-error-700)]"
      >
        <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
        Save failed.{" "}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="underline underline-offset-2 hover:opacity-80"
          >
            Try again
          </button>
        ) : null}
      </span>
    );
  }

  return null;
}
