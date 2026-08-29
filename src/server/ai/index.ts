/**
 * AI provider barrel — exports types and the default provider factory.
 * Consumers should import from here, never hardcode a specific provider.
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
export { ModalModelProvider, ModalNotReadyError } from './ModalModelProvider';
export { getModelManifest, clearManifestCache } from './modelManifest';
export type { ModelManifest } from './modelManifest';
export { getConfiguredProviderKind } from './providerConfig';
export type { RamiProviderKind } from './providerConfig';

import { LocalModelProvider } from './LocalModelProvider';
import { ModalModelProvider } from './ModalModelProvider';
import type { RamiModelProvider } from './RamiModelProvider';
import { getConfiguredProviderKind } from './providerConfig';

let _defaultProvider: RamiModelProvider | null = null;
let _providerKind: string | null = null;

/**
 * Returns (and lazily initialises) the configured provider singleton.
 * RAMI_MODEL_PROVIDER=local|modal
 */
export function getDefaultProvider(): RamiModelProvider {
  const kind = getConfiguredProviderKind();
  if (!_defaultProvider || _providerKind !== kind) {
    _defaultProvider = kind === 'modal' ? new ModalModelProvider() : new LocalModelProvider();
    _providerKind = kind;
  }
  return _defaultProvider;
}

/** Clears the singleton (useful for tests / re-initialisation). */
export function clearDefaultProvider(): void {
  _defaultProvider = null;
  _providerKind = null;
}
