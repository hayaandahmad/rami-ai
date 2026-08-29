/**
 * RamiChatWorkspace — the main Phase 2 conversational workspace.
 *
 * States:
 * 1. Initial: full-screen centered chat, spacious, no split
 * 2. Active: scrollable chat, no split yet
 * 3. RFP workspace: left chat + right A4 preview (after intent=CREATE_RFP)
 *
 * Phase 2.1: applicabilityContext now synced from server via SSE events.
 */

'use client';

import { useCallback, useState } from 'react';
import { Sparkles, PanelRight, PanelRightClose } from 'lucide-react';
import { useRamiChat } from '@/hooks/useRamiChat';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { SectionProgress } from '@/components/rfp/SectionProgress';
import { DocumentPreviewShell } from '@/components/rfp/DocumentPreviewShell';
import type { SectionLifecycleState } from '@/types/sectionState';
import type { RfpIntent } from '@/types/conversation';

interface RamiChatWorkspaceProps {
  sessionId: string;
  documentId?: string;
}

export function RamiChatWorkspace({ sessionId, documentId }: RamiChatWorkspaceProps) {
  const [composerValue, setComposerValue] = useState('');
  const [rightPaneVisible, setRightPaneVisible] = useState(false);
  const [mobileTab, setMobileTab] = useState<'chat' | 'document'>('chat');

  // Section states live on the server; client tracks a lightweight display state
  const [sectionStates] = useState<Record<string, SectionLifecycleState>>({});

  const onIntentChange = useCallback((intent: RfpIntent) => {
    if (intent === 'CREATE_RFP') {
      setTimeout(() => setRightPaneVisible(true), 150);
    }
  }, []);

  // Completeness comes from server SSE — no client +3 heuristic
  const onFactsExtracted = useCallback((_facts: unknown[], _updatedFieldIds: string[]) => {}, []);

  const {
    messages,
    status,
    isGenerating,
    rfpIntent,
    errorMessage,
    applicabilityContext,
    sendMessage,
    retryLastMessage,
    clearError,
  } = useRamiChat({ sessionId, documentId, onIntentChange, onFactsExtracted });

  const completionPercent = applicabilityContext.completionPercent ?? 0;

  const handleSubmit = useCallback(() => {
    if (!composerValue.trim()) return;
    sendMessage(composerValue);
    setComposerValue('');
  }, [composerValue, sendMessage]);

  const isInitialState = messages.length === 0 && !isGenerating;
  const showSplit = rfpIntent === 'CREATE_RFP' && rightPaneVisible;

  // Build applicability context from server-synced values
  const sectionApplicabilityCtx = {
    documentType: applicabilityContext.documentType ?? '',
    engagementType: applicabilityContext.engagementType ?? '',
    hasDeliveryMilestone: applicabilityContext.documentType === 'system-implementation',
    hasSupportPeriod: ['system-implementation', 'support'].includes(applicabilityContext.documentType ?? ''),
    hasNamedRoles: false,
    isLargeEngagement: applicabilityContext.documentType === 'system-implementation',
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-primary-100)] to-[var(--color-primary-50)] ring-1 ring-[var(--color-primary-200)]">
            <Sparkles
              aria-hidden="true"
              className="h-4 w-4 text-[var(--color-primary-700)]"
              strokeWidth={1.75}
            />
          </div>
          <div>
            <p className="text-small font-semibold leading-tight text-text-primary">Rami</p>
            <p className="text-caption leading-tight text-text-muted">
              AI Business Analysis Assistant
              {rfpIntent === 'CREATE_RFP' && (
                <>
                  <span aria-hidden="true" className="mx-1.5">·</span>
                  <span className="font-medium text-[var(--color-primary-700)]">RFP mode</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showSplit && (
            <div className="flex rounded-lg border border-border bg-[var(--color-neutral-50)] p-0.5 md:hidden">
              <button
                type="button"
                onClick={() => setMobileTab('chat')}
                className={`rounded-md px-2.5 py-1 text-caption font-medium transition-colors ${
                  mobileTab === 'chat'
                    ? 'bg-white text-text-primary shadow-card'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                Chat
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('document')}
                className={`rounded-md px-2.5 py-1 text-caption font-medium transition-colors ${
                  mobileTab === 'document'
                    ? 'bg-white text-text-primary shadow-card'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                Document
              </button>
            </div>
          )}

          {showSplit && (
            <button
              type="button"
              onClick={() => setRightPaneVisible((v) => !v)}
              aria-label={rightPaneVisible ? 'Hide document preview' : 'Show document preview'}
              className="hidden items-center gap-1.5 rounded-control border border-border px-2.5 py-1.5 text-small text-text-secondary transition-hover hover:bg-surface-subtle md:flex"
            >
              {rightPaneVisible ? (
                <PanelRightClose aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <PanelRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
              )}
              <span className="hidden lg:inline">Preview</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Main content area ──────────────────────────────────────────────── */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* ── Initial centered state ──────────────────────────────────────── */}
        {isInitialState && (
          <div className="flex w-full flex-col">
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-primary-100)] to-[var(--color-primary-50)] ring-1 ring-[var(--color-primary-200)] shadow-[0_8px_24px_rgba(19,62,103,0.08)]">
                <Sparkles
                  aria-hidden="true"
                  className="h-7 w-7 text-[var(--color-primary-700)]"
                  strokeWidth={1.5}
                />
              </div>
              <h1 className="mb-3 text-[1.625rem] font-semibold leading-tight tracking-tight text-text-primary">
                What would you like to work on?
              </h1>
              <p className="max-w-sm text-body text-text-secondary">
                Tell me about your project and I&apos;ll help you prepare a professional RFP.
              </p>
            </div>

            <ChatComposer
              value={composerValue}
              onChange={setComposerValue}
              onSubmit={handleSubmit}
              status={status}
              placeholder="e.g. I need an RFP for a digital licensing platform for the Ministry of Industry…"
            />
          </div>
        )}

        {/* ── Active conversation ─────────────────────────────────────────── */}
        {!isInitialState && (
          <>
            {/* Left: Chat pane */}
            <div
              className={`flex flex-col transition-all duration-300 ease-out ${
                showSplit
                  ? mobileTab === 'chat' ? 'flex w-full md:w-3/5' : 'hidden md:flex md:w-3/5'
                  : 'flex w-full'
              }`}
            >
              <ChatMessages
                messages={messages}
                status={status}
                errorMessage={errorMessage}
                onRetry={retryLastMessage}
                onClearError={clearError}
              />
              <ChatComposer
                value={composerValue}
                onChange={setComposerValue}
                onSubmit={handleSubmit}
                status={status}
              />
            </div>

            {showSplit && (
              <div className="hidden shrink-0 md:block">
                <div className="h-full w-px bg-border" />
              </div>
            )}

            {showSplit && (
              <div
                className={`flex flex-col overflow-hidden transition-all duration-300 ease-out ${
                  mobileTab === 'document' ? 'flex w-full md:w-2/5' : 'hidden md:flex md:w-2/5'
                }`}
              >
                <div className="shrink-0 p-3">
                  <SectionProgress
                    sectionStates={sectionStates}
                    applicabilityContext={sectionApplicabilityCtx}
                    applicableSectionCount={applicabilityContext.applicableSectionCount}
                    completionPercent={completionPercent}
                  />
                </div>

                <div className="flex-1 overflow-hidden">
                  <DocumentPreviewShell
                    sectionStates={sectionStates}
                    applicabilityContext={sectionApplicabilityCtx}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
