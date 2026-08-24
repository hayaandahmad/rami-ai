/**
 * SectionProgress — compact dynamic RFP section progress control.
 * Derived from getApplicableSections() — never hardcoded.
 */

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { RFP_SECTIONS, isSectionApplicable } from '@/schema/rfpSchema';
import type { SectionApplicabilityContext } from '@/schema/rfpSchema';
import type { SectionLifecycleState } from '@/types/sectionState';

interface SectionProgressProps {
  sectionStates?: Record<string, SectionLifecycleState>;
  applicabilityContext?: SectionApplicabilityContext;
  activeSection?: string | null;
  completionPercent?: number;
}

const STATE_LABEL: Record<SectionLifecycleState, string> = {
  NOT_STARTED: 'Not started',
  COLLECTING: 'In progress',
  READY_TO_DRAFT: 'Ready',
  DRAFTING: 'Drafting',
  REVIEW: 'Review',
  REVISING: 'Revising',
  APPROVED: 'Approved',
  REOPENED: 'Reopened',
};

function SectionIcon({ state, isActive }: { state: SectionLifecycleState; isActive: boolean }) {
  if (state === 'APPROVED') {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-success-100)] text-[var(--color-success-700)] text-[10px] font-bold">
        ✓
      </span>
    );
  }
  if (state === 'COLLECTING' || isActive) {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary-100)] ring-2 ring-[var(--color-primary-400)]">
        <span className="h-2 w-2 rounded-full bg-[var(--color-primary-600)]" />
      </span>
    );
  }
  if (state === 'READY_TO_DRAFT' || state === 'DRAFTING' || state === 'REVIEW') {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary-50)] ring-1 ring-[var(--color-primary-200)]">
        <span className="h-2 w-2 rounded-full bg-[var(--color-primary-400)]" />
      </span>
    );
  }
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-neutral-300)]" />
    </span>
  );
}

export function SectionProgress({
  sectionStates = {},
  applicabilityContext = {},
  activeSection,
  completionPercent = 0,
}: SectionProgressProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const applicableSections = RFP_SECTIONS.filter((s) =>
    isSectionApplicable(s, applicabilityContext),
  );

  const approvedCount = applicableSections.filter(
    (s) => sectionStates[s.sectionId] === 'APPROVED',
  ).length;

  const total = applicableSections.length;

  return (
    <div className="rounded-xl border border-border bg-surface shadow-card">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between gap-3 px-4 py-3"
        aria-label={`RFP Progress: ${approvedCount} of ${total} sections approved`}
      >
        <div className="flex items-center gap-3">
          <span className="text-small font-semibold text-text-primary">RFP Progress</span>
          <span className="text-caption text-text-muted tabular-nums">
            {approvedCount} / {total}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mini dot indicators */}
          <div className="hidden items-center gap-0.5 sm:flex" aria-hidden="true">
            {applicableSections.slice(0, 10).map((s) => {
              const state: SectionLifecycleState = (sectionStates[s.sectionId] as SectionLifecycleState) ?? 'NOT_STARTED';
              const isActive = s.sectionId === activeSection;
              if (state === 'APPROVED') {
                return <span key={s.sectionId} className="h-2 w-2 rounded-full bg-[var(--color-success-700)]" />;
              }
              if (isActive || state === 'COLLECTING') {
                return <span key={s.sectionId} className="h-2 w-2 rounded-full bg-[var(--color-primary-500)]" />;
              }
              return <span key={s.sectionId} className="h-2 w-2 rounded-full bg-[var(--color-neutral-200)]" />;
            })}
            {applicableSections.length > 10 && (
              <span className="text-caption text-text-muted ml-0.5">…</span>
            )}
          </div>

          {/* Percentage */}
          <span className="text-caption font-medium tabular-nums text-[var(--color-primary-700)]">
            {completionPercent}%
          </span>

          {isExpanded ? (
            <ChevronUp aria-hidden="true" className="h-4 w-4 shrink-0 text-text-muted" strokeWidth={1.75} />
          ) : (
            <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-text-muted" strokeWidth={1.75} />
          )}
        </div>
      </button>

      {/* Progress bar */}
      <div className="mx-4 mb-3 h-1 rounded-full bg-[var(--color-neutral-100)]">
        <div
          className="h-full rounded-full bg-[var(--color-primary-600)] transition-all duration-500"
          style={{ width: `${completionPercent}%` }}
          role="progressbar"
          aria-valuenow={completionPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {/* Expanded section list */}
      {isExpanded && (
        <div className="border-t border-border px-2 py-2">
          <ul className="flex flex-col gap-0.5" role="list">
            {applicableSections.map((s) => {
              const state: SectionLifecycleState = (sectionStates[s.sectionId] as SectionLifecycleState) ?? 'NOT_STARTED';
              const isActive = s.sectionId === activeSection;
              return (
                <li
                  key={s.sectionId}
                  className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${isActive ? 'bg-[var(--color-primary-50)]' : ''}`}
                >
                  <SectionIcon state={state} isActive={isActive} />
                  <span
                    className={`flex-1 text-small ${
                      isActive
                        ? 'font-medium text-[var(--color-primary-800)]'
                        : state === 'APPROVED'
                        ? 'text-text-secondary line-through'
                        : 'text-text-secondary'
                    }`}
                  >
                    {s.title}
                  </span>
                  {isActive && (
                    <span className="text-caption text-[var(--color-primary-600)]">
                      {STATE_LABEL[state]}
                    </span>
                  )}
                  {!isActive && state !== 'NOT_STARTED' && state !== 'APPROVED' && (
                    <span className="text-caption text-text-muted">
                      {STATE_LABEL[state]}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
