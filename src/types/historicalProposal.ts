/**
 * Controlled historical suggestion types.
 * PENDING proposals are NOT ProjectFacts.
 */

import type { HistoricalReference, RetrievalMode } from './historicalRag';

export type HistoricalProposalStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface HistoricalFieldProposal {
  proposalId: string;
  projectId: string;
  fieldId: string;
  proposedValue: unknown;
  proposedText: string;
  status: HistoricalProposalStatus;
  sourceChunkIds: string[];
  sourceReferences: HistoricalReference[];
  retrievalMode: RetrievalMode | null;
  retrievalQuery: string | null;
  retrievalDebug: Record<string, unknown>;
  baModifiedValue: unknown | null;
  finalValue: unknown | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** UI/API-facing card for a historical reference (never current project truth). */
export interface SurfacedHistoricalReference {
  chunkId: string;
  label: 'HISTORICAL_REFERENCE';
  provenanceClass: 'REFERENCE';
  historicalRfpId: string;
  historicalRfpTitle?: string;
  excerpt: string;
  mappedFieldIds: string[];
  sectionIds: string[];
  canonicalQuestionIds: string[];
  sourceLocators: string[];
  excelRelPath: string;
  pdfAvailable: boolean;
  score: number;
  retrievalMode: RetrievalMode;
  matchReasons: string[];
}

export function toSurfacedReference(r: HistoricalReference): SurfacedHistoricalReference {
  return {
    chunkId: r.chunkId,
    label: 'HISTORICAL_REFERENCE',
    provenanceClass: 'REFERENCE',
    historicalRfpId: r.historicalRfpId,
    historicalRfpTitle: r.historicalRfpTitle,
    excerpt: r.chunkText.slice(0, 900),
    mappedFieldIds: r.mappedFieldIds,
    sectionIds: r.sectionIds,
    canonicalQuestionIds: r.canonicalQuestionIds,
    sourceLocators: r.sourceLocators,
    excelRelPath: r.excelRelPath,
    pdfAvailable: r.pdfAvailable,
    score: r.score,
    retrievalMode: r.retrievalMode,
    matchReasons: r.matchReasons,
  };
}
