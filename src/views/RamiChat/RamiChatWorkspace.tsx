/**
 * RamiChatWorkspace — conversational BA workspace + RFP document pane.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sparkles, PanelRight, PanelRightClose } from 'lucide-react';
import { useRamiChat } from '@/hooks/useRamiChat';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { ProjectUnderstandingPanel } from '@/components/chat/ProjectUnderstandingPanel';
import { SectionProgress } from '@/components/rfp/SectionProgress';
import { RfpDocumentPanel } from '@/components/rfp/RfpDocumentPanel';
import type { AssembledProgressSummary } from '@/hooks/useRfpDocument';
import { useRamiEngineStatus } from '@/providers/RamiEngineStatusProvider';
import type { RfpIntent } from '@/types/conversation';

interface RamiChatWorkspaceProps {
  sessionId: string;
  documentId?: string;
}

export function RamiChatWorkspace({ sessionId, documentId }: RamiChatWorkspaceProps) {
  const [composerValue, setComposerValue] = useState('');
  const [rightPaneVisible, setRightPaneVisible] = useState(false);
  const [mobileTab, setMobileTab] = useState<'chat' | 'document'>('chat');
  const [forceDocumentPane, setForceDocumentPane] = useState(false);
  const [assembledProgress, setAssembledProgress] = useState<AssembledProgressSummary | null>(
    null,
  );

  const onIntentChange = useCallback((intent: RfpIntent) => {
    if (intent === 'CREATE_RFP') {
      setTimeout(() => setRightPaneVisible(true), 150);
    }
  }, []);

  const onFactsExtracted = useCallback((_facts: unknown[], _updatedFieldIds: string[]) => {}, []);

  const onProgressSummary = useCallback((summary: AssembledProgressSummary | null) => {
    setAssembledProgress(summary);
    if (summary && summary.generatedApplicableCount > 0) {
      setForceDocumentPane(true);
      setRightPaneVisible(true);
    }
  }, []);

  useEffect(() => {
    const key = documentId || sessionId;
    if (!key) return;
    let cancelled = false;
    void fetch(`/api/rami/generation/document?documentKey=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.ok) return;
        const generated = Number(data.assembled?.generatedApplicableCount ?? 0);
        if (generated > 0) {
          setForceDocumentPane(true);
          setRightPaneVisible(true);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [documentId, sessionId]);

  const {
    messages,
    status,
    isGenerating,
    rfpIntent,
    errorMessage,
    applicabilityContext,
    historicalReferences,
    pendingProposals,
    understanding,
    refreshProposals,
    sendMessage,
    retryLastMessage,
    clearError,
  } = useRamiChat({ sessionId, documentId, onIntentChange, onFactsExtracted });

  const { isModalEngineUnavailable } = useRamiEngineStatus();

  const completionPercent =
    understanding?.completionPercent ?? applicabilityContext.completionPercent ?? 0;

  const handleSubmit = useCallback(() => {
    if (!composerValue.trim()) return;
    sendMessage(composerValue);
    setComposerValue('');
  }, [composerValue, sendMessage]);

  const showSplit =
    (rfpIntent === 'CREATE_RFP' || forceDocumentPane || Boolean(assembledProgress?.generatedApplicableCount)) &&
    rightPaneVisible;
  const isInitialState = messages.length === 0 && !isGenerating && !showSplit;

  const projectTitle =
    understanding?.documentTitle ||
    assembledProgress?.documentTitle ||
    understanding?.documentType ||
    'RFP workspace';

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-primary-100)] to-[var(--color-primary-50)] ring-1 ring-[var(--color-primary-200)]">
            <Sparkles
              aria-hidden="true"
              className="h-4 w-4 text-[var(--color-primary-700)]"
              strokeWidth={1.75}
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-small font-semibold leading-tight text-text-primary">
              {projectTitle}
            </p>
            <p className="truncate text-caption leading-tight text-text-muted">
              {understanding?.documentType || 'AI-assisted RFP analysis'}
              {understanding?.engagementType ? ` · ${understanding.engagementType}` : ''}
              {rfpIntent === 'CREATE_RFP' && (
                <>
                  <span aria-hidden="true" className="mx-1.5">
                    ·
                  </span>
                  <span className="font-medium text-[var(--color-primary-700)]">Building RFP</span>
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
                Conversation
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

          {(rfpIntent === 'CREATE_RFP' || forceDocumentPane || assembledProgress) && (
            <button
              type="button"
              onClick={() => setRightPaneVisible((v) => !v)}
              aria-label={rightPaneVisible ? 'Hide RFP document' : 'Show RFP document'}
              className="hidden items-center gap-1.5 rounded-control border border-border px-2.5 py-1.5 text-small text-text-secondary transition-hover hover:bg-surface-subtle md:flex"
            >
              {rightPaneVisible ? (
                <PanelRightClose aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <PanelRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
              )}
              <span className="hidden lg:inline">RFP document</span>
            </button>
          )}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
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
                Describe the engagement. Rami will gather requirements and help you draft a
                professional RFP.
              </p>
            </div>

            <ChatComposer
              value={composerValue}
              onChange={setComposerValue}
              onSubmit={handleSubmit}
              status={status}
              engineOff={isModalEngineUnavailable}
              placeholder="e.g. I need an RFP for a digital licensing platform for the Ministry of Industry…"
            />
          </div>
        )}

        {!isInitialState && (
          <>
            <div
              className={`flex flex-col transition-all duration-300 ease-out ${
                showSplit
                  ? mobileTab === 'chat'
                    ? 'flex w-full md:w-1/2'
                    : 'hidden md:flex md:w-1/2'
                  : 'flex w-full'
              }`}
            >
              <ProjectUnderstandingPanel understanding={understanding} />
              <ChatMessages
                messages={messages}
                status={status}
                errorMessage={errorMessage}
                onRetry={retryLastMessage}
                onClearError={clearError}
                historicalReferences={historicalReferences}
                documentKey={documentId || sessionId}
                pendingProposals={pendingProposals}
                onProposalChanged={() => void refreshProposals()}
              />
              <ChatComposer
                value={composerValue}
                onChange={setComposerValue}
                onSubmit={handleSubmit}
                status={status}
                engineOff={isModalEngineUnavailable}
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
                  mobileTab === 'document' ? 'flex w-full md:w-1/2' : 'hidden md:flex md:w-1/2'
                }`}
              >
                <div className="shrink-0 border-b border-border px-2 py-1.5">
                  <SectionProgress
                    applicableSectionCount={
                      assembledProgress?.applicableSectionCount ??
                      applicabilityContext.applicableSectionCount
                    }
                    completionPercent={completionPercent}
                    assembledApprovedCount={assembledProgress?.approvedApplicableCount}
                    assembledGeneratedCount={assembledProgress?.generatedApplicableCount}
                  />
                </div>

                <div className="flex-1 overflow-hidden">
                  <RfpDocumentPanel
                    documentKey={documentId || sessionId}
                    onProgressSummary={onProgressSummary}
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
