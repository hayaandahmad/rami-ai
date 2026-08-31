#!/usr/bin/env npx tsx
/**
 * Seed dedicated live RAG quality evaluation project (not rami-gen-core-demo).
 * Uses applyExtractedFacts + persist — no SQL fact inserts.
 */
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { clearAllSessionCache } from '../src/server/rami/sessionStore';
import {
  getOrHydrateSession,
  persistRuntimeState,
} from '../src/server/rami/projectPersistence';
import { applyExtractedFacts } from '../src/server/rami/memoryUpdater';
import { classifyProject } from '../src/server/rami/projectClassifier';
import { withActivePacks } from '../src/server/rami/questionPackEngine';
import { getSectionReadiness } from '../src/server/rami/sectionReadiness';

export const EVAL_DOCUMENT_KEY = 'rami-rag-live-eval';

export function buildEvalMemoryFacts() {
  return [
    { fieldId: 'documentTitle', value: 'National Digital Services Assessment RFP', confidence: 'high' as const },
    { fieldId: 'documentType', value: 'assessment', confidence: 'high' as const },
    {
      fieldId: 'beneficiaryEntity',
      value: 'Ministry of Digital Economy and Entrepreneurship (MoDEE)',
      confidence: 'high' as const,
    },
    { fieldId: 'engagementType', value: 'consulting', confidence: 'high' as const },
    { fieldId: 'engagementDuration', value: '18 months', confidence: 'high' as const },
    {
      fieldId: 'currentSituation',
      value:
        'MoDEE delivers digital services through fragmented departmental portals with limited shared metrics.',
      confidence: 'high' as const,
    },
    {
      fieldId: 'businessNeedRationale',
      value: 'Independent maturity assessment and target operating model for follow-on investments.',
      confidence: 'high' as const,
    },
    {
      fieldId: 'businessObjectives',
      value: [
        'Assess digital-services maturity',
        'Recommend target operating model',
        'Sequence follow-on procurements',
      ],
      confidence: 'high' as const,
    },
    { fieldId: 'painPoints', value: 'TBC', confidence: 'high' as const },
    {
      fieldId: 'inScope',
      value: [
        'Maturity assessment of priority digital services',
        'Target operating model recommendation',
        'Roadmap advice',
      ],
      confidence: 'high' as const,
    },
    {
      fieldId: 'outOfScope',
      value: ['Software implementation', 'Hardware procurement', 'Managed operations'],
      confidence: 'high' as const,
    },
    {
      fieldId: 'deliverableItems',
      value: ['Inception report', 'Monthly steering pack', 'Final advisory report'],
      confidence: 'high' as const,
    },
    { fieldId: 'deliverableFormats', value: ['PDF', 'editable source'], confidence: 'high' as const },
    { fieldId: 'deliverableApprovers', value: ['Project owner'], confidence: 'high' as const },
    {
      fieldId: 'acceptanceCriteria',
      value: [
        'Deliverables approved by project owner against agreed quality checklist',
        'Final report accepted after steering committee review',
      ],
      confidence: 'high' as const,
    },
    {
      fieldId: 'acceptanceProcess',
      value: 'Steering committee sign-off within 10 business days of submission.',
      confidence: 'high' as const,
    },
    {
      fieldId: 'governanceCadence',
      value: 'Bi-weekly steering; monthly executive checkpoint.',
      confidence: 'high' as const,
    },
    {
      fieldId: 'engagementPhases',
      value: ['Inception', 'Assessment', 'Reporting', 'Closure'],
      confidence: 'high' as const,
    },
    {
      fieldId: 'stakeholderRoles',
      value: 'MoDEE digital transformation unit; service owners; PMO liaison.',
      confidence: 'high' as const,
    },
    {
      fieldId: 'evaluationRules',
      value: 'Technical and financial proposals evaluated separately; methodology to be confirmed.',
      confidence: 'high' as const,
    },
    { fieldId: 'awardModel', value: 'TBC', confidence: 'high' as const },
    { fieldId: 'evaluationWeights', value: 'TBC', confidence: 'high' as const },
    {
      fieldId: 'users',
      value: { internal: ['MoDEE digital transformation unit', 'service owners'], external: [] },
      confidence: 'high' as const,
      updateKind: 'correction' as const,
    },
    {
      fieldId: 'approvers',
      value: ['Project owner', 'Steering committee chair'],
      confidence: 'high' as const,
    },
    {
      fieldId: 'assumptionsDependenciesConstraints',
      value: 'MoDEE provides access to service owners; vendor arranges own workspace.',
      confidence: 'high' as const,
    },
    {
      fieldId: 'bidderResponsibilities',
      value: 'Deliver assessment methodology, workshops, and final reports per schedule.',
      confidence: 'high' as const,
    },
    {
      fieldId: 'entityResponsibilities',
      value: 'MoDEE provides SMEs, data access, and steering participation.',
      confidence: 'high' as const,
    },
  ];
}

async function main() {
  loadLocalEnv();
  clearAllSessionCache();

  const session = await getOrHydrateSession(EVAL_DOCUMENT_KEY, EVAL_DOCUMENT_KEY);
  session.conversation.rfpIntent = 'CREATE_RFP';

  applyExtractedFacts(session.memory, buildEvalMemoryFacts(), 'seed:rag-live-eval');

  session.projectContext = classifyProject({
    memory: session.memory,
    previous: session.projectContext,
    latestMessage:
      'Assessment RFP for MoDEE digital services maturity over 18 months with deliverables and acceptance criteria.',
    signals: {
      documentStageSignal: 'FULL_RFP',
      granularitySignal: 'SINGLE_PROJECT',
      domainSignals: ['ASSESSMENT'],
    },
  });
  session.projectContext = withActivePacks(session.projectContext, session.memory);

  await persistRuntimeState(session);

  const sections = [
    'deliverables',
    'scopeOfWork',
    'background',
    'evaluationCriteria',
    'background',
  ] as const;
  console.log('Seeded', EVAL_DOCUMENT_KEY);
  for (const sid of sections) {
    const r = getSectionReadiness(session.memory, sid, session.projectContext);
    console.log(sid, r.readiness, {
      tbc: r.tbcFields.map((f) => f.fieldId),
      blockers: r.criticalBlockers?.slice(0, 3),
    });
  }

  await closePool();
}

const isDirect =
  process.argv[1] &&
  (process.argv[1].endsWith('seed-rag-live-eval.ts') ||
    process.argv[1].endsWith('seed-rag-live-eval.js'));

if (isDirect) {
  main().catch(async (err) => {
    console.error(err);
    await closePool().catch(() => undefined);
    process.exit(1);
  });
}
