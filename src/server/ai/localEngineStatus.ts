/**
 * Local Ollama engine status for the Rami control panel.
 * Ollama runs as an external daemon — no RAMI start/stop lifecycle.
 */

import { LocalModelProvider } from './LocalModelProvider';
import { getModelManifest } from './modelManifest';
import { getConfiguredProviderKind } from './providerConfig';

export interface LocalEngineStatus {
  state: 'OFF' | 'READY' | 'ERROR';
  provider: 'local';
  model: string;
  modelLabel: string;
  gpu: string;
  endpointReachable: boolean;
  defaultModelAvailable: boolean;
  lastError: string | null;
  checkedAt: string;
}

export async function getLocalEngineStatus(): Promise<Record<string, unknown>> {
  const manifest = getModelManifest();
  const provider = new LocalModelProvider(manifest);

  let health;
  try {
    health = await provider.healthCheck();
  } catch (err) {
    return {
      state: 'ERROR',
      LOCAL_TRACKED_STATE: 'ERROR',
      provider: 'local',
      model: manifest.models.default,
      modelLabel: manifest.models.default,
      gpu: 'Local',
      endpointReachable: false,
      defaultModelAvailable: false,
      lastError: err instanceof Error ? err.message : String(err),
      checkedAt: new Date().toISOString(),
    };
  }

  const ready =
    health.endpointReachable && health.defaultModelAvailable && health.smokeTestPassed;
  const reachableButNotReady =
    health.endpointReachable && health.defaultModelAvailable && !health.smokeTestPassed;

  let state: 'OFF' | 'READY' | 'ERROR' = 'OFF';
  if (ready) state = 'READY';
  else if (!health.endpointReachable) state = 'OFF';
  else state = 'ERROR';

  return {
    state,
    LOCAL_TRACKED_STATE: state,
    provider: 'local',
    model: manifest.models.default,
    modelLabel: manifest.models.default,
    gpu: 'Local',
    endpointReachable: health.endpointReachable,
    defaultModelAvailable: health.defaultModelAvailable,
    modelsInstalled: health.models.map((m) => m.name),
    lastError: health.smokeTestError ?? (reachableButNotReady ? 'Model health check failed' : null),
    checkedAt: health.checkedAt,
    runtimeNote:
      'Local Ollama runs as a system service. Start or stop Ollama outside RAMI.',
  };
}

export function isLocalProvider(): boolean {
  return getConfiguredProviderKind() === 'local';
}
