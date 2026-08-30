/**
 * RamiEmbeddingProvider — local Ollama embeddings (not chat generation).
 *
 * nomic-embed-text context is limited; we truncate embedding *input* only.
 * Full chunk_text remains stored for display/traceability.
 */

import { NOMIC_EMBED_INFO, type EmbeddingModelInfo } from '@/types/historicalRag';

/** Conservative char cap for nomic-embed-text via Ollama (~8192 tokens). */
export const EMBED_INPUT_MAX_CHARS = 6000;

export type EmbedRole = 'document' | 'query';

export interface RamiEmbeddingProvider {
  readonly info: EmbeddingModelInfo;
  embed(text: string, role?: EmbedRole): Promise<number[]>;
  embedBatch(texts: string[], role?: EmbedRole): Promise<number[][]>;
}

function getOllamaBase(): string {
  return (process.env.RAMI_OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');
}

/**
 * Prepare text for nomic-embed-text: task prefix + truncate (head+tail).
 * Metadata stays out of the embedding string by design (callers pass chunk_text only).
 */
export function prepareEmbedInput(
  text: string,
  role: EmbedRole = 'document',
  maxChars = EMBED_INPUT_MAX_CHARS,
): string {
  const prefix = role === 'query' ? 'search_query: ' : 'search_document: ';
  const body = text.trim();
  let clipped = body;
  if (body.length > maxChars) {
    const head = Math.floor(maxChars * 0.7);
    const tail = maxChars - head - 20;
    clipped = `${body.slice(0, head)}\n…[truncated]…\n${body.slice(-Math.max(0, tail))}`;
  }
  return `${prefix}${clipped}`;
}

export class OllamaEmbeddingProvider implements RamiEmbeddingProvider {
  readonly info: EmbeddingModelInfo;

  constructor(info: EmbeddingModelInfo = NOMIC_EMBED_INFO) {
    this.info = info;
  }

  async embed(text: string, role: EmbedRole = 'document'): Promise<number[]> {
    const prompt = prepareEmbedInput(text, role);
    const res = await fetch(`${getOllamaBase()}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.info.model,
        prompt,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Ollama embeddings failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as { embedding?: number[] };
    if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
      throw new Error('Ollama embeddings returned empty vector');
    }
    if (data.embedding.length !== this.info.dims) {
      // Allow model dim drift but record actual
      (this.info as { dims: number }).dims = data.embedding.length;
    }
    return data.embedding;
  }

  async embedBatch(texts: string[], role: EmbedRole = 'document'): Promise<number[][]> {
    const out: number[][] = [];
    for (const t of texts) {
      out.push(await this.embed(t, role));
    }
    return out;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function getDefaultEmbeddingProvider(): RamiEmbeddingProvider {
  return new OllamaEmbeddingProvider();
}
