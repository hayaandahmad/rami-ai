/**
 * Conversation domain types for Phase 2 Rami chat.
 * Authority: .private-context/architecture/rami-agent-architecture.md
 */

/** A single message in the Rami conversation. */
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string; // ISO-8601
  /** Streaming is in progress for this message (assistant only). */
  isStreaming?: boolean;
  /** Extracted facts from this message (assistant acknowledgement metadata). */
  extractedFieldIds?: string[];
}

/** High-level RFP intent state. */
export type RfpIntent = 'NONE' | 'POSSIBLE' | 'CREATE_RFP';

/** Phase 2 action types (extensible for Phase 3 RAG). */
export type NextAction =
  | { type: 'ASK_FIELD'; fieldId: string; label: string }
  | { type: 'PROPOSE_VALUE'; fieldId: string; proposedValue: unknown }
  | { type: 'SEARCH_HISTORICAL_RFPS'; fieldId: string }  // Phase 3
  | { type: 'READY_TO_DRAFT'; sectionId: string }          // Phase 4
  | { type: 'OPEN_ENDED' };                                // free conversation

/** The full runtime conversational session. */
export interface RamiConversation {
  sessionId: string;
  documentId?: string;
  rfpIntent: RfpIntent;
  messages: ConversationMessage[];
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
}

/** Result of the structured extraction call. */
export interface ExtractionResult {
  extractedFacts: ExtractedFact[];
  rfpIntentSignal: RfpIntent;
  /** Model's own brief acknowledgement used to inform response (not shown directly). */
  internalContext?: string;
}

/** Gap analysis result from deterministic gap engine. */
export interface GapAnalysis {
  missingRequired: string[];      // fieldIds
  missingConditional: string[];   // fieldIds (applicable but missing)
  tbcFields: string[];            // fieldIds marked TBC
  filledCount: number;
  totalRequired: number;
  completionPercent: number;
  nextPriorityFieldId: string | null;
  nextPriorityLabel: string | null;
}

/** SSE event types sent from the API to the client. */
export type StreamEventType = 'thinking' | 'facts' | 'text' | 'done' | 'error';

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
  /** For 'error' */
  message?: string;
}
