/**
 * ThinkingIndicator — elegant animated Rami "thinking" state.
 * Shown between message submission and first streaming token.
 */

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
      className="flex items-start gap-3 py-1"
    >
      {/* Rami avatar — small */}
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-100)] ring-1 ring-[var(--color-primary-200)]">
        <span className="text-[10px] font-semibold text-[var(--color-primary-700)] select-none">R</span>
      </div>

      {/* Dots */}
      <div className="flex items-center gap-1.5 rounded-xl px-1 py-2.5">
        <span
          className="thinking-dot h-[6px] w-[6px] rounded-full bg-[var(--color-primary-400)]"
          style={{ animationDelay: '0ms' }}
          aria-hidden="true"
        />
        <span
          className="thinking-dot h-[6px] w-[6px] rounded-full bg-[var(--color-primary-400)]"
          style={{ animationDelay: '180ms' }}
          aria-hidden="true"
        />
        <span
          className="thinking-dot h-[6px] w-[6px] rounded-full bg-[var(--color-primary-400)]"
          style={{ animationDelay: '360ms' }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
