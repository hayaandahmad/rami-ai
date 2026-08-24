/**
 * RamiModelProvider — the provider-independent AI boundary.
 * Authority: .private-context/architecture/rami-agent-architecture.md §3
 *
 * All Rami business logic interacts with this interface, never with
 * Ollama, HTTP, or any specific model directly.
 *
 * The current implementation is LocalModelProvider (Ollama-backed).
 * Future providers (e.g. a different zero-cost local runtime) can be
 * added without changing any code above this line.
 */

/** A single message in a conversation. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Options common to inference calls. */
export interface InferenceOptions {
  /** Overrides the manifest default model for this call. */
  modelOverride?: string;
  /** Request timeout in milliseconds. Default: provider-defined. */
  timeoutMs?: number;
  /**
   * Temperature (0–1). 0 for deterministic extraction,
   * higher for creative drafting.
   */
  temperature?: number;
}

/** Result of a structured extraction call. */
export interface StructuredExtractionResult<T = unknown> {
  data: T;
  /** Milliseconds the inference call took. */
  durationMs: number;
  /** Model actually used (may differ from configured default if overridden). */
  modelUsed: string;
}

/** Result of a plain chat/completion call. */
export interface CompletionResult {
  text: string;
  durationMs: number;
  modelUsed: string;
}

/** Model availability info returned by health checks. */
export interface ModelInfo {
  name: string;
  available: boolean;
  /** File size in bytes, if reported by the backend. */
  sizeBytes?: number;
}

/** Comprehensive health-check result for the provider. */
export interface ProviderHealthResult {
  providerType: string;
  endpointReachable: boolean;
  defaultModelAvailable: boolean;
  lightweightModelAvailable: boolean;
  models: ModelInfo[];
  /** True if a trivial inference round-trip succeeded. */
  smokeTestPassed: boolean;
  smokeTestError?: string;
  checkedAt: string;
}

/**
 * Provider-independent AI interface.
 * All methods are async; all throw a descriptive Error on failure.
 */
export interface RamiModelProvider {
  /** Returns the provider type string (e.g. 'ollama-local'). */
  readonly providerType: string;

  /**
   * Send a free-form chat message and get a plain-text completion.
   * Used for natural conversation turns and section drafting narrative.
   */
  complete(
    messages: ChatMessage[],
    options?: InferenceOptions,
  ): Promise<CompletionResult>;

  /**
   * Send a message and get a structured JSON response conforming to the
   * given JSON Schema. The provider must use the backend's native
   * schema-constrained output mechanism (e.g. Ollama's `format` field)
   * so the result is guaranteed schema-valid without fragile prompt parsing.
   */
  extractStructured<T = unknown>(
    messages: ChatMessage[],
    jsonSchema: Record<string, unknown>,
    options?: InferenceOptions,
  ): Promise<StructuredExtractionResult<T>>;

  /**
   * Generate a dense vector embedding for the given text.
   * Returns a float array (the exact dimension depends on the configured
   * embedding model). Used by the Phase-3 local RAG pipeline.
   */
  embed(text: string): Promise<number[]>;

  /**
   * Perform a comprehensive health check:
   * - endpoint reachable
   * - configured model(s) installed
   * - trivial inference round-trip
   */
  healthCheck(): Promise<ProviderHealthResult>;
}
