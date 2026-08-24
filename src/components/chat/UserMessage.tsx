/**
 * UserMessage — renders a user message in the chat.
 * Right-aligned, subtle surface, clean typography.
 */

import type { ConversationMessage } from '@/types/conversation';

interface UserMessageProps {
  message: ConversationMessage;
}

export function UserMessage({ message }: UserMessageProps) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%]">
        <div className="rounded-2xl rounded-tr-sm bg-[var(--color-primary-800)] px-4 py-2.5">
          <p className="whitespace-pre-wrap text-body leading-relaxed text-white">
            {message.content}
          </p>
        </div>
      </div>
    </div>
  );
}
