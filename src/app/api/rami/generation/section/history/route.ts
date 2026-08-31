import { findProjectByDocumentKey } from '@/server/repositories/ProjectRepository';
import { listSectionContentHistory } from '@/server/repositories/ProjectSectionContentRepository';
import { GenerationError } from '@/types/generatedSection';

export const runtime = 'nodejs';

function errorResponse(err: unknown) {
  if (err instanceof GenerationError) {
    const status =
      err.code === 'PROJECT_NOT_FOUND' || err.code === 'CONTENT_NOT_FOUND' ? 404 : 500;
    return Response.json(
      { ok: false, code: err.code, error: err.message },
      { status },
    );
  }
  return Response.json(
    { ok: false, error: err instanceof Error ? err.message : String(err) },
    { status: 500 },
  );
}

/**
 * GET ?documentKey=&sectionId=
 * Read-only section version history (newest first).
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const documentKey = url.searchParams.get('documentKey')?.trim();
    const sectionId = url.searchParams.get('sectionId')?.trim();
    if (!documentKey || !sectionId) {
      return Response.json(
        { ok: false, error: 'documentKey and sectionId are required' },
        { status: 400 },
      );
    }

    const project = await findProjectByDocumentKey(documentKey);
    if (!project) {
      throw new GenerationError('PROJECT_NOT_FOUND', `Project not found: ${documentKey}`);
    }

    const rows = await listSectionContentHistory(project.project_id, sectionId);
    if (rows.length === 0) {
      throw new GenerationError(
        'CONTENT_NOT_FOUND',
        `No generated content for section ${sectionId}.`,
      );
    }

    return Response.json({
      ok: true,
      documentKey,
      sectionId,
      versions: rows.map((row) => ({
        version: row.version,
        approvalStatus: row.approval_status,
        modelUsed: row.model_used,
        createdAt: row.created_at,
        isCurrent: row.is_current,
        generated: row.content_json,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
