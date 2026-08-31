'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ProjectUnderstanding } from '@/types/projectUnderstanding';

interface Props {
  understanding: ProjectUnderstanding | null;
}

export function ProjectUnderstandingPanel({ understanding }: Props) {
  const [open, setOpen] = useState(true);

  if (!understanding) {
    return (
      <div className="border-b border-border px-4 py-3">
        <p className="text-caption text-text-muted">
          Project understanding will appear here as you describe the engagement.
        </p>
      </div>
    );
  }

  const attentionCount =
    understanding.missingCritical.length +
    understanding.tbcItems.length +
    understanding.contradictions.length;

  const title =
    understanding.documentTitle ||
    understanding.documentType ||
    'Current project';

  return (
    <section className="border-b border-border bg-surface" aria-labelledby="project-understanding-heading">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p id="project-understanding-heading" className="truncate text-small font-semibold text-text-primary">
            {title}
          </p>
          <p className="truncate text-caption text-text-muted">
            {[understanding.documentType, understanding.engagementType, understanding.documentStage]
              .filter(Boolean)
              .join(' · ') || 'Details still being gathered'}
            {` · ${understanding.completionPercent}% information gathered`}
          </p>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
        )}
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-3">
          {understanding.currentlyClarifying && (
            <p className="rounded-md bg-[var(--color-primary-50)] px-2.5 py-1.5 text-caption text-[var(--color-primary-800)]">
              {understanding.currentlyClarifying}
            </p>
          )}

          {attentionCount > 0 ? (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Needs your attention
              </p>
              <ul className="list-disc space-y-0.5 pl-4 text-caption text-text-secondary">
                {understanding.contradictions.map((item) => (
                  <li key={`c-${item.fieldId}`}>{item.label}</li>
                ))}
                {understanding.tbcItems.map((item) => (
                  <li key={`t-${item.fieldId}`}>{item.label}</li>
                ))}
                {understanding.missingCritical.map((item) => (
                  <li key={`m-${item.fieldId}`}>{item.label}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-caption text-text-secondary">
              {understanding.readyToDraftHint ||
                'No critical gaps flagged. Continue the conversation or draft ready sections.'}
            </p>
          )}

          {understanding.recentlyConfirmed.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Recently captured
              </p>
              <ul className="space-y-1 text-caption text-text-secondary">
                {understanding.recentlyConfirmed.map((item) => (
                  <li key={item.fieldId}>
                    <span className="font-medium text-text-primary">{item.label}</span>
                    {item.detail ? ` — ${item.detail}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
