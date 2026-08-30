#!/usr/bin/env npx tsx
/**
 * Seed a dedicated generation-demo project with real ProjectFacts so
 * Background becomes DRAFTABLE_WITH_TBC (painPoints left TBC).
 * Uses the same applyExtractedFacts + persist path as chat — not fake readiness.
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

export const DEMO_DOCUMENT_KEY = 'rami-gen-core-demo';

async function main() {
  loadLocalEnv();
  clearAllSessionCache();

  const session = await getOrHydrateSession(DEMO_DOCUMENT_KEY, DEMO_DOCUMENT_KEY);
  session.conversation.rfpIntent = 'CREATE_RFP';

  applyExtractedFacts(
    session.memory,
    [
      {
        fieldId: 'documentTitle',
        value: 'Digital Services Maturity Assessment RFP',
        confidence: 'high',
      },
      { fieldId: 'documentType', value: 'assessment', confidence: 'high' },
      {
        fieldId: 'beneficiaryEntity',
        value: 'Ministry of Digital Economy and Entrepreneurship (MoDEE)',
        confidence: 'high',
      },
      { fieldId: 'engagementType', value: 'consulting', confidence: 'high' },
      { fieldId: 'engagementDuration', value: '18 months', confidence: 'high' },
      {
        fieldId: 'currentSituation',
        value:
          'MoDEE currently delivers digital services through fragmented departmental portals with limited shared metrics and manual maturity tracking.',
        confidence: 'high',
      },
      {
        fieldId: 'businessNeedRationale',
        value:
          'The Ministry needs an independent assessment of digital-services maturity and a practical target operating model to guide subsequent modernization investments.',
        confidence: 'high',
      },
      {
        fieldId: 'businessObjectives',
        value: [
          'Assess current digital-services maturity across priority service lines',
          'Recommend a target operating model and roadmap',
          'Identify capability gaps and sequencing for follow-on RFPs',
        ],
        confidence: 'high',
      },
      {
        fieldId: 'painPoints',
        value: 'TBC',
        confidence: 'high',
      },
      {
        fieldId: 'previousPhases',
        value: 'Prior internal stocktake completed; no formal external assessment yet.',
        confidence: 'medium',
      },
      {
        fieldId: 'inScope',
        value: [
          'Maturity assessment of priority digital services',
          'Target operating model recommendation',
          'Roadmap and sequencing advice for follow-on procurements',
        ],
        confidence: 'high',
      },
      {
        fieldId: 'outOfScope',
        value: [
          'Software implementation',
          'Hardware procurement',
          'Ongoing managed service operations',
        ],
        confidence: 'high',
      },
      {
        fieldId: 'users',
        value:
          'MoDEE digital transformation unit and service owners; citizen service recipients as assessment subjects only',
        confidence: 'high',
        updateKind: 'correction',
      },
    ],
    'seed:generation-demo',
  );

  session.projectContext = classifyProject({
    memory: session.memory,
    previous: session.projectContext,
    latestMessage:
      'We need an assessment RFP for MoDEE digital services maturity over 18 months.',
    signals: {
      documentStageSignal: 'FULL_RFP',
      granularitySignal: 'SINGLE_PROJECT',
      domainSignals: ['ASSESSMENT'],
    },
  });
  session.projectContext = withActivePacks(session.projectContext, session.memory);

  await persistRuntimeState(session);

  const bg = getSectionReadiness(session.memory, 'background', session.projectContext);
  const scope = getSectionReadiness(session.memory, 'scopeOfWork', session.projectContext);

  console.log('Seeded', DEMO_DOCUMENT_KEY);
  console.log('background readiness:', bg.readiness, {
    answered: bg.answeredFields,
    tbc: bg.tbcFields,
    blockers: bg.criticalBlockers,
  });
  console.log('scopeOfWork readiness:', scope.readiness, {
    answered: scope.answeredFields,
    tbc: scope.tbcFields,
    blockers: scope.criticalBlockers,
  });

  await closePool();
}

const isDirect =
  process.argv[1] &&
  (process.argv[1].endsWith('seed-generation-demo.ts') ||
    process.argv[1].endsWith('seed-generation-demo.js'));

if (isDirect) {
  main().catch(async (err) => {
    console.error(err);
    await closePool().catch(() => undefined);
    process.exit(1);
  });
}