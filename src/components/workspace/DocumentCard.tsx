"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Building2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DOCUMENT_TYPE_LABELS } from "@/data/documentTypes";
import { useDocumentStore } from "@/hooks/useDocumentStore";
import type { DocumentProject } from "@/types/document";
import {
  getDocumentActionHref,
  getReviewStateForAction,
} from "@/utils/documentNavigation";
import { getDocumentNextActionLabel } from "@/utils/documentLabels";

interface DocumentCardProps {
  document: DocumentProject;
}

export function DocumentCard({ document }: DocumentCardProps) {
  const router = useRouter();
  const { dispatch } = useDocumentStore();
  const actionLabel = getDocumentNextActionLabel(document.nextAction);
  const actionHref = getDocumentActionHref(document.id, document.nextAction);
  const isPrimaryAction = document.nextAction === "continue-interview";

  function handleActionClick() {
    dispatch({ type: "SET_ACTIVE_DOCUMENT", documentId: document.id });

    const reviewState = getReviewStateForAction(document.nextAction);

    if (reviewState) {
      dispatch({
        type: "SET_REVIEW_STATE",
        documentId: document.id,
        state: reviewState,
      });
    }

    router.push(actionHref);
  }

  return (
    <Card interactive className="group flex h-full min-h-[22rem] flex-col border-border-strong p-5">
      <div className="flex flex-1 flex-col gap-4">
        <div className="space-y-1">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-text-primary">
            {document.title}
          </h3>
          <p className="text-caption font-medium text-text-muted">
            {DOCUMENT_TYPE_LABELS[document.documentType]}
          </p>
        </div>

        <dl className="grid gap-2 rounded-control-sm border border-border bg-surface-subtle/70 px-3 py-2.5 text-caption">
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-text-muted">
              <Building2 aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
              Beneficiary
            </dt>
            <dd className="font-medium text-text-secondary">{document.beneficiary}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-text-muted">
              <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
              Updated
            </dt>
            <dd className="font-medium text-text-secondary">{document.lastUpdated}</dd>
          </div>
        </dl>

        <StatusBadge status={document.status} />

        <ProgressBar
          id={`progress-${document.id}`}
          value={document.progressPercent}
        />
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <Button
          variant={isPrimaryAction ? "primary" : "secondary"}
          className="w-full"
          onClick={handleActionClick}
          aria-label={`${actionLabel} for ${document.title}`}
        >
          {actionLabel}
          <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
        </Button>
      </div>
    </Card>
  );
}
