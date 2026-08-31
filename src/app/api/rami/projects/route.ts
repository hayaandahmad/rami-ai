import type { DocumentType } from '@/types/document';
import { PersistenceError } from '@/server/rami/projectPersistence';
import { createWorkspaceProject } from '@/server/rami/workspaceService';

export const runtime = 'nodejs';

const VALID_TYPES: DocumentType[] = [
  'system-implementation',
  'framework-agreement',
  'consulting',
  'assessment',
  'support',
  'connectivity-telecom',
  'other',
];

export async function POST(req: Request) {
  let body: { documentType?: string; title?: string };
  try {
    body = (await req.json()) as { documentType?: string; title?: string };
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const documentType = body.documentType?.trim() as DocumentType | undefined;
  if (!documentType || !VALID_TYPES.includes(documentType)) {
    return Response.json(
      { ok: false, error: 'documentType is required and must be a supported type.' },
      { status: 400 },
    );
  }

  try {
    const { documentKey, project } = await createWorkspaceProject({
      documentType,
      title: body.title,
    });
    return Response.json({
      ok: true,
      documentKey,
      project: {
        id: documentKey,
        name: project.name,
        status: project.status,
      },
    });
  } catch (err) {
    const persist = err instanceof PersistenceError;
    return Response.json(
      {
        ok: false,
        error: persist ? err.message : 'Failed to create project.',
        code: persist ? err.code : 'UNKNOWN',
      },
      { status: persist && err.code === 'NOT_CONFIGURED' ? 503 : 500 },
    );
  }
}
