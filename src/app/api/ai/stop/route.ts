import { stopEngine, buildStatusPayload } from '@/server/ai/modalEngineControl';
import { getConfiguredProviderKind } from '@/server/ai/providerConfig';
import { getLocalEngineStatus } from '@/server/ai/localEngineStatus';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST() {
  if (getConfiguredProviderKind() !== 'modal') {
    const status = await getLocalEngineStatus();
    return Response.json(
      {
        ok: false,
        error: 'Local Ollama has no RAMI stop control. Manage Ollama outside RAMI.',
        ...status,
      },
      { status: 400 },
    );
  }
  const s = await stopEngine('manual');
  return Response.json({ ok: true, ...buildStatusPayload(s) });
}
