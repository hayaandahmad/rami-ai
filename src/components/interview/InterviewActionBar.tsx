import { ArrowLeft, ArrowRight, ChevronRight, Paperclip } from "lucide-react";
import type { MockAttachment } from "@/types/interview";
import { Button } from "@/components/ui";
import { AttachmentChip } from "./AttachmentChip";
import { MarkTbcAction } from "./MarkTbcAction";

const MOCK_ATTACHMENT_NAME = "current-platform-overview.pdf";

interface InterviewActionBarProps {
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

export function InterviewActionBar({
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
}: InterviewActionBarProps) {
  const handleAttach = () => {
    if (!attachment) {
      onSetAttachment(MOCK_ATTACHMENT_NAME);
    }
  };

  return (
    <div className="sticky bottom-0 z-10 border-t border-border bg-surface">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        {/* Left — Back */}
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            disabled={!canGoBack || isSaving}
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
            Back
          </Button>
        </div>

        {/* Middle — secondary actions */}
        <div className="flex flex-1 items-center gap-2">
          <MarkTbcAction
            allowTbc={allowTbc}
            onMarkTbc={onMarkTbc}
            disabled={isSaving}
          />

          {attachment ? (
            <AttachmentChip attachment={attachment} onRemove={onRemoveAttachment} />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAttach}
              disabled={isSaving}
              title="Attach a reference document (demo only)"
            >
              <Paperclip aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
              Attach Reference
            </Button>
          )}
        </div>

        {/* Right — primary action */}
        <div className="flex items-center">
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
              <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
