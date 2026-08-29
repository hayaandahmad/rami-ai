import { startEngine } from '@/server/ai/modalEngineControl';
import { getConfiguredProviderKind } from '@/server/ai/providerConfig';

export const runtime = 'nodejs';
export const maxDuration = 600;

export async function POST() {
  if (getConfiguredProviderKind() !== 'modal') {
    return Response.json(
      {
        ok: false,
        error: 'Provider is local. Set RAMI_MODEL_PROVIDER=modal to use Modal Start.',
        provider: 'local',
      },
      { status: 400 },
    );
  }
  const status = await startEngine();
  return Response.json({ ok: status.state === 'READY' || status.state === 'BUSY', ...status });
}
