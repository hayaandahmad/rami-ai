import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

interface ErrorStateProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function ErrorState({ title, description, actions }: ErrorStateProps) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-panel border border-border bg-surface p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-warning-100)] bg-[var(--color-warning-100)]">
        <AlertTriangle
          aria-hidden="true"
          className="h-6 w-6 text-[var(--color-warning-700)]"
          strokeWidth={1.75}
        />
      </div>
      <div>
        <h2 className="text-card-title font-semibold text-text-primary">{title}</h2>
        {description ? (
          <p className="mt-1 text-small text-text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
}
