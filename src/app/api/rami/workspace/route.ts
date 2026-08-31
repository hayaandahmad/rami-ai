import { PersistenceError } from '@/server/rami/projectPersistence';
import { listWorkspaceDocuments } from '@/server/rami/workspaceService';
import { deriveWorkspaceMetrics } from '@/utils/workspaceMetrics';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { documents, lastActivityAt } = await listWorkspaceDocuments();
    const metrics = deriveWorkspaceMetrics(documents);
    return Response.json({
      ok: true,
      source: 'postgresql',
      documents,
      metrics,
      lastActivityAt,
    });
  } catch (err) {
    const persist = err instanceof PersistenceError;
    return Response.json(
      {
        ok: false,
        error: persist ? err.message : 'Failed to load workspace from PostgreSQL.',
        code: persist ? err.code : 'UNKNOWN',
      },
      { status: persist && err.code === 'NOT_CONFIGURED' ? 503 : 500 },
    );
  }
}
