/**
 * Write-through persistence + hydration.
 * PostgreSQL is authority. The in-memory Map is a cache.
 */

import { createSession, getSession, saveSession, type RamiServerSession } from './sessionStore';
import { withActivePacks } from './questionPackEngine';
import { analyzeGaps } from './gapEngine';
import { isDatabaseConfigured } from '@/server/db/config';
import { PersistenceError } from '@/server/db/errors';
import { withTransaction } from '@/server/db/connection';
import { projectMemoryToFactRows, factRowsToProjectMemory } from '@/server/db/factMapper';
import { deriveProjectBudgetJod, parseDurationMonths } from '@/server/db/projectNormalization';
import { upsertSystemUser } from '@/server/repositories/UserRepository';
import {
  ensureProject,
  findProjectByDocumentKey,
  updateProjectDerived,
} from '@/server/repositories/ProjectRepository';
import { listProjectFacts, replaceProjectFacts } from '@/server/repositories/ProjectFactsRepository';
import { insertMessage, listMessages, nextSortOrder } from '@/server/repositories/MessageRepository';
import {
  loadProjectRuntime,
  loadSectionStates,
  replaceSectionStates,
  upsertProjectRuntime,
} from '@/server/repositories/ProjectRuntimeRepository';
import { createEmptyProjectContext } from '@/types/projectContext';
import { createSectionStateRecord } from '@/types/sectionState';
import { RFP_SECTIONS } from '@/schema/rfpSchema';
import type { ConversationMessage } from '@/types/conversation';

export { PersistenceError };

export function assertPersistenceConfigured(): void {
  if (!isDatabaseConfigured()) {
    throw new PersistenceError(
      'NOT_CONFIGURED',
      'PostgreSQL is not configured. Project state cannot be saved. Set RAMI_DB_URL or RAMI_DB_HOST in .env.local.',
    );
  }
}

function applyDerivedContext(session: RamiServerSession): void {
  session.projectContext = withActivePacks(session.projectContext, session.memory);
  const gaps = analyzeGaps(session.memory, session.projectContext, {
    contextContradictions: session.contextContradictions,
  });
  session.projectContext = {
    ...session.projectContext,
    collectionSufficient: gaps.collectionSufficient,
  };
}

export async function hydrateProject(documentKey: string): Promise<RamiServerSession> {
  assertPersistenceConfigured();
  const cached = getSession(documentKey);
  if (cached) return cached;

  const project = await findProjectByDocumentKey(documentKey);
  if (!project) {
    throw new PersistenceError(
      'HYDRATION_FAILED',
      `Project '${documentKey}' was not found. Refusing to invent an empty ProjectMemory.`,
    );
  }

  try {
    const [facts, messages, runtime, sectionStates] = await Promise.all([
      listProjectFacts(project.project_id),
      listMessages(project.project_id),
      loadProjectRuntime(project.project_id),
      loadSectionStates(project.project_id),
    ]);

    const session = createSession(documentKey, documentKey);
    session.memory = factRowsToProjectMemory(facts);
    session.conversation.messages = messages;
    session.conversation.documentId = documentKey;

    if (runtime) {
      session.conversation.rfpIntent = runtime.rfpIntent;
      session.conversation.language = runtime.language;
      session.conversation.activeSection = runtime.activeSection;
      session.projectContext = runtime.context;
      session.contextContradictions = runtime.contextContradictions;
    } else {
      session.projectContext = createEmptyProjectContext();
    }

    if (Object.keys(sectionStates).length > 0) {
      session.sectionStates = sectionStates;
    } else {
      for (const section of RFP_SECTIONS) {
        session.sectionStates[section.sectionId] = createSectionStateRecord(section.sectionId);
      }
    }

    applyDerivedContext(session);
    saveSession(session);
    return session;
  } catch (err) {
    if (err instanceof PersistenceError) throw err;
    throw new PersistenceError(
      'HYDRATION_FAILED',
      `Failed to hydrate project '${documentKey}'. Will not start a blank session.`,
      err,
    );
  }
}

/** Cache hit, else hydrate, else create a new persisted project + empty session. */
export async function getOrHydrateSession(
  sessionId: string,
  documentId?: string,
): Promise<RamiServerSession> {
  assertPersistenceConfigured();
  const key = documentId?.trim() || sessionId;
  const cached = getSession(key);
  if (cached) return cached;

  const existing = await findProjectByDocumentKey(key);
  if (existing) {
    return hydrateProject(key);
  }

  await withTransaction(async (client) => {
    await upsertSystemUser(client);
    await ensureProject(key, 'Untitled RFP', client);
  });

  const session = createSession(key, key);
  saveSession(session);
  await persistRuntimeState(session);
  return session;
}

export async function persistUserMessage(
  session: RamiServerSession,
  message: ConversationMessage,
): Promise<void> {
  assertPersistenceConfigured();
  const key = session.conversation.documentId || session.sessionId;
  await withTransaction(async (client) => {
    const project = await ensureProject(key, 'Untitled RFP', client);
    const order = await nextSortOrder(project.project_id, client);
    await insertMessage(project.project_id, message, order, null, client);
  });
}

export async function persistAssistantMessage(
  session: RamiServerSession,
  message: ConversationMessage,
): Promise<void> {
  assertPersistenceConfigured();
  const key = session.conversation.documentId || session.sessionId;
  await withTransaction(async (client) => {
    const project = await ensureProject(key, 'Untitled RFP', client);
    const order = await nextSortOrder(project.project_id, client);
    await insertMessage(project.project_id, message, order, null, client);
  });
}

/** Persist facts + classifier snapshot + section states. Must succeed before a successful reply. */
export async function persistRuntimeState(session: RamiServerSession): Promise<void> {
  assertPersistenceConfigured();
  const key = session.conversation.documentId || session.sessionId;
  const title = (session.memory.documentTitle?.current?.value as string | undefined) || undefined;
  const budget = deriveProjectBudgetJod(session.memory.pricingModelAndCostBreakdown?.current?.value);
  const duration = parseDurationMonths(session.memory.engagementDuration?.current?.value);

  await withTransaction(async (client) => {
    const project = await ensureProject(key, title ?? 'Untitled RFP', client);
    if (title || budget != null || duration != null) {
      await updateProjectDerived(
        project.project_id,
        { name: title, budgetJod: budget, durationMonths: duration },
        client,
      );
    }
    await replaceProjectFacts(project.project_id, projectMemoryToFactRows(session.memory), client);
    await upsertProjectRuntime(
      project.project_id,
      {
        rfpIntent: session.conversation.rfpIntent,
        language: session.conversation.language,
        activeSection: session.conversation.activeSection,
        context: session.projectContext,
        contextContradictions: session.contextContradictions,
      },
      client,
    );
    await replaceSectionStates(project.project_id, session.sectionStates, client);
  });
  saveSession(session);
}
