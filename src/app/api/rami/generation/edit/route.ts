import { editRfpSection } from '@/server/rami/sectionGeneration';
import { PersistenceError } from '@/server/rami/projectPersistence';
import { GenerationError, type GeneratedBlock } from '@/types/generatedSection';

export const runtime = 'nodejs';

function errorResponse(err: unknown) {
  if (err instanceof GenerationError) {
    const status =
      err.code === 'APPROVED_CONTENT_PROTECTED'
        ? 409
        : err.code === 'CONTENT_NOT_FOUND' || err.code === 'PROJECT_NOT_FOUND'
          ? 404
          : err.code === 'INVALID_MODEL_OUTPUT'
            ? 400
            : 500;
    return Response.json(
      { ok: false, code: err.code, error: err.message, details: err.details ?? null },
      { status },
    );
  }
  if (err instanceof PersistenceError) {
    return Response.json(
      { ok: false, code: err.code, error: err.message },
      { status: err.code === 'NOT_CONFIGURED' ? 503 : 500 },
    );
  }
  return Response.json(
    { ok: false, code: 'UNKNOWN', error: err instanceof Error ? err.message : String(err) },
    { status: 500 },
  );
}

/**
 * POST { documentKey, sectionId, blocks, reopenApproved? }
 * Persist a manual edit as a new DRAFT version. Does not change ProjectFacts.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      documentKey?: string;
      sectionId?: string;
      blocks?: GeneratedBlock[];
      reopenApproved?: boolean;
    };
    const documentKey = body.documentKey?.trim();
    const sectionId = body.sectionId?.trim();
    if (!documentKey || !sectionId || !Array.isArray(body.blocks)) {
      return Response.json(
        { ok: false, error: 'documentKey, sectionId, and blocks[] are required' },
        { status: 400 },
      );
    }
    const row = await editRfpSection({
      documentKey,
      sectionId,
      blocks: body.blocks,
      reopenApproved: Boolean(body.reopenApproved),
    });
    return Response.json({
      ok: true,
      documentKey,
      sectionId,
      content: {
        contentId: row.content_id,
        version: row.version,
        approvalStatus: row.approval_status,
        generated: row.content_json,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
