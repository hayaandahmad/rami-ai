/**
 * ModalModelProvider — same RamiModelProvider contract as LocalModelProvider.
 * Calls Modal Ollama (qwen3:8b Q4_K_M) via Python bridge. No Rami business logic.
 */

import type {
  RamiModelProvider,
  ChatMessage,
  InferenceOptions,
  StructuredExtractionResult,
  CompletionResult,
  ProviderHealthResult,
  ModelInfo,
  HealthCheckOptions,
} from './RamiModelProvider';
import { getModelManifest } from './modelManifest';
import { runModalBridge, runModalBridgeStream } from './modalBridge';
import {
  enforceTimeouts,
  isModalReadyForChat,
  markInferenceActivity,
  setBusy,
} from './modalEngineControl';
import { MODAL_MODEL_TAG } from './providerConfig';

export class ModalNotReadyError extends Error {
  constructor(message = 'Start Rami to begin chatting.') {
    super(message);
    this.name = 'ModalNotReadyError';
  }
}

export class ModalModelProvider implements RamiModelProvider {
  readonly providerType = 'modal-ollama';

  private assertReady(): void {
    if (!isModalReadyForChat()) {
      throw new ModalNotReadyError();
    }
  }

  async complete(
    messages: ChatMessage[],
    options?: InferenceOptions,
  ): Promise<CompletionResult> {
    await enforceTimeouts();
    this.assertReady();
    setBusy(true);
    const start = Date.now();
    try {
      const result = await runModalBridge<{
        ok?: boolean;
        text?: string;
        model?: string;
        tokens_per_sec?: number;
        wall_seconds?: number;
      }>({
        op: 'chat',
        messages,
        temperature: options?.temperature ?? 0.7,
      }, options?.timeoutMs ?? 300_000);

      const durationMs = Date.now() - start;
      markInferenceActivity({
        responseSeconds: (result.wall_seconds as number) ?? durationMs / 1000,
        tokensPerSec: result.tokens_per_sec ?? null,
        ttftSeconds: null,
      });
      return {
        text: result.text ?? '',
        durationMs,
        modelUsed: result.model ?? options?.modelOverride ?? MODAL_MODEL_TAG,
      };
    } finally {
      setBusy(false);
    }
  }

  async extractStructured<T = unknown>(
    messages: ChatMessage[],
    jsonSchema: Record<string, unknown>,
    options?: InferenceOptions,
  ): Promise<StructuredExtractionResult<T>> {
    await enforceTimeouts();
    this.assertReady();
    setBusy(true);
    const start = Date.now();
    try {
      const result = await runModalBridge<{
        text?: string;
        model?: string;
        wall_seconds?: number;
        tokens_per_sec?: number;
      }>({
        op: 'chat',
        messages,
        temperature: options?.temperature ?? 0.0,
        format: jsonSchema,
      }, options?.timeoutMs ?? 300_000);

      let parsed: T;
      try {
        parsed = JSON.parse(result.text ?? '') as T;
      } catch (err) {
        throw new Error(
          `ModalModelProvider.extractStructured: non-JSON despite format. ` +
            `Raw: ${(result.text ?? '').slice(0, 200)}. ${String(err)}`,
        );
      }

      markInferenceActivity({
        responseSeconds: result.wall_seconds ?? (Date.now() - start) / 1000,
        tokensPerSec: result.tokens_per_sec ?? null,
        ttftSeconds: null,
      });

      return {
        data: parsed,
        durationMs: Date.now() - start,
        modelUsed: result.model ?? MODAL_MODEL_TAG,
      };
    } finally {
      setBusy(false);
    }
  }

  async *completeStream(
    messages: ChatMessage[],
    options?: InferenceOptions,
  ): AsyncGenerator<string> {
    await enforceTimeouts();
    this.assertReady();
    setBusy(true);
    const start = Date.now();
    let ttft: number | null = null;
    let tokensPerSec: number | null = null;
    try {
      for await (const event of runModalBridgeStream(
        {
          op: 'chat_stream',
          messages,
          temperature: options?.temperature ?? 0.7,
        },
        options?.timeoutMs ?? 300_000,
      )) {
        if (event.type === 'chunk' && typeof event.text === 'string' && event.text) {
          if (ttft == null) ttft = (Date.now() - start) / 1000;
          yield event.text;
        } else if (event.type === 'done') {
          if (typeof event.ttft_seconds === 'number') ttft = event.ttft_seconds;
          if (typeof event.tokens_per_sec === 'number') tokensPerSec = event.tokens_per_sec;
          markInferenceActivity({
            ttftSeconds: ttft,
            responseSeconds:
              typeof event.wall_seconds === 'number'
                ? event.wall_seconds
                : (Date.now() - start) / 1000,
            tokensPerSec,
          });
        } else if (event.type === 'error') {
          throw new Error(String(event.message ?? 'modal stream error'));
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async embed(text: string): Promise<number[]> {
    void text;
    throw new Error(
      'ModalModelProvider.embed is not implemented in this integration (RAG is Phase 3 / local).',
    );
  }

  async healthCheck(options?: HealthCheckOptions): Promise<ProviderHealthResult> {
    void options;
    const checkedAt = new Date().toISOString();
    const manifest = getModelManifest();
    try {
      await enforceTimeouts();
      if (!isModalReadyForChat()) {
        return {
          providerType: this.providerType,
          endpointReachable: true,
          defaultModelAvailable: false,
          lightweightModelAvailable: false,
          models: [],
          smokeTestPassed: false,
          smokeTestError: 'Modal engine is not READY — press Start Rami',
          checkedAt,
        };
      }
      const result = await runModalBridge<{
        ok?: boolean;
        health?: { ok?: boolean; model?: string };
        remote?: Record<string, unknown>;
      }>({ op: 'health' }, 180_000);
      const models: ModelInfo[] = [
        {
          name: result.health?.model ?? manifest.models.default,
          available: Boolean(result.ok && result.health?.ok),
        },
      ];
      return {
        providerType: this.providerType,
        endpointReachable: true,
        defaultModelAvailable: Boolean(result.ok && result.health?.ok),
        lightweightModelAvailable: false,
        models,
        smokeTestPassed: Boolean(result.ok && result.health?.ok),
        smokeTestError: result.ok ? undefined : 'health failed',
        checkedAt,
      };
    } catch (err) {
      return {
        providerType: this.providerType,
        endpointReachable: false,
        defaultModelAvailable: false,
        lightweightModelAvailable: false,
        models: [],
        smokeTestPassed: false,
        smokeTestError: err instanceof Error ? err.message : String(err),
        checkedAt,
      };
    }
  }
}
