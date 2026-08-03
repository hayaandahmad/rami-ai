import { AlertCircle } from "lucide-react";

interface InlineValidationProps {
  message: string | null;
  id?: string;
}

export function InlineValidation({ message, id }: InlineValidationProps) {
  if (!message) return null;

  return (
    <div
      id={id}
      role="alert"
      className="flex items-start gap-2 rounded-control border border-[var(--color-error-100)] bg-[var(--color-error-100)] px-3 py-2.5 text-small text-[var(--color-error-700)]"
    >
      <AlertCircle
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 shrink-0"
        strokeWidth={1.75}
      />
      <span>{message}</span>
    </div>
  );
}
