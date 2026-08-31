/**
 * ChatMessages — scrollable message list with auto-scroll behavior.
 * Smart scroll: follows new content unless user has scrolled up.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import type { ConversationMessage } from '@/types/conversation';
import type { ChatStatus } from '@/hooks/useRamiChat';
import type { SurfacedHistoricalReference, HistoricalFieldProposal } from '@/types/historicalProposal';
import { RamiMessage } from './RamiMessage';
import { UserMessage } from './UserMessage';
import { ThinkingIndicator } from './ThinkingIndicator';
import { HistoricalReferenceCard } from './HistoricalReferenceCard';
import { PendingProposalCard } from './PendingProposalCard';

interface ChatMessagesProps {
  messages: ConversationMessage[];
  status: ChatStatus;
  errorMessage: string | null;
  onRetry: () => void;
  onClearError: () => void;
  historicalReferences?: SurfacedHistoricalReference[];
  documentKey?: string;
  pendingProposals?: HistoricalFieldProposal[];
  onProposalChanged?: () => void;
  currentlyClarifying?: string | null;
}

const SCROLL_THRESHOLD = 80;

export function ChatMessages({
  messages,
  status,
  errorMessage,
  onRetry,
  onClearError,
  historicalReferences = [],
  documentKey,
  pendingProposals = [],
  onProposalChanged,
  currentlyClarifying,
}: ChatMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const userScrolledUpRef = useRef(false);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUpRef.current = distanceFromBottom > SCROLL_THRESHOLD;
    setShowScrollButton(distanceFromBottom > SCROLL_THRESHOLD + 20);
  };

  useEffect(() => {
    if (!userScrolledUpRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, status, historicalReferences.length]);

  const scrollToBottom = () => {
    userScrolledUpRef.current = false;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollButton(false);
  };

  const isThinking = status === 'thinking';
  const lastMessage = messages[messages.length - 1];
  const isStreamingLast = lastMessage?.role === 'assistant' && lastMessage?.isStreaming;
  const visibleRefs = historicalReferences.filter((r) => !dismissed.has(r.chunkId));

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        className="h-full overflow-y-auto scroll-smooth"
        onScroll={handleScroll}
      >
        <div className="mx-auto max-w-2xl px-4 py-6 xl:px-0">
          {messages.length === 0 && !isThinking && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-body text-text-muted">
                Tell me about the project you&apos;d like to work on.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-6">
            {currentlyClarifying && messages.length > 0 && (
              <p className="rounded-md border border-[var(--color-primary-100)] bg-[var(--color-primary-50)] px-3 py-2 text-caption text-[var(--color-primary-800)]">
                {currentlyClarifying}
              </p>
            )}
            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.role === 'assistant' ? (
                  <RamiMessage message={msg} />
                ) : (
                  <UserMessage message={msg} />
                )}
              </div>
            ))}

            {documentKey && visibleRefs.length > 0 && !isThinking && (
              <div className="flex flex-col gap-3">
                <p className="text-caption font-semibold uppercase tracking-wide text-text-muted">
                  Historical references (not current project facts)
                </p>
                {visibleRefs.map((ref) => (
                  <HistoricalReferenceCard
                    key={ref.chunkId}
                    reference={ref}
                    documentKey={documentKey}
                    defaultFieldId={ref.mappedFieldIds[0]}
                    onProposed={() => onProposalChanged?.()}
                    onDismiss={(id: string) => setDismissed((prev) => new Set(prev).add(id))}
                  />
                ))}
              </div>
            )}

            {documentKey && pendingProposals.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-caption font-semibold uppercase tracking-wide text-text-muted">
                  Suggested information — not confirmed for this project
                </p>
                {pendingProposals.map((p) => (
                  <PendingProposalCard
                    key={p.proposalId}
                    proposal={p}
                    documentKey={documentKey}
                    onChanged={onProposalChanged}
                  />
                ))}
              </div>
            )}

            <ThinkingIndicator visible={isThinking && !isStreamingLast} />

            {errorMessage && status === 'error' && (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-error-100)] ring-1 ring-[var(--color-error-700)]/20">
                  <span className="text-[10px] font-bold text-[var(--color-error-700)]">!</span>
                </div>
                <div className="flex-1">
                  <p className="text-small text-[var(--color-error-700)]">
                    {errorMessage.includes('Ollama') ||
                    errorMessage.includes('fetch') ||
                    errorMessage.includes('ECONNREFUSED')
                      ? "Rami cannot reach the local AI service. Make sure Ollama is running, then retry."
                      : errorMessage.includes('Start Rami')
                        ? 'Start Rami from the engine control when using Modal, then retry.'
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
