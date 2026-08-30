/**
 * Historical retrieval — structured / vector / hybrid.
 * Returns REFERENCE HistoricalReference only. No ProjectFacts writes. No chat injection.
 */

import {
  cosineSimilarity,
  getDefaultEmbeddingProvider,
  type RamiEmbeddingProvider,
} from '@/server/ai/RamiEmbeddingProvider';
import { getHistoricalDocument } from '@/server/rami/historicalRepository';
import {
  listChunks,
  listEmbeddings,
} from '@/server/rami/historicalChunkRepository';
import type {
  HistoricalKnowledgeChunk,
  HistoricalReference,
  RetrieveHistoricalOptions,
  RetrievalMode,
} from '@/types/historicalRag';
import { NOMIC_EMBED_INFO } from '@/types/historicalRag';

function intersects(a: string[], b: string[]): boolean {
  if (!b.length) return true;
  const set = new Set(a);
  return b.some((x) => set.has(x));
}

function structuralFilter(
  chunk: HistoricalKnowledgeChunk,
  opts: RetrieveHistoricalOptions,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (opts.excludeHistoricalRfpIds?.includes(chunk.historicalRfpId)) {
    return { ok: false, reasons: [] };
  }
  if (opts.historicalRfpIds?.length && !opts.historicalRfpIds.includes(chunk.historicalRfpId)) {
    return { ok: false, reasons: [] };
  }
  if (opts.chunkTypes?.length && !opts.chunkTypes.includes(chunk.chunkType)) {
    return { ok: false, reasons: [] };
  }
  if (opts.fieldIds?.length) {
    if (!intersects(chunk.mappedFieldIds, opts.fieldIds)) return { ok: false, reasons: [] };
    reasons.push(`field_filter:${opts.fieldIds.join(',')}`);
  }
  if (opts.sectionIds?.length) {
    if (!intersects(chunk.sectionIds, opts.sectionIds)) return { ok: false, reasons: [] };
    reasons.push(`section_filter:${opts.sectionIds.join(',')}`);
  }
  if (opts.questionIds?.length) {
    const qok =
      intersects(chunk.canonicalQuestionIds, opts.questionIds) ||
      intersects(chunk.sourceQuestionIds, opts.questionIds);
    if (!qok) return { ok: false, reasons: [] };
    reasons.push(`question_filter:${opts.questionIds.join(',')}`);
  }
  return { ok: true, reasons };
}

function structuralScore(
  chunk: HistoricalKnowledgeChunk,
  opts: RetrieveHistoricalOptions,
  query: string,
): number {
  let score = 0;
  if (opts.fieldIds?.length) {
    const hits = opts.fieldIds.filter((f) => chunk.mappedFieldIds.includes(f)).length;
    score += hits * 3;
  }
  if (opts.sectionIds?.length) {
    const hits = opts.sectionIds.filter((s) => chunk.sectionIds.includes(s)).length;
    score += hits * 2;
  }
  if (opts.questionIds?.length) {
    const hits = opts.questionIds.filter(
      (q) =>
        chunk.canonicalQuestionIds.includes(q) || chunk.sourceQuestionIds.includes(q),
    ).length;
    score += hits * 4;
  }
  // light lexical bonus
  const q = query.toLowerCase();
  if (q && chunk.chunkText.toLowerCase().includes(q.slice(0, 40))) score += 0.5;
  if (chunk.topicKey && q.includes(chunk.topicKey.replace(/^gap:/, '').toLowerCase())) {
    score += 1;
  }
  return score;
}

async function toReference(
  chunk: HistoricalKnowledgeChunk,
  score: number,
  mode: RetrievalMode,
  matchReasons: string[],
  vectorScore: number | null,
  structuralMatch: boolean,
): Promise<HistoricalReference> {
  const doc = await getHistoricalDocument(chunk.historicalRfpId);
  return {
    chunkId: chunk.chunkId,
    score,
    retrievalMode: mode,
    matchReasons,
    chunkType: chunk.chunkType,
    chunkText: chunk.chunkText,
    historicalRfpId: chunk.historicalRfpId,
    historicalRfpTitle: doc?.title,
    excelRelPath: chunk.excelRelPath,
    pdfAvailable: chunk.pdfAvailable,
    sourceSheet: chunk.sourceSheet,
    sourceRows: chunk.sourceRows,
    sourceQuestionIds: chunk.sourceQuestionIds,
    canonicalQuestionIds: chunk.canonicalQuestionIds,
    mappedFieldIds: chunk.mappedFieldIds,
    sectionIds: chunk.sectionIds,
    sourceLocators: chunk.sourceLocators,
    extractionStatuses: chunk.extractionStatuses,
    provenanceClass: 'REFERENCE',
    topicKey: chunk.topicKey,
    structuralMatch,
    vectorScore,
  };
}

export async function retrieveHistoricalReferences(
  queryText: string,
  options: RetrieveHistoricalOptions = {},
  provider: RamiEmbeddingProvider = getDefaultEmbeddingProvider(),
): Promise<HistoricalReference[]> {
  const topK = options.topK ?? 8;
  const mode: RetrievalMode = options.mode ?? 'hybrid';
  const model = options.embeddingModel ?? NOMIC_EMBED_INFO.model;
  const version = options.embeddingVersion ?? NOMIC_EMBED_INFO.version;

  const chunks = await listChunks({
    excludeHistoricalRfpIds: options.excludeHistoricalRfpIds,
    chunkTypes: options.chunkTypes,
    historicalRfpId: options.historicalRfpIds?.length === 1 ? options.historicalRfpIds[0] : undefined,
  });

  const filtered: Array<{
    chunk: HistoricalKnowledgeChunk;
    structuralReasons: string[];
    structuralScore: number;
  }> = [];

  for (const chunk of chunks) {
    if (options.historicalRfpIds?.length && options.historicalRfpIds.length > 1) {
      if (!options.historicalRfpIds.includes(chunk.historicalRfpId)) continue;
    }
    const { ok, reasons } = structuralFilter(chunk, options);
    if (!ok) continue;
    // For structured/hybrid with filters, require filter pass (already).
    // For vector-only without filters, all chunks eligible.
    if (
      mode !== 'vector' &&
      (options.fieldIds?.length ||
        options.sectionIds?.length ||
        options.questionIds?.length)
    ) {
      // already filtered
    }
    filtered.push({
      chunk,
      structuralReasons: reasons,
      structuralScore: structuralScore(chunk, options, queryText),
    });
  }

  // Structured-only: candidates that have positive structural score, or all if no filters
  if (mode === 'structured') {
    const ranked = [...filtered]
      .map((x) => ({
        ...x,
        score:
          x.structuralScore ||
          (options.fieldIds?.length || options.sectionIds?.length || options.questionIds?.length
            ? x.structuralScore
            : lexicalOverlap(queryText, x.chunk.chunkText)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    const out: HistoricalReference[] = [];
    for (const r of ranked) {
      out.push(
        await toReference(
          r.chunk,
          r.score,
          'structured',
          [...r.structuralReasons, 'structured_rank'],
          null,
          r.structuralReasons.length > 0 || r.structuralScore > 0,
        ),
      );
    }
    return out;
  }

  const embeddings = await listEmbeddings({
    embeddingModel: model,
    embeddingVersion: version,
  });
  const embMap = new Map(embeddings.map((e) => [e.chunkId, e.embedding]));
  const queryVec = await provider.embed(queryText, 'query');

  const scored = filtered
    .map((x) => {
      const vec = embMap.get(x.chunk.chunkId);
      const vectorScore = vec ? cosineSimilarity(queryVec, vec) : -1;
      let score = vectorScore;
      const reasons = [...x.structuralReasons, 'vector_cosine'];
      if (mode === 'hybrid') {
        // Normalize structural into ~0-1 then blend
        const structNorm = Math.min(1, x.structuralScore / 8);
        const hasStructFilter = Boolean(
          options.fieldIds?.length ||
            options.sectionIds?.length ||
            options.questionIds?.length,
        );
        if (hasStructFilter) {
          score = 0.55 * vectorScore + 0.45 * structNorm;
          reasons.push('hybrid_blend');
        } else {
          score = 0.85 * vectorScore + 0.15 * Math.min(1, lexicalOverlap(queryText, x.chunk.chunkText));
          reasons.push('hybrid_light_lexical');
        }
      }
      return { ...x, vectorScore, score, reasons };
    })
    .filter((x) => x.vectorScore >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const out: HistoricalReference[] = [];
  for (const r of scored) {
    out.push(
      await toReference(
        r.chunk,
        r.score,
        mode,
        r.reasons,
        r.vectorScore,
        r.structuralReasons.length > 0,
      ),
    );
  }
  return out;
}

function lexicalOverlap(query: string, text: string): number {
  const qTokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 3);
  if (!qTokens.length) return 0;
  const lower = text.toLowerCase();
  let hits = 0;
  for (const t of qTokens) if (lower.includes(t)) hits++;
  return hits / qTokens.length;
}
