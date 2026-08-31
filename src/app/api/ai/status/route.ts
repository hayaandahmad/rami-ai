import { getEngineStatus } from '@/server/ai/modalEngineControl';
import { getLocalEngineStatus } from '@/server/ai/localEngineStatus';
import { getConfiguredProviderKind } from '@/server/ai/providerConfig';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  const kind = getConfiguredProviderKind();
  const status =
    kind === 'modal' ? await getEngineStatus() : await getLocalEngineStatus();
  return Response.json({ ok: true, ...status });
}
