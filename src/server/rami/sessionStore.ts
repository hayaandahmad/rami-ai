/**
 * Phase 2 runtime session store.
 *
 * Persistence decision (documented in DECISIONS.md):
 * - In-memory Map on the server for Phase 2 (simple, fast, zero setup)
 * - Uses the global singleton pattern to survive Next.js HMR in development
 * - Client-side localStorage provides conversation history backup
 * - Google Sheets NOT used for conversational state (too slow, wrong tool)
 * - Full Sheets integration for ProjectMemory deferred to Phase 2.5 / Phase 3
 */

import { createEmptyProjectMemory } from '@/types/projectMemory';
import { createSectionStateRecord } from '@/types/sectionState';
import { RFP_SECTIONS } from '@/schema/rfpSchema';
import type { ProjectMemory } from '@/types/projectMemory';
import type { SectionStateRecord } from '@/types/sectionState';
import type { RamiConversation } from '@/types/conversation';

export interface RamiServerSession {
  sessionId: string;
  conversation: RamiConversation;
  memory: ProjectMemory;
  sectionStates: Record<string, SectionStateRecord>;
  createdAt: string;
  updatedAt: string;
}

/** Global store — survives HMR in Next.js dev. */
const _global = global as typeof global & {
  __ramiSessionStore?: Map<string, RamiServerSession>;
};

function getStore(): Map<string, RamiServerSession> {
  if (!_global.__ramiSessionStore) {
    _global.__ramiSessionStore = new Map();
  }
  return _global.__ramiSessionStore;
}

export function getSession(sessionId: string): RamiServerSession | undefined {
  return getStore().get(sessionId);
}

export function createSession(sessionId: string, documentId?: string): RamiServerSession {
  const now = new Date().toISOString();

  const sectionStates: Record<string, SectionStateRecord> = {};
  for (const section of RFP_SECTIONS) {
    sectionStates[section.sectionId] = createSectionStateRecord(section.sectionId);
  }

  const session: RamiServerSession = {
    sessionId,
    conversation: {
      sessionId,
      documentId,
      rfpIntent: 'NONE',
      messages: [],
      language: 'en',
      activeSection: null,
      createdAt: now,
      updatedAt: now,
    },
    memory: createEmptyProjectMemory(),
    sectionStates,
    createdAt: now,
    updatedAt: now,
  };

  getStore().set(sessionId, session);
  return session;
}

export function getOrCreateSession(sessionId: string, documentId?: string): RamiServerSession {
  return getStore().get(sessionId) ?? createSession(sessionId, documentId);
}

export function saveSession(session: RamiServerSession): void {
  session.updatedAt = new Date().toISOString();
  session.conversation.updatedAt = session.updatedAt;
  getStore().set(session.sessionId, session);
}

export function listSessions(): string[] {
  return Array.from(getStore().keys());
}
