/**
 * AI provider barrel — exports types and the default provider factory.
 * Consumers should import from here, never directly from LocalModelProvider.
 */

export type {
  RamiModelProvider,
  ChatMessage,
  InferenceOptions,
  StructuredExtractionResult,
  CompletionResult,
  ProviderHealthResult,
  ModelInfo,
} from './RamiModelProvider';

export { LocalModelProvider } from './LocalModelProvider';
export { getModelManifest, clearManifestCache } from './modelManifest';
export type { ModelManifest } from './modelManifest';

import { LocalModelProvider } from './LocalModelProvider';
import type { RamiModelProvider } from './RamiModelProvider';

let _defaultProvider: RamiModelProvider | null = null;

/**
 * Returns (and lazily initialises) the default provider singleton.
 * Currently always a LocalModelProvider. When a new provider type is added,
 * this factory is the only place that needs to change.
 */
export function getDefaultProvider(): RamiModelProvider {
  if (!_defaultProvider) {
    _defaultProvider = new LocalModelProvider();
  }
  return _defaultProvider;
}

/** Clears the singleton (useful for tests / re-initialisation). */
export function clearDefaultProvider(): void {
  _defaultProvider = null;
}
