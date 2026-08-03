"use client";

import { useEffect, useRef } from "react";
import type { MockAttachment, QuestionStep, SaveState } from "@/types/interview";
import { AnswerControl } from "./AnswerControl";
import { InlineValidation } from "./InlineValidation";
import { QuestionActions } from "./QuestionActions";
import { QuestionGuidance } from "./QuestionGuidance";
import { QuestionHeader } from "./QuestionHeader";
import { RamiIdentity } from "./RamiIdentity";
import { RamiIntro } from "./RamiIntro";
import { ThinkingState } from "./ThinkingState";

interface QuestionStageProps {
  question: QuestionStep;
  value: string;
  onValueChange: (value: string) => void;
  saveState: SaveState;
  validationError: string | null;
  onClearSaveError: () => void;
  isSaving: boolean;
  showIntro: boolean;
  showThinking: boolean;
  attachment: MockAttachment | null;
  canGoBack: boolean;
  isLastQuestion: boolean;
  onBack: () => void;
  onMarkTbc: () => void;
  onSaveAndContinue: () => void;
  onCompleteInterview: () => void;
  onSetAttachment: (name: string) => void;
  onRemoveAttachment: () => void;
}

export function QuestionStage({
  question,
  value,
  onValueChange,
  saveState,
  validationError,
  onClearSaveError,
  isSaving,
  showIntro,
  showThinking,
  attachment,
  canGoBack,
  isLastQuestion,
  onBack,
  onMarkTbc,
  onSaveAndContinue,
  onCompleteInterview,
  onSetAttachment,
  onRemoveAttachment,
}: QuestionStageProps) {
  const validationId = `validation-${question.id}`;
  const answerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = answerRef.current;
    if (!el) return;
    const focusable = el.querySelector<HTMLElement>(
      "input, textarea, button, [tabindex]:not([tabindex='-1'])",
    );
    focusable?.focus({ preventScroll: false });
  }, [question.id]);

  return (
    <article
      aria-labelledby={`question-heading-${question.id}`}
      className="interview-panel shadow-interview-workspace"
    >
      {/* Top accent */}
      <div
        className="h-0.5 bg-gradient-to-r from-[var(--color-primary-700)] via-[var(--color-primary-600)] to-transparent"
        aria-hidden="true"
      />

      {/* Rami identity header */}
      <div className="px-6 py-5 sm:px-8 sm:py-6">
        <RamiIdentity saveState={saveState} onClearSaveError={onClearSaveError} />
      </div>

      <hr className="interview-divider" />

      {/* Question body */}
      <div
        key={question.id}
        className="question-enter flex flex-col gap-7 px-6 py-7 sm:px-8 sm:py-8"
      >
        {showIntro ? <RamiIntro /> : null}

        {showThinking ? (
          <ThinkingState visible />
        ) : (
          <div className="flex flex-col gap-6">
            <QuestionHeader
              sectionId={question.sectionId}
              prompt={question.prompt}
              questionId={question.id}
            />

            {question.helperText ? (
              <QuestionGuidance helperText={question.helperText} />
            ) : null}

            <div ref={(el) => { answerRef.current = el; }}>
              <AnswerControl
                question={question}
                value={value}
                onChange={onValueChange}
                validationErrorId={validationId}
                disabled={isSaving}
              />
            </div>

            {validationError ? (
              <InlineValidation message={validationError} id={validationId} />
            ) : null}
          </div>
        )}
      </div>

      {/* Action footer */}
      <div className="interview-action-footer px-6 py-5 sm:px-8">
        <QuestionActions
          canGoBack={canGoBack}
          allowTbc={question.allowTbc}
          isLastQuestion={isLastQuestion}
          isSaving={isSaving || showThinking}
          attachment={attachment}
          onBack={onBack}
          onMarkTbc={onMarkTbc}
          onSaveAndContinue={onSaveAndContinue}
          onCompleteInterview={onCompleteInterview}
          onSetAttachment={onSetAttachment}
          onRemoveAttachment={onRemoveAttachment}
        />
      </div>
    </article>
  );
}
