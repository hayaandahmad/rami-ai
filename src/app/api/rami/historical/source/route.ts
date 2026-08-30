/**
 * GET /api/rami/historical/source?chunkId=
 * Source view for a historical knowledge chunk.
 */
import { NextRequest, NextResponse } from 'next/server';
import { loadLocalEnv } from '@/server/db/loadEnv';
import { getChunkById } from '@/server/rami/historicalChunkRepository';
import { getHistoricalDocument } from '@/server/rami/historicalRepository';

loadLocalEnv();

export async function GET(req: NextRequest) {
  try {
    const chunkId = req.nextUrl.searchParams.get('chunkId');
    if (!chunkId) {
      return NextResponse.json({ ok: false, error: 'chunkId required' }, { status: 400 });
    }
    const chunk = await getChunkById(chunkId);
    if (!chunk) {
      return NextResponse.json({ ok: false, error: 'chunk not found' }, { status: 404 });
    }
    const doc = await getHistoricalDocument(chunk.historicalRfpId);
    return NextResponse.json({
      ok: true,
      source: {
        label: 'HISTORICAL_REFERENCE',
        provenanceClass: 'REFERENCE',
        historicalRfpId: chunk.historicalRfpId,
        title: doc?.title ?? chunk.historicalRfpId,
        excelRelPath: chunk.excelRelPath,
        pdfAvailable: chunk.pdfAvailable,
        pdfRelPath: doc?.pdfRelPath ?? null,
        sourceSheet: chunk.sourceSheet,
        sourceRows: chunk.sourceRows,
        sourceQuestionIds: chunk.sourceQuestionIds,
        canonicalQuestionIds: chunk.canonicalQuestionIds,
        mappedFieldIds: chunk.mappedFieldIds,
        sectionIds: chunk.sectionIds,
        sourceLocators: chunk.sourceLocators,
        pageProvenanceAvailable: Boolean(
          chunk.pdfAvailable && chunk.sourceLocators.some((l) => /p(p)?\.\s*\d/i.test(l)),
        ),
        chunkType: chunk.chunkType,
        chunkText: chunk.chunkText,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'source failed' },
      { status: 500 },
    );
  }
}
