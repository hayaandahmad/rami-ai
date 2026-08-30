import {
  assembleRfpDocument,
  listGeneratedSections,
} from '@/server/rami/sectionGeneration';
import { getAllSectionReadiness } from '@/server/rami/sectionReadiness';
import { hydrateProject, PersistenceError } from '@/server/rami/projectPersistence';
import { GenerationError } from '@/types/generatedSection';

export const runtime = 'nodejs';

function errorResponse(err: unknown) {
  if (err instanceof GenerationError) {
    return Response.json(
      { ok: false, code: err.code, error: err.message, details: err.details ?? null },
      { status: err.code === 'PROJECT_NOT_FOUND' ? 404 : 500 },
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
 * GET ?documentKey=
 * Returns all current generated sections, readiness map, and assembled RFP skeleton.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const documentKey = url.searchParams.get('documentKey')?.trim();
  if (!documentKey) {
    return Response.json({ ok: false, error: 'documentKey is required' }, { status: 400 });
  }
  try {
    const session = await hydrateProject(documentKey);
    const readiness = getAllSectionReadiness(session.memory, session.projectContext);
    const contents = await listGeneratedSections({ documentKey });
    const assembled = await assembleRfpDocument(documentKey);

    const mem = session.memory;
    const str = (fieldId: keyof typeof mem) => {
      const v = mem[fieldId]?.current?.value;
      return typeof v === 'string' && v.trim() ? v.trim() : undefined;
    };

    return Response.json({
      ok: true,
      documentKey,
      documentMeta: {
        documentTitle: str('documentTitle'),
        beneficiaryEntity: str('beneficiaryEntity'),
        documentType: str('documentType'),
        engagementType: str('engagementType'),
        engagementDuration: str('engagementDuration'),
      },
      readiness,
      sections: contents.map((c) => ({
        contentId: c.content_id,
        sectionId: c.section_id,
        version: c.version,
        approvalStatus: c.approval_status,
        generated: c.content_json,
        createdAt: c.created_at,
      })),
      assembled,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
