"use client";

import { useCallback, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Check, CheckCircle2, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  DOCUMENT_TYPE_DEFINITIONS,
  isDemoDocumentType,
} from "@/data/documentTypes";
import { useDocumentStore } from "@/hooks/useDocumentStore";
import type { DocumentType } from "@/types/document";
import { createMockDocument } from "@/utils/createDocument";

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

  function handleContinue() {
    if (!selectedType) {
      return;
    }

    if (!isDemoDocumentType(selectedType)) {
      const definition = DOCUMENT_TYPE_DEFINITIONS.find(
        (item) => item.id === selectedType,
      );
      setFeedbackMessage(
        definition?.unavailableMessage ??
          "This document type is recognized by Rami but is not configured in this demo.",
      );
      return;
    }

    const document = createMockDocument(selectedType);
    dispatch({ type: "CREATE_DOCUMENT", document });
    dispatch({ type: "SET_ACTIVE_DOCUMENT", documentId: document.id });
    router.push(`/documents/${document.id}/interview`);
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
          const AvailabilityIcon = definition.demoEnabled ? CheckCircle2 : CircleDashed;

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
                      definition.demoEnabled
                        ? "bg-[var(--color-success-100)] text-[var(--color-success-700)]"
                        : "bg-surface-subtle text-text-secondary"
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
          onClick={handleContinue}
          disabled={!selectedType}
          aria-disabled={!selectedType}
          aria-label={
            selectedType
              ? `Continue with ${DOCUMENT_TYPE_DEFINITIONS.find((item) => item.id === selectedType)?.label ?? "selected document type"}`
              : "Continue with selected document type"
          }
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
