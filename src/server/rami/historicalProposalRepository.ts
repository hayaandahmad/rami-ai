/**
 * Persistence for historical_field_proposals.
 * PENDING never writes project_facts.
 */

import { createHash, randomUUID } from 'crypto';
import { query } from '@/server/db/connection';
import type { HistoricalReference, RetrievalMode } from '@/types/historicalRag';
import type {
  HistoricalFieldProposal,
  HistoricalProposalStatus,
} from '@/types/historicalProposal';

interface ProposalRow {
  proposal_id: string;
  project_id: string;
  field_id: string;
  proposed_value_json: unknown;
  proposed_text: string;
  status: HistoricalProposalStatus;
  source_chunk_ids: string[];
  source_references_json: unknown;
  retrieval_mode: string | null;
  retrieval_query: string | null;
  retrieval_debug_json: unknown;
  ba_modified_value_json: unknown | null;
  final_value_json: unknown | null;
  decided_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(r: ProposalRow): HistoricalFieldProposal {
  return {
    proposalId: r.proposal_id,
    projectId: r.project_id,
    fieldId: r.field_id,
    proposedValue: r.proposed_value_json,
    proposedText: r.proposed_text,
    status: r.status,
    sourceChunkIds: r.source_chunk_ids ?? [],
    sourceReferences: (r.source_references_json as HistoricalReference[]) ?? [],
    retrievalMode: (r.retrieval_mode as RetrievalMode) ?? null,
    retrievalQuery: r.retrieval_query,
    retrievalDebug: (r.retrieval_debug_json as Record<string, unknown>) ?? {},
    baModifiedValue: r.ba_modified_value_json,
    finalValue: r.final_value_json,
    decidedAt: r.decided_at ? r.decided_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function insertProposal(input: {
  projectId: string;
  fieldId: string;
  proposedValue: unknown;
  proposedText: string;
  sourceChunkIds: string[];
  sourceReferences: HistoricalReference[];
  retrievalMode?: RetrievalMode | null;
  retrievalQuery?: string | null;
  retrievalDebug?: Record<string, unknown>;
}): Promise<HistoricalFieldProposal> {
  const proposalId = `prop-${createHash('sha256')
    .update(`${input.projectId}|${input.fieldId}|${input.sourceChunkIds.join(',')}|${Date.now()}|${randomUUID()}`)
    .digest('hex')
    .slice(0, 24)}`;

  const r = await query<ProposalRow>(
    `INSERT INTO historical_field_proposals (
      proposal_id, project_id, field_id, proposed_value_json, proposed_text, status,
      source_chunk_ids, source_references_json, retrieval_mode, retrieval_query,
      retrieval_debug_json, created_at, updated_at
    ) VALUES (
      $1,$2,$3,$4::jsonb,$5,'PENDING',$6,$7::jsonb,$8,$9,$10::jsonb,NOW(),NOW()
    ) RETURNING *`,
    [
      proposalId,
      input.projectId,
      input.fieldId,
      JSON.stringify(input.proposedValue),
      input.proposedText,
      input.sourceChunkIds,
      JSON.stringify(input.sourceReferences),
      input.retrievalMode ?? null,
      input.retrievalQuery ?? null,
      JSON.stringify(input.retrievalDebug ?? {}),
    ],
  );
  return mapRow(r.rows[0]);
}

export async function getProposal(proposalId: string): Promise<HistoricalFieldProposal | null> {
  const r = await query<ProposalRow>(
    `SELECT * FROM historical_field_proposals WHERE proposal_id = $1`,
    [proposalId],
  );
  return r.rows[0] ? mapRow(r.rows[0]) : null;
}

export async function listProposals(opts: {
  projectId: string;
  status?: HistoricalProposalStatus;
  fieldId?: string;
}): Promise<HistoricalFieldProposal[]> {
  const clauses = ['project_id = $1'];
  const params: unknown[] = [opts.projectId];
  if (opts.status) {
    params.push(opts.status);
    clauses.push(`status = $${params.length}`);
  }
  if (opts.fieldId) {
    params.push(opts.fieldId);
    clauses.push(`field_id = $${params.length}`);
  }
  const r = await query<ProposalRow>(
    `SELECT * FROM historical_field_proposals WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`,
    params,
  );
  return r.rows.map(mapRow);
}

export async function updateProposalDecision(input: {
  proposalId: string;
  status: 'ACCEPTED' | 'REJECTED';
  baModifiedValue?: unknown | null;
  finalValue?: unknown | null;
}): Promise<HistoricalFieldProposal | null> {
  const r = await query<ProposalRow>(
    `UPDATE historical_field_proposals SET
      status = $2,
      ba_modified_value_json = COALESCE($3::jsonb, ba_modified_value_json),
      final_value_json = COALESCE($4::jsonb, final_value_json),
      decided_at = NOW(),
      updated_at = NOW()
    WHERE proposal_id = $1 AND status = 'PENDING'
    RETURNING *`,
    [
      input.proposalId,
      input.status,
      input.baModifiedValue !== undefined ? JSON.stringify(input.baModifiedValue) : null,
      input.finalValue !== undefined ? JSON.stringify(input.finalValue) : null,
    ],
  );
  return r.rows[0] ? mapRow(r.rows[0]) : null;
}

/** Recently rejected chunk+field pairs — avoid re-proposing immediately. */
export async function listRejectedChunkKeys(
  projectId: string,
  fieldId: string,
): Promise<Set<string>> {
  const r = await query<{ source_chunk_ids: string[] }>(
    `SELECT source_chunk_ids FROM historical_field_proposals
     WHERE project_id = $1 AND field_id = $2 AND status = 'REJECTED'
     ORDER BY decided_at DESC NULLS LAST
     LIMIT 20`,
    [projectId, fieldId],
  );
  const set = new Set<string>();
  for (const row of r.rows) {
    for (const id of row.source_chunk_ids ?? []) set.add(`${fieldId}::${id}`);
  }
  return set;
}
