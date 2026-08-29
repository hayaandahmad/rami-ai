import { getEngineStatus } from '@/server/ai/modalEngineControl';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  const status = await getEngineStatus();
  return Response.json({ ok: true, ...status });
}
