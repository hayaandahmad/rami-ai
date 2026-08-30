/**
 * GET ?documentKey= — download DOCX built from persisted AssembledRfp.
 * Never calls the model.
 */

import { assembleRfpDocument } from '@/server/rami/sectionGeneration';
import {
  buildRfpDocxBuffer,
  safeDocxFilename,
} from '@/server/rami/docxExport';
import { hydrateProject, PersistenceError } from '@/server/rami/projectPersistence';
import { GenerationError } from '@/types/generatedSection';

export const runtime = 'nodejs';
export const maxDuration = 60;

function errorResponse(err: unknown) {
  if (err instanceof GenerationError) {
    return Response.json(
      { ok: false, code: err.code, error: err.message },
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const documentKey = url.searchParams.get('documentKey')?.trim();
  if (!documentKey) {
    return Response.json({ ok: false, error: 'documentKey is required' }, { status: 400 });
  }

  try {
    const session = await hydrateProject(documentKey);
    const assembled = await assembleRfpDocument(documentKey);
    const mem = session.memory;
    const str = (fieldId: keyof typeof mem) => {
      const v = mem[fieldId]?.current?.value;
      return typeof v === 'string' && v.trim() ? v.trim() : undefined;
    };
    const documentMeta = {
      documentTitle: str('documentTitle'),
      beneficiaryEntity: str('beneficiaryEntity'),
      documentType: str('documentType'),
      engagementType: str('engagementType'),
      engagementDuration: str('engagementDuration'),
    };

    const buffer = await buildRfpDocxBuffer({ assembled, documentMeta });
    const filename = safeDocxFilename(documentMeta, documentKey);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
