/**
 * Model manifest loader.
 * Reads config/model-manifest.json (relative to the project root).
 * Server-side only — manifest is not exposed to browser clients.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

export interface ModelManifest {
  provider: string;
  inferenceBaseUrl: string;
  models: {
    default: string;
    lightweight: string;
    quality: string;
  };
  embeddings: {
    model: string;
  };
}

let _cached: ModelManifest | null = null;

/** Returns the parsed model manifest, caching after first read. */
export function getModelManifest(): ModelManifest {
  if (_cached) return _cached;

  const manifestPath = join(process.cwd(), 'config', 'model-manifest.json');
  try {
    const raw = readFileSync(manifestPath, 'utf-8');
    _cached = JSON.parse(raw) as ModelManifest;
    return _cached;
  } catch (err) {
    throw new Error(
      `Failed to load model manifest from ${manifestPath}. ` +
      `Run 'npm run ai:setup' to initialise the local AI stack. ` +
      `Original error: ${String(err)}`,
    );
  }
}

/** Clears the cached manifest (useful in tests). */
export function clearManifestCache(): void {
  _cached = null;
}
