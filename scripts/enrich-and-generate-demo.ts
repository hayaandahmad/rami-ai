#!/usr/bin/env npx tsx
/**
 * Enrich demo project facts via applyExtractedFacts (same path as chat),
 * then generate all currently draftable applicable sections for a stronger demo.
 */
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { clearAllSessionCache } from '../src/server/rami/sessionStore';
import { hydrateProject, persistRuntimeState } from '../src/server/rami/projectPersistence';
import { applyExtractedFacts } from '../src/server/rami/memoryUpdater';
import { classifyProject } from '../src/server/rami/projectClassifier';
import { withActivePacks } from '../src/server/rami/questionPackEngine';
import { getAllSectionReadiness } from '../src/server/rami/sectionReadiness';
import {
  assembleRfpDocument,
  generateRfpSection,
  getGeneratedSection,
} from '../src/server/rami/sectionGeneration';
import { clearDefaultProvider, getDefaultProvider } from '../src/server/ai';

const DOC = 'rami-gen-core-demo';

async function main() {
  loadLocalEnv();
  clearAllSessionCache();
  clearDefaultProvider();

  const health = await getDefaultProvider().healthCheck();
  if (!health.smokeTestPassed) throw new Error('Ollama not ready');

  const session = await hydrateProject(DOC);
  applyExtractedFacts(
    session.memory,
    [
      {
        fieldId: 'engagementPhases',
        value: ['Discovery', 'Assessment', 'Recommendations', 'Knowledge transfer'],
        confidence: 'high',
        updateKind: 'correction',
      },
      {
        fieldId: 'deliverableItems',
        value: [
          'Maturity assessment report',
          'Target operating model recommendation',
          'Roadmap and sequencing advice',
          'Executive briefing deck',
        ],
        confidence: 'high',
        updateKind: 'correction',
      },
      {
        fieldId: 'deliverableFormats',
        value: ['PDF report', 'Editable source files', 'Presentation deck'],
        confidence: 'high',
        updateKind: 'correction',
      },
      {
        fieldId: 'entityResponsibilities',
        value: [
          'Provide access to stakeholders and service documentation',
          'Nominate a MoDEE project counterpart',
          'Validate interim findings',
        ],
        confidence: 'high',
        updateKind: 'correction',
      },
      {
        fieldId: 'bidderResponsibilities',
        value: [
          'Conduct the maturity assessment',
          'Produce recommendations and roadmap',
          'Transfer knowledge to MoDEE counterparts',
        ],
        confidence: 'high',
        updateKind: 'correction',
      },
      {
        fieldId: 'assumptionsDependenciesConstraints',
        value:
          'Assessment depends on timely MoDEE access to stakeholders; no software implementation is included.',
        confidence: 'high',
        updateKind: 'correction',
      },
      {
        fieldId: 'requiredAnnexes',
        value: ['Company profile', 'CVs of proposed team', 'Relevant assessment references'],
        confidence: 'high',
        updateKind: 'correction',
      },
      {
        fieldId: 'proposalDeadline',
        value: 'TBC',
        confidence: 'high',
        updateKind: 'correction',
      },
    ],
    'seed:demo-enrichment',
  );

  session.projectContext = classifyProject({
    memory: session.memory,
    previous: session.projectContext,
    latestMessage: 'Assessment RFP enrichment for demo completeness.',
    signals: {
      documentStageSignal: 'FULL_RFP',
      granularitySignal: 'SINGLE_PROJECT',
      domainSignals: ['ASSESSMENT'],
    },
  });
  session.projectContext = withActivePacks(session.projectContext, session.memory);
  await persistRuntimeState(session);

  const readiness = getAllSectionReadiness(session.memory, session.projectContext);
  const candidates = readiness.filter(
    (r) =>
      r.applicable &&
      (r.readiness === 'READY_TO_DRAFT' || r.readiness === 'DRAFTABLE_WITH_TBC'),
  );
  console.log(
    'Draftable sections:',
    candidates.map((c) => `${c.sectionId}:${c.readiness}`),
  );

  for (const c of candidates) {
    const existing = await getGeneratedSection({ documentKey: DOC, sectionId: c.sectionId });
    if (existing) {
      console.log('skip existing', c.sectionId, 'v' + existing.version);
      continue;
    }
    console.log('generating', c.sectionId, '…');
    try {
      const result = await generateRfpSection({
        documentKey: DOC,
        sectionId: c.sectionId,
      });
      console.log(
        '  ok',
        c.sectionId,
        'v' + result.content.version,
        'blocks',
        result.generated.blocks.length,
      );
    } catch (err) {
      console.error('  fail', c.sectionId, err instanceof Error ? err.message : err);
    }
  }

  const assembled = await assembleRfpDocument(DOC);
  console.log('assembled', {
    applicable: assembled.applicableSectionCount,
    generated: assembled.generatedApplicableCount,
    approved: assembled.approvedApplicableCount,
    missing: assembled.sections.filter((s) => s.missingGeneration).map((s) => s.sectionId),
  });

  await closePool();
}

main().catch(async (err) => {
  console.error(err);
  await closePool().catch(() => undefined);
  process.exit(1);
});
