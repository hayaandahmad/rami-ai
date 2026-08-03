import { Sparkles } from "lucide-react";
import { SaveStatus } from "./SaveStatus";
import type { SaveState } from "@/types/interview";

interface RamiIdentityProps {
  saveState: SaveState;
  onClearSaveError?: () => void;
}

export function RamiIdentity({ saveState, onClearSaveError }: RamiIdentityProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-[var(--color-primary-100)]">
          <Sparkles
            aria-hidden="true"
            className="h-4.5 w-4.5 text-[var(--color-primary-700)]"
            strokeWidth={1.75}
          />
        </div>
        <div>
          <p className="text-small font-semibold leading-tight text-text-primary">Rami</p>
          <p className="text-caption leading-tight text-text-muted">AI Document Assistant</p>
        </div>
        <span className="status-pulse-indicator ml-1" aria-hidden="true">
          <span className="status-pulse-indicator__dot" />
        </span>
      </div>

      <SaveStatus saveState={saveState} onRetry={onClearSaveError} />
    </div>
  );
}
