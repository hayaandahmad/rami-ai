import { stopEngine, buildStatusPayload } from '@/server/ai/modalEngineControl';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST() {
  const s = await stopEngine('manual');
  return Response.json({ ok: true, ...buildStatusPayload(s) });
}
