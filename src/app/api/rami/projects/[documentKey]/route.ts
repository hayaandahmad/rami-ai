import { PersistenceError } from '@/server/rami/projectPersistence';
import { deleteWorkspaceProject } from '@/server/rami/workspaceService';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ documentKey: string }> };

export async function DELETE(_req: Request, context: RouteContext) {
  const { documentKey: rawKey } = await context.params;
  const documentKey = decodeURIComponent(rawKey ?? '').trim();

  if (!documentKey) {
    return Response.json({ ok: false, error: 'documentKey is required' }, { status: 400 });
  }

  try {
    const deleted = await deleteWorkspaceProject(documentKey);
    if (!deleted) {
      return Response.json({ ok: false, error: 'Project not found' }, { status: 404 });
    }
    return Response.json({ ok: true, documentKey });
  } catch (err) {
    const persist = err instanceof PersistenceError;
    return Response.json(
      {
        ok: false,
        error: persist ? err.message : 'Failed to delete project.',
        code: persist ? err.code : 'UNKNOWN',
      },
      { status: persist && err.code === 'NOT_CONFIGURED' ? 503 : 500 },
    );
  }
}
