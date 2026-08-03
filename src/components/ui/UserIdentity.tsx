interface UserIdentityProps {
  compact?: boolean;
}

export function UserIdentity({ compact = false }: UserIdentityProps) {
  return (
    <div
      className={`flex items-center gap-3 ${compact ? "" : "min-w-0"}`}
      aria-label="Ahmad Mahmoud, Business Analyst"
    >
      <div
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-100)] text-xs font-semibold text-[var(--color-primary-800)] md:h-10 md:w-10 md:text-sm"
      >
        AM
      </div>
      {!compact ? (
        <div className="hidden min-w-0 sm:block">
          <p className="whitespace-nowrap text-small font-medium text-text-primary">
            Ahmad Mahmoud
          </p>
          <p className="whitespace-nowrap text-caption text-text-secondary">
            Business Analyst
          </p>
        </div>
      ) : (
        <span className="sr-only">Ahmad Mahmoud, Business Analyst</span>
      )}
    </div>
  );
}
