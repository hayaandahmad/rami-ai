/**
 * ThinkingIndicator — Rami identity + "Thinking •••" while awaiting first token.
 */

'use client';

import { Sparkles } from 'lucide-react';

interface ThinkingIndicatorProps {
  visible: boolean;
}

export function ThinkingIndicator({ visible }: ThinkingIndicatorProps) {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-label="Rami is thinking"
      aria-live="polite"
      className="flex min-h-[52px] items-start gap-3 py-1"
    >
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary-100)] to-[var(--color-primary-50)] ring-1 ring-[var(--color-primary-200)]">
        <Sparkles
          aria-hidden="true"
          className="h-3.5 w-3.5 text-[var(--color-primary-700)]"
          strokeWidth={1.75}
        />
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <span className="mb-1 block text-caption font-semibold text-[var(--color-primary-800)]">
          Rami
        </span>
        <p className="text-small leading-snug text-text-secondary">
          <span>Thinking</span>
          <span className="rami-thinking-dots" aria-hidden="true">
            <span className="rami-thinking-dot">•</span>
            <span className="rami-thinking-dot">•</span>
            <span className="rami-thinking-dot">•</span>
          </span>
        </p>
      </div>
    </div>
  );
}
