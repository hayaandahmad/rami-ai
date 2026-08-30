/**
 * BA-approved drafting references for a Section.
 * Does NOT write ProjectFacts. Does NOT run retrieval.
 */
import { NextRequest, NextResponse } from 'next/server';
import { loadLocalEnv } from '@/server/db/loadEnv';
import {
  approveDraftingReference,
  GenerationReferenceError,
  listDraftingReferences,
  revokeDraftingReference,
} from '@/server/rami/generationReferenceService';

loadLocalEnv();

function errorResponse(e: unknown) {
  if (e instanceof GenerationReferenceError) {
    const status =
      e.code === 'PROJECT_NOT_FOUND' || e.code === 'NOT_FOUND' || e.code === 'CHUNK_NOT_FOUND'
        ? 404
        : e.code === 'LIMIT_EXCEEDED'
          ? 409
          : 400;
    return NextResponse.json({ ok: false, code: e.code, error: e.message }, { status });
  }
  return NextResponse.json(
    { ok: false, error: e instanceof Error ? e.message : 'generation-reference failed' },
    { status: 500 },
  );
}

/** GET ?documentKey=&sectionId=&status= */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const documentKey = url.searchParams.get('documentKey')?.trim();
    const sectionId = url.searchParams.get('sectionId')?.trim() || undefined;
    const status = url.searchParams.get('status')?.trim() as 'ACTIVE' | 'REVOKED' | undefined;
    if (!documentKey) {
      return NextResponse.json({ ok: false, error: 'documentKey required' }, { status: 400 });
    }
    const refs = await listDraftingReferences({
      documentKey,
      sectionId,
      status: status === 'REVOKED' || status === 'ACTIVE' ? status : 'ACTIVE',
    });
    return NextResponse.json({
      ok: true,
      documentKey,
      sectionId: sectionId ?? null,
      references: refs,
      note: 'Drafting references are not ProjectFacts.',
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST { documentKey, sectionId, chunkId } — approve as drafting reference. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      documentKey?: string;
      sectionId?: string;
      chunkId?: string;
    };
    if (!body.documentKey || !body.sectionId || !body.chunkId) {
      return NextResponse.json(
        { ok: false, error: 'documentKey, sectionId, and chunkId required' },
        { status: 400 },
      );
    }
    const row = await approveDraftingReference({
      documentKey: body.documentKey,
      sectionId: body.sectionId,
      chunkId: body.chunkId,
      approvedBy: 'ba',
    });
    return NextResponse.json({
      ok: true,
      reference: row,
      createsProjectFact: false,
      message:
        'Approved as a drafting reference for this section only. Project-specific values were not copied.',
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/** DELETE { documentKey, generationReferenceId } — revoke. Does not delete ProjectFacts. */
export async function DELETE(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      documentKey?: string;
      generationReferenceId?: string;
    };
    if (!body.documentKey || !body.generationReferenceId) {
      return NextResponse.json(
        { ok: false, error: 'documentKey and generationReferenceId required' },
        { status: 400 },
      );
    }
    const row = await revokeDraftingReference({
      documentKey: body.documentKey,
      generationReferenceId: body.generationReferenceId,
    });
    return NextResponse.json({
      ok: true,
      reference: row,
      removesProjectFact: false,
      message: 'Drafting reference revoked. Existing ProjectFacts were not changed.',
    });
  } catch (e) {
    return errorResponse(e);
  }
}
