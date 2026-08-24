/**
 * LocalModelProvider — Ollama-backed implementation of RamiModelProvider.
 * Authority: .private-context/architecture/local-ai-deployment.md
 *
 * Server-side only. Reads model configuration from config/model-manifest.json.
 * Does not hardcode model tags; does not expose Ollama details to browser clients.
 *
 * Communicates with the local Ollama service at the configured base URL
 * (default: http://localhost:11434).
 *
 * Ollama API references used:
 *   POST /api/chat       — chat with optional json schema format
 *   POST /api/embeddings — dense embeddings
 *   GET  /api/tags       — list installed models
 */

import type {
  RamiModelProvider,
  ChatMessage,
  InferenceOptions,
  StructuredExtractionResult,
  CompletionResult,
  ProviderHealthResult,
  ModelInfo,
} from './RamiModelProvider';
import { getModelManifest, type ModelManifest } from './modelManifest';

/** Strips <think>...</think> blocks that Qwen3 generates before its actual response. */
class ThinkStripper {
  private buffer = '';
  private decided = false;

  process(chunk: string): string {
    if (this.decided) return chunk;

    this.buffer += chunk;

    // If buffer doesn't start with <think>, pass everything through
    if (this.buffer.length > 10 && !this.buffer.startsWith('<think>')) {
      this.decided = true;
      const result = this.buffer;
      this.buffer = '';
      return result;
    }

    // Look for end of thinking block
    const closeIdx = this.buffer.indexOf('</think>');
    if (closeIdx !== -1) {
      this.decided = true;
      const afterThink = this.buffer.slice(closeIdx + '</think>'.length).trimStart();
      this.buffer = '';
      return afterThink;
    }

    // Buffer is large with no closing tag — something is wrong, pass through
    if (this.buffer.length > 8000) {
      this.decided = true;
      const result = this.buffer;
      this.buffer = '';
      return result;
    }

    return ''; // still buffering the <think> block
  }

  flush(): string {
    if (!this.decided) {
      // Never found </think> — output buffer as-is
      const result = this.buffer;
      this.buffer = '';
      return result;
    }
    return '';
  }
}

/** Raw Ollama /api/chat message format */
interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Raw Ollama /api/chat response (non-streaming) */
interface OllamaChatResponse {
  model: string;
  message: OllamaMessage;
  done: boolean;
  total_duration?: number; // nanoseconds
}

/** Raw Ollama /api/embed response */
interface OllamaEmbedResponse {
  embedding: number[];
}

/** Raw Ollama /api/tags model entry */
interface OllamaTagsEntry {
  name: string;
  size: number;
}

interface OllamaTagsResponse {
  models: OllamaTagsEntry[];
}

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes for larger models

/** Performs a fetch with an AbortController-based timeout. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export class LocalModelProvider implements RamiModelProvider {
  readonly providerType = 'ollama-local';

  private readonly manifest: ModelManifest;
  private readonly baseUrl: string;

  constructor(manifest?: ModelManifest) {
    this.manifest = manifest ?? getModelManifest();
    this.baseUrl = this.manifest.inferenceBaseUrl.replace(/\/$/, '');
  }

  private get defaultModel(): string {
    return this.manifest.models.default;
  }

  private get embeddingModel(): string {
    return this.manifest.embeddings.model;
  }

  async complete(
    messages: ChatMessage[],
    options?: InferenceOptions,
  ): Promise<CompletionResult> {
    const model = options?.modelOverride ?? this.defaultModel;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const body = JSON.stringify({
      model,
      messages: messages as OllamaMessage[],
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.7,
      },
    });

    const start = Date.now();
    const response = await fetchWithTimeout(
      `${this.baseUrl}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      },
      timeoutMs,
    );

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(
        `LocalModelProvider.complete: Ollama returned ${response.status}: ${text}`,
      );
    }

    const json = (await response.json()) as OllamaChatResponse;
    return {
      text: json.message.content,
      durationMs: Date.now() - start,
      modelUsed: json.model,
    };
  }

  async extractStructured<T = unknown>(
    messages: ChatMessage[],
    jsonSchema: Record<string, unknown>,
    options?: InferenceOptions,
  ): Promise<StructuredExtractionResult<T>> {
    const model = options?.modelOverride ?? this.defaultModel;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const body = JSON.stringify({
      model,
      messages: messages as OllamaMessage[],
      stream: false,
      format: jsonSchema, // Ollama native JSON schema-constrained output
      options: {
        temperature: options?.temperature ?? 0.0, // deterministic for extraction
      },
    });

    const start = Date.now();
    const response = await fetchWithTimeout(
      `${this.baseUrl}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      },
      timeoutMs,
    );

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(
        `LocalModelProvider.extractStructured: Ollama returned ${response.status}: ${text}`,
      );
    }

    const json = (await response.json()) as OllamaChatResponse;
    let parsed: T;
    try {
      parsed = JSON.parse(json.message.content) as T;
    } catch (err) {
      throw new Error(
        `LocalModelProvider.extractStructured: model returned non-JSON despite format constraint. ` +
        `Raw: ${json.message.content.slice(0, 200)}. Parse error: ${String(err)}`,
      );
    }

    return {
      data: parsed,
      durationMs: Date.now() - start,
      modelUsed: json.model,
    };
  }

  /**
   * Stream a chat completion from Ollama, yielding text chunks.
   * Automatically strips Qwen3 <think>...</think> blocks.
   */
  async *completeStream(
    messages: ChatMessage[],
    options?: InferenceOptions,
  ): AsyncGenerator<string> {
    const model = options?.modelOverride ?? this.defaultModel;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const body = JSON.stringify({
      model,
      messages: messages as OllamaMessage[],
      stream: true,
      options: {
        temperature: options?.temperature ?? 0.7,
      },
    });

    const response = await fetchWithTimeout(
      `${this.baseUrl}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      },
      timeoutMs,
    );

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(
        `LocalModelProvider.completeStream: Ollama returned ${response.status}: ${text}`,
      );
    }

    if (!response.body) throw new Error('LocalModelProvider.completeStream: no response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const stripper = new ThinkStripper();
    let lineBuffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line) as OllamaChatResponse;
            if (parsed.message?.content) {
              const chunk = stripper.process(parsed.message.content);
              if (chunk) yield chunk;
            }
            if (parsed.done) {
              const remaining = stripper.flush();
              if (remaining) yield remaining;
              return;
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      // Flush any remaining buffer
      const remaining = stripper.flush();
      if (remaining) yield remaining;
    } finally {
      reader.releaseLock();
    }
  }

  async embed(text: string): Promise<number[]> {
    const timeoutMs = DEFAULT_TIMEOUT_MS;

    const body = JSON.stringify({
      model: this.embeddingModel,
      prompt: text,
    });

    const response = await fetchWithTimeout(
      `${this.baseUrl}/api/embeddings`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      },
      timeoutMs,
    );

    if (!response.ok) {
      const text2 = await response.text().catch(() => response.statusText);
      throw new Error(
        `LocalModelProvider.embed: Ollama returned ${response.status}: ${text2}`,
      );
    }

    const json = (await response.json()) as OllamaEmbedResponse;
    return json.embedding;
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    const checkedAt = new Date().toISOString();
    let endpointReachable = false;
    let models: ModelInfo[] = [];
    let smokeTestPassed = false;
    let smokeTestError: string | undefined;

    // 1. Check endpoint reachability and model list
    try {
      const resp = await fetchWithTimeout(
        `${this.baseUrl}/api/tags`,
        { method: 'GET' },
        10_000,
      );
      if (resp.ok) {
        endpointReachable = true;
        const json = (await resp.json()) as OllamaTagsResponse;
        models = (json.models ?? []).map((m) => ({
          name: m.name,
          available: true,
          sizeBytes: m.size,
        }));
      }
    } catch {
      // endpointReachable stays false
    }

    const installedNames = new Set(models.map((m) => m.name));

    // Normalize model name comparison: strip :latest suffix for bare names
    function modelInstalled(tag: string): boolean {
      if (installedNames.has(tag)) return true;
      if (!tag.includes(':') && installedNames.has(`${tag}:latest`)) return true;
      return false;
    }

    const defaultModelAvailable = modelInstalled(this.manifest.models.default);
    const lightweightModelAvailable = modelInstalled(this.manifest.models.lightweight);

    // 2. Smoke-test inference only if endpoint is reachable and default model is installed
    if (endpointReachable && defaultModelAvailable) {
      try {
        const schema = {
          type: 'object',
          properties: {
            intent: { type: 'string' },
            summary: { type: 'string' },
          },
          required: ['intent', 'summary'],
        };
        const result = await this.extractStructured(
          [
            {
              role: 'user',
              content: 'We need to prepare an RFP for a new digital service.',
            },
          ],
          schema,
          { temperature: 0, timeoutMs: 120_000 },
        );
        const d = result.data as { intent?: unknown; summary?: unknown };
        if (typeof d.intent === 'string' && typeof d.summary === 'string') {
          smokeTestPassed = true;
        } else {
          smokeTestError = `Schema fields present but wrong types: ${JSON.stringify(d)}`;
        }
      } catch (err) {
        smokeTestError = String(err);
      }
    } else if (!endpointReachable) {
      smokeTestError = `Ollama endpoint not reachable at ${this.baseUrl}`;
    } else {
      smokeTestError = `Default model '${this.manifest.models.default}' not installed`;
    }

    return {
      providerType: this.providerType,
      endpointReachable,
      defaultModelAvailable,
      lightweightModelAvailable,
      models,
      smokeTestPassed,
      smokeTestError,
      checkedAt,
    };
  }
}
