import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock3,
  FileCheck2,
  Loader2,
} from "lucide-react";
import type { DocumentStatus } from "@/types/document";
import { getDocumentStatusLabel } from "@/utils/documentLabels";

interface StatusBadgeProps {
  status: DocumentStatus;
}

const statusStyles: Record<
  DocumentStatus,
  { className: string; icon: typeof Circle }
> = {
  "not-started": {
    className: "border-border bg-surface-subtle text-text-secondary",
    icon: Circle,
  },
  "in-progress": {
    className: "border-[var(--color-info-100)] bg-[var(--color-info-100)] text-[var(--color-info-700)]",
    icon: Clock3,
  },
  "needs-clarification": {
    className: "border-[var(--color-warning-100)] bg-[var(--color-warning-100)] text-[var(--color-warning-700)]",
    icon: AlertCircle,
  },
  "ready-for-review": {
    className: "border-[var(--color-primary-100)] bg-action-primary-subtle text-action-primary",
    icon: CheckCircle2,
  },
  generating: {
    className: "border-[var(--color-info-100)] bg-[var(--color-info-100)] text-[var(--color-info-700)]",
    icon: Loader2,
  },
  "draft-generated": {
    className: "border-[var(--color-success-100)] bg-[var(--color-success-100)] text-[var(--color-success-700)]",
    icon: FileCheck2,
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const label = getDocumentStatusLabel(status);
  const { className, icon: Icon } = statusStyles[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-caption font-medium ${className}`}
      aria-label={`Status: ${label}`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      <span>{label}</span>
    </span>
  );
}
