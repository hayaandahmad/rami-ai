import type { CapturedAnswer } from "@/types/interview";
import { TbcMarker } from "./TbcMarker";

interface CapturedInputItemProps {
  answer: CapturedAnswer;
  /** The most recently saved answer field — triggers highlight animation. */
  lastSavedField?: string | null;
}

export function CapturedInputItem({ answer, lastSavedField }: CapturedInputItemProps) {
  const isNew = !!lastSavedField && answer.field === lastSavedField;

  return (
    <div className={`space-y-0.5 rounded-sm px-1 py-0.5 ${isNew ? "captured-item-new" : ""}`}>
      <p className="text-caption font-semibold text-text-muted">{answer.label}</p>
      {answer.isTbc ? (
        <TbcMarker />
      ) : (
        <p className="text-small leading-relaxed text-text-primary line-clamp-3">
          {answer.value}
        </p>
      )}
    </div>
  );
}
