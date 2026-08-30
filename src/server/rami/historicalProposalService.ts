/**
 * Controlled REFERENCE → PROPOSED (proposal table) → BA confirm → ProjectFact.
 * Displaying/retrieving references never writes ProjectFacts.
 * PENDING proposals live only in historical_field_proposals.
 */

import type { ProjectMemory } from '@/types/projectMemory';
import type { GapStatus } from '@/types/gapStatus';
import type { InformationEntry } from '@/types/provenance';
import type { HistoricalReference } from '@/types/historicalRag';
import type { HistoricalFieldProposal } from '@/types/historicalProposal';
import {
  getProposal,
  insertProposal,
  listProposals,
  listRejectedChunkKeys,
  updateProposalDecision,
} from '@/server/rami/historicalProposalRepository';
import {
  getOrHydrateSession,
  persistRuntimeState,
} from '@/server/rami/projectPersistence';
import { findProjectByDocumentKey } from '@/server/repositories/ProjectRepository';
import { clearSessionCache } from '@/server/rami/sessionStore';
import { getSectionReadiness } from '@/server/rami/sectionReadiness';

type MemoryBag = {
  fieldId: string;
  current: InformationEntry;
  history: InformationEntry[];
  gapStatus?: GapStatus;
};

function extractProposedText(ref: HistoricalReference): string {
  const answerMatch = /Answer:\s*([\s\S]+?)(?:\nSource:|$)/i.exec(ref.chunkText);
  if (answerMatch?.[1]) return answerMatch[1].trim().slice(0, 2000);
  return ref.chunkText.slice(0, 1200).trim();
}

export async function createProposalFromReference(input: {
  documentKey: string;
  fieldId: string;
  reference: HistoricalReference;
  retrievalQuery?: string;
  retrievalDebug?: Record<string, unknown>;
}): Promise<{ proposal: HistoricalFieldProposal | null; skippedAsRejected: boolean }> {
  const project = await findProjectByDocumentKey(input.documentKey);
  if (!project) throw new Error(`Project not found: ${input.documentKey}`);

  const rejected = await listRejectedChunkKeys(project.project_id, input.fieldId);
  if (rejected.has(`${input.fieldId}::${input.reference.chunkId}`)) {
    return { proposal: null, skippedAsRejected: true };
  }

  const pending = await listProposals({
    projectId: project.project_id,
    fieldId: input.fieldId,
    status: 'PENDING',
  });
  const existing = pending.find((p) => p.sourceChunkIds.includes(input.reference.chunkId));
  if (existing) return { proposal: existing, skippedAsRejected: false };

  const text = extractProposedText(input.reference);
  const proposal = await insertProposal({
    projectId: project.project_id,
    fieldId: input.fieldId,
    proposedValue: text,
    proposedText: text,
    sourceChunkIds: [input.reference.chunkId],
    sourceReferences: [input.reference],
    retrievalMode: input.reference.retrievalMode,
    retrievalQuery: input.retrievalQuery ?? null,
    retrievalDebug: input.retrievalDebug ?? {
      score: input.reference.score,
      matchReasons: input.reference.matchReasons,
    },
  });
  return { proposal, skippedAsRejected: false };
}

export async function rejectProposal(input: {
  documentKey: string;
  proposalId: string;
}): Promise<HistoricalFieldProposal> {
  const project = await findProjectByDocumentKey(input.documentKey);
  if (!project) throw new Error(`Project not found: ${input.documentKey}`);
  const existing = await getProposal(input.proposalId);
  if (!existing || existing.projectId !== project.project_id) {
    throw new Error('Proposal not found for this project');
  }
  if (existing.status !== 'PENDING') throw new Error(`Proposal already ${existing.status}`);
  const updated = await updateProposalDecision({
    proposalId: input.proposalId,
    status: 'REJECTED',
  });
  if (!updated) throw new Error('Failed to reject proposal');
  return updated;
}

/**
 * BA accepts (optionally with modified value). Only then write ProjectFact.
 * Never writes REFERENCE into ProjectMemory.
 * History always includes a PROPOSED lineage entry before CONFIRMED.
 */
export async function acceptProposal(input: {
  documentKey: string;
  proposalId: string;
  modifiedValue?: unknown;
  confirmedBy?: string;
}): Promise<{
  proposal: HistoricalFieldProposal;
  fieldId: string;
  readinessBefore: string | null;
  readinessAfter: string | null;
}> {
  const project = await findProjectByDocumentKey(input.documentKey);
  if (!project) throw new Error(`Project not found: ${input.documentKey}`);
  const existing = await getProposal(input.proposalId);
  if (!existing || existing.projectId !== project.project_id) {
    throw new Error('Proposal not found for this project');
  }
  if (existing.status !== 'PENDING') throw new Error(`Proposal already ${existing.status}`);

  const finalValue =
    input.modifiedValue !== undefined ? input.modifiedValue : existing.proposedValue;

  const session = await getOrHydrateSession(input.documentKey, input.documentKey);
  const memory = session.memory as unknown as Record<string, MemoryBag | undefined>;
  const fieldId = existing.fieldId;
  const sectionId = existing.sourceReferences[0]?.sectionIds?.[0] ?? null;
  const readinessBefore = sectionId
    ? getSectionReadiness(session.memory, sectionId, session.projectContext).readiness
    : null;

  const sourceRef = [
    'historical-proposal',
    existing.proposalId,
    `chunks=${existing.sourceChunkIds.join(',')}`,
    `rfps=${[...new Set(existing.sourceReferences.map((r) => r.historicalRfpId))].join(',')}`,
  ].join(':');

  const now = new Date().toISOString();
  const proposedEntry: InformationEntry = {
    value: existing.proposedValue,
    status: 'PROPOSED',
    sourceType: 'historical-retrieval',
    sourceRef,
    updatedAt: now,
  };
  const confirmedEntry: InformationEntry = {
    value: finalValue,
    status: 'CONFIRMED',
    sourceType: 'historical-retrieval',
    sourceRef,
    confirmedBy: input.confirmedBy ?? 'ba',
    updatedAt: now,
  };

  const prior = memory[fieldId];
  const history: InformationEntry[] = [];
  if (prior?.current) history.push(...(prior.history ?? []), prior.current);
  history.push(proposedEntry);

  memory[fieldId] = {
    fieldId,
    current: confirmedEntry,
    history,
    gapStatus: 'KNOWN',
  };

  const updatedProposal = await updateProposalDecision({
    proposalId: input.proposalId,
    status: 'ACCEPTED',
    baModifiedValue: input.modifiedValue ?? null,
    finalValue,
  });
  if (!updatedProposal) throw new Error('Failed to accept proposal');

  await persistRuntimeState(session);
  clearSessionCache(input.documentKey);

  // Re-hydrate for readiness after persist
  const afterSession = await getOrHydrateSession(input.documentKey, input.documentKey);
  const readinessAfter = sectionId
    ? getSectionReadiness(afterSession.memory, sectionId, afterSession.projectContext)
        .readiness
    : null;

  return {
    proposal: updatedProposal,
    fieldId,
    readinessBefore,
    readinessAfter,
  };
}

export function isNonConfirmingProvenance(status: string | undefined): boolean {
  return status === 'PROPOSED' || status === 'REFERENCE';
}

/** Guard: never call applyExtractedFacts on historical reference text alone. */
export function assertHistoricalTextNotExtractedAsBa(
  sourceRef: string | undefined,
  sourceType: string | undefined,
): boolean {
  if (sourceType === 'historical-retrieval') return true;
  if (sourceRef?.startsWith('historical-proposal:')) return true;
  return false;
}
