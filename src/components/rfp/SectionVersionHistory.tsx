'use client';

import { ChevronDown, History, RotateCcw } from 'lucide-react';
import {
  describeVersionSource,
  describeVersionStatus,
} from '@/utils/sectionVersionLabel';
import type { SectionVersionSummary } from '@/types/generatedSection';

interface SectionVersionHistoryProps {
  open: boolean;
  onToggle: () => void;
  loading: boolean;
  versions: SectionVersionSummary[];
  previewVersion: number | null;
  onPreview: (version: number | null) => void;
  onRestore: (version: number) => void;
  busy?: boolean;
  canRestore: boolean;
}

function formatWhen(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Date(ms).toLocaleString();
}

export function SectionVersionHistory({
  open,
  onToggle,
  loading,
  versions,
  previewVersion,
  onPreview,
  onRestore,
  busy,
  canRestore,
}: SectionVersionHistoryProps) {
  return (
    <div className="shrink-0 border-b border-border px-2.5 py-2">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-caption font-medium text-text-secondary hover:text-text-primary"
        onClick={onToggle}
        aria-expanded={open}
      >
        <History className="h-3.5 w-3.5" aria-hidden />
        Version history
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {loading ? (
            <p className="text-caption text-text-muted">Loading versions…</p>
          ) : versions.length === 0 ? (
            <p className="text-caption text-text-muted">No version history yet.</p>
          ) : (
            <ul className="space-y-1">
              {versions.map((v) => {
                const isPreview = previewVersion === v.version;
                const statusLabel = describeVersionStatus({
                  version: v.version,
                  approvalStatus: v.approvalStatus,
                  isCurrent: v.isCurrent,
                });
                const sourceLabel = describeVersionSource(v.modelUsed);
                return (
                  <li
                    key={v.version}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded border px-2 py-1.5 text-caption ${
                      isPreview
                        ? 'border-[var(--color-primary-300)] bg-[var(--color-primary-50)]'
                        : 'border-border bg-white'
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-text-primary">v{v.version}</span>
                      <span className="mx-1 text-text-muted">·</span>
                      <span className="text-text-secondary">{statusLabel}</span>
                      <span className="mx-1 text-text-muted">·</span>
                      <span className="text-text-muted">{sourceLabel}</span>
                      <div className="text-[10px] text-text-muted">{formatWhen(v.createdAt)}</div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {v.isCurrent ? (
                        <span className="rounded bg-[var(--color-primary-100)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-primary-800)]">
                          Current
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="rounded border border-border px-2 py-0.5 text-[11px]"
                            onClick={() => onPreview(isPreview ? null : v.version)}
                            disabled={busy}
                          >
                            {isPreview ? 'Hide' : 'View'}
                          </button>
                          {canRestore && (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px]"
                              onClick={() => onRestore(v.version)}
                              disabled={busy}
                              title="Create a new draft from this version"
                            >
                              <RotateCcw className="h-3 w-3" aria-hidden />
                              Restore
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
