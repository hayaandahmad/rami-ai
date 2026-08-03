"use client";

import { Search } from "lucide-react";

interface DocumentSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function DocumentSearchField({ value, onChange }: DocumentSearchFieldProps) {
  return (
    <div className="relative w-full lg:max-w-sm">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted"
        strokeWidth={1.75}
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search documents..."
        aria-label="Search documents"
        className="min-h-11 w-full rounded-control border border-border bg-surface-subtle py-2 pr-4 pl-10 text-small text-text-primary transition-hover placeholder:text-text-muted focus:border-[var(--color-primary-600)] focus:bg-surface focus:outline-none"
      />
    </div>
  );
}
