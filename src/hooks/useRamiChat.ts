/**
 * useRamiChat — client-side hook for the Rami conversational engine.
 *
 * Manages:
 * - Conversation messages (with per-message language tag for RTL)
 * - Streaming state
 * - RFP intent detection
 * - ProjectMemory update notifications
 * - Applicability context (documentType, engagementType, applicableSectionCount)
 * - localStorage persistence (backup for navigation recovery)
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ConversationMessage,
  ConversationLanguage,
  StreamEvent,
  RfpIntent,
  ExtractedFact,
} from '@/types/conversation';
import type {
  SurfacedHistoricalReference,
  HistoricalFieldProposal,
} from '@/types/historicalProposal';

const STORAGE_KEY_PREFIX = 'rami-chat-v1:';
const MAX_STORED_MESSAGES = 50;

function storageKey(sessionId: string) {
  return `${STORAGE_KEY_PREFIX}${sessionId}`;
}

interface StoredChat {
  messages: ConversationMessage[];
  rfpIntent: RfpIntent;
  updatedAt: string;
}

function saveToStorage(sessionId: string, data: StoredChat) {
  if (typeof window === 'undefined') return;
  try {
    const toStore: StoredChat = {
      ...data,
      messages: data.messages.slice(-MAX_STORED_MESSAGES),
    };
    localStorage.setItem(storageKey(sessionId), JSON.stringify(toStore));
  } catch {
    // Storage quota — ignore silently
  }
}

/** Detect Arabic character dominance for client-side RTL rendering. */
export function detectMessageLanguage(text: string): ConversationLanguage {
  if (!text) return 'en';
  const arabicCount = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  return arabicCount / text.length > 0.15 ? 'ar' : 'en';
}

export type ChatStatus =
  | 'idle'
  | 'thinking'    // extraction in progress
  | 'streaming'   // response text streaming
  | 'error';

/** Applicability context synced from the server via SSE events. */
export interface ApplicabilityContext {
  documentType?: string;
  engagementType?: string;
  applicableSectionCount: number;
  completionPercent: number;
  collectionSufficient?: boolean;
}

export interface UseRamiChatOptions {
  sessionId: string;
  documentId?: string;
  onIntentChange?: (intent: RfpIntent) => void;
  onFactsExtracted?: (facts: ExtractedFact[], updatedFieldIds: string[]) => void;
}

export function useRamiChat({
  sessionId,
  documentId,
  onIntentChange,
  onFactsExtracted,
}: UseRamiChatOptions) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [rfpIntent, setRfpIntent] = useState<RfpIntent>('NONE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [applicabilityContext, setApplicabilityContext] = useState<ApplicabilityContext>({
    applicableSectionCount: 12, // default to mandatory count
    completionPercent: 0,
  });

  // Track streaming message id
  const streamingIdRef = useRef<string | null>(null);
  // Latest updated field IDs from last response
  const [lastUpdatedFields, setLastUpdatedFields] = useState<string[]>([]);
  const [historicalReferences, setHistoricalReferences] = useState<
    SurfacedHistoricalReference[]
  >([]);
  const [pendingProposals, setPendingProposals] = useState<HistoricalFieldProposal[]>([]);
  const [lastRetrievalDebug, setLastRetrievalDebug] = useState<
    StreamEvent['retrievalDebug'] | null
  >(null);

  const refreshProposals = useCallback(async () => {
    const key = documentId || sessionId;
    if (!key) return;
    try {
      const res = await fetch(
        `/api/rami/historical/proposals?documentKey=${encodeURIComponent(key)}&status=PENDING`,
        { cache: 'no-store' },
      );
      const data = await res.json();
      if (data.ok) setPendingProposals(data.proposals ?? []);
    } catch {
      /* ignore */
    }
  }, [documentId, sessionId]);

  // PostgreSQL is authority. Hydrate on mount; localStorage is only a UI cache.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/rami/session?sessionId=${encodeURIComponent(sessionId)}&documentId=${encodeURIComponent(documentId ?? sessionId)}`,
          { cache: 'no-store' },
        );
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          messages?: ConversationMessage[];
          rfpIntent?: RfpIntent;
          documentType?: string;
          engagementType?: string;
          applicableSectionCount?: number;
          completionPercent?: number;
          collectionSufficient?: boolean;
        };
        if (!res.ok || !data.ok) {
          if (!cancelled) {
            setErrorMessage(data.error ?? 'Could not load this project from PostgreSQL.');
          }
          return;
        }
        if (cancelled) return;
        setMessages(data.messages ?? []);
        if (data.rfpIntent) {
          setRfpIntent(data.rfpIntent);
          onIntentChange?.(data.rfpIntent);
        }
        setApplicabilityContext((prev) => ({
          ...prev,
          documentType: data.documentType ?? prev.documentType,
          engagementType: data.engagementType ?? prev.engagementType,
          applicableSectionCount: data.applicableSectionCount ?? prev.applicableSectionCount,
          completionPercent: data.completionPercent ?? prev.completionPercent,
          collectionSufficient: data.collectionSufficient ?? prev.collectionSufficient,
        }));
        if (!cancelled) void refreshProposals();
      } catch {
        if (!cancelled) {
          setErrorMessage('Could not load this project from PostgreSQL.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, documentId, onIntentChange, refreshProposals]);

  // Optional UI cache only — never authoritative
  useEffect(() => {
    if (messages.length === 0) return;
    saveToStorage(sessionId, {
      messages: messages.filter((m) => m.role !== 'system'),
      rfpIntent,
      updatedAt: new Date().toISOString(),
    });
  }, [messages, rfpIntent, sessionId]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || status === 'thinking' || status === 'streaming') return;

      setErrorMessage(null);

      // Detect language client-side for optimistic RTL rendering of user message
      const userLang = detectMessageLanguage(content.trim());

      // Add user message optimistically
      const userId = `msg-${Date.now()}-u`;
      const userMsg: ConversationMessage = {
        id: userId,
        role: 'user',
        content: content.trim(),
        language: userLang,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setHistoricalReferences([]);

      // Add placeholder assistant message
      const assistantId = `msg-${Date.now()}-a`;
      streamingIdRef.current = assistantId;
      const placeholderMsg: ConversationMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        isStreaming: true,
      };
      setMessages((prev) => [...prev, placeholderMsg]);
      setStatus('thinking');

      try {
        const response = await fetch('/api/rami/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, documentId, message: content.trim() }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`API error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let lineBuffer = '';
        let accumulatedText = '';
        let responseLang: ConversationLanguage = userLang;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split('\n');
          lineBuffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6);
            if (!jsonStr.trim()) continue;

            try {
              const event = JSON.parse(jsonStr) as StreamEvent;

              switch (event.type) {
                case 'thinking':
                  setStatus('thinking');
                  break;

                case 'facts':
                  if (event.facts && event.updatedFieldIds) {
                    onFactsExtracted?.(event.facts, event.updatedFieldIds);
                    setLastUpdatedFields(event.updatedFieldIds);
                  }
                  if (event.rfpIntent) {
                    setRfpIntent(event.rfpIntent);
                    onIntentChange?.(event.rfpIntent);
                  }
                  if (event.language) responseLang = event.language;
                  setApplicabilityContext((prev) => ({
                    ...prev,
                    documentType: event.documentType ?? prev.documentType,
                    engagementType: event.engagementType ?? prev.engagementType,
                    applicableSectionCount:
                      event.applicableSectionCount !== undefined
                        ? event.applicableSectionCount
                        : prev.applicableSectionCount,
                    completionPercent:
                      event.completionPercent !== undefined
                        ? event.completionPercent
                        : prev.completionPercent,
                    collectionSufficient:
                      event.collectionSufficient ?? prev.collectionSufficient,
                  }));
                  break;

                case 'historical_references':
                  if (event.historicalReferences) {
                    setHistoricalReferences(event.historicalReferences);
                  }
                  if (event.retrievalDebug) {
                    setLastRetrievalDebug(event.retrievalDebug);
                  }
                  break;

                case 'text':
                  if (event.chunk) {
                    setStatus('streaming');
                    accumulatedText += event.chunk;
                    const currentId = assistantId;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === currentId
                          ? { ...m, content: accumulatedText, isStreaming: true }
                          : m,
                      ),
                    );
                  }
                  break;

                case 'done':
                  if (event.rfpIntent) {
                    setRfpIntent(event.rfpIntent);
                    onIntentChange?.(event.rfpIntent);
                  }
                  if (event.updatedFieldIds) {
                    setLastUpdatedFields(event.updatedFieldIds);
                  }
                  if (event.language) responseLang = event.language;
                  if (event.historicalReferences?.length) {
                    setHistoricalReferences(event.historicalReferences);
                  }
                  if (event.retrievalDebug) {
                    setLastRetrievalDebug(event.retrievalDebug);
                  }
                  if (event.applicableSectionCount !== undefined) {
                    setApplicabilityContext((prev) => ({
                      ...prev,
                      documentType: event.documentType,
                      engagementType: event.engagementType,
                      applicableSectionCount: event.applicableSectionCount!,
                      completionPercent:
                        event.completionPercent !== undefined
                          ? event.completionPercent
                          : prev.completionPercent,
                      collectionSufficient:
                        event.collectionSufficient ?? prev.collectionSufficient,
                    }));
                  }
                  // Tag the assistant message with server-confirmed language
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? {
                            ...m,
                            isStreaming: false,
                            content: accumulatedText,
                            language: responseLang,
                          }
                        : m,
                    ),
                  );
                  setStatus('idle');
                  streamingIdRef.current = null;
                  void refreshProposals();
                  break;

                case 'error':
                  throw new Error(event.message ?? 'Unknown error');
              }
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue; // skip bad JSON
              throw parseErr;
            }
          }
        }

        // Ensure status is idle even if 'done' event was missed
        setStatus('idle');
        streamingIdRef.current = null;

      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Rami is unavailable. Please try again.';
        setErrorMessage(msg);
        setStatus('error');
        streamingIdRef.current = null;

        // Remove the failed assistant placeholder
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      }
    },
    [sessionId, documentId, status, onIntentChange, onFactsExtracted, refreshProposals],
  );

  const retryLastMessage = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    setErrorMessage(null);
    setStatus('idle');
    sendMessage(lastUser.content);
  }, [messages, sendMessage]);

  const clearError = useCallback(() => {
    setErrorMessage(null);
    setStatus('idle');
  }, []);

  const isGenerating = status === 'thinking' || status === 'streaming';

  return {
    messages: messages.filter((m) => m.role !== 'system'),
    status,
    isGenerating,
    rfpIntent,
    errorMessage,
    lastUpdatedFields,
    applicabilityContext,
    historicalReferences,
    pendingProposals,
    lastRetrievalDebug,
    refreshProposals,
    sendMessage,
    retryLastMessage,
    clearError,
  };
}
