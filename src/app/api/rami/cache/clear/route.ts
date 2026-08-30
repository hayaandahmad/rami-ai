import { clearAllSessionCache, clearSessionCache } from '@/server/rami/sessionStore';

export const runtime = 'nodejs';

/** Dev/test helper: drop process cache so the next read hydrates from PostgreSQL. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sessionId?: string };
  if (body.sessionId?.trim()) {
    clearSessionCache(body.sessionId.trim());
    return Response.json({ ok: true, cleared: body.sessionId.trim() });
  }
  clearAllSessionCache();
  return Response.json({ ok: true, cleared: 'all' });
}
