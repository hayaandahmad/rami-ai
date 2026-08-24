/**
 * Interview route — now renders the Rami conversational workspace (Phase 2).
 * The legacy GuidedDocumentInterviewPage is retained at
 * src/views/GuidedDocumentInterview/ but is no longer the primary entry point.
 */

import { ChatLayout } from '@/layouts/ChatLayout';
import { RamiChatWorkspace } from '@/views/RamiChat/RamiChatWorkspace';

interface InterviewRouteProps {
  params: Promise<{ documentId: string }>;
}

export default async function InterviewRoute({ params }: InterviewRouteProps) {
  const { documentId } = await params;

  return (
    <ChatLayout>
      <RamiChatWorkspace sessionId={documentId} documentId={documentId} />
    </ChatLayout>
  );
}
