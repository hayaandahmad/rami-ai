import { ArrowLeft, ChevronRight, Paperclip, SendHorizonal } from "lucide-react";
import type { MockAttachment } from "@/types/interview";
import { Button } from "@/components/ui";
import { AttachmentChip } from "./AttachmentChip";
import { MarkTbcAction } from "./MarkTbcAction";

const MOCK_ATTACHMENT_NAME = "current-platform-overview.pdf";

interface QuestionActionsProps {
  canGoBack: boolean;
  allowTbc: boolean;
  isLastQuestion: boolean;
  isSaving: boolean;
  attachment: MockAttachment | null;
  onBack: () => void;
  onMarkTbc: () => void;
  onSaveAndContinue: () => void;
  onCompleteInterview: () => void;
  onSetAttachment: (name: string) => void;
  onRemoveAttachment: () => void;
}

export function QuestionActions({
  canGoBack,
  allowTbc,
  isLastQuestion,
  isSaving,
  attachment,
  onBack,
  onMarkTbc,
  onSaveAndContinue,
  onCompleteInterview,
  onSetAttachment,
  onRemoveAttachment,
}: QuestionActionsProps) {
  const handleAttach = () => {
    if (!attachment) {
      onSetAttachment(MOCK_ATTACHMENT_NAME);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Attachment chip — inside the card, above the action row */}
      {attachment ? (
        <div className="flex items-center gap-2">
          <span className="text-caption text-text-muted">Supporting file:</span>
          <AttachmentChip attachment={attachment} onRemove={onRemoveAttachment} />
        </div>
      ) : null}

      {/* Action row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left — back + secondary actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            disabled={!canGoBack || isSaving}
            aria-label="Go back to previous question"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
            Back
          </Button>

          <MarkTbcAction
            allowTbc={allowTbc}
            onMarkTbc={onMarkTbc}
            disabled={isSaving}
          />

          {!attachment ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAttach}
              disabled={isSaving}
              title="Add a file that supports your answer. Demo only."
            >
              <Paperclip aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
              Add Supporting File
            </Button>
          ) : null}
        </div>

        {/* Right — primary CTA */}
        <div>
          {isLastQuestion ? (
            <Button
              variant="primary"
              size="md"
              onClick={onCompleteInterview}
              disabled={isSaving}
            >
              Continue to Review
              <ChevronRight aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              onClick={onSaveAndContinue}
              disabled={isSaving}
            >
              Save and Continue
              <SendHorizonal aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
