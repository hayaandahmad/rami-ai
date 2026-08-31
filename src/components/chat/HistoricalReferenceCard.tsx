/**
 * HistoricalReferenceCard — visibly distinct from normal Rami statements.
 * REFERENCE only — not project truth. Actions: Use as suggestion / Dismiss / View source.
 */

'use client';

import { useState } from 'react';
import type { SurfacedHistoricalReference } from '@/types/historicalProposal';
import type { HistoricalReference } from '@/types/historicalRag';
import { RFP_SECTIONS } from '@/schema/rfpSchema';
import { fieldLabel } from '@/utils/fieldDisplay';

interface Props {
  reference: SurfacedHistoricalReference;
  documentKey: string;
  defaultFieldId?: string;
  onProposed?: (proposalId: string) => void;
  onDismiss?: (chunkId: string) => void;
}

function toFullReference(s: SurfacedHistoricalReference): HistoricalReference {
  return {
    chunkId: s.chunkId,
    score: s.score,
    retrievalMode: s.retrievalMode,
    matchReasons: s.matchReasons,
    chunkType: 'QUESTION_ANSWER',
    chunkText: s.excerpt,
    historicalRfpId: s.historicalRfpId,
    historicalRfpTitle: s.historicalRfpTitle,
    excelRelPath: s.excelRelPath,
    pdfAvailable: s.pdfAvailable,
    sourceSheet: null,
    sourceRows: [],
    sourceQuestionIds: s.canonicalQuestionIds,
    canonicalQuestionIds: s.canonicalQuestionIds,
    mappedFieldIds: s.mappedFieldIds,
    sectionIds: s.sectionIds,
    sourceLocators: s.sourceLocators,
    extractionStatuses: [],
    provenanceClass: 'REFERENCE',
    topicKey: null,
    structuralMatch: s.matchReasons.some((m) => m.includes('filter')),
    vectorScore: null,
  };
}

export function HistoricalReferenceCard({
  reference,
  documentKey,
  defaultFieldId,
  onProposed,
  onDismiss,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceDetail, setSourceDetail] = useState<Record<string, unknown> | null>(null);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifiedText, setModifiedText] = useState(reference.excerpt.slice(0, 400));
  const [proposalId, setProposalId] = useState<string | null>(null);
  const mappedSections = RFP_SECTIONS.filter((s) => reference.sectionIds.includes(s.sectionId));
  const sectionChoices = mappedSections.length > 0 ? mappedSections : RFP_SECTIONS.filter((s) =>
    ['deliverables', 'scopeOfWork', 'background', 'acceptanceCriteria', 'projectManagementGovernance'].includes(
      s.sectionId,
    ),
  );
  const [draftSectionId, setDraftSectionId] = useState<string>(
    sectionChoices[0]?.sectionId ?? 'deliverables',
  );

  const fieldId =
    defaultFieldId ||
    reference.mappedFieldIds[0] ||
    'deliverableItems';

  const propose = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/rami/historical/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentKey,
          fieldId,
          reference: toFullReference(reference),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Propose failed');
      if (data.skippedAsRejected) {
        setMessage('Previously rejected — not re-proposed.');
        return;
      }
      setProposalId(data.proposal.proposalId);
      setMessage('Saved as a suggestion — confirm it before it becomes project information.');
      onProposed?.(data.proposal.proposalId);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Propose failed');
    } finally {
      setBusy(false);
    }
  };

  const decide = async (decision: 'accept' | 'reject', modified?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      let id = proposalId;
      if (!id) {
        const res = await fetch('/api/rami/historical/propose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentKey,
            fieldId,
            reference: toFullReference(reference),
          }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Propose failed');
        if (data.skippedAsRejected) {
          setMessage('Previously rejected — not re-proposed.');
          return;
        }
        id = data.proposal.proposalId as string;
        setProposalId(id);
        onProposed?.(id);
      }
      const res = await fetch('/api/rami/historical/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentKey,
          proposalId: id,
          decision,
          modifiedValue: modified !== undefined ? modified : undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Decision failed');
      setMessage(
        decision === 'accept'
          ? 'Accepted — saved as confirmed project information.'
          : 'Rejected — no project information created.',
      );
      if (decision === 'reject') onDismiss?.(reference.chunkId);
      onProposed?.(id!);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Decision failed');
    } finally {
      setBusy(false);
      setModifyOpen(false);
    }
  };

  const approveDrafting = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/rami/historical/generation-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentKey,
          sectionId: draftSectionId,
          chunkId: reference.chunkId,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Drafting reference failed');
      setMessage(
        `Drafting reference saved for ${sectionChoices.find((s) => s.sectionId === draftSectionId)?.title ?? 'the selected section'}. This does not add project facts.`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Drafting reference failed');
    } finally {
      setBusy(false);
    }
  };

  const viewSource = async () => {
    setSourceOpen(true);
    try {
      const res = await fetch(
        `/api/rami/historical/source?chunkId=${encodeURIComponent(reference.chunkId)}`,
      );
      const data = await res.json();
      if (data.ok) setSourceDetail(data.source);
    } catch {
      setSourceDetail({ error: 'Could not load source' });
    }
  };

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted,#f7f6f4)] px-3 py-3 text-sm">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Historical reference
        </span>
        <span className="rounded bg-[var(--color-warning-100,#f5e6c8)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-warning-800,#7a5b12)]">
          REFERENCE — not this project
        </span>
      </div>
      <p className="mb-1 text-caption text-text-muted">
        Source:{' '}
        <span className="font-medium text-text-primary">
          {reference.historicalRfpTitle || reference.historicalRfpId}
        </span>
      </p>
      {(reference.mappedFieldIds.length > 0 || mappedSections.length > 0) && (
        <p className="mb-2 text-caption text-text-muted">
          Relevant to:{' '}
          {[
            ...reference.mappedFieldIds.map(fieldLabel),
            ...mappedSections.map((s) => s.title),
          ]
            .slice(0, 6)
            .join(' · ')}
        </p>
      )}
      <p className="mb-3 whitespace-pre-wrap text-body text-text-primary leading-relaxed">
        {reference.excerpt.slice(0, 500)}
        {reference.excerpt.length > 500 ? '…' : ''}
      </p>
      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            Project information
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void propose()}
              className="rounded border border-[var(--color-border)] bg-white px-2.5 py-1 text-caption hover:bg-[var(--color-surface)]"
            >
              Use as suggestion
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setModifyOpen((v) => !v)}
              className="rounded border border-[var(--color-border)] bg-white px-2.5 py-1 text-caption hover:bg-[var(--color-surface)]"
            >
              Modify &amp; accept
            </button>
            <button
              type="button"
              disabled={busy || !proposalId}
              onClick={() => void decide('accept')}
              className="rounded border border-[var(--color-border)] bg-white px-2.5 py-1 text-caption hover:bg-[var(--color-surface)]"
            >
              Accept
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void decide('reject')}
              className="rounded border border-[var(--color-border)] bg-white px-2.5 py-1 text-caption text-text-muted hover:bg-[var(--color-surface)]"
            >
              Dismiss
            </button>
          </div>
          <p className="mt-1 text-[10px] text-text-muted">
            Becomes current project information only after you accept.
          </p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            Drafting help
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1 text-caption text-text-muted">
              Section
              <select
                className="rounded border border-[var(--color-border)] bg-white px-1 py-0.5 text-caption text-text-primary"
                value={draftSectionId}
                onChange={(e) => setDraftSectionId(e.target.value)}
                disabled={busy}
              >
                {sectionChoices.map((s) => (
                  <option key={s.sectionId} value={s.sectionId}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void approveDrafting()}
              className="rounded border border-[var(--color-border)] bg-white px-2.5 py-1 text-caption hover:bg-[var(--color-surface)]"
            >
              Use as drafting reference
            </button>
          </div>
          <p className="mt-1 text-[10px] text-text-muted">
            Guides wording for the selected section only. Does not add project facts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void viewSource()}
          className="self-start rounded border border-transparent px-2.5 py-1 text-caption text-[var(--color-primary-700)] underline-offset-2 hover:underline"
        >
          View source
        </button>
      </div>
      {modifyOpen && (
        <div className="mt-3 space-y-2">
          <label className="block text-caption text-text-muted">
            BA-modified value (becomes ProjectFact on accept)
          </label>
          <textarea
            className="w-full rounded border border-[var(--color-border)] bg-white p-2 text-caption"
            rows={3}
            value={modifiedText}
            onChange={(e) => setModifiedText(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || !modifiedText.trim()}
            onClick={() => void decide('accept', modifiedText.trim())}
            className="rounded bg-[var(--color-primary-700)] px-2.5 py-1 text-caption text-white"
          >
            Confirm modified value
          </button>
        </div>
      )}
      {message && <p className="mt-2 text-caption text-text-muted">{message}</p>}
      {sourceOpen && sourceDetail && (
        <div className="mt-3 rounded border border-[var(--color-border)] bg-white p-2 text-caption text-text-muted">
          <p className="font-medium text-text-primary">Source details</p>
          <p>RFP: {String(sourceDetail.title ?? '')}</p>
          <p>Workbook: {String(sourceDetail.excelRelPath ?? '')}</p>
          <p>Questions: {JSON.stringify(sourceDetail.canonicalQuestionIds ?? [])}</p>
          <p>Locators: {JSON.stringify(sourceDetail.sourceLocators ?? [])}</p>
          <p>
            PDF page provenance:{' '}
            {sourceDetail.pageProvenanceAvailable ? 'available' : 'not available (Excel-only or no page)'}
          </p>
        </div>
      )}
    </div>
  );
}
