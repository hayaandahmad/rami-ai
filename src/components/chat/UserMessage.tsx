/**
 * UserMessage — renders a user message in the chat.
 * Right-aligned, subtle surface, clean typography.
 * Arabic messages render RTL within the bubble.
 */

import type { ConversationMessage } from '@/types/conversation';
import { detectMessageLanguage } from '@/hooks/useRamiChat';

interface UserMessageProps {
  message: ConversationMessage;
}

export function UserMessage({ message }: UserMessageProps) {
  const lang = message.language ?? detectMessageLanguage(message.content);
  const isArabic = lang === 'ar';

  return (
    <div className="flex justify-end">
      <div className="max-w-[80%]">
        <div className="rounded-2xl rounded-tr-sm bg-[var(--color-primary-800)] px-4 py-2.5">
          <p
            className="whitespace-pre-wrap text-body leading-relaxed text-white"
            dir={isArabic ? 'rtl' : 'ltr'}
            lang={isArabic ? 'ar' : 'en'}
          >
            {message.content}
          </p>
        </div>
      </div>
    </div>
  );
}
