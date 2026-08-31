'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ProjectUnderstanding, UnderstandingItem } from '@/types/projectUnderstanding';

interface Props {
  understanding: ProjectUnderstanding | null;
}

const ATTENTION_PREVIEW = 3;

function buildAttentionItems(understanding: ProjectUnderstanding): UnderstandingItem[] {
  return [
    ...understanding.contradictions,
    ...understanding.tbcItems,
    ...understanding.missingCritical,
  ];
}

export function ProjectUnderstandingPanel({ understanding }: Props) {
  const [open, setOpen] = useState(false);
  const [showAllAttention, setShowAllAttention] = useState(false);

  const attentionItems = useMemo(
    () => (understanding ? buildAttentionItems(understanding) : []),
    [understanding],
  );

  if (!understanding) {
    return (
      <div className="border-b border-border px-4 py-2.5">
        <p className="text-caption text-text-muted">
          Project understanding will appear here as you describe the engagement.
        </p>
      </div>
    );
  }

  const attentionCount = attentionItems.length;
  const recentCount = understanding.recentlyConfirmed.length;
  const title =
    understanding.documentTitle || understanding.documentType || 'Current project';
  const attentionPreview = showAllAttention
    ? attentionItems
    : attentionItems.slice(0, ATTENTION_PREVIEW);
  const hiddenAttention = Math.max(0, attentionCount - ATTENTION_PREVIEW);

  return (
    <section className="border-b border-border bg-surface" aria-labelledby="project-understanding-heading">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <p
            id="project-understanding-heading"
            className="truncate text-small font-semibold text-text-primary"
          >
            Project Understanding
          </p>
          <p className="truncate text-caption text-text-muted">{title}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="inline-flex rounded-pill bg-surface-subtle px-2 py-0.5 text-[10px] font-medium text-text-secondary">
              {understanding.completionPercent}% gathered
            </span>
            {attentionCount > 0 ? (
              <span className="inline-flex rounded-pill bg-[var(--color-warning-100)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-warning-700)]">
                {attentionCount} need attention
              </span>
            ) : null}
            {recentCount > 0 ? (
              <span className="inline-flex rounded-pill bg-[var(--color-primary-50)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-primary-800)]">
                {recentCount} recently captured
              </span>
            ) : null}
          </div>
          {!open && understanding.currentlyClarifying ? (
            <p className="mt-1.5 truncate text-caption text-[var(--color-primary-800)]">
              Clarifying: {understanding.currentlyClarifying}
            </p>
          ) : null}
        </div>
        {open ? (
          <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
        ) : (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t border-border px-4 py-3">
          <p className="text-caption text-text-muted">
            {[understanding.documentType, understanding.engagementType, understanding.documentStage]
              .filter(Boolean)
              .join(' · ') || 'Details still being gathered'}
          </p>

          {understanding.currentlyClarifying ? (
            <p className="rounded-md border border-[var(--color-primary-100)] bg-[var(--color-primary-50)] px-2.5 py-1.5 text-caption text-[var(--color-primary-800)]">
              <span className="font-medium">Currently clarifying:</span>{' '}
              {understanding.currentlyClarifying}
            </p>
          ) : null}

          {attentionCount > 0 ? (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Needs your attention ({attentionCount})
              </p>
              <ul className="space-y-1 text-caption text-text-secondary">
                {attentionPreview.map((item) => (
                  <li key={`a-${item.fieldId}`} className="flex items-start gap-1.5">
                    <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-muted" />
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
              {hiddenAttention > 0 && !showAllAttention ? (
                <button
                  type="button"
                  className="mt-1.5 text-caption font-medium text-[var(--color-primary-700)] hover:underline"
                  onClick={() => setShowAllAttention(true)}
                >
                  +{hiddenAttention} more
                </button>
              ) : null}
              {showAllAttention && attentionCount > ATTENTION_PREVIEW ? (
                <button
                  type="button"
                  className="mt-1.5 text-caption font-medium text-text-muted hover:underline"
                  onClick={() => setShowAllAttention(false)}
                >
                  Show fewer
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-caption text-text-secondary">
              {understanding.readyToDraftHint ||
                'No critical gaps flagged. Continue the conversation or draft ready sections.'}
            </p>
          )}

          {recentCount > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Recently captured
              </p>
              <ul className="space-y-2 text-caption">
                {understanding.recentlyConfirmed.map((item) => (
                  <li key={item.fieldId} className="rounded-md bg-surface-subtle px-2.5 py-1.5">
                    <p className="font-medium text-text-primary">{item.label}</p>
                    {item.detail ? (
                      <p className="mt-0.5 text-text-secondary">{item.detail}</p>
                    ) : null}
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
