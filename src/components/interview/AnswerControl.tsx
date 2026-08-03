import type { QuestionStep } from "@/types/interview";
import { ChoiceButtonGroup } from "./ChoiceButtonGroup";

interface AnswerControlProps {
  question: QuestionStep;
  value: string;
  onChange: (value: string) => void;
  validationErrorId?: string;
  disabled?: boolean;
}

const FOCUS_RING =
  "focus:border-[var(--color-primary-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-200)] focus:ring-offset-0";

const BASE_INPUT =
  `w-full rounded-control border border-border bg-surface px-4 py-3 text-body text-text-primary placeholder:text-text-muted transition-hover hover:border-border-strong ${FOCUS_RING} disabled:cursor-not-allowed disabled:opacity-60`;

export function AnswerControl({
  question,
  value,
  onChange,
  validationErrorId,
  disabled = false,
}: AnswerControlProps) {
  const inputId = `answer-${question.id}`;

  if (question.inputType === "text") {
    return (
      <div className="space-y-2">
        <label
          htmlFor={inputId}
          className="block text-small font-semibold text-text-secondary"
        >
          {question.label}
          {question.required ? (
            <span className="ml-1 text-[var(--color-danger-600)]" aria-hidden="true">
              *
            </span>
          ) : (
            <span className="ml-2 text-caption font-normal text-text-muted">
              (optional)
            </span>
          )}
        </label>
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-describedby={validationErrorId}
          aria-required={question.required}
          placeholder={`Enter ${question.label.toLowerCase()}…`}
          autoComplete="off"
          className={BASE_INPUT}
        />
      </div>
    );
  }

  if (question.inputType === "long-text") {
    return (
      <div className="space-y-2">
        <label
          htmlFor={inputId}
          className="block text-small font-semibold text-text-secondary"
        >
          {question.label}
          {question.required ? (
            <span className="ml-1 text-[var(--color-danger-600)]" aria-hidden="true">
              *
            </span>
          ) : (
            <span className="ml-2 text-caption font-normal text-text-muted">
              (optional)
            </span>
          )}
        </label>
        <textarea
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-describedby={validationErrorId}
          aria-required={question.required}
          placeholder={`Describe ${question.label.toLowerCase()}…`}
          rows={5}
          className={`${BASE_INPUT} resize-none leading-relaxed`}
        />
      </div>
    );
  }

  if (question.inputType === "choice" && question.choices) {
    return (
      <div className="space-y-2">
        <p className="text-small font-semibold text-text-secondary" id={`choice-label-${question.id}`}>
          {question.label}
          {question.required ? (
            <span className="ml-1 text-[var(--color-danger-600)]" aria-hidden="true">
              *
            </span>
          ) : (
            <span className="ml-2 text-caption font-normal text-text-muted">
              (optional)
            </span>
          )}
        </p>
        <ChoiceButtonGroup
          name={`choice-${question.id}`}
          choices={question.choices}
          value={value}
          onChange={onChange}
          disabled={disabled}
          describedById={validationErrorId}
          labelledById={`choice-label-${question.id}`}
        />
      </div>
    );
  }

  if (question.inputType === "confirm") {
    const checked = value === "confirmed";
    return (
      <label
        htmlFor={inputId}
        className={`flex cursor-pointer items-start gap-3 rounded-control border border-border bg-surface px-4 py-4 transition-hover hover:border-border-strong hover:bg-surface-subtle ${
          disabled ? "cursor-not-allowed opacity-60" : ""
        }`}
      >
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked ? "confirmed" : "")}
          disabled={disabled}
          aria-describedby={validationErrorId}
          aria-required={question.required}
          className={`mt-0.5 h-4 w-4 shrink-0 rounded accent-[var(--color-primary-700)] ${FOCUS_RING}`}
        />
        <span className="text-small leading-relaxed text-text-primary">
          I confirm the collected information is accurate and ready for professional review.
          Any items marked as{" "}
          <em className="not-italic font-semibold text-[var(--color-warning-700)]">
            [To be confirmed]
          </em>{" "}
          will remain clearly marked in the draft.
        </span>
      </label>
    );
  }

  return null;
}
