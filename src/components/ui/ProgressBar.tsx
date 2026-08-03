interface ProgressBarProps {
  value: number;
  label?: string;
  id: string;
}

export function ProgressBar({
  value,
  label = "Progress",
  id,
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const labelId = `${id}-label`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-caption">
        <span id={labelId} className="font-medium text-text-muted">
          {label}
        </span>
        <span className="font-semibold text-text-primary" aria-hidden="true">
          {clampedValue}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-labelledby={labelId}
        aria-valuetext={`${clampedValue} percent complete`}
        className="h-2.5 overflow-hidden rounded-pill bg-[var(--color-neutral-200)]"
      >
        <div
          className="h-full rounded-pill bg-action-primary transition-panel"
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}
