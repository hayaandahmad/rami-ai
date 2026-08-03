import { CheckCircle2, CircleDashed } from "lucide-react";
import type { DocumentTypeDefinition } from "@/data/documentTypes";
import { DOCUMENT_TYPE_ICONS } from "./visualTokens";

interface DocumentTypeCardProps {
  definition: DocumentTypeDefinition;
}

export function DocumentTypeCard({ definition }: DocumentTypeCardProps) {
  const AvailabilityIcon = definition.demoEnabled ? CheckCircle2 : CircleDashed;
  const TypeIcon = DOCUMENT_TYPE_ICONS[definition.id];

  return (
    <article className="group flex h-full min-h-[10.5rem] flex-col overflow-hidden rounded-card border border-border bg-type-card-surface shadow-card transition-elevate hover-elevate hover:border-[var(--color-primary-100)] hover:shadow-card-elevated">
      <div
        aria-hidden="true"
        className={`h-1 w-full ${
          definition.demoEnabled
            ? "bg-[var(--color-primary-600)]"
            : "bg-[var(--color-primary-200)]"
        }`}
      />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-control ${
              definition.demoEnabled
                ? "bg-[var(--color-primary-100)] text-[var(--color-primary-800)] ring-1 ring-[var(--color-primary-100)]"
                : "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] ring-1 ring-[var(--color-primary-100)]"
            }`}
          >
            <TypeIcon aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-small font-semibold text-text-primary">{definition.label}</h3>
            <p className="mt-1.5 line-clamp-2 text-caption leading-snug text-text-secondary">
              {definition.description}
            </p>
          </div>
        </div>
        <div className="mt-auto border-t border-border/70 pt-3">
          <span
            className={`inline-flex max-w-full items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-caption font-medium ${
              definition.demoEnabled
                ? "bg-[var(--color-success-100)] text-[var(--color-success-700)]"
                : "border border-border bg-surface text-text-secondary"
            }`}
          >
            <AvailabilityIcon
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0"
              strokeWidth={1.75}
            />
            <span className="truncate">{definition.availabilityLabel}</span>
          </span>
        </div>
      </div>
    </article>
  );
}
