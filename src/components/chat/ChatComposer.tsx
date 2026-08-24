/**
 * ChatComposer — premium message input with auto-grow, keyboard handling,
 * and graceful loading/disabled states.
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';
import type { ChatStatus } from '@/hooks/useRamiChat';

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  status: ChatStatus;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  status,
  placeholder = 'Message Rami…',
  disabled = false,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isGenerating = status === 'thinking' || status === 'streaming';
  const canSubmit = value.trim().length > 0 && !isGenerating && !disabled;

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 160;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (canSubmit) onSubmit();
      }
    },
    [canSubmit, onSubmit],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (canSubmit) onSubmit();
    },
    [canSubmit, onSubmit],
  );

  return (
    <div className="border-t border-border bg-surface">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-2xl px-4 py-3 xl:px-0"
      >
        <div className="flex items-end gap-2 rounded-xl border border-border bg-[var(--color-neutral-50)] px-3 py-2 shadow-card transition-colors focus-within:border-[var(--color-primary-300)] focus-within:ring-1 focus-within:ring-[var(--color-primary-200)]">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isGenerating || disabled}
            rows={1}
            aria-label="Message to Rami"
            className="flex-1 resize-none bg-transparent text-body text-text-primary placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!canSubmit}
            aria-label={isGenerating ? 'Rami is responding…' : 'Send message'}
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-800)] text-white transition-hover hover:bg-[var(--color-primary-900)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
          >
            {isGenerating ? (
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
                strokeWidth={2}
              />
            ) : (
              <ArrowUp aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
            )}
          </button>
        </div>

        <p className="mt-1.5 text-center text-caption text-text-muted">
          {isGenerating ? (
            <span className="text-[var(--color-primary-700)]">
              {status === 'thinking' ? 'Processing your message…' : 'Rami is responding…'}
            </span>
          ) : (
            'Enter to send · Shift+Enter for new line'
          )}
        </p>
      </form>
    </div>
  );
}
