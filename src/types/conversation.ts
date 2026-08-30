/**
 * Conversation domain types for Phase 2 Rami chat.
 * Authority: .private-context/architecture/rami-agent-architecture.md
 */

/** Conversation language detected from user messages. */
export type ConversationLanguage = 'ar' | 'en';

/** A single message in the Rami conversation. */
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string; // ISO-8601
  /** Dominant language of this message. */
  language?: ConversationLanguage;
  /** Streaming is in progress for this message (assistant only). */
  isStreaming?: boolean;
  /** Extracted facts from this message (assistant acknowledgement metadata). */
  extractedFieldIds?: string[];
}

/** High-level RFP intent state. */
export type RfpIntent = 'NONE' | 'POSSIBLE' | 'CREATE_RFP';

/** Re-export Phase 2.2 NextAction (ASK_REQUIREMENTS cluster, etc.). */
export type { NextAction, ClarifyTargetKind } from './nextAction';
export { normalizeAskRequirements } from './nextAction';

/** The full runtime conversational session. */
export interface RamiConversation {
  sessionId: string;
  documentId?: string;
  rfpIntent: RfpIntent;
  messages: ConversationMessage[];
  /** Dominant language of the conversation so far. */
  language: ConversationLanguage;
  /** Canonical section currently being worked on (null = pre-RFP). */
  activeSection: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Fact extracted by LLM from a BA message. */
export interface ExtractedFact {
  fieldId: string;
  value: unknown;
  /** 'high' = explicitly stated; 'medium' = inferred */
  confidence: 'high' | 'medium';
  /** Phase 2.2: assert | correction | conflict */
  updateKind?: 'assert' | 'correction' | 'conflict';
}

/** Result of the structured extraction call. */
export interface ExtractionResult {
  extractedFacts: ExtractedFact[];
  rfpIntentSignal: RfpIntent;
  /** Model's own brief acknowledgement used to inform response (not shown directly). */
  internalContext?: string;
}

import type { NextAction } from './nextAction';
import type { GapStatus, Materiality } from './gapStatus';
import type { PackId } from './projectContext';

/** Per-field gap snapshot from gap engine v2. */
export interface FieldGapSnapshot {
  fieldId: string;
  gapStatus: GapStatus;
  materiality: Materiality;
  packs: PackId[];
  deferredTo?: string;
}

/** Gap analysis result from deterministic gap engine (Phase 2.2). */
export interface GapAnalysis {
  /** @deprecated Prefer fieldGaps; kept for Phase 2.1 callers. */
  missingRequired: string[];
  /** @deprecated Prefer fieldGaps. */
  missingConditional: string[];
  /** Fields with GapStatus UNKNOWN or legacy provenance TBC. */
  tbcFields: string[];
  filledCount: number;
  totalRequired: number;
  completionPercent: number;
  applicableSectionCount: number;
  /** @deprecated Prefer nextAction ASK_REQUIREMENTS.primaryFieldId */
  nextPriorityFieldId: string | null;
  nextPriorityLabel: string | null;
  /** Phase 2.2: full per-field gap snapshots for active/applicable fields. */
  fieldGaps: FieldGapSnapshot[];
  /** Deterministic next action for the phraser. */
  nextAction: NextAction;
  /** Materiality-based stop — never a field-count threshold. */
  collectionSufficient: boolean;
}

/** SSE event types sent from the API to the client. */
export type StreamEventType =
  | 'thinking'
  | 'facts'
  | 'text'
  | 'done'
  | 'error'
  | 'historical_references';

export interface StreamEvent {
  type: StreamEventType;
  /** For 'facts': array of extracted facts */
  facts?: ExtractedFact[];
  /** For 'text': the next chunk of text */
  chunk?: string;
  /** For 'done': session metadata */
  sessionId?: string;
  updatedFieldIds?: string[];
  rfpIntent?: RfpIntent;
  /** Language used in this response */
  language?: ConversationLanguage;
  /** Document type for applicability context */
  documentType?: string;
  /** Engagement type for applicability context */
  engagementType?: string;
  /** Number of applicable sections */
  applicableSectionCount?: number;
  /** Server-authoritative information completeness (0–100). */
  completionPercent?: number;
  /** Materiality-based stop flag. */
  collectionSufficient?: boolean;
  /** Serialized next action for client debugging / UI. */
  nextActionType?: string;
  /** Controlled RAG: historical references for UI (never ProjectFacts). */
  historicalReferences?: import('./historicalProposal').SurfacedHistoricalReference[];
  retrievalDebug?: {
    triggered: boolean;
    mode?: string;
    trigger?: string;
    reason?: string;
    query?: string;
    fieldIds?: string[];
    sectionIds?: string[];
    topK?: number;
  };
  /** For 'error' */
  message?: string;
}
