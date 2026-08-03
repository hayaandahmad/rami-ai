"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export type WorkspaceFilter =
  | "all"
  | "in-progress"
  | "needs-clarification"
  | "ready-for-review"
  | "draft-generated";

export const WORKSPACE_FILTERS: Array<{ id: WorkspaceFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "in-progress", label: "In Progress" },
  { id: "needs-clarification", label: "Needs Clarification" },
  { id: "ready-for-review", label: "Ready for Review" },
  { id: "draft-generated", label: "Draft Generated" },
];

function parseWorkspaceFilter(value: string | null): WorkspaceFilter {
  if (
    value === "in-progress" ||
    value === "needs-clarification" ||
    value === "ready-for-review" ||
    value === "draft-generated"
  ) {
    return value;
  }

  return "all";
}

export function useWorkspaceFilters() {
  const searchParams = useSearchParams();
  const initialFilter = useMemo(
    () => parseWorkspaceFilter(searchParams.get("filter")),
    [searchParams],
  );
  const [filter, setFilter] = useState<WorkspaceFilter>(initialFilter);

  const clearFilter = useCallback(() => {
    setFilter("all");
  }, []);

  return {
    filter,
    setFilter,
    clearFilter,
    filters: WORKSPACE_FILTERS,
  };
}
