import { FileText, Sparkles } from "lucide-react";

export function CapturedInputsEmptyState() {
  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <div className="relative">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-primary-100)] bg-[var(--color-primary-50)]">
          <FileText
            aria-hidden="true"
            className="h-5 w-5 text-[var(--color-primary-600)]"
            strokeWidth={1.5}
          />
        </div>
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary-700)] text-white shadow-sm">
          <Sparkles aria-hidden="true" className="h-2.5 w-2.5" strokeWidth={2} />
        </span>
      </div>

      <div className="space-y-1.5">
        <p className="text-small font-semibold text-text-secondary">
          Building your document
        </p>
        <p className="max-w-[220px] text-caption leading-relaxed text-text-muted">
          Your confirmed answers will appear here as Rami structures the document.
        </p>
      </div>

      <div
        className="w-full space-y-2.5 rounded-control border border-dashed border-[var(--color-primary-100)] bg-surface/80 px-4 py-4"
        aria-hidden="true"
      >
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary-300)]" />
          <div className="h-2 flex-1 rounded-full bg-[var(--color-neutral-200)]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary-200)]" />
          <div className="h-2 w-2/3 rounded-full bg-[var(--color-neutral-200)]" />
        </div>
        <div className="my-1 border-t border-dashed border-[var(--color-primary-100)]" />
        <div className="h-2 w-full rounded-full bg-[var(--color-neutral-200)]" />
        <div className="h-2 w-4/5 rounded-full bg-[var(--color-neutral-200)]" />
      </div>
    </div>
  );
}
