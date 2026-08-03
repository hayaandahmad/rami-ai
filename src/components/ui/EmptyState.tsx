import type { ReactNode } from "react";
import { FolderOpen } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
}

export function EmptyState({
  title,
  description,
  primaryAction,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-border bg-surface px-6 py-12 text-center shadow-card">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-text-secondary">
        <FolderOpen aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <h3 className="text-section-title text-text-primary">{title}</h3>
      <p className="mt-2 max-w-md text-body text-text-secondary">{description}</p>
      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {secondaryAction}
          {primaryAction}
        </div>
      )}
    </div>
  );
}
