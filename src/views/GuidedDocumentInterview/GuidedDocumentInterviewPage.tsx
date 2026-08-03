"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useInterviewEngine } from "@/hooks/useInterviewEngine";
import { TBC_VALUE } from "@/utils/tbc";
import { ErrorState } from "@/components/ui";
import {
  CapturedInputsPanel,
  InterviewLayout,
  InterviewNavigator,
  InterviewPageHeader,
  QuestionStage,
} from "@/components/interview";

interface GuidedDocumentInterviewPageProps {
  documentId: string;
}

export function GuidedDocumentInterviewPage({
  documentId,
}: GuidedDocumentInterviewPageProps) {
  const engine = useInterviewEngine(documentId);
  const [localValue, setLocalValue] = useState("");

  /**
   * Track whether the intro typing has already played this session.
   * Once it plays (or is skipped for returning users), we don't replay it.
   */
  const introPlayedRef = useRef(false);
  const showIntro =
    engine.isFirstEntry &&
    !introPlayedRef.current &&
    engine.currentIndex === 0;

  // Mark intro as played after first render where isFirstEntry is true.
  useEffect(() => {
    if (engine.isFirstEntry) {
      introPlayedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset local input value when the question changes, pre-populating any saved answer.
  useEffect(() => {
    if (!engine.currentQuestion) {
      setLocalValue("");
      return;
    }
    const existing = engine.answers[engine.currentQuestion.answerField];
    const prefill =
      existing?.value && existing.value !== TBC_VALUE ? existing.value : "";
    setLocalValue(prefill);
    // Intentionally depends only on question id, not entire answers object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.currentQuestion?.id]);

  // ── Error states ───────────────────────────────────────────────────────────

  if (engine.error === "missing-document") {
    return (
      <ErrorState
        title="No interview found"
        description="We could not open this interview. The document identifier is missing."
        actions={
          <Link
            href="/workspace"
            className="inline-flex min-h-10 items-center gap-2 rounded-control border border-border bg-surface px-4 text-small font-medium text-text-primary transition-hover hover:bg-surface-subtle"
          >
            Back to Workspace
          </Link>
        }
      />
    );
  }

  if (engine.error === "unknown-document") {
    return (
      <ErrorState
        title="We could not open this interview"
        description="The document you are looking for does not exist or has been removed."
        actions={
          <Link
            href="/workspace"
            className="inline-flex min-h-10 items-center gap-2 rounded-control border border-border bg-surface px-4 text-small font-medium text-text-primary transition-hover hover:bg-surface-subtle"
          >
            Back to Workspace
          </Link>
        }
      />
    );
  }

  if (!engine.document || !engine.currentQuestion) {
    return (
      <div className="flex h-48 items-center justify-center">
        <p className="text-small text-text-muted">Loading interview…</p>
      </div>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const isSaving = engine.saveState === "saving";
  const currentSectionId = engine.currentQuestion.sectionId;
  const currentSection = engine.sections.find((s) => s.id === currentSectionId);

  const questionLabel = `Question ${engine.currentIndex + 1} of ${engine.totalSteps}`;
  const mobileNavSummary = currentSection
    ? `${questionLabel} · ${currentSection.label}`
    : questionLabel;

  const handleSaveAndContinue = () => {
    engine.saveAnswer(localValue);
  };

  return (
    <div className="flex flex-col">
      {/* Page header — contains the single overall progress bar */}
      <InterviewPageHeader
        document={engine.document}
        progressPercent={engine.progressPercent}
        saveState={engine.saveState}
        onSaveAndExit={engine.saveAndExit}
        onClearSaveError={engine.clearSaveError}
        currentSectionLabel={currentSection?.label}
        questionNumber={engine.currentIndex + 1}
        totalQuestions={engine.totalSteps}
        isFirstEntry={engine.isFirstEntry}
        isLastQuestion={engine.isOnLastQuestion}
      />

      {/* Three-zone interview layout */}
      <InterviewLayout
        mobileNavSummary={mobileNavSummary}
        navigator={
          <InterviewNavigator
            sections={engine.sections}
            sectionStates={engine.sectionStates}
            currentSectionId={currentSectionId}
            currentIndex={engine.currentIndex}
            totalSteps={engine.totalSteps}
          />
        }
        workspace={
          <QuestionStage
            question={engine.currentQuestion}
            value={localValue}
            onValueChange={setLocalValue}
            saveState={engine.saveState}
            validationError={engine.validationError}
            onClearSaveError={engine.clearSaveError}
            isSaving={isSaving}
            showIntro={showIntro}
            showThinking={engine.showThinking}
            attachment={engine.attachment}
            canGoBack={engine.canGoBack}
            isLastQuestion={engine.isOnLastQuestion}
            onBack={engine.goBack}
            onMarkTbc={engine.markTbc}
            onSaveAndContinue={handleSaveAndContinue}
            onCompleteInterview={engine.completeInterview}
            onSetAttachment={engine.setAttachment}
            onRemoveAttachment={engine.removeAttachment}
          />
        }
        capturedPanel={
          <CapturedInputsPanel
            groups={engine.groupedCapturedAnswers}
            lastSavedField={engine.lastSavedField}
          />
        }
      />
    </div>
  );
}
