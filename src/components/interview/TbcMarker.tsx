import { HelpCircle } from "lucide-react";

interface TbcMarkerProps {
  className?: string;
}

export function TbcMarker({ className = "" }: TbcMarkerProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill border border-[var(--color-warning-100)] bg-[var(--color-warning-100)] px-2 py-0.5 text-caption font-medium text-[var(--color-warning-700)] ${className}`}
      aria-label="To be confirmed"
    >
      <HelpCircle aria-hidden="true" className="h-3 w-3 shrink-0" strokeWidth={2} />
      To be confirmed
    </span>
  );
}
