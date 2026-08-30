/**
 * RAG foundation types — HistoricalReference is REFERENCE only.
 * Not connected to live chat/generation or ProjectFacts.
 */

import type { HistoricalProvenanceClass } from './historicalRfp';

export type HistoricalChunkType = 'QUESTION_ANSWER' | 'SECTION' | 'MULTI_QA_TOPIC';

export type RetrievalMode = 'structured' | 'vector' | 'hybrid';

export interface HistoricalKnowledgeChunk {
  chunkId: string;
  historicalRfpId: string;
  chunkType: HistoricalChunkType;
  chunkText: string;
  contentHash: string;
  sourceSheet: string | null;
  sourceRows: number[];
  sourceAnswerIds: string[];
  sourceQuestionIds: string[];
  canonicalQuestionIds: string[];
  mappedFieldIds: string[];
  sectionIds: string[];
  extractionStatuses: string[];
  sourceLocators: string[];
  excelRelPath: string;
  excelSha256: string;
  pdfAvailable: boolean;
  provenanceClass: HistoricalProvenanceClass;
  topicKey: string | null;
  metadata: Record<string, unknown>;
}

export interface HistoricalReference {
  chunkId: string;
  score: number;
  retrievalMode: RetrievalMode;
  matchReasons: string[];
  chunkType: HistoricalChunkType;
  chunkText: string;
  historicalRfpId: string;
  historicalRfpTitle?: string;
  excelRelPath: string;
  pdfAvailable: boolean;
  sourceSheet: string | null;
  sourceRows: number[];
  sourceQuestionIds: string[];
  canonicalQuestionIds: string[];
  mappedFieldIds: string[];
  sectionIds: string[];
  sourceLocators: string[];
  extractionStatuses: string[];
  provenanceClass: HistoricalProvenanceClass;
  topicKey: string | null;
  structuralMatch: boolean;
  vectorScore: number | null;
}

export interface RetrieveHistoricalOptions {
  topK?: number;
  mode?: RetrievalMode;
  fieldIds?: string[];
  sectionIds?: string[];
  questionIds?: string[];
  historicalRfpIds?: string[];
  /** Exclude these RFPs (leave-one-out). */
  excludeHistoricalRfpIds?: string[];
  chunkTypes?: HistoricalChunkType[];
  embeddingModel?: string;
  embeddingVersion?: string;
}

export interface EmbeddingModelInfo {
  model: string;
  dims: number;
  version: string;
  license: string;
  approximateSize: string;
  reason: string;
  provider: 'ollama';
}

export const NOMIC_EMBED_INFO: EmbeddingModelInfo = {
  model: 'nomic-embed-text',
  dims: 768,
  version: 'nomic-embed-text-v1.5-ollama-prefixed',
  license: 'Apache-2.0',
  approximateSize: '~274 MB',
  reason:
    'Dedicated local embedding model via Ollama; not the chat LLM. Good default for retrieval baselines without paid APIs. Uses search_document/search_query prefixes; embedding input truncated to fit context.',
  provider: 'ollama',
};

export interface RetrievalEvalCase {
  id: string;
  task: 'FIELD' | 'QUESTION' | 'SECTION' | 'SEMANTIC' | 'PROCUREMENT_GAP';
  query: string;
  expectedFieldIds?: string[];
  expectedQuestionIds?: string[];
  expectedSectionIds?: string[];
  expectedTopicKeys?: string[];
  excludeHistoricalRfpId?: string;
  notes?: string;
}
