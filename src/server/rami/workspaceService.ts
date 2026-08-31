/**
 * Workspace summaries — PostgreSQL is authoritative.
 * Derives dashboard document cards from persisted project state.
 */

import { randomBytes } from 'crypto';
import type { DocumentNextAction, DocumentProject, DocumentStatus, DocumentType } from '@/types/document';
import { isDatabaseConfigured } from '@/server/db/config';
import { query } from '@/server/db/connection';
import { factRowsToProjectMemory } from '@/server/db/factMapper';
import { withTransaction } from '@/server/db/connection';
import { analyzeGaps } from '@/server/rami/gapEngine';
import { ensureProject, type ProjectRow } from '@/server/repositories/ProjectRepository';
import { listProjectFacts } from '@/server/repositories/ProjectFactsRepository';
import { loadProjectRuntime } from '@/server/repositories/ProjectRuntimeRepository';
import { upsertSystemUser } from '@/server/repositories/UserRepository';
import { upsertProjectRuntime } from '@/server/repositories/ProjectRuntimeRepository';
import { createEmptyProjectContext } from '@/types/projectContext';
import { createSectionStateRecord } from '@/types/sectionState';
import { RFP_SECTIONS } from '@/schema/rfpSchema';
import { PersistenceError } from '@/server/rami/projectPersistence';

export interface WorkspaceListResult {
  documents: DocumentProject[];
  lastActivityAt: string | null;
}

interface ProjectActivityRow {
  project_id: string;
  document_key: string;
  name: string;
  status: string;
  message_count: string;
  latest_message_at: string | null;
  latest_fact_at: string | null;
  latest_content_at: string | null;
  draft_section_count: string;
  approved_section_count: string;
  has_tbc: boolean;
  has_gap_issue: boolean;
  has_contradictions: boolean;
}

const DOCUMENT_TYPE_VALUES: DocumentType[] = [
  'system-implementation',
  'framework-agreement',
  'consulting',
  'assessment',
  'support',
  'connectivity-telecom',
  'other',
];

function normalizeDocumentType(raw: unknown): DocumentType {
  if (typeof raw !== 'string' || !raw.trim()) return 'other';
  const normalized = raw.trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
  const match = DOCUMENT_TYPE_VALUES.find((t) => t === normalized || normalized.includes(t));
  if (match) return match;
  if (normalized.includes('system') || normalized.includes('implementation')) {
    return 'system-implementation';
  }
  if (normalized.includes('assess')) return 'assessment';
  if (normalized.includes('support')) return 'support';
  if (normalized.includes('consult')) return 'consulting';
  if (normalized.includes('framework')) return 'framework-agreement';
  if (normalized.includes('connect') || normalized.includes('telecom')) {
    return 'connectivity-telecom';
  }
  return 'other';
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '—';
  const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (sec < 60) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 172800) return 'Yesterday';
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(ms).toLocaleDateString();
}

function latestIso(...values: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  let bestMs = -1;
  for (const v of values) {
    if (!v) continue;
    const ms = Date.parse(v);
    if (!Number.isNaN(ms) && ms > bestMs) {
      bestMs = ms;
      best = v;
    }
  }
  return best;
}

function deriveDocumentStatus(input: {
  projectStatus: string;
  draftSectionCount: number;
  approvedSectionCount: number;
  hasTbc: boolean;
  hasGapIssue: boolean;
  hasContradictions: boolean;
  collectionSufficient: boolean;
  messageCount: number;
  factCount: number;
}): DocumentStatus {
  if (input.projectStatus === 'archived' || input.projectStatus === 'completed') {
    return input.draftSectionCount > 0 ? 'draft-generated' : 'ready-for-review';
  }
  if (input.draftSectionCount > 0) {
    return 'draft-generated';
  }
  if (input.hasContradictions || input.hasTbc || input.hasGapIssue) {
    return 'needs-clarification';
  }
  if (input.collectionSufficient) {
    return 'ready-for-review';
  }
  if (input.messageCount > 0 || input.factCount > 0) {
    return 'in-progress';
  }
  return 'not-started';
}

function deriveNextAction(
  status: DocumentStatus,
  collectionSufficient: boolean,
  draftSectionCount: number,
): DocumentNextAction {
  if (status === 'draft-generated') return 'open-draft';
  if (status === 'ready-for-review' || collectionSufficient) return 'review-inputs';
  if (status === 'needs-clarification') return 'continue-interview';
  if (draftSectionCount > 0) return 'open-draft';
  return 'continue-interview';
}

function slugifyDocumentKey(prefix: string): string {
  const slug = prefix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const suffix = randomBytes(3).toString('hex');
  return `rfp-${slug || 'document'}-${suffix}`;
}

async function listProjectActivityRows(): Promise<ProjectActivityRow[]> {
  const r = await query<ProjectActivityRow>(
    `SELECT
       p.project_id,
       p.document_key,
       p.name,
       p.status,
       COALESCE(msg.cnt, 0)::text AS message_count,
       msg.latest_at AS latest_message_at,
       facts.latest_at AS latest_fact_at,
       contents.latest_at AS latest_content_at,
       COALESCE(contents.draft_cnt, 0)::text AS draft_section_count,
       COALESCE(contents.approved_cnt, 0)::text AS approved_section_count,
       COALESCE(facts.has_tbc, false) AS has_tbc,
       COALESCE(facts.has_gap_issue, false) AS has_gap_issue,
       COALESCE(runtime.has_contradictions, false) AS has_contradictions
     FROM projects p
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS cnt, MAX(created_at) AS latest_at
       FROM messages m WHERE m.project_id = p.project_id
     ) msg ON true
     LEFT JOIN LATERAL (
       SELECT
         MAX(updated_at) AS latest_at,
         BOOL_OR(collection_state = 'TBC' OR provenance_status = 'TBC') AS has_tbc,
         BOOL_OR(gap_status IN ('UNKNOWN', 'DEFERRED', 'CONTRADICTORY')) AS has_gap_issue
       FROM project_facts pf WHERE pf.project_id = p.project_id
     ) facts ON true
     LEFT JOIN LATERAL (
       SELECT
         MAX(created_at::text) AS latest_at,
         COUNT(*) FILTER (WHERE is_current AND approval_status = 'DRAFT')::int AS draft_cnt,
         COUNT(*) FILTER (WHERE is_current AND approval_status = 'APPROVED')::int AS approved_cnt
       FROM project_section_contents psc WHERE psc.project_id = p.project_id
     ) contents ON true
     LEFT JOIN LATERAL (
       SELECT
         jsonb_array_length(COALESCE(context_contradictions, '[]'::jsonb)) > 0 AS has_contradictions
       FROM project_runtime pr WHERE pr.project_id = p.project_id
     ) runtime ON true
     ORDER BY GREATEST(
       COALESCE(msg.latest_at, ''),
       COALESCE(facts.latest_at, ''),
       COALESCE(contents.latest_at, '')
     ) DESC NULLS LAST,
     p.document_key ASC`,
  );
  return r.rows;
}

async function buildDocumentSummary(row: ProjectActivityRow): Promise<DocumentProject> {
  const [facts, runtime] = await Promise.all([
    listProjectFacts(row.project_id),
    loadProjectRuntime(row.project_id),
  ]);

  const memory = factRowsToProjectMemory(facts);
  const context = runtime?.context ?? createEmptyProjectContext();
  const gaps = analyzeGaps(memory, context, {
    contextContradictions: runtime?.contextContradictions ?? [],
  });

  const documentType = normalizeDocumentType(memory.documentType?.current?.value);
  const beneficiaryRaw = memory.beneficiaryEntity?.current?.value;
  const beneficiary =
    typeof beneficiaryRaw === 'string' && beneficiaryRaw.trim()
      ? beneficiaryRaw.trim()
      : 'To be confirmed';

  const title =
    (typeof memory.documentTitle?.current?.value === 'string' &&
      memory.documentTitle.current.value.trim()) ||
    (row.name && row.name !== 'Untitled RFP' ? row.name : null) ||
    row.document_key.replace(/-/g, ' ');

  const draftSectionCount = Number(row.draft_section_count) || 0;
  const approvedSectionCount = Number(row.approved_section_count) || 0;
  const messageCount = Number(row.message_count) || 0;

  const status = deriveDocumentStatus({
    projectStatus: row.status,
    draftSectionCount,
    approvedSectionCount,
    hasTbc: row.has_tbc,
    hasGapIssue: row.has_gap_issue,
    hasContradictions: row.has_contradictions,
    collectionSufficient: gaps.collectionSufficient,
    messageCount,
    factCount: facts.length,
  });

  const lastActivityIso = latestIso(
    row.latest_message_at,
    row.latest_fact_at,
    row.latest_content_at,
  );

  return {
    id: row.document_key,
    title,
    documentType,
    beneficiary,
    status,
    progressPercent: gaps.completionPercent,
    lastUpdated: formatRelativeTime(lastActivityIso),
    nextAction: deriveNextAction(status, gaps.collectionSufficient, draftSectionCount),
    interviewCompleted: gaps.collectionSufficient,
    draftGeneratedAt:
      draftSectionCount > 0 && row.latest_content_at
        ? formatRelativeTime(row.latest_content_at)
        : undefined,
  };
}

export async function listWorkspaceDocuments(): Promise<WorkspaceListResult> {
  if (!isDatabaseConfigured()) {
    throw new PersistenceError(
      'NOT_CONFIGURED',
      'PostgreSQL is not configured. Set RAMI_DB_URL or RAMI_DB_HOST in .env.local.',
    );
  }

  const rows = await listProjectActivityRows();
  const documents = await Promise.all(rows.map((row) => buildDocumentSummary(row)));

  const lastActivityAt = documents.length
    ? latestIso(
        ...rows.map((r) =>
          latestIso(r.latest_message_at, r.latest_fact_at, r.latest_content_at),
        ),
      )
    : null;

  return { documents, lastActivityAt };
}

export interface CreateProjectInput {
  documentType: DocumentType;
  title?: string;
}

export interface CreateProjectResult {
  documentKey: string;
  project: ProjectRow;
}

export async function createWorkspaceProject(
  input: CreateProjectInput,
): Promise<CreateProjectResult> {
  if (!isDatabaseConfigured()) {
    throw new PersistenceError(
      'NOT_CONFIGURED',
      'PostgreSQL is not configured. Set RAMI_DB_URL or RAMI_DB_HOST in .env.local.',
    );
  }

  const documentKey = slugifyDocumentKey(input.documentType);
  const title = input.title?.trim() || 'Untitled RFP';

  const project = await withTransaction(async (client) => {
    await upsertSystemUser(client);
    const row = await ensureProject(documentKey, title, client);

    const emptyContext = createEmptyProjectContext();
    await upsertProjectRuntime(
      row.project_id,
      {
        rfpIntent: 'NONE',
        language: 'en',
        activeSection: RFP_SECTIONS[0]?.sectionId ?? null,
        context: emptyContext,
        contextContradictions: [],
      },
      client,
    );

    for (const section of RFP_SECTIONS) {
      const rec = createSectionStateRecord(section.sectionId);
      await client.query(
        `INSERT INTO project_section_states (project_id, section_id, state, entered_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [row.project_id, rec.sectionId, rec.state, rec.enteredAt],
      );
    }

    return row;
  });

  return { documentKey, project };
}
