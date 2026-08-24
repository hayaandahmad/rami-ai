/**
 * useRamiChat — client-side hook for the Rami conversational engine.
 *
 * Manages:
 * - Conversation messages
 * - Streaming state
 * - RFP intent detection
 * - ProjectMemory update notifications
 * - localStorage persistence (backup for navigation recovery)
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationMessage, StreamEvent, RfpIntent, ExtractedFact } from '@/types/conversation';

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

function loadFromStorage(sessionId: string): StoredChat | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as StoredChat;
  } catch {
    return null;
  }
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

export type ChatStatus =
  | 'idle'
  | 'thinking'    // extraction in progress
  | 'streaming'   // response text streaming
  | 'error';

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
  const [messages, setMessages] = useState<ConversationMessage[]>(() => {
    const stored = loadFromStorage(sessionId);
    return stored?.messages ?? [];
  });
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [rfpIntent, setRfpIntent] = useState<RfpIntent>(() => {
    const stored = loadFromStorage(sessionId);
    return stored?.rfpIntent ?? 'NONE';
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Track streaming message id
  const streamingIdRef = useRef<string | null>(null);
  // Latest updated field IDs from last response
  const [lastUpdatedFields, setLastUpdatedFields] = useState<string[]>([]);

  // Persist to localStorage whenever messages change
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

      // Add user message optimistically
      const userId = `msg-${Date.now()}-u`;
      const userMsg: ConversationMessage = {
        id: userId,
        role: 'user',
        content: content.trim(),
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

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
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, isStreaming: false, content: accumulatedText }
                        : m,
                    ),
                  );
                  setStatus('idle');
                  streamingIdRef.current = null;
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
    [sessionId, documentId, status, onIntentChange, onFactsExtracted],
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
    sendMessage,
    retryLastMessage,
    clearError,
  };
}
