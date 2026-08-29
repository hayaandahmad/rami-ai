import { extendSession } from '@/server/ai/modalEngineControl';
import { getConfiguredProviderKind } from '@/server/ai/providerConfig';

export const runtime = 'nodejs';

export async function POST() {
  if (getConfiguredProviderKind() !== 'modal') {
    return Response.json({ ok: false, error: 'Extend applies to Modal sessions only.' }, { status: 400 });
  }
  const status = extendSession();
  return Response.json({ ok: true, ...status });
}
