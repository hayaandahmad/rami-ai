/**
 * RamiMessage — renders an assistant message in the chat.
 * Modern AI-chat layout: avatar + name, then text below.
 * Supports Arabic RTL messages via per-message dir attribute.
 */

'use client';

import { Sparkles } from 'lucide-react';
import type { ConversationMessage } from '@/types/conversation';
import { detectMessageLanguage } from '@/hooks/useRamiChat';

/** Basic markdown rendering for common patterns (bold, lists, code). */
function renderMarkdown(text: string): string {
  return (
    text
      // Bold **text**
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Inline code `code`
      .replace(/`([^`]+)`/g, '<code class="rami-inline-code">$1</code>')
      // Newlines → paragraphs
      .split('\n\n')
      .map((para) => {
        if (para.trim().startsWith('- ') || para.trim().startsWith('* ')) {
          const items = para
            .split('\n')
            .filter((line) => line.trim().startsWith('- ') || line.trim().startsWith('* '))
            .map((line) => `<li>${line.replace(/^[-*]\s/, '')}</li>`)
            .join('');
          return `<ul class="rami-list">${items}</ul>`;
        }
        return para.trim() ? `<p>${para.replace(/\n/g, '<br />')}</p>` : '';
      })
      .join('')
  );
}

interface RamiMessageProps {
  message: ConversationMessage;
}

export function RamiMessage({ message }: RamiMessageProps) {
  const showCursor = message.isStreaming && message.content.length > 0;

  // Determine direction from stored language tag or live detection
  const lang = message.language ?? detectMessageLanguage(message.content);
  const isArabic = lang === 'ar';

  return (
    <div className="flex items-start gap-3 group">
      {/* Avatar */}
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary-100)] to-[var(--color-primary-50)] ring-1 ring-[var(--color-primary-200)]">
        <Sparkles
          aria-hidden="true"
          className="h-3.5 w-3.5 text-[var(--color-primary-700)]"
          strokeWidth={1.75}
        />
      </div>

      {/* Message body */}
      <div className="min-w-0 flex-1">
        <span className="mb-1.5 block text-caption font-semibold text-[var(--color-primary-800)]">
          Rami
        </span>
        <div
          className="rami-message-body text-body leading-relaxed text-text-primary"
          dir={isArabic ? 'rtl' : 'ltr'}
          lang={isArabic ? 'ar' : 'en'}
          dangerouslySetInnerHTML={{
            __html: message.content
              ? renderMarkdown(message.content) + (showCursor ? '<span class="rami-cursor" aria-hidden="true" />' : '')
              : '',
          }}
        />
        {!message.content && message.isStreaming && null}
      </div>
    </div>
  );
}
