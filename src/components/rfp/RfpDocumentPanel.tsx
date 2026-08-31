/**
 * RFP document panel — A4 preview, section nav, Generate/Regenerate/Approve/Edit.
 * Consumes GeneratedSection from PostgreSQL via generation APIs.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { ManualBlockEditor } from '@/components/rfp/ManualBlockEditor';
import { SectionVersionHistory } from '@/components/rfp/SectionVersionHistory';
import {
  useRfpDocument,
  type AssembledProgressSummary,
  type DocumentStatus,
  type SectionUiRow,
} from '@/hooks/useRfpDocument';
import type { GeneratedBlock, GeneratedSection } from '@/types/generatedSection';
import type { SectionInformationReadiness } from '@/types/sectionReadiness';
import { describeBlocker, exportStatusCopy } from '@/utils/fieldDisplay';
import { isStructuralSectionId } from '@/schema/rfpSchema';
import { useRamiEngineStatus } from '@/providers/RamiEngineStatusProvider';

const ENGINE_OFF_GENERATION_MSG =
  'Rami AI Engine is off. Start Rami to use AI generation. Your project and RFP are safely saved.';

interface RfpDocumentPanelProps {
  documentKey: string;
  onHasDocumentContent?: (has: boolean) => void;
  onProgressSummary?: (summary: AssembledProgressSummary | null) => void;
}

const READINESS_LABEL: Record<SectionInformationReadiness, string> = {
  NOT_APPLICABLE: 'Not applicable',
  NOT_READY: 'Needs information',
  DRAFTABLE_WITH_TBC: 'Draftable with TBC',
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

function needsAiEngine(row: SectionUiRow): boolean {
  return !isStructuralSectionId(row.sectionId);
}

function isPersistedSection(row: SectionUiRow): boolean {
  return Boolean(row.generated && row.approvalStatus);
}

function documentStatusLabel(row: SectionUiRow): string {
  if (isStructuralSectionId(row.sectionId) && row.generated) return 'Deterministic';
  return DOC_STATUS_LABEL[row.documentStatus];
}

export function RfpDocumentPanel({ documentKey, onProgressSummary }: RfpDocumentPanelProps) {
  const doc = useRfpDocument(documentKey);
  const { isModalEngineUnavailable } = useRamiEngineStatus();
  const [editing, setEditing] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [busyElapsed, setBusyElapsed] = useState(0);
  const [aiEditOpen, setAiEditOpen] = useState(false);
  const [aiEditInstruction, setAiEditInstruction] = useState('');
  const [aiEditAfterReopen, setAiEditAfterReopen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingRestoreVersion, setPendingRestoreVersion] = useState<number | null>(null);

  const selected = doc.selected;

  useEffect(() => {
    onProgressSummary?.(doc.progressSummary);
  }, [doc.progressSummary, onProgressSummary]);

  useEffect(() => {
    if (!doc.busy) {
      setBusyElapsed(0);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => {
      setBusyElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [doc.busy]);

  const blockers = useMemo(() => {
    const d = selected?.readinessDetail;
    if (!d) return [];
    const ids = d.criticalBlockers.filter((id) => id !== '__coverage_gap__');
    const fallback = ids.length ? ids : d.missingFields.slice(0, 6);
    return fallback.map((id) => {
      const tbc = d.tbcFields.includes(id);
      return describeBlocker(id, tbc ? 'tbc' : 'missing');
    });
  }, [selected]);

  const startEdit = () => {
    if (!selected?.generated) return;
    setAiEditOpen(false);
    doc.setPreviewVersion(null);
    if (selected.documentStatus === 'APPROVED') {
      setConfirmReopen(true);
      return;
    }
    setEditing(true);
  };

  const saveManualEdit = async (blocks: GeneratedBlock[]) => {
    if (!selected) return;
    try {
      await doc.saveEdit(selected.sectionId, blocks, {
        reopenApproved: selected.documentStatus === 'APPROVED',
      });
      setEditing(false);
      setConfirmReopen(false);
      if (historyOpen) {
        await doc.fetchSectionHistory(selected.sectionId);
      }
    } catch {
      /* error set in hook */
    }
  };

  const toggleHistory = async () => {
    if (!selected?.generated) return;
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next) {
      await doc.fetchSectionHistory(selected.sectionId);
    } else {
      doc.setPreviewVersion(null);
    }
  };

  const handleRestoreVersion = async (version: number) => {
    if (!selected) return;
    const needsReopen = selected.documentStatus === 'APPROVED';
    if (needsReopen && !confirmReopen) {
      setPendingRestoreVersion(version);
      setConfirmReopen(true);
      return;
    }
    try {
      await doc.restoreSectionVersion(selected.sectionId, version, {
        reopenApproved: needsReopen,
      });
      setConfirmReopen(false);
      setPendingRestoreVersion(null);
    } catch {
      /* error set in hook */
    }
  };

  const viewingHistorical = doc.previewVersion != null;

  const openAiEdit = () => {
    if (!selected?.generated) return;
    setEditing(false);
    if (selected.documentStatus === 'APPROVED') {
      setAiEditAfterReopen(true);
      setConfirmReopen(true);
      return;
    }
    setAiEditInstruction('');
    setAiEditOpen(true);
  };

  const submitAiEdit = async () => {
    if (!selected?.generated) return;
    const instruction = aiEditInstruction.trim();
    if (!instruction) {
      doc.setError('Enter an edit instruction for Rami.');
      return;
    }
    if (isModalEngineUnavailable) {
      doc.setError(ENGINE_OFF_GENERATION_MSG);
      return;
    }
    const needsReopen = selected.documentStatus === 'APPROVED';
    try {
      await doc.aiEdit(selected.sectionId, instruction, {
        reopenApproved: needsReopen,
      });
      setAiEditOpen(false);
      setAiEditInstruction('');
      setConfirmReopen(false);
      setAiEditAfterReopen(false);
    } catch {
      /* error set in hook */
    }
  };


  const onGenerate = async (regenerate: boolean) => {
    if (!selected) return;
    if (needsAiEngine(selected) && isModalEngineUnavailable) {
      doc.setError(ENGINE_OFF_GENERATION_MSG);
      return;
    }
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
      setAiEditOpen(false);
    } catch {
      /* error set in hook */
    }
  };

  const onApprove = async () => {
    if (!selected?.generated) return;
    if (!confirmApprove) {
      setConfirmApprove(true);
      return;
    }
    try {
      await doc.approve(selected.sectionId);
      setConfirmApprove(false);
    } catch {
      /* error set in hook */
    }
  };

  const allApproved = Boolean(doc.assembled?.complete);
  const exportCopy = exportStatusCopy(allApproved);
  const headerBadge = allApproved
    ? 'All sections approved'
    : doc.hasGeneratedContent
      ? 'Working draft'
      : doc.hasPreparedStructural
        ? 'Automatic sections prepared'
        : 'No drafts yet';

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-surface">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-border px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-text-muted" strokeWidth={1.75} aria-hidden />
          <span className="text-small font-semibold text-text-primary">RFP Document</span>
          <span className="hidden rounded border border-border bg-[var(--color-neutral-50)] px-1.5 py-0.5 text-[10px] text-text-secondary sm:inline">
            {headerBadge}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
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
            title={exportCopy.helper}
            aria-label={exportCopy.buttonLabel}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            {allApproved ? 'Export approved RFP' : 'Download Word'}
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
          className="flex w-[10rem] shrink-0 flex-col overflow-y-auto border-r border-border bg-[var(--color-neutral-50)]"
          aria-label="RFP sections"
        >
          <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
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
                    setAiEditOpen(false);
                    setConfirmReopen(false);
                    setHistoryOpen(false);
                    doc.setPreviewVersion(null);
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
                    <StatusChip kind="doc" value={row.documentStatus} label={documentStatusLabel(row)} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {doc.assembled && (
            <p className="mt-auto border-t border-border px-2 py-2 text-caption text-text-muted">
              {doc.assembled.generatedApplicableCount} drafted ·{' '}
              {doc.assembled.structuralPreparedCount} automatic ·{' '}
              {doc.assembled.approvedApplicableCount} approved
              {doc.assembled.complete ? ' · all sections approved' : ''}
            </p>
          )}
        </nav>

        {/* Preview + actions */}
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {selected && doc.viewMode === 'section' && (
            <div className="shrink-0 border-b border-border px-2.5 py-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-semibold text-text-primary">
                    {selected.title}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    Info: {READINESS_LABEL[selected.readiness]} · Doc:{' '}
                    {documentStatusLabel(selected)}
                    {isPersistedSection(selected) && selected.generated
                      ? ` · v${selected.generated.version}`
                      : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {!selected.applicable && (
                    <span className="inline-flex items-center gap-1 text-caption text-text-muted">
                      <Ban className="h-3.5 w-3.5" /> Not applicable
                    </span>
                  )}

                  {canGenerate(selected) &&
                    !isPersistedSection(selected) &&
                    !isStructuralSectionId(selected.sectionId) && (
                    <ActionButton
                      disabled={doc.busy || (needsAiEngine(selected) && isModalEngineUnavailable)}
                      onClick={() => void onGenerate(false)}
                      label={
                        selected.readiness === 'DRAFTABLE_WITH_TBC'
                          ? 'Generate (with TBC)'
                          : 'Generate'
                      }
                      primary
                    />
                  )}

                  {selected.generated &&
                    selected.documentStatus === 'DRAFT' &&
                    isPersistedSection(selected) &&
                    !viewingHistorical && (
                    <>
                      <ActionButton
                        disabled={doc.busy}
                        onClick={() => void onApprove()}
                        label="Approve section"
                        icon={<Check className="h-3.5 w-3.5" />}
                        primary
                      />
                      <ActionButton
                        disabled={doc.busy || (needsAiEngine(selected) && isModalEngineUnavailable)}
                        onClick={() => void onGenerate(true)}
                        label="Regenerate"
                      />
                      <ActionButton
                        disabled={doc.busy || editing}
                        onClick={startEdit}
                        label="Edit manually"
                        icon={<Pencil className="h-3.5 w-3.5" />}
                      />
                      <ActionButton
                        disabled={
                          doc.busy ||
                          (needsAiEngine(selected) && isModalEngineUnavailable) ||
                          editing
                        }
                        onClick={openAiEdit}
                        label="Edit with Rami"
                      />
                    </>
                  )}

                  {selected.documentStatus === 'APPROVED' && !viewingHistorical && (
                    <>
                      <ActionButton
                        disabled={doc.busy || isModalEngineUnavailable}
                        onClick={() => setConfirmReopen(true)}
                        label="Reopen / Regenerate"
                      />
                      <ActionButton
                        disabled={doc.busy || isModalEngineUnavailable}
                        onClick={openAiEdit}
                        label="Edit with Rami"
                      />
                    </>
                  )}
                </div>
              </div>

              {selected.applicable && selected.readiness === 'NOT_READY' && (
                <div className="mt-2 rounded-md border border-[var(--color-warning-100)] bg-[var(--color-warning-100)]/60 px-2.5 py-2 text-caption text-[var(--color-warning-700)]">
                  <p className="mb-1 inline-flex items-center gap-1 font-medium">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    This section needs {blockers.length || 'more'}{' '}
                    {blockers.length === 1 ? 'piece' : 'pieces'} of information
                  </p>
                  {blockers.length > 0 && (
                    <ul className="list-disc pl-4">
                      {blockers.map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1 text-text-muted">
                    Answer these in the conversation to make the section ready.
                  </p>
                </div>
              )}

              {doc.draftingReferences.filter((r) => r.sectionId === selected.sectionId).length >
                0 && (
                <div className="mt-2 text-caption text-text-muted">
                  Active drafting references (do not add facts; do not auto-regenerate APPROVED
                  content):
                  {doc.draftingReferences
                    .filter((r) => r.sectionId === selected.sectionId)
                    .map((r) => (
                      <span key={r.generationReferenceId} className="ml-2 inline-flex items-center gap-1">
                        {r.historicalRfpTitle || r.chunkId.slice(0, 8)}
                        <button
                          type="button"
                          className="underline"
                          disabled={doc.busy}
                          onClick={() => void doc.revokeDraftingReference(r.generationReferenceId)}
                        >
                          Remove
                        </button>
                      </span>
                    ))}
                </div>
              )}

              {isModalEngineUnavailable && selected.applicable && needsAiEngine(selected) && (
                <p className="mt-2 text-caption text-[var(--color-warning-700)]">
                  {ENGINE_OFF_GENERATION_MSG}
                </p>
              )}
            </div>
          )}

          {confirmApprove && selected && (
            <div className="shrink-0 border-b border-border bg-[var(--color-primary-50)] px-3 py-2 text-caption text-text-secondary">
              <p className="mb-2 font-medium text-text-primary">
                Approve this section? Once approved, regeneration requires reopening the section.
                A new version is created if you later regenerate.
              </p>
              <div className="flex gap-2">
                <ActionButton
                  disabled={doc.busy}
                  onClick={() => void onApprove()}
                  label="Approve section"
                  icon={<Check className="h-3.5 w-3.5" />}
                />
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1 text-caption"
                  onClick={() => setConfirmApprove(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {confirmReopen && selected && (
            <div className="shrink-0 border-b border-[var(--color-warning-100)] bg-[var(--color-warning-100)] px-3 py-2 text-caption text-[var(--color-warning-700)]">
              <p className="mb-2 font-medium">
                This section is approved. Regenerating or editing will create a new draft
                version. Previous versions remain stored.
              </p>
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  disabled={doc.busy}
                  onClick={() => void onGenerate(true)}
                  label="Confirm regenerate"
                />
                <ActionButton
                  disabled={doc.busy}
                  onClick={() => {
                    setEditing(true);
                    setConfirmReopen(false);
                    setAiEditAfterReopen(false);
                  }}
                  label="Edit manually"
                />
                {aiEditAfterReopen ? (
                  <ActionButton
                    disabled={doc.busy || isModalEngineUnavailable}
                    onClick={() => {
                      setConfirmReopen(false);
                      setAiEditInstruction('');
                      setAiEditOpen(true);
                    }}
                    label="Continue with AI edit"
                  />
                ) : null}
                {pendingRestoreVersion != null ? (
                  <ActionButton
                    disabled={doc.busy}
                    onClick={() => void handleRestoreVersion(pendingRestoreVersion)}
                    label={`Confirm restore v${pendingRestoreVersion}`}
                  />
                ) : null}
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1 text-caption"
                  onClick={() => {
                    setConfirmReopen(false);
                    setAiEditAfterReopen(false);
                    setPendingRestoreVersion(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {aiEditOpen && selected && doc.viewMode === 'section' && (
            <div className="shrink-0 border-b border-border bg-[var(--color-primary-50)] px-3 py-2">
              <p className="mb-1 text-small font-semibold text-text-primary">Edit with Rami</p>
              <p className="mb-2 text-caption text-text-secondary">
                Describe how to revise this section. Rami will not change confirmed project
                information or resolve TBC items.
              </p>
              <textarea
                className="mb-2 min-h-[72px] w-full rounded border border-border bg-white p-2 text-small text-text-primary"
                value={aiEditInstruction}
                onChange={(e) => setAiEditInstruction(e.target.value)}
                placeholder="e.g. Make this section shorter and emphasize the business need."
                disabled={doc.busy}
              />
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  disabled={doc.busy || !aiEditInstruction.trim() || isModalEngineUnavailable}
                  onClick={() => void submitAiEdit()}
                  label="Update section"
                  primary
                />
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1 text-caption"
                  onClick={() => {
                    setAiEditOpen(false);
                    setAiEditInstruction('');
                  }}
                  disabled={doc.busy}
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

          {selected?.generated && doc.viewMode === 'section' && (
            <SectionVersionHistory
              open={historyOpen}
              onToggle={() => void toggleHistory()}
              loading={doc.historyLoading}
              versions={doc.sectionHistory}
              previewVersion={doc.previewVersion}
              onPreview={doc.setPreviewVersion}
              onRestore={(version) => void handleRestoreVersion(version)}
              busy={doc.busy}
              canRestore={!viewingHistorical && !editing && !aiEditOpen}
            />
          )}

          {editing && selected?.generated && (
            <ManualBlockEditor
              initialBlocks={selected.generated.blocks}
              disabled={doc.busy}
              saving={doc.busy}
              onSave={saveManualEdit}
              onCancel={() => setEditing(false)}
            />
          )}

          {/* A4 paper */}
          <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--color-neutral-100)] p-3">
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
                      Beneficiary: {doc.documentMeta.beneficiaryEntity}
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
                  <SectionPreview
                    row={selected}
                    historicalPreview={
                      doc.previewVersion != null
                        ? doc.sectionHistory.find((v) => v.version === doc.previewVersion)
                            ?.generated ?? null
                        : null
                    }
                    onExitHistorical={() => doc.setPreviewVersion(null)}
                  />
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
                  {aiEditOpen || doc.lastAction?.includes('ai-edit')
                    ? `Rami is updating this section… ${busyElapsed}s elapsed.`
                    : `Generating section… ${busyElapsed}s elapsed.`}{' '}
                  Existing drafts stay intact if this fails. Do not resubmit.
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
  label,
}: {
  kind: 'readiness' | 'doc';
  value: SectionInformationReadiness | DocumentStatus;
  label?: string;
}) {
  const resolved =
    label ??
    (kind === 'readiness'
      ? READINESS_LABEL[value as SectionInformationReadiness]
      : DOC_STATUS_LABEL[value as DocumentStatus]);
  const tone =
    value === 'APPROVED' || value === 'READY_TO_DRAFT'
      ? 'rfp-chip-ok'
      : value === 'DRAFT' || value === 'DRAFTABLE_WITH_TBC'
        ? 'rfp-chip-warn'
        : value === 'NOT_READY'
          ? 'rfp-chip-alert'
          : 'rfp-chip-muted';
  return <span className={`rfp-chip ${tone}`}>{resolved}</span>;
}

function ActionButton({
  label,
  onClick,
  disabled,
  icon,
  primary = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-caption font-medium disabled:opacity-50 ${
        primary
          ? 'border border-[var(--color-primary-600)] bg-[var(--color-primary-700)] text-white hover:bg-[var(--color-primary-800)]'
          : 'border border-[var(--color-primary-200)] bg-white text-[var(--color-primary-800)] hover:bg-[var(--color-primary-50)]'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function DraftingLineage({ section }: { section: GeneratedSection }) {
  const used = section.draftingReferencesUsed ?? [];
  const [open, setOpen] = useState(false);
  if (used.length === 0) return null;
  return (
    <div className="mb-3 rounded border border-dashed border-[var(--color-border)] bg-[var(--color-neutral-50)] px-3 py-2 text-caption text-text-muted">
      <button type="button" className="font-medium text-text-secondary" onClick={() => setOpen((v) => !v)}>
        Drafting references used: {used.length}
      </button>
      {open && (
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {used.map((r) => (
            <li key={r.generationReferenceId}>
              {r.historicalRfpTitle || r.historicalRfpId}
              {r.sourceLocator ? ` · ${r.sourceLocator}` : ''}
              <span className="text-text-muted"> — lineage only, not RFP citations</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SectionPreview({
  row,
  historicalPreview,
  onExitHistorical,
}: {
  row: SectionUiRow;
  historicalPreview?: GeneratedSection | null;
  onExitHistorical?: () => void;
}) {
  if (historicalPreview) {
    return (
      <section className="rfp-section-slot" data-approval="historical-preview">
        <div className="mb-3 rounded border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-3 py-2 text-caption text-[var(--color-primary-800)]">
          <p className="font-medium">
            Viewing version {historicalPreview.version} — read only
          </p>
          <button
            type="button"
            className="mt-1 rounded border border-border bg-white px-2 py-0.5"
            onClick={onExitHistorical}
          >
            Back to current version
          </button>
        </div>
        <GeneratedSectionBlocks section={historicalPreview} />
      </section>
    );
  }

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
        {row.documentStatus === 'DRAFT' && row.approvalStatus === 'DRAFT' && (
          <p className="rfp-draft-banner">Draft · version {row.generated.version}</p>
        )}
        <DraftingLineage section={row.generated} />
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
  const pending = rows.filter((row) => row.applicable && !row.generated);
  return (
    <div className="flex flex-col gap-8">
      {pending.length > 0 ? (
        <p className="rounded-md border border-border bg-surface-subtle px-3 py-2 text-caption text-text-secondary">
          {pending.length} applicable {pending.length === 1 ? 'section has' : 'sections have'} not
          been drafted yet. They are omitted from this preview until generated.
        </p>
      ) : null}
      {rows.map((row) => {
        if (!row.applicable || !row.generated) return null;
        return (
          <section key={row.sectionId} className="rfp-section-slot" id={`rfp-${row.sectionId}`}>
            {row.documentStatus === 'APPROVED' && (
              <p className="rfp-approved-banner">Approved</p>
            )}
            <DraftingLineage section={row.generated as GeneratedSection} />
            <GeneratedSectionBlocks section={row.generated as GeneratedSection} />
          </section>
        );
      })}
    </div>
  );
}
