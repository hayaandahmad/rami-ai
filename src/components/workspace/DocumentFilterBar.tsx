"use client";

import type { WorkspaceFilter } from "@/hooks/useWorkspaceFilters";
import { WORKSPACE_FILTERS } from "@/hooks/useWorkspaceFilters";

interface DocumentFilterBarProps {
  activeFilter: WorkspaceFilter;
  onFilterChange: (filter: WorkspaceFilter) => void;
}

export function DocumentFilterBar({
  activeFilter,
  onFilterChange,
}: DocumentFilterBarProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter documents"
      className="flex flex-wrap gap-2"
    >
      {WORKSPACE_FILTERS.map((filter) => {
        const isActive = activeFilter === filter.id;

        return (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onFilterChange(filter.id)}
            className={`min-h-10 rounded-pill px-4 text-small font-medium transition-elevate ${
              isActive
                ? "bg-action-primary text-text-inverse shadow-card"
                : "border border-border bg-surface text-text-secondary hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary"
            }`}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
