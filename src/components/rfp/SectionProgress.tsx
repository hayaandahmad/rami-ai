/**
 * SectionProgress — thin document-status strip above the RFP workspace.
 * Unique value: document approval/generation counts at a glance.
 * Expanded section list removed (duplicates section navigator).
 */

'use client';

interface SectionProgressProps {
  /** Information completeness: 0–100 from gap engine */
  completionPercent?: number;
  applicableSectionCount?: number;
  assembledApprovedCount?: number;
  assembledGeneratedCount?: number;
}

export function SectionProgress({
  completionPercent = 0,
  applicableSectionCount,
  assembledApprovedCount,
  assembledGeneratedCount,
}: SectionProgressProps) {
  const approved = assembledApprovedCount ?? 0;
  const total = applicableSectionCount ?? 0;
  const generated = assembledGeneratedCount;

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] text-text-secondary"
      aria-label={`RFP progress: ${approved} of ${total} sections approved, ${completionPercent}% information gathered`}
    >
      <span>
        <span className="font-semibold text-text-primary">{approved}</span>
        <span className="text-text-muted"> / {total} approved</span>
      </span>
      {generated != null ? (
        <>
          <span className="text-text-muted" aria-hidden>
            ·
          </span>
          <span>
            <span className="font-semibold text-text-primary">{generated}</span> generated
          </span>
        </>
      ) : null}
      <span className="text-text-muted" aria-hidden>
        ·
      </span>
      <span>
        <span className="font-semibold text-[var(--color-primary-700)]">{completionPercent}%</span>{' '}
        gathered
      </span>
    </div>
  );
}
