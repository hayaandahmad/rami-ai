import { approveRfpSection } from '@/server/rami/sectionGeneration';
import { PersistenceError } from '@/server/rami/projectPersistence';
import { GenerationError } from '@/types/generatedSection';

export const runtime = 'nodejs';

function errorResponse(err: unknown) {
  if (err instanceof GenerationError) {
    const status =
      err.code === 'CONTENT_NOT_FOUND' || err.code === 'PROJECT_NOT_FOUND' ? 404 : 409;
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

/** POST { documentKey, sectionId } — mark current generated content APPROVED. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { documentKey?: string; sectionId?: string };
    const documentKey = body.documentKey?.trim();
    const sectionId = body.sectionId?.trim();
    if (!documentKey || !sectionId) {
      return Response.json(
        { ok: false, error: 'documentKey and sectionId are required' },
        { status: 400 },
      );
    }
    const row = await approveRfpSection({ documentKey, sectionId });
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
