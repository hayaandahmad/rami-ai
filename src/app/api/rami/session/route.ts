import { getOrHydrateSession, PersistenceError } from '@/server/rami/projectPersistence';
import { analyzeGaps, buildApplicabilityContext } from '@/server/rami/gapEngine';
import { RFP_SECTIONS, isSectionApplicable } from '@/schema/rfpSchema';
import { buildProjectUnderstanding } from '@/server/rami/projectUnderstanding';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId')?.trim();
  const documentId = url.searchParams.get('documentId')?.trim() || sessionId;
  if (!sessionId) {
    return Response.json({ ok: false, error: 'sessionId is required' }, { status: 400 });
  }

  try {
    const session = await getOrHydrateSession(sessionId, documentId);
    const gaps = analyzeGaps(session.memory, session.projectContext, {
      contextContradictions: session.contextContradictions,
    });
    const ctx = buildApplicabilityContext(session.memory, session.projectContext);
    const applicableSectionCount = RFP_SECTIONS.filter((s) => isSectionApplicable(s, ctx)).length;
    const understanding = buildProjectUnderstanding(
      session.memory,
      session.projectContext,
      gaps,
      session.contextContradictions,
    );

    return Response.json({
      ok: true,
      source: 'postgresql',
      sessionId: session.sessionId,
      rfpIntent: session.conversation.rfpIntent,
      language: session.conversation.language,
      messages: session.conversation.messages.filter((m) => m.role !== 'system'),
      documentType: understanding.documentType ?? undefined,
      engagementType: understanding.engagementType ?? undefined,
      applicableSectionCount,
      completionPercent: gaps.completionPercent,
      collectionSufficient: gaps.collectionSufficient,
      nextActionType: gaps.nextAction.type,
      nextPriorityLabel: gaps.nextPriorityLabel,
      understanding,
    });
  } catch (err) {
    const persist = err instanceof PersistenceError;
    return Response.json(
      {
        ok: false,
        error: persist ? err.message : 'Failed to hydrate project from PostgreSQL.',
        code: persist ? err.code : 'UNKNOWN',
      },
      { status: persist && err.code === 'NOT_CONFIGURED' ? 503 : 500 },
    );
  }
}
