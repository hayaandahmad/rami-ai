interface UserIdentityProps {
  compact?: boolean;
}

const USER_NAME = "HAYA ALGHNIEMAT";
const USER_ROLE = "Business Analyst";
const USER_INITIALS = "HA";

export function UserIdentity({ compact = false }: UserIdentityProps) {
  return (
    <div
      className={`flex items-center gap-3 ${compact ? "" : "min-w-0"}`}
      aria-label={`${USER_NAME}, ${USER_ROLE}`}
    >
      <div
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-100)] text-xs font-semibold text-[var(--color-primary-800)] md:h-10 md:w-10 md:text-sm"
      >
        {USER_INITIALS}
      </div>
      {!compact ? (
        <div className="hidden min-w-0 sm:block">
          <p className="whitespace-nowrap text-small font-medium text-text-primary">
            {USER_NAME}
          </p>
          <p className="whitespace-nowrap text-caption text-text-secondary">
            {USER_ROLE}
          </p>
        </div>
      ) : (
        <span className="sr-only">{`${USER_NAME}, ${USER_ROLE}`}</span>
      )}
    </div>
  );
}
