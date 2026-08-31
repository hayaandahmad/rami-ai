import { aiEditRfpSection } from '@/server/rami/sectionGeneration';
import { PersistenceError } from '@/server/rami/projectPersistence';
import { GenerationError } from '@/types/generatedSection';

export const runtime = 'nodejs';
export const maxDuration = 300;

function errorResponse(err: unknown) {
  if (err instanceof GenerationError) {
    const status =
      err.code === 'APPROVED_CONTENT_PROTECTED'
        ? 409
        : err.code === 'CONTENT_NOT_FOUND' || err.code === 'PROJECT_NOT_FOUND'
          ? 404
          : err.code === 'NOT_APPLICABLE'
            ? 409
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
 * POST { documentKey, sectionId, editInstruction, reopenApproved? }
 * AI-assisted edit of existing section content. ProjectFacts unchanged.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      documentKey?: string;
      sectionId?: string;
      editInstruction?: string;
      reopenApproved?: boolean;
    };
    const documentKey = body.documentKey?.trim();
    const sectionId = body.sectionId?.trim();
    const editInstruction = body.editInstruction?.trim();
    if (!documentKey || !sectionId || !editInstruction) {
      return Response.json(
        { ok: false, error: 'documentKey, sectionId, and editInstruction are required' },
        { status: 400 },
      );
    }

    const result = await aiEditRfpSection({
      documentKey,
      sectionId,
      editInstruction,
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
