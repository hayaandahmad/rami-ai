/**
 * RFP document panel — A4 preview, section nav, Generate/Regenerate/Approve/Edit.
 * Consumes GeneratedSection from PostgreSQL via generation APIs.
 */

'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  FileText,
  Loader2,
  RefreshCw,
  Check,
  Pencil,
  Ban,
  AlertTriangle,
  Download,
} from 'lucide-react';
import { GeneratedSectionBlocks } from '@/components/rfp/GeneratedSectionBlocks';
import {
  useRfpDocument,
  type DocumentStatus,
  type SectionUiRow,
} from '@/hooks/useRfpDocument';
import type { GeneratedBlock, GeneratedSection } from '@/types/generatedSection';
import type { SectionInformationReadiness } from '@/types/sectionReadiness';

interface RfpDocumentPanelProps {
  documentKey: string;
  onHasDocumentContent?: (has: boolean) => void;
}

const READINESS_LABEL: Record<SectionInformationReadiness, string> = {
  NOT_APPLICABLE: 'N/A',
  NOT_READY: 'Needs info',
  DRAFTABLE_WITH_TBC: 'Draftable (TBC)',
  READY_TO_DRAFT: 'Ready to draft',
};

const DOC_STATUS_LABEL: Record<DocumentStatus, string> = {
  NOT_APPLICABLE: 'Not applicable',
  NOT_GENERATED: 'Not generated',
  DRAFT: 'Draft',
  APPROVED: 'Approved',
};

function canGenerate(row: SectionUiRow): boolean {
  if (!row.applicable) return false;
  return (
    row.readiness === 'READY_TO_DRAFT' || row.readiness === 'DRAFTABLE_WITH_TBC'
  );
}

export function RfpDocumentPanel({ documentKey }: RfpDocumentPanelProps) {
  const doc = useRfpDocument(documentKey);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [confirmReopen, setConfirmReopen] = useState(false);

  const selected = doc.selected;

  const blockers = useMemo(() => {
    const d = selected?.readinessDetail;
    if (!d) return [];
    return d.criticalBlockers.filter((id) => id !== '__coverage_gap__');
  }, [selected]);

  const startEdit = () => {
    if (!selected?.generated) return;
    if (selected.documentStatus === 'APPROVED') {
      setConfirmReopen(true);
      return;
    }
    setEditText(JSON.stringify(selected.generated.blocks, null, 2));
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    let blocks: GeneratedBlock[];
    try {
      blocks = JSON.parse(editText) as GeneratedBlock[];
      if (!Array.isArray(blocks)) throw new Error('blocks must be an array');
    } catch (err) {
      doc.setError(err instanceof Error ? err.message : 'Invalid JSON blocks');
      return;
    }
    try {
      await doc.saveEdit(selected.sectionId, blocks, {
        reopenApproved: selected.documentStatus === 'APPROVED',
      });
      setEditing(false);
      setConfirmReopen(false);
    } catch {
      /* error set in hook */
    }
  };

  const onGenerate = async (regenerate: boolean) => {
    if (!selected) return;
    const needsReopen =
      regenerate && selected.documentStatus === 'APPROVED';
    if (needsReopen && !confirmReopen) {
      setConfirmReopen(true);
      return;
    }
    try {
      await doc.generate(selected.sectionId, {
        regenerate,
        reopenApproved: needsReopen,
      });
      setConfirmReopen(false);
      setEditing(false);
    } catch {
      /* error set in hook */
    }
  };

  const onApprove = async () => {
    if (!selected?.generated) return;
    try {
      await doc.approve(selected.sectionId);
    } catch {
      /* error set in hook */
    }
  };

  const headerBadge =
    doc.assembled?.complete
      ? 'Complete'
      : doc.hasGeneratedContent
        ? 'In progress'
        : 'No drafts yet';

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-surface">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-text-muted" strokeWidth={1.75} aria-hidden />
          <span className="text-small font-semibold text-text-primary">RFP Document</span>
          <span className="rounded border border-border bg-[var(--color-neutral-50)] px-2 py-0.5 text-caption text-text-secondary">
            {headerBadge}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={`rounded px-2 py-1 text-caption font-medium ${
              doc.viewMode === 'section'
                ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-800)]'
                : 'text-text-muted hover:bg-surface-subtle'
            }`}
            onClick={() => doc.setViewMode('section')}
          >
            Section
          </button>
          <button
            type="button"
            className={`rounded px-2 py-1 text-caption font-medium ${
              doc.viewMode === 'full'
                ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-800)]'
                : 'text-text-muted hover:bg-surface-subtle'
            }`}
            onClick={() => doc.setViewMode('full')}
          >
            Full RFP
          </button>
          <a
            href={`/api/rami/generation/document/docx?documentKey=${encodeURIComponent(documentKey)}`}
            className="inline-flex items-center gap-1 rounded border border-border bg-white px-2 py-1 text-caption font-medium text-text-secondary hover:bg-surface-subtle"
            download
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Word
          </a>
          <button
            type="button"
            aria-label="Refresh from PostgreSQL"
            className="rounded p-1.5 text-text-muted hover:bg-surface-subtle"
            onClick={() => void doc.refresh()}
            disabled={doc.loading || doc.busy}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${doc.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Section navigation */}
        <nav
          className="flex w-[11.5rem] shrink-0 flex-col overflow-y-auto border-r border-border bg-[var(--color-neutral-50)]"
          aria-label="RFP sections"
        >
          <p className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            Sections
          </p>
          <ul className="flex flex-col gap-0.5 px-1 pb-3">
            {doc.rows.map((row) => (
              <li key={row.sectionId}>
                <button
                  type="button"
                  onClick={() => {
                    doc.setSelectedSectionId(row.sectionId);
                    doc.setViewMode('section');
                    setEditing(false);
                    setConfirmReopen(false);
                  }}
                  className={`flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left transition-colors ${
                    row.sectionId === doc.selectedSectionId
                      ? 'bg-white shadow-sm ring-1 ring-[var(--color-primary-200)]'
                      : 'hover:bg-white/70'
                  } ${!row.applicable ? 'opacity-50' : ''}`}
                >
                  <span className="text-[11px] font-medium leading-snug text-text-primary">
                    {String(row.order).padStart(2, '0')}. {row.title}
                  </span>
                  <span className="mt-0.5 flex flex-wrap gap-1">
                    <StatusChip kind="readiness" value={row.readiness} />
                    <StatusChip kind="doc" value={row.documentStatus} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {doc.assembled && (
            <p className="mt-auto border-t border-border px-2 py-2 text-caption text-text-muted">
              {doc.assembled.generatedApplicableCount}/
              {doc.assembled.applicableSectionCount} generated ·{' '}
              {doc.assembled.approvedApplicableCount} approved
            </p>
          )}
        </nav>

        {/* Preview + actions */}
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {selected && doc.viewMode === 'section' && (
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-small font-semibold text-text-primary">
                  {selected.title}
                </p>
                <p className="text-caption text-text-muted">
                  Info: {READINESS_LABEL[selected.readiness]} · Doc:{' '}
                  {DOC_STATUS_LABEL[selected.documentStatus]}
                  {selected.generated ? ` · v${selected.generated.version}` : ''}
                </p>
              </div>

              {!selected.applicable && (
                <span className="inline-flex items-center gap-1 text-caption text-text-muted">
                  <Ban className="h-3.5 w-3.5" /> Not applicable
                </span>
              )}

              {selected.applicable && selected.readiness === 'NOT_READY' && (
                <span className="inline-flex max-w-[14rem] items-start gap-1 text-caption text-[var(--color-warning-700)]">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Needs:{' '}
                    {blockers.length
                      ? blockers.join(', ')
                      : selected.readinessDetail?.missingFields.slice(0, 4).join(', ') ||
                        'more information'}
                  </span>
                </span>
              )}

              {canGenerate(selected) && !selected.generated && (
                <ActionButton
                  disabled={doc.busy}
                  onClick={() => void onGenerate(false)}
                  label={
                    selected.readiness === 'DRAFTABLE_WITH_TBC'
                      ? 'Generate (with TBC)'
                      : 'Generate'
                  }
                />
              )}

              {selected.generated && selected.documentStatus === 'DRAFT' && (
                <>
                  <ActionButton
                    disabled={doc.busy}
                    onClick={() => void onGenerate(true)}
                    label="Regenerate"
                  />
                  <ActionButton
                    disabled={doc.busy}
                    onClick={() => void onApprove()}
                    label="Approve"
                    icon={<Check className="h-3.5 w-3.5" />}
                  />
                  <ActionButton
                    disabled={doc.busy || editing}
                    onClick={startEdit}
                    label="Edit"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                  />
                </>
              )}

              {selected.documentStatus === 'APPROVED' && (
                <ActionButton
                  disabled={doc.busy}
                  onClick={() => setConfirmReopen(true)}
                  label="Reopen / Regenerate"
                />
              )}
            </div>
          )}

          {confirmReopen && selected && (
            <div className="shrink-0 border-b border-[var(--color-warning-100)] bg-[var(--color-warning-100)] px-3 py-2 text-caption text-[var(--color-warning-700)]">
              <p className="mb-2 font-medium">
                This section is APPROVED. Regenerating or editing will create a new DRAFT
                version (history kept). Confirm?
              </p>
              <div className="flex gap-2">
                <ActionButton
                  disabled={doc.busy}
                  onClick={() => void onGenerate(true)}
                  label="Confirm regenerate"
                />
                <ActionButton
                  disabled={doc.busy}
                  onClick={() => {
                    setEditText(
                      JSON.stringify(selected.generated?.blocks ?? [], null, 2),
                    );
                    setEditing(true);
                    setConfirmReopen(false);
                  }}
                  label="Edit into new draft"
                />
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1 text-caption"
                  onClick={() => setConfirmReopen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {doc.error && (
            <div className="shrink-0 border-b border-border bg-[var(--color-danger-50, #fef2f2)] px-3 py-2 text-caption text-[var(--color-danger-700,#b91c1c)]">
              {doc.error}
            </div>
          )}

          {editing && selected && (
            <div className="flex shrink-0 flex-col gap-2 border-b border-border px-3 py-2">
              <p className="text-caption text-text-secondary">
                Edit GeneratedSection blocks (JSON). Saves a new DRAFT version to
                PostgreSQL. Does not change ProjectFacts.
              </p>
              <textarea
                className="h-40 w-full rounded border border-border bg-white p-2 font-mono text-[11px] text-text-primary"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
              />
              <div className="flex gap-2">
                <ActionButton disabled={doc.busy} onClick={() => void saveEdit()} label="Save edit" />
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1 text-caption"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* A4 paper */}
          <div className="flex-1 overflow-y-auto bg-[var(--color-neutral-100)] p-4">
            {doc.loading && !doc.assembled ? (
              <div className="flex h-40 items-center justify-center text-text-muted">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading document…
              </div>
            ) : (
              <article className="rfp-a4-page mx-auto" role="document" aria-label="RFP document preview">
                <header className="rfp-cover">
                  <p className="rfp-cover-kicker">Request for Proposal</p>
                  <h1 className="rfp-cover-title">
                    {doc.documentMeta.documentTitle || 'Untitled RFP'}
                  </h1>
                  {doc.documentMeta.beneficiaryEntity && (
                    <p className="rfp-cover-meta">
                      Issued by: {doc.documentMeta.beneficiaryEntity}
                    </p>
                  )}
                  <p className="rfp-cover-meta">
                    {[
                      doc.documentMeta.documentType,
                      doc.documentMeta.engagementType,
                      doc.documentMeta.engagementDuration,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Document details to be confirmed'}
                  </p>
                </header>

                {doc.viewMode === 'full' ? (
                  <FullDocumentView rows={doc.rows} />
                ) : selected ? (
                  <SectionPreview row={selected} />
                ) : (
                  <p className="rfp-p text-text-muted">Select a section.</p>
                )}
              </article>
            )}
          </div>

          {doc.busy && (
            <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-4">
              <span className="inline-flex max-w-xs items-start gap-2 rounded-md bg-[var(--color-primary-800)] px-3 py-1.5 text-caption text-white shadow-lg">
                <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                <span>
                  Working… generation can take several minutes. Do not resubmit —
                  existing drafts stay intact if this fails.
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusChip({
  kind,
  value,
}: {
  kind: 'readiness' | 'doc';
  value: SectionInformationReadiness | DocumentStatus;
}) {
  const label =
    kind === 'readiness'
      ? READINESS_LABEL[value as SectionInformationReadiness]
      : DOC_STATUS_LABEL[value as DocumentStatus];
  const tone =
    value === 'APPROVED' || value === 'READY_TO_DRAFT'
      ? 'rfp-chip-ok'
      : value === 'DRAFT' || value === 'DRAFTABLE_WITH_TBC'
        ? 'rfp-chip-warn'
        : value === 'NOT_READY'
          ? 'rfp-chip-alert'
          : 'rfp-chip-muted';
  return <span className={`rfp-chip ${tone}`}>{label}</span>;
}

function ActionButton({
  label,
  onClick,
  disabled,
  icon,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded border border-[var(--color-primary-200)] bg-white px-2.5 py-1 text-caption font-medium text-[var(--color-primary-800)] hover:bg-[var(--color-primary-50)] disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}

function SectionPreview({ row }: { row: SectionUiRow }) {
  if (!row.applicable) {
    return (
      <section className="rfp-section-slot">
        <h2 className="rfp-h1">{row.title}</h2>
        <p className="rfp-p rfp-muted">This section is not applicable for the current engagement.</p>
      </section>
    );
  }
  if (row.generated) {
    return (
      <section className="rfp-section-slot" data-approval={row.documentStatus}>
        {row.documentStatus === 'APPROVED' && (
          <p className="rfp-approved-banner">Approved · version {row.generated.version}</p>
        )}
        {row.documentStatus === 'DRAFT' && (
          <p className="rfp-draft-banner">Draft · version {row.generated.version}</p>
        )}
        <GeneratedSectionBlocks section={row.generated} />
      </section>
    );
  }
  return (
    <section className="rfp-section-slot">
      <h2 className="rfp-h1">{row.title}</h2>
      <p className="rfp-p rfp-muted">
        {row.readiness === 'NOT_READY'
          ? 'Not generated — additional project information is required before drafting.'
          : row.readiness === 'READY_TO_DRAFT' || row.readiness === 'DRAFTABLE_WITH_TBC'
            ? 'Not generated yet — use Generate when ready.'
            : 'Not generated.'}
      </p>
      {row.missingGeneration && (
        <p className="rfp-missing">Missing generated content for this applicable section.</p>
      )}
    </section>
  );
}

function FullDocumentView({ rows }: { rows: SectionUiRow[] }) {
  return (
    <div className="flex flex-col gap-8">
      {rows.map((row) => {
        if (!row.applicable) return null;
        return (
          <section key={row.sectionId} className="rfp-section-slot" id={`rfp-${row.sectionId}`}>
            {!row.generated ? (
              <>
                <h2 className="rfp-h1">{row.title}</h2>
                <p className="rfp-missing">
                  [{row.title} — not yet generated
                  {row.readiness === 'NOT_READY' ? '; information incomplete' : ''}]
                </p>
              </>
            ) : (
              <>
                {row.documentStatus === 'APPROVED' && (
                  <p className="rfp-approved-banner">Approved</p>
                )}
                <GeneratedSectionBlocks section={row.generated as GeneratedSection} />
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
