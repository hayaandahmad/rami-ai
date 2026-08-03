export type SaveState = "idle" | "saving" | "saved" | "error";

export type SectionState =
  | "not-started"
  | "current"
  | "completed"
  | "needs-clarification";

export type QuestionInputType = "text" | "long-text" | "choice" | "confirm";

export interface InterviewSection {
  id: string;
  label: string;
  order: number;
}

export interface QuestionFollowUp {
  triggerMatch: string;
  questionId: string;
}

export interface QuestionStep {
  id: string;
  sectionId: string;
  prompt: string;
  helperText?: string;
  inputType: QuestionInputType;
  choices?: string[];
  answerField: string;
  label: string;
  required: boolean;
  allowTbc: boolean;
  followUp?: QuestionFollowUp;
  isFollowUpQuestion?: boolean;
  followUpTriggeredBy?: string;
}

export interface MockAttachment {
  name: string;
}

export interface CapturedAnswer {
  field: string;
  label: string;
  value: string;
  sectionId: string;
  isTbc: boolean;
  updatedAt: string;
}

export interface GroupedCapturedAnswers {
  sectionId: string;
  sectionLabel: string;
  answers: CapturedAnswer[];
}

export type ReviewSectionStatus =
  | "complete"
  | "needs-clarification"
  | "to-be-confirmed";

export interface ReviewSectionSummary {
  sectionId: string;
  label: string;
  status: ReviewSectionStatus;
  answers: CapturedAnswer[];
}

export interface InterviewProgress {
  currentQuestionId: string;
  completedQuestionIds: string[];
  sectionStates: Record<string, SectionState>;
  followUpInsertedIds: string[];
}

export type ReviewPageState = "input-review" | "generating" | "draft-preview";
