/**
 * Client hook for RFP document experience — consumes generation APIs only.
 * PostgreSQL remains source of truth; no client-side content invention.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AssembledRfp,
  AssembledRfpSectionSlot,
  GeneratedBlock,
  GeneratedSection,
  SectionApprovalStatus,
} from '@/types/generatedSection';
import type { SectionInformationReadiness, SectionReadinessResult } from '@/types/sectionReadiness';
import type { SectionVersionSummary } from '@/types/generatedSection';

export type DocumentStatus = 'NOT_GENERATED' | 'DRAFT' | 'APPROVED' | 'NOT_APPLICABLE';

export interface DraftingReferenceRow {
  generationReferenceId: string;
  sectionId: string;
  chunkId: string;
  status: string;
  historicalRfpTitle: string | null;
  sourceLocator: string | null;
}

export interface DocumentMeta {
  documentTitle?: string;
  beneficiaryEntity?: string;
  documentType?: string;
  engagementType?: string;
  engagementDuration?: string;
}

export interface SectionUiRow extends AssembledRfpSectionSlot {
  readinessDetail?: SectionReadinessResult;
  documentStatus: DocumentStatus;
}

function deriveDocumentStatus(slot: AssembledRfpSectionSlot): DocumentStatus {
  if (!slot.applicable) return 'NOT_APPLICABLE';
  if (slot.approvalStatus === 'APPROVED') return 'APPROVED';
  if (slot.generated) return 'DRAFT';
  return 'NOT_GENERATED';
}

export interface AssembledProgressSummary {
  approvedApplicableCount: number;
  generatedApplicableCount: number;
  structuralPreparedCount: number;
  applicableSectionCount: number;
  complete: boolean;
  documentTitle?: string;
  documentType?: string;
  sectionDocumentStatus: Record<string, DocumentStatus>;
}

function rfpUiStorageKey(documentKey: string, part: 'section' | 'view') {
  return `rami-rfp-ui-v1:${documentKey}:${part}`;
}

function readStoredView(documentKey: string): 'section' | 'full' | null {
  try {
    const value = sessionStorage.getItem(rfpUiStorageKey(documentKey, 'view'));
    return value === 'full' || value === 'section' ? value : null;
  } catch {
    return null;
  }
}

function readStoredSection(documentKey: string): string | null {
  try {
    return sessionStorage.getItem(rfpUiStorageKey(documentKey, 'section'));
  } catch {
    return null;
  }
}

export function useRfpDocument(documentKey: string | undefined) {
  const [assembled, setAssembled] = useState<AssembledRfp | null>(null);
  const [readiness, setReadiness] = useState<SectionReadinessResult[]>([]);
  const [documentMeta, setDocumentMeta] = useState<DocumentMeta>({});
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'section' | 'full'>('section');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [draftingReferences, setDraftingReferences] = useState<DraftingReferenceRow[]>([]);
  const [sectionHistory, setSectionHistory] = useState<SectionVersionSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!documentKey) return null;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/rami/generation/document?documentKey=${encodeURIComponent(documentKey)}`,
      );
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to load document');
      }
      setAssembled(data.assembled as AssembledRfp);
      setReadiness((data.readiness as SectionReadinessResult[]) ?? []);
      setDocumentMeta((data.documentMeta as DocumentMeta) ?? {});
      setDraftingReferences((data.draftingReferences as DraftingReferenceRow[]) ?? []);
      return data.assembled as AssembledRfp;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, [documentKey]);

  useEffect(() => {
    if (!documentKey) return;
    const storedView = readStoredView(documentKey);
    if (storedView) setViewMode(storedView);
  }, [documentKey]);

  useEffect(() => {
    void refresh().then((asm) => {
      if (!asm) return;
      setSelectedSectionId((prev) => {
        const stored = documentKey ? readStoredSection(documentKey) : null;
        if (stored && asm.sections.some((s) => s.sectionId === stored)) return stored;
        if (prev && asm.sections.some((s) => s.sectionId === prev)) return prev;
        const firstGenerated = asm.sections.find((s) => s.applicable && s.generated);
        const firstApplicable = asm.sections.find((s) => s.applicable);
        return firstGenerated?.sectionId ?? firstApplicable?.sectionId ?? null;
      });
    });
  }, [refresh, documentKey]);

  useEffect(() => {
    if (!documentKey || !selectedSectionId) return;
    try {
      sessionStorage.setItem(rfpUiStorageKey(documentKey, 'section'), selectedSectionId);
    } catch {
      /* ignore */
    }
  }, [documentKey, selectedSectionId]);

  useEffect(() => {
    if (!documentKey) return;
    try {
      sessionStorage.setItem(rfpUiStorageKey(documentKey, 'view'), viewMode);
    } catch {
      /* ignore */
    }
  }, [documentKey, viewMode]);

  const readinessById = useMemo(() => {
    const m = new Map<string, SectionReadinessResult>();
    for (const r of readiness) m.set(r.sectionId, r);
    return m;
  }, [readiness]);

  const rows: SectionUiRow[] = useMemo(() => {
    if (!assembled) return [];
    return assembled.sections.map((slot) => ({
      ...slot,
      readinessDetail: readinessById.get(slot.sectionId),
      documentStatus: deriveDocumentStatus(slot),
    }));
  }, [assembled, readinessById]);

  const selected = rows.find((r) => r.sectionId === selectedSectionId) ?? null;

  const postJson = useCallback(
    async (url: string, body: Record<string, unknown>) => {
      if (!documentKey) throw new Error('No documentKey');
      setBusy(true);
      setError(null);
      setLastAction(null);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentKey, ...body }),
        });
        const data = await res.json();
        if (!data.ok) {
          const detail =
            data.details && typeof data.details === 'object'
              ? ` (${data.code ?? 'error'})`
              : '';
          throw new Error(`${data.error || 'Request failed'}${detail}`);
        }
        await refresh();
        setLastAction(url);
        return data;
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        const friendly =
          /abort|timeout|failed to fetch|networkerror/i.test(raw)
            ? `Generation timed out or the connection dropped. Existing persisted draft was not overwritten. (${raw})`
            : raw;
        setError(friendly);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [documentKey, refresh],
  );

  const generate = useCallback(
    async (sectionId: string, opts?: { regenerate?: boolean; reopenApproved?: boolean }) => {
      return postJson('/api/rami/generation/section', {
        sectionId,
        regenerate: Boolean(opts?.regenerate),
        reopenApproved: Boolean(opts?.reopenApproved),
      });
    },
    [postJson],
  );

  const approve = useCallback(
    async (sectionId: string) => {
      return postJson('/api/rami/generation/approve', { sectionId });
    },
    [postJson],
  );

  const saveEdit = useCallback(
    async (
      sectionId: string,
      blocks: GeneratedBlock[],
      opts?: { reopenApproved?: boolean; versionLabel?: string },
    ) => {
      return postJson('/api/rami/generation/edit', {
        sectionId,
        blocks,
        reopenApproved: Boolean(opts?.reopenApproved),
        versionLabel: opts?.versionLabel,
      });
    },
    [postJson],
  );

  const fetchSectionHistory = useCallback(
    async (sectionId: string) => {
      if (!documentKey) return [];
      setHistoryLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/rami/generation/section/history?documentKey=${encodeURIComponent(documentKey)}&sectionId=${encodeURIComponent(sectionId)}`,
        );
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Failed to load version history');
        const versions = (data.versions as SectionVersionSummary[]) ?? [];
        setSectionHistory(versions);
        return versions;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setSectionHistory([]);
        return [];
      } finally {
        setHistoryLoading(false);
      }
    },
    [documentKey],
  );

  const restoreSectionVersion = useCallback(
    async (
      sectionId: string,
      sourceVersion: number,
      opts?: { reopenApproved?: boolean },
    ) => {
      const versions =
        sectionHistory.length > 0
          ? sectionHistory
          : await fetchSectionHistory(sectionId);
      const source = versions.find((v) => v.version === sourceVersion);
      if (!source) {
        throw new Error(`Version ${sourceVersion} not found.`);
      }
      await saveEdit(sectionId, source.generated.blocks, {
        reopenApproved: opts?.reopenApproved,
        versionLabel: `restored-from-v${sourceVersion}`,
      });
      setPreviewVersion(null);
      await fetchSectionHistory(sectionId);
    },
    [sectionHistory, fetchSectionHistory, saveEdit],
  );

  useEffect(() => {
    setPreviewVersion(null);
    setSectionHistory([]);
  }, [selectedSectionId]);

  const aiEdit = useCallback(
    async (
      sectionId: string,
      editInstruction: string,
      opts?: { reopenApproved?: boolean },
    ) => {
      return postJson('/api/rami/generation/ai-edit', {
        sectionId,
        editInstruction,
        reopenApproved: Boolean(opts?.reopenApproved),
      });
    },
    [postJson],
  );

  const revokeDraftingReference = useCallback(
    async (generationReferenceId: string) => {
      if (!documentKey) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch('/api/rami/historical/generation-reference', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentKey, generationReferenceId }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Revoke failed');
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [documentKey, refresh],
  );

  const hasGeneratedContent = Boolean(
    assembled && assembled.generatedApplicableCount > 0,
  );
  const hasPreparedStructural = Boolean(
    assembled && assembled.structuralPreparedCount > 0,
  );

  const progressSummary = useMemo(() => {
    if (!assembled) return null;
    const sectionDocumentStatus: Record<
      string,
      'APPROVED' | 'DRAFT' | 'NOT_GENERATED' | 'NOT_APPLICABLE'
    > = {};
    for (const slot of assembled.sections) {
      sectionDocumentStatus[slot.sectionId] = deriveDocumentStatus(slot);
    }
    return {
      approvedApplicableCount: assembled.approvedApplicableCount,
      generatedApplicableCount: assembled.generatedApplicableCount,
      structuralPreparedCount: assembled.structuralPreparedCount,
      applicableSectionCount: assembled.applicableSectionCount,
      complete: assembled.complete,
      documentTitle: documentMeta.documentTitle,
      documentType: documentMeta.documentType,
      sectionDocumentStatus,
    };
  }, [assembled, documentMeta.documentTitle, documentMeta.documentType]);

  return {
    assembled,
    documentMeta,
    rows,
    selected,
    selectedSectionId,
    setSelectedSectionId,
    viewMode,
    setViewMode,
    loading,
    busy,
    error,
    setError,
    lastAction,
    refresh,
    generate,
    approve,
    saveEdit,
    aiEdit,
    draftingReferences,
    revokeDraftingReference,
    hasGeneratedContent,
    hasPreparedStructural,
    progressSummary,
    sectionHistory,
    historyLoading,
    previewVersion,
    setPreviewVersion,
    fetchSectionHistory,
    restoreSectionVersion,
    readinessLabel: (r?: SectionInformationReadiness) => r ?? 'NOT_APPLICABLE',
    approvalLabel: (a?: SectionApprovalStatus | null) => a ?? null,
    currentGenerated: selected?.generated as GeneratedSection | null,
  };
}
