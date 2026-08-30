import type { PoolClient } from 'pg';
import { query } from '@/server/db/connection';
import type { ProjectContext } from '@/types/projectContext';
import { createEmptyProjectContext } from '@/types/projectContext';
import type { ConversationLanguage, RfpIntent } from '@/types/conversation';
import type { SectionStateRecord } from '@/types/sectionState';

export interface ProjectRuntimeRow {
  rfp_intent: string;
  conversation_language: string;
  active_section: string | null;
  document_stage: string;
  contracting_granularity: string;
  primary_domain: string;
  secondary_domains: unknown;
  complexity: unknown;
  context_contradictions: unknown;
}

export async function upsertProjectRuntime(
  projectId: string,
  input: {
    rfpIntent: RfpIntent;
    language: ConversationLanguage;
    activeSection: string | null;
    context: ProjectContext;
    contextContradictions: Array<{ targetId: string; values: unknown[] }>;
  },
  client: PoolClient,
): Promise<void> {
  await client.query(
    `INSERT INTO project_runtime (
       project_id, rfp_intent, conversation_language, active_section,
       document_stage, contracting_granularity, primary_domain,
       secondary_domains, complexity, context_contradictions
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb)
     ON CONFLICT (project_id) DO UPDATE SET
       rfp_intent = EXCLUDED.rfp_intent,
       conversation_language = EXCLUDED.conversation_language,
       active_section = EXCLUDED.active_section,
       document_stage = EXCLUDED.document_stage,
       contracting_granularity = EXCLUDED.contracting_granularity,
       primary_domain = EXCLUDED.primary_domain,
       secondary_domains = EXCLUDED.secondary_domains,
       complexity = EXCLUDED.complexity,
       context_contradictions = EXCLUDED.context_contradictions`,
    [
      projectId,
      input.rfpIntent,
      input.language,
      input.activeSection,
      input.context.documentStage,
      input.context.contractingGranularity,
      input.context.primaryDomain,
      JSON.stringify(input.context.secondaryDomains),
      JSON.stringify(input.context.complexity),
      JSON.stringify(input.contextContradictions),
    ],
  );
}

export async function loadProjectRuntime(projectId: string): Promise<{
  rfpIntent: RfpIntent;
  language: ConversationLanguage;
  activeSection: string | null;
  context: ProjectContext;
  contextContradictions: Array<{ targetId: string; values: unknown[] }>;
} | null> {
  const r = await query<ProjectRuntimeRow>(
    `SELECT * FROM project_runtime WHERE project_id = $1`,
    [projectId],
  );
  const row = r.rows[0];
  if (!row) return null;
  const empty = createEmptyProjectContext();
  return {
    rfpIntent: (row.rfp_intent as RfpIntent) || 'NONE',
    language: (row.conversation_language as ConversationLanguage) || 'en',
    activeSection: row.active_section,
    context: {
      ...empty,
      documentStage: (row.document_stage as ProjectContext['documentStage']) || 'UNDETERMINED',
      contractingGranularity:
        (row.contracting_granularity as ProjectContext['contractingGranularity']) ||
        'UNDETERMINED',
      primaryDomain: (row.primary_domain as ProjectContext['primaryDomain']) || 'UNDETERMINED',
      secondaryDomains: Array.isArray(row.secondary_domains)
        ? (row.secondary_domains as ProjectContext['secondaryDomains'])
        : [],
      complexity: {
        ...empty.complexity,
        ...((row.complexity as object) ?? {}),
      },
    },
    contextContradictions: Array.isArray(row.context_contradictions)
      ? (row.context_contradictions as Array<{ targetId: string; values: unknown[] }>)
      : [],
  };
}

export async function replaceSectionStates(
  projectId: string,
  states: Record<string, SectionStateRecord>,
  client: PoolClient,
): Promise<void> {
  await client.query('DELETE FROM project_section_states WHERE project_id = $1', [projectId]);
  for (const rec of Object.values(states)) {
    await client.query(
      `INSERT INTO project_section_states (
         project_id, section_id, state, entered_at, reopen_reason, draft_field_snapshot
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        projectId,
        rec.sectionId,
        rec.state,
        rec.enteredAt,
        rec.reopenReason ?? null,
        rec.draftFieldSnapshot ? JSON.stringify(rec.draftFieldSnapshot) : null,
      ],
    );
  }
}

export async function loadSectionStates(
  projectId: string,
): Promise<Record<string, SectionStateRecord>> {
  const r = await query<SectionStateRecord & { draft_field_snapshot?: unknown; entered_at: string; reopen_reason?: string; section_id: string }>(
    `SELECT section_id, state, entered_at, reopen_reason, draft_field_snapshot
     FROM project_section_states WHERE project_id = $1`,
    [projectId],
  );
  const out: Record<string, SectionStateRecord> = {};
  for (const row of r.rows) {
    out[row.section_id] = {
      sectionId: row.section_id,
      state: row.state as SectionStateRecord['state'],
      enteredAt: row.entered_at,
      reopenReason: row.reopen_reason,
      draftFieldSnapshot: Array.isArray(row.draft_field_snapshot)
        ? (row.draft_field_snapshot as string[])
        : undefined,
    };
  }
  return out;
}
