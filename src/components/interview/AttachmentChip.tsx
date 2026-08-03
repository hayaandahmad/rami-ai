import { FileText, X } from "lucide-react";
import type { MockAttachment } from "@/types/interview";

interface AttachmentChipProps {
  attachment: MockAttachment;
  onRemove: () => void;
}

export function AttachmentChip({ attachment, onRemove }: AttachmentChipProps) {
  return (
    <div className="flex items-center gap-2 rounded-pill border border-border bg-surface px-3 py-1.5 text-small">
      <FileText
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0 text-text-muted"
        strokeWidth={1.75}
      />
      <span className="max-w-[140px] truncate text-text-secondary">{attachment.name}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove attachment ${attachment.name}`}
        className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-text-muted transition-hover hover:bg-surface-subtle hover:text-text-primary"
      >
        <X aria-hidden="true" className="h-3 w-3" strokeWidth={2} />
      </button>
    </div>
  );
}
