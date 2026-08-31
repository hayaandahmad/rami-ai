"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, CalendarDays, MoreVertical, Trash2 } from "lucide-react";
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

function clearDocumentUiStorage(documentKey: string) {
  try {
    sessionStorage.removeItem(`rami-rfp-ui-v1:${documentKey}:section`);
    sessionStorage.removeItem(`rami-rfp-ui-v1:${documentKey}:view`);
  } catch {
    /* ignore */
  }
}

export function DocumentCard({ document: docProject }: DocumentCardProps) {
  const router = useRouter();
  const { dispatch } = useDocumentStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const actionLabel = getDocumentNextActionLabel(docProject.nextAction);
  const actionHref = getDocumentActionHref(docProject.id, docProject.nextAction);
  const isPrimaryAction = docProject.nextAction === "continue-interview";

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.document.addEventListener("pointerdown", onPointerDown);
    return () => window.document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  function handleActionClick() {
    dispatch({ type: "SET_ACTIVE_DOCUMENT", documentId: docProject.id });

    const reviewState = getReviewStateForAction(docProject.nextAction);

    if (reviewState) {
      dispatch({
        type: "SET_REVIEW_STATE",
        documentId: docProject.id,
        state: reviewState,
      });
    }

    router.push(actionHref);
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/rami/projects/${encodeURIComponent(docProject.id)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) {
        throw new Error(data.error || "Delete failed");
      }
      clearDocumentUiStorage(docProject.id);
      dispatch({ type: "REMOVE_DOCUMENT", documentId: docProject.id });
      setConfirmDelete(false);
      setMenuOpen(false);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card interactive className="group relative flex h-full min-h-[22rem] flex-col border-border-strong p-5">
      <div className="absolute right-3 top-3" ref={menuRef}>
        <button
          type="button"
          className="rounded p-1.5 text-text-muted hover:bg-surface-subtle hover:text-text-primary"
          aria-label={`More actions for ${docProject.title}`}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MoreVertical className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1 min-w-[10rem] rounded-md border border-border bg-white py-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center px-3 py-2 text-left text-caption text-text-secondary hover:bg-surface-subtle"
              onClick={() => {
                setMenuOpen(false);
                handleActionClick();
              }}
            >
              {actionLabel}
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-caption text-[var(--color-danger-700,#b91c1c)] hover:bg-[var(--color-danger-50,#fef2f2)]"
              onClick={() => {
                setMenuOpen(false);
                setConfirmDelete(true);
                setDeleteError(null);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Delete RFP
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 pr-8">
        <div className="space-y-1">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-text-primary">
            {docProject.title}
          </h3>
          <p className="text-caption font-medium text-text-muted">
            {DOCUMENT_TYPE_LABELS[docProject.documentType]}
          </p>
        </div>

        <dl className="grid gap-2 rounded-control-sm border border-border bg-surface-subtle/70 px-3 py-2.5 text-caption">
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-text-muted">
              <Building2 aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
              Beneficiary
            </dt>
            <dd className="font-medium text-text-secondary">{docProject.beneficiary}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-text-muted">
              <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
              Updated
            </dt>
            <dd className="font-medium text-text-secondary">{docProject.lastUpdated}</dd>
          </div>
        </dl>

        <StatusBadge status={docProject.status} />

        <ProgressBar id={`progress-${docProject.id}`} value={docProject.progressPercent} />
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <Button
          variant={isPrimaryAction ? "primary" : "secondary"}
          className="w-full"
          onClick={handleActionClick}
          aria-label={`${actionLabel} for ${docProject.title}`}
        >
          {actionLabel}
          <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
        </Button>
      </div>

      {confirmDelete && (
        <div
          className="absolute inset-0 z-30 flex items-end rounded-panel bg-black/40 p-4 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`delete-title-${docProject.id}`}
        >
          <div className="w-full max-w-sm rounded-lg border border-border bg-white p-4 shadow-xl">
            <h4
              id={`delete-title-${docProject.id}`}
              className="text-base font-semibold text-text-primary"
            >
              Delete &ldquo;{docProject.title}&rdquo;?
            </h4>
            <p className="mt-2 text-caption text-text-secondary">
              This permanently deletes this RFP and its saved project data. This action cannot be
              undone.
            </p>
            {deleteError ? (
              <p className="mt-2 text-caption text-[var(--color-danger-700,#b91c1c)]" role="alert">
                {deleteError}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-border px-3 py-1.5 text-caption"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded border border-[var(--color-danger-600,#dc2626)] bg-[var(--color-danger-600,#dc2626)] px-3 py-1.5 text-caption font-medium text-white disabled:opacity-50"
                onClick={() => void handleDelete()}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete RFP"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
