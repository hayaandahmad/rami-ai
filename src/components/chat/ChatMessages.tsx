/**
 * ChatMessages — scrollable message list with auto-scroll behavior.
 * Smart scroll: follows new content unless user has scrolled up.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import type { ConversationMessage } from '@/types/conversation';
import type { ChatStatus } from '@/hooks/useRamiChat';
import { RamiMessage } from './RamiMessage';
import { UserMessage } from './UserMessage';
import { ThinkingIndicator } from './ThinkingIndicator';

interface ChatMessagesProps {
  messages: ConversationMessage[];
  status: ChatStatus;
  errorMessage: string | null;
  onRetry: () => void;
  onClearError: () => void;
}

const SCROLL_THRESHOLD = 80; // px from bottom to consider "at bottom"

export function ChatMessages({
  messages,
  status,
  errorMessage,
  onRetry,
  onClearError,
}: ChatMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const userScrolledUpRef = useRef(false);

  // Track whether user has scrolled up
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUpRef.current = distanceFromBottom > SCROLL_THRESHOLD;
    setShowScrollButton(distanceFromBottom > SCROLL_THRESHOLD + 20);
  };

  // Auto-scroll when new content arrives, unless user has scrolled up
  useEffect(() => {
    if (!userScrolledUpRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, status]);

  const scrollToBottom = () => {
    userScrolledUpRef.current = false;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollButton(false);
  };

  const isThinking = status === 'thinking';
  const lastMessage = messages[messages.length - 1];
  const isStreamingLast = lastMessage?.role === 'assistant' && lastMessage?.isStreaming;

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        className="h-full overflow-y-auto scroll-smooth"
        onScroll={handleScroll}
      >
        <div className="mx-auto max-w-2xl px-4 py-6 xl:px-0">
          {/* Empty state */}
          {messages.length === 0 && !isThinking && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-body text-text-muted">
                Tell me about the project you&apos;d like to work on.
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="flex flex-col gap-6">
            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.role === 'assistant' ? (
                  <RamiMessage message={msg} />
                ) : (
                  <UserMessage message={msg} />
                )}
              </div>
            ))}

            {/* Thinking indicator — shown when thinking but no streaming yet */}
            <ThinkingIndicator visible={isThinking && !isStreamingLast} />

            {/* Error state */}
            {errorMessage && status === 'error' && (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-error-100)] ring-1 ring-[var(--color-error-700)]/20">
                  <span className="text-[10px] font-bold text-[var(--color-error-700)]">!</span>
                </div>
                <div className="flex-1">
                  <p className="text-small text-[var(--color-error-700)]">
                    {errorMessage.includes('Ollama') || errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED')
                      ? "Rami's local AI service is currently unavailable. Make sure Ollama is running."
                      : errorMessage}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={onRetry}
                      className="text-small font-medium text-[var(--color-primary-700)] underline underline-offset-2 hover:no-underline"
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={onClearError}
                      className="text-small text-text-muted hover:text-text-secondary"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div ref={bottomRef} className="h-4" />
        </div>
      </div>

      {/* Jump to latest button */}
      {showScrollButton && (
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label="Jump to latest message"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-caption font-medium text-text-secondary shadow-card-elevated transition-hover hover:bg-surface-subtle"
        >
          <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
          Latest
        </button>
      )}
    </div>
  );
}
