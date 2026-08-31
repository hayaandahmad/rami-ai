/**
 * DocumentPreviewShell — A4-style document preview panel.
 * Phase 2: shows structure/state shell only. No actual draft content yet (Phase 4).
 * Designed so Phase 4 can inject real section drafts into each placeholder.
 */

import { FileText, Clock } from 'lucide-react';
import { RFP_SECTIONS, isSectionApplicable } from '@/schema/rfpSchema';
import type { SectionApplicabilityContext } from '@/schema/rfpSchema';
import type { SectionLifecycleState } from '@/types/sectionState';

interface DocumentPreviewShellProps {
  documentTitle?: string;
  beneficiaryEntity?: string;
  sectionStates?: Record<string, SectionLifecycleState>;
  applicabilityContext?: SectionApplicabilityContext;
  activeSection?: string | null;
}

const STATE_DOT_CLASS: Partial<Record<SectionLifecycleState, string>> = {
  APPROVED: 'bg-[var(--color-success-700)]',
  COLLECTING: 'bg-[var(--color-primary-500)]',
  READY_TO_DRAFT: 'bg-[var(--color-primary-300)]',
  NOT_STARTED: 'bg-[var(--color-neutral-200)]',
};

export function DocumentPreviewShell({
  documentTitle,
  beneficiaryEntity,
  sectionStates = {},
  applicabilityContext = {},
  activeSection,
}: DocumentPreviewShellProps) {
  const applicableSections = RFP_SECTIONS.filter((s) =>
    isSectionApplicable(s, applicabilityContext),
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Panel header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText aria-hidden="true" className="h-4 w-4 text-text-muted" strokeWidth={1.75} />
          <span className="text-small font-semibold text-text-primary">RFP Document</span>
        </div>
        <span className="rounded-pill border border-[var(--color-warning-100)] bg-[var(--color-warning-100)] px-2 py-0.5 text-caption font-medium text-[var(--color-warning-700)]">
          Draft pending
        </span>
      </div>

      {/* A4 paper scroll area */}
      <div className="flex-1 overflow-y-auto bg-[var(--color-neutral-100)] p-4">
        <div
          className="mx-auto rounded-sm bg-white shadow-[0_4px_24px_rgba(15,23,42,0.08),0_1px_4px_rgba(15,23,42,0.04)]"
          style={{
            maxWidth: '595px', // A4 width approximation
            minHeight: '842px', // A4 height approximation
            padding: '48px 56px',
          }}
          role="document"
          aria-label="RFP document preview"
        >
          {/* Cover area */}
          <div className="mb-8 border-b border-[var(--color-neutral-200)] pb-8">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded bg-[var(--color-primary-800)]">
              <FileText aria-hidden="true" className="h-5 w-5 text-white" strokeWidth={1.5} />
            </div>

            {documentTitle ? (
              <h1 className="mb-2 text-[1.25rem] font-bold leading-snug text-[var(--color-neutral-900)]">
                {documentTitle}
              </h1>
            ) : (
              <div className="mb-2 h-7 w-3/4 animate-pulse rounded bg-[var(--color-neutral-100)]" />
            )}

            {beneficiaryEntity ? (
              <p className="text-small text-text-secondary">
                Beneficiary: {beneficiaryEntity}
              </p>
            ) : (
              <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--color-neutral-100)]" />
            )}

            <div className="mt-4 flex items-center gap-1.5 text-caption text-text-muted">
              <Clock aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Draft in progress — information gathering underway</span>
            </div>
          </div>

          {/* Sections */}
          <div className="flex flex-col gap-5">
            {applicableSections.map((section, i) => {
              const state: SectionLifecycleState =
                (sectionStates[section.sectionId] as SectionLifecycleState) ?? 'NOT_STARTED';
              const isActive = section.sectionId === activeSection;
              const dotClass = STATE_DOT_CLASS[state] ?? STATE_DOT_CLASS.NOT_STARTED!;

              return (
                <div
                  key={section.sectionId}
                  className={`rounded-lg border p-4 transition-colors ${
                    isActive
                      ? 'border-[var(--color-primary-200)] bg-[var(--color-primary-50)]'
                      : 'border-[var(--color-neutral-100)] bg-[var(--color-neutral-50)]'
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-caption tabular-nums text-text-muted">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`}
                        aria-hidden="true"
                      />
                      <h2
                        className={`text-small font-semibold ${
                          isActive
                            ? 'text-[var(--color-primary-800)]'
                            : 'text-text-primary'
                        }`}
                      >
                        {section.title}
                      </h2>
                    </div>
                    {isActive && (
                      <span className="shrink-0 rounded-pill bg-[var(--color-primary-100)] px-2 py-0.5 text-caption font-medium text-[var(--color-primary-700)]">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Placeholder lines */}
                  <div className="space-y-1.5 pl-8">
                    {state === 'APPROVED' ? (
                      <div className="space-y-1">
                        <div className="h-2.5 w-full rounded bg-[var(--color-neutral-200)]" />
                        <div className="h-2.5 w-4/5 rounded bg-[var(--color-neutral-200)]" />
                        <div className="h-2.5 w-3/5 rounded bg-[var(--color-neutral-200)]" />
                      </div>
                    ) : isActive ? (
                      <p className="text-caption italic text-[var(--color-primary-600)]">
                        Gathering information…
                      </p>
                    ) : (
                      <p className="text-caption text-text-muted">
                        {section.applicableWhenNote}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
