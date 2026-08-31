'use client';

import { useState } from 'react';
import type { HistoricalFieldProposal } from '@/types/historicalProposal';
import { fieldLabel, formatValuePreview } from '@/utils/fieldDisplay';

interface Props {
  proposal: HistoricalFieldProposal;
  documentKey: string;
  onChanged?: () => void;
}

export function PendingProposalCard({ proposal, documentKey, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modified, setModified] = useState(
    typeof proposal.proposedText === 'string'
      ? proposal.proposedText
      : formatValuePreview(proposal.proposedValue, 400),
  );
  const [message, setMessage] = useState<string | null>(null);

  const source =
    proposal.sourceReferences[0]?.historicalRfpTitle ||
    'Historical RFP';

  const decide = async (decision: 'accept' | 'reject', modifiedValue?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/rami/historical/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentKey,
          proposalId: proposal.proposalId,
          decision,
          modifiedValue,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Decision failed');
      setMessage(
        decision === 'accept'
          ? 'Accepted — saved as confirmed project information.'
          : 'Rejected — not added to this project.',
      );
      onChanged?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Decision failed');
    } finally {
      setBusy(false);
      setModifyOpen(false);
    }
  };

  return (
    <article className="rounded-md border border-dashed border-[var(--color-warning-700)]/30 bg-[var(--color-warning-100)]/40 px-3 py-3">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="rounded bg-[var(--color-warning-100)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-warning-700)]">
          Suggested — awaiting confirmation
        </span>
      </div>
      <p className="text-small font-medium text-text-primary">{fieldLabel(proposal.fieldId)}</p>
      <p className="mt-1 text-caption text-text-secondary">
        {formatValuePreview(proposal.proposedText || proposal.proposedValue, 240)}
      </p>
      <p className="mt-1 text-caption text-text-muted">Source: {source} (historical reference)</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide('accept')}
          className="rounded border border-border bg-white px-2.5 py-1 text-caption font-medium text-text-primary hover:bg-surface-subtle disabled:opacity-50"
        >
          Accept
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setModifyOpen((v) => !v)}
          className="rounded border border-border bg-white px-2.5 py-1 text-caption text-text-secondary hover:bg-surface-subtle disabled:opacity-50"
        >
          Modify
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide('reject')}
          className="rounded border border-border bg-white px-2.5 py-1 text-caption text-text-muted hover:bg-surface-subtle disabled:opacity-50"
        >
          Reject
        </button>
      </div>
      {modifyOpen && (
        <div className="mt-2 space-y-2">
          <label className="block text-caption text-text-muted" htmlFor={`modify-${proposal.proposalId}`}>
            Adjusted value (becomes project information on accept)
          </label>
          <textarea
            id={`modify-${proposal.proposalId}`}
            className="w-full rounded border border-border bg-white p-2 text-caption"
            rows={3}
            value={modified}
            onChange={(e) => setModified(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || !modified.trim()}
            onClick={() => void decide('accept', modified.trim())}
            className="rounded bg-[var(--color-primary-700)] px-2.5 py-1 text-caption text-white disabled:opacity-50"
          >
            Accept modified value
          </button>
        </div>
      )}
      {message && <p className="mt-2 text-caption text-text-muted">{message}</p>}
    </article>
  );
}
