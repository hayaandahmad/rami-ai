/**
 * ThinkingState — shows a brief Rami "checking" indicator before follow-up appears.
 */
interface ThinkingStateProps {
  visible: boolean;
}

export function ThinkingState({ visible }: ThinkingStateProps) {
  if (!visible) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      role="status"
      className="flex items-center gap-3 rounded-control border border-[var(--color-primary-100)] bg-[var(--color-primary-50)] px-4 py-3.5"
    >
      <span aria-hidden="true" className="flex gap-1.5">
        <span className="thinking-dot h-2 w-2 rounded-full bg-[var(--color-primary-500)]" />
        <span className="thinking-dot h-2 w-2 rounded-full bg-[var(--color-primary-500)]" />
        <span className="thinking-dot h-2 w-2 rounded-full bg-[var(--color-primary-500)]" />
      </span>
      <span className="text-small text-[var(--color-primary-800)]">
        Rami is checking whether more detail is needed…
      </span>
    </div>
  );
}
