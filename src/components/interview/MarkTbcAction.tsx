import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui";

interface MarkTbcActionProps {
  onMarkTbc: () => void;
  disabled?: boolean;
  allowTbc: boolean;
}

export function MarkTbcAction({ onMarkTbc, disabled, allowTbc }: MarkTbcActionProps) {
  if (!allowTbc) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onMarkTbc}
      disabled={disabled}
      title="Mark this answer as To be confirmed"
      className="btn-press"
    >
      <HelpCircle aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
      Mark as TBC
    </Button>
  );
}
