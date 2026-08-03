import { FileText } from "lucide-react";

export function CapturedInputsEmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-primary-100)] bg-[var(--color-primary-50)]">
        <FileText
          aria-hidden="true"
          className="h-5 w-5 text-[var(--color-primary-600)]"
          strokeWidth={1.5}
        />
      </div>
      <div className="space-y-1">
        <p className="text-small font-medium text-text-secondary">
          Building your document
        </p>
        <p className="text-caption leading-relaxed text-text-muted">
          Your confirmed answers will appear here as Rami structures the document.
        </p>
      </div>

      {/* Subtle structured placeholder showing document shape */}
      <div className="mt-1 w-full space-y-2 rounded-control border border-dashed border-border px-4 py-3" aria-hidden="true">
        <div className="h-2 w-3/4 rounded-full bg-surface-subtle" />
        <div className="h-2 w-1/2 rounded-full bg-surface-subtle" />
        <div className="mt-3 h-2 w-full rounded-full bg-surface-subtle" />
        <div className="h-2 w-2/3 rounded-full bg-surface-subtle" />
      </div>
    </div>
  );
}
