import {
  generateRfpSection,
  regenerateRfpSection,
  getGeneratedSection,
} from '@/server/rami/sectionGeneration';
import { getSectionReadiness } from '@/server/rami/sectionReadiness';
import { hydrateProject, PersistenceError } from '@/server/rami/projectPersistence';
import { GenerationError } from '@/types/generatedSection';
import { findProjectByDocumentKey } from '@/server/repositories/ProjectRepository';

export const runtime = 'nodejs';
export const maxDuration = 300;

function errorResponse(err: unknown) {
  if (err instanceof GenerationError) {
    const status =
      err.code === 'NOT_READY' || err.code === 'NOT_APPLICABLE'
        ? 409
        : err.code === 'APPROVED_CONTENT_PROTECTED'
          ? 409
          : err.code === 'PROJECT_NOT_FOUND' || err.code === 'CONTENT_NOT_FOUND'
            ? 404
            : err.code === 'SECTION_UNKNOWN'
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

/** GET ?documentKey=&sectionId= — current generated section + readiness. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const documentKey = url.searchParams.get('documentKey')?.trim();
  const sectionId = url.searchParams.get('sectionId')?.trim();
  if (!documentKey || !sectionId) {
    return Response.json(
      { ok: false, error: 'documentKey and sectionId are required' },
      { status: 400 },
    );
  }
  try {
    const session = await hydrateProject(documentKey);
    const project = await findProjectByDocumentKey(documentKey);
    const readiness = getSectionReadiness(
      session.memory,
      sectionId,
      session.projectContext,
    );
    const content = await getGeneratedSection({ documentKey, sectionId });
    return Response.json({
      ok: true,
      documentKey,
      projectId: project?.project_id ?? null,
      sectionId,
      readiness,
      content: content
        ? {
            contentId: content.content_id,
            version: content.version,
            approvalStatus: content.approval_status,
            isCurrent: content.is_current,
            generated: content.content_json,
            createdAt: content.created_at,
          }
        : null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * POST { documentKey, sectionId, reopenApproved? }
 * Generate (or regenerate) one section when readiness allows.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      documentKey?: string;
      sectionId?: string;
      reopenApproved?: boolean;
      regenerate?: boolean;
    };
    const documentKey = body.documentKey?.trim();
    const sectionId = body.sectionId?.trim();
    if (!documentKey || !sectionId) {
      return Response.json(
        { ok: false, error: 'documentKey and sectionId are required' },
        { status: 400 },
      );
    }

    const fn = body.regenerate ? regenerateRfpSection : generateRfpSection;
    const result = await fn({
      documentKey,
      sectionId,
      reopenApproved: Boolean(body.reopenApproved),
    });

    return Response.json({
      ok: true,
      documentKey,
      sectionId,
      readiness: result.context.readiness,
      contextAudit: {
        answeredFieldIds: result.context.answeredFacts.map((f) => f.fieldId),
        sharedFieldIds: result.context.sharedFacts.map((f) => f.fieldId),
        tbcFieldIds: result.context.tbcFields.map((f) => f.fieldId),
        notApplicableFieldIds: result.context.notApplicableFields,
        documentMetaKeys: Object.keys(result.context.documentMeta),
        historicalReferenceIds: result.generated.historicalReferenceIds ?? [],
        generationReferenceIds: result.generated.generationReferenceIds ?? [],
      },
      content: {
        contentId: result.content.content_id,
        version: result.content.version,
        approvalStatus: result.content.approval_status,
        generated: result.generated,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
