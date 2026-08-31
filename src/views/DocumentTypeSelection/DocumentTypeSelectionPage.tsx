"use client";

import { useCallback, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Check, CheckCircle2, CircleDashed, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { DOCUMENT_TYPE_DEFINITIONS } from "@/data/documentTypes";
import { useDocumentStore } from "@/hooks/useDocumentStore";
import type { DocumentType } from "@/types/document";

const DOCUMENT_TYPE_IDS = DOCUMENT_TYPE_DEFINITIONS.map((definition) => definition.id);

function getRadioTabIndex(
  typeId: DocumentType,
  selectedType: DocumentType | null,
): 0 | -1 {
  if (selectedType) {
    return selectedType === typeId ? 0 : -1;
  }

  return typeId === DOCUMENT_TYPE_IDS[0] ? 0 : -1;
}

export function DocumentTypeSelectionPage() {
  const router = useRouter();
  const { dispatch } = useDocumentStore();
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleSelectType = useCallback((type: DocumentType) => {
    setSelectedType(type);
    setFeedbackMessage(null);
  }, []);

  const focusTypeOption = useCallback((type: DocumentType) => {
    document.getElementById(`doc-type-${type}`)?.focus();
  }, []);

  const handleRadioKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, typeId: DocumentType) => {
      const currentIndex = DOCUMENT_TYPE_IDS.indexOf(typeId);
      if (currentIndex === -1) return;

      let nextIndex: number | null = null;

      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          nextIndex = (currentIndex + 1) % DOCUMENT_TYPE_IDS.length;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          nextIndex =
            (currentIndex - 1 + DOCUMENT_TYPE_IDS.length) % DOCUMENT_TYPE_IDS.length;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = DOCUMENT_TYPE_IDS.length - 1;
          break;
        case " ":
        case "Enter":
          event.preventDefault();
          handleSelectType(typeId);
          return;
        default:
          return;
      }

      event.preventDefault();
      const nextType = DOCUMENT_TYPE_IDS[nextIndex];
      handleSelectType(nextType);
      focusTypeOption(nextType);
    },
    [focusTypeOption, handleSelectType],
  );

  async function handleContinue() {
    if (!selectedType || creating) {
      return;
    }

    setCreating(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch("/api/rami/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType: selectedType }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        documentKey?: string;
        error?: string;
      };

      if (!res.ok || !data.ok || !data.documentKey) {
        setFeedbackMessage(data.error ?? "Failed to create project. Check database configuration.");
        return;
      }

      const definition = DOCUMENT_TYPE_DEFINITIONS.find((item) => item.id === selectedType);
      dispatch({
        type: "CREATE_DOCUMENT",
        document: {
          id: data.documentKey,
          title: definition?.label ?? "Untitled RFP",
          documentType: selectedType,
          beneficiary: "To be confirmed",
          status: "not-started",
          progressPercent: 0,
          lastUpdated: "Just now",
          nextAction: "continue-interview",
          interviewCompleted: false,
        },
      });
      dispatch({ type: "SET_ACTIVE_DOCUMENT", documentId: data.documentKey });
      router.push(`/documents/${data.documentKey}/interview`);
    } catch {
      setFeedbackMessage("Failed to create project. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Choose Document Type"
        description="Select the type of professional document you want to prepare with Rami."
      />

      <div
        role="radiogroup"
        aria-label="Document type"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {DOCUMENT_TYPE_DEFINITIONS.map((definition) => {
          const isSelected = selectedType === definition.id;
          const AvailabilityIcon = definition.supported ? CheckCircle2 : CircleDashed;

          return (
            <button
              key={definition.id}
              id={`doc-type-${definition.id}`}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={getRadioTabIndex(definition.id, selectedType)}
              onClick={() => handleSelectType(definition.id)}
              onKeyDown={(event) => handleRadioKeyDown(event, definition.id)}
              className={`relative w-full rounded-card text-left transition-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] ${
                isSelected ? "ring-2 ring-[var(--color-primary-600)] ring-offset-2" : ""
              }`}
            >
              <Card
                interactive
                tinted={isSelected}
                className={`h-full transition-colors ${
                  isSelected
                    ? "!border-[var(--color-primary-600)] !bg-[var(--color-primary-50)] shadow-card-elevated"
                    : ""
                }`}
              >
                {isSelected ? (
                  <span
                    aria-hidden="true"
                    className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-primary-600)] text-white shadow-sm"
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                ) : null}

                <div className="space-y-2 pr-8">
                  <h2 className="text-card-title text-text-primary">{definition.label}</h2>
                  <p className="text-small text-text-secondary">{definition.description}</p>
                </div>

                <div className="mt-4">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-caption ${
                      definition.supported
                        ? "bg-[var(--color-success-100)] text-[var(--color-success-700)]"
                        : "border border-border bg-surface text-text-secondary"
                    }`}
                  >
                    <AvailabilityIcon
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0"
                      strokeWidth={1.75}
                    />
                    <span>{definition.availabilityLabel}</span>
                  </span>
                </div>
              </Card>
            </button>
          );
        })}
      </div>

      {feedbackMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-3 rounded-card border border-[var(--color-warning-700)] bg-[var(--color-warning-100)] px-4 py-3 text-small text-[var(--color-warning-700)]"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          <p>{feedbackMessage}</p>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/workspace">
          <Button variant="ghost">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
            Back to Workspace
          </Button>
        </Link>

        <Button
          onClick={() => void handleContinue()}
          disabled={!selectedType || creating}
          aria-disabled={!selectedType || creating}
          aria-label={
            selectedType
              ? `Continue with ${DOCUMENT_TYPE_DEFINITIONS.find((item) => item.id === selectedType)?.label ?? "selected document type"}`
              : "Continue with selected document type"
          }
        >
          {creating ? (
            <>
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              Creating…
            </>
          ) : (
            "Continue"
          )}
        </Button>
      </div>
    </div>
  );
}
