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

  /** Show the one-time Rami introduction typing animation. */
  showIntro: boolean;
  /** Show the AI thinking state before follow-up appears. */
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

  // Move focus to the answer area when the question changes.
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
      className="flex flex-col gap-0 rounded-panel border border-border bg-surface shadow-card"
    >
      {/* Card header — Rami identity */}
      <div className="px-6 py-5 sm:px-8">
        <RamiIdentity saveState={saveState} onClearSaveError={onClearSaveError} />
      </div>

      <hr className="border-border" />

      {/* Animated question content — key causes remount on question change */}
      <div key={question.id} className="question-enter flex flex-col gap-6 px-6 py-6 sm:px-8">
        {/* One-time introduction — shown only on first entry */}
        {showIntro ? (
          <RamiIntro />
        ) : null}

        {/* Thinking state — replaces question body while checking for follow-up */}
        {showThinking ? (
          <ThinkingState visible />
        ) : (
          <div className="flex flex-col gap-5">
            <QuestionHeader
              sectionId={question.sectionId}
              prompt={question.prompt}
              questionId={question.id}
            />

            {question.helperText ? (
              <QuestionGuidance helperText={question.helperText} />
            ) : null}

            {/* Answer area — ref used for focus management */}
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

      {/* Divider + Actions — always visible at the bottom of the card */}
      <hr className="border-border" />
      <div className="px-6 py-4 sm:px-8">
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
