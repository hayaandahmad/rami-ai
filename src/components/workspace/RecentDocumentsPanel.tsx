import type { ReactNode } from "react";

interface RecentDocumentsPanelProps {
  children: ReactNode;
  searchField: ReactNode;
  filterBar: ReactNode;
}

export function RecentDocumentsPanel({
  children,
  searchField,
  filterBar,
}: RecentDocumentsPanelProps) {
  return (
    <section
      aria-labelledby="recent-documents-heading"
      className="overflow-hidden rounded-panel border border-border-strong bg-workspace-panel-surface shadow-card-elevated"
    >
      <div className="border-b border-border px-5 py-5 md:px-6 md:py-6">
        <h2 id="recent-documents-heading" className="text-section-title text-text-primary">
          Recent Documents
        </h2>
        <p className="mt-1 text-small text-text-secondary">
          Your active workspace — search, filter, and continue document work.
        </p>
      </div>

      <div className="border-b border-border bg-surface-muted px-5 py-4 md:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <div className="w-full lg:max-w-sm">{searchField}</div>
          <div className="w-full lg:w-auto lg:shrink-0 lg:overflow-x-auto">{filterBar}</div>
        </div>
      </div>

      <div className="p-5 md:p-6">{children}</div>
    </section>
  );
}
