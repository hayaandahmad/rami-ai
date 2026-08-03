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
      <div className="flex items-center gap-3.5">
        {/* Avatar with online indicator */}
        <div className="relative shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-control bg-gradient-to-br from-[var(--color-primary-100)] to-[var(--color-primary-50)] ring-1 ring-[var(--color-primary-200)]">
            <Sparkles
              aria-hidden="true"
              className="h-[1.125rem] w-[1.125rem] text-[var(--color-primary-700)]"
              strokeWidth={1.75}
            />
          </div>
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-surface"
            aria-hidden="true"
          >
            <span className="status-pulse-indicator h-full w-full">
              <span className="status-pulse-indicator__dot h-2 w-2" />
            </span>
          </span>
        </div>

        <div>
          <p className="text-small font-semibold leading-tight text-text-primary">Rami</p>
          <p className="mt-0.5 text-caption leading-tight text-text-muted">
            AI Document Assistant
            <span aria-hidden="true" className="mx-1.5 text-text-muted">·</span>
            <span className="font-medium text-[var(--color-success-700)]">Active</span>
          </p>
        </div>
      </div>

      <SaveStatus saveState={saveState} onRetry={onClearSaveError} />
    </div>
  );
}
