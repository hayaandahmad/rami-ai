/**
 * POST /api/rami/historical/propose
 * Create a PENDING proposal from a HistoricalReference. Does not write ProjectFacts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { loadLocalEnv } from '@/server/db/loadEnv';
import { createProposalFromReference } from '@/server/rami/historicalProposalService';
import type { HistoricalReference } from '@/types/historicalRag';

loadLocalEnv();

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      documentKey?: string;
      fieldId?: string;
      reference?: HistoricalReference;
      retrievalQuery?: string;
    };
    if (!body.documentKey || !body.fieldId || !body.reference?.chunkId) {
      return NextResponse.json(
        { ok: false, error: 'documentKey, fieldId, and reference required' },
        { status: 400 },
      );
    }
    const result = await createProposalFromReference({
      documentKey: body.documentKey,
      fieldId: body.fieldId,
      reference: body.reference,
      retrievalQuery: body.retrievalQuery,
    });
    if (result.skippedAsRejected) {
      return NextResponse.json({
        ok: true,
        skippedAsRejected: true,
        message: 'This historical suggestion was previously rejected for this field.',
      });
    }
    return NextResponse.json({ ok: true, proposal: result.proposal, skippedAsRejected: false });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'propose failed' },
      { status: 500 },
    );
  }
}
