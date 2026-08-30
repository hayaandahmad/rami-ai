/**
 * POST /api/rami/historical/decide
 * Accept / reject / modify+accept a PENDING proposal.
 * Only ACCEPT writes ProjectFacts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { loadLocalEnv } from '@/server/db/loadEnv';
import {
  acceptProposal,
  rejectProposal,
} from '@/server/rami/historicalProposalService';

loadLocalEnv();

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      documentKey?: string;
      proposalId?: string;
      decision?: 'accept' | 'reject';
      modifiedValue?: unknown;
    };
    if (!body.documentKey || !body.proposalId || !body.decision) {
      return NextResponse.json(
        { ok: false, error: 'documentKey, proposalId, decision required' },
        { status: 400 },
      );
    }
    if (body.decision === 'reject') {
      const proposal = await rejectProposal({
        documentKey: body.documentKey,
        proposalId: body.proposalId,
      });
      return NextResponse.json({ ok: true, proposal, projectFactWritten: false });
    }
    const result = await acceptProposal({
      documentKey: body.documentKey,
      proposalId: body.proposalId,
      modifiedValue: body.modifiedValue,
      confirmedBy: 'ba',
    });
    return NextResponse.json({
      ok: true,
      proposal: result.proposal,
      fieldId: result.fieldId,
      projectFactWritten: true,
      readinessBefore: result.readinessBefore,
      readinessAfter: result.readinessAfter,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'decide failed' },
      { status: 500 },
    );
  }
}
