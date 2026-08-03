"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, LayoutList } from "lucide-react";

interface InterviewLayoutProps {
  navigator: ReactNode;
  workspace: ReactNode;
  capturedPanel: ReactNode;
  /**
   * Compact summary for the mobile/tablet nav toggle button.
   * e.g. "Question 3 of 17 · Background and Business Need"
   */
  mobileNavSummary: string;
}

/**
 * Responsive three-zone interview layout.
 *
 * Desktop (lg+):   navigator | workspace | captured panel — all columns sticky
 * Tablet (md-lg):  workspace full-width; captured panel below; nav toggle row
 * Mobile (<md):    single column; navigator toggle row; captured accordion below
 */
export function InterviewLayout({
  navigator,
  workspace,
  capturedPanel,
  mobileNavSummary,
}: InterviewLayoutProps) {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isCapturedOpen, setIsCapturedOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Mobile / tablet nav toggle bar ────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-control border border-border bg-surface px-4 py-2.5 lg:hidden">
        <span className="text-caption text-text-muted">{mobileNavSummary}</span>
        <button
          type="button"
          onClick={() => setIsNavOpen((v) => !v)}
          aria-expanded={isNavOpen}
          aria-controls="mobile-interview-navigator"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-control px-3 text-small font-medium text-text-secondary transition-hover hover:bg-surface-subtle"
        >
          <LayoutList aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          Sections
          {isNavOpen ? (
            <ChevronUp aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
          ) : (
            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
          )}
        </button>
      </div>

      {/* ── Mobile / tablet collapsible navigator ─────────────────────────── */}
      {isNavOpen ? (
        <div id="mobile-interview-navigator" className="lg:hidden">
          {navigator}
        </div>
      ) : null}

      {/* ── Main content area ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        {/* Left navigator — desktop only, sticky */}
        <div
          className="hidden lg:block lg:w-[220px] lg:shrink-0 lg:self-start"
          style={{ position: "sticky", top: "1.5rem" }}
        >
          {navigator}
        </div>

        {/* Center workspace — always visible, dominant */}
        <div className="min-w-0 flex-1">
          {workspace}
        </div>

        {/* Right captured panel — desktop only, sticky */}
        <div
          className="hidden xl:block xl:w-[300px] xl:shrink-0 xl:self-start"
          style={{ position: "sticky", top: "1.5rem" }}
        >
          {capturedPanel}
        </div>
      </div>

      {/* ── Mobile / tablet captured panel as accordion ───────────────────── */}
      <div className="xl:hidden">
        <button
          type="button"
          onClick={() => setIsCapturedOpen((v) => !v)}
          aria-expanded={isCapturedOpen}
          aria-controls="mobile-captured-panel"
          className="flex w-full items-center justify-between rounded-control border border-border bg-surface px-4 py-3 text-left text-small font-medium text-text-secondary transition-hover hover:bg-surface-subtle"
        >
          <span>Captured Information</span>
          {isCapturedOpen ? (
            <ChevronUp aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          ) : (
            <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          )}
        </button>

        {isCapturedOpen ? (
          <div id="mobile-captured-panel" className="mt-2">
            {capturedPanel}
          </div>
        ) : null}
      </div>
    </div>
  );
}
