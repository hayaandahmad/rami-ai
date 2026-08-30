/**
 * GET /api/rami/historical/proposals?documentKey=
 * List proposals for a project (PENDING survive reload).
 */
import { NextRequest, NextResponse } from 'next/server';
import { loadLocalEnv } from '@/server/db/loadEnv';
import { findProjectByDocumentKey } from '@/server/repositories/ProjectRepository';
import { listProposals } from '@/server/rami/historicalProposalRepository';
import type { HistoricalProposalStatus } from '@/types/historicalProposal';

loadLocalEnv();

export async function GET(req: NextRequest) {
  try {
    const documentKey = req.nextUrl.searchParams.get('documentKey');
    const status = req.nextUrl.searchParams.get('status') as HistoricalProposalStatus | null;
    if (!documentKey) {
      return NextResponse.json({ ok: false, error: 'documentKey required' }, { status: 400 });
    }
    const project = await findProjectByDocumentKey(documentKey);
    if (!project) {
      return NextResponse.json({ ok: false, error: 'project not found' }, { status: 404 });
    }
    const proposals = await listProposals({
      projectId: project.project_id,
      status: status ?? undefined,
    });
    return NextResponse.json({ ok: true, proposals });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'list failed' },
      { status: 500 },
    );
  }
}
