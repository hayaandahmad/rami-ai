#!/usr/bin/env npx tsx
/**
 * Continue live proof using already-persisted background draft where present.
 * Completes: reload, approve protect, regenerate, scope generation, assemble.
 */
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { clearAllSessionCache } from '../src/server/rami/sessionStore';
import { clearDefaultProvider, getDefaultProvider } from '../src/server/ai';
import {
  generateRfpSection,
  getGeneratedSection,
  assembleRfpDocument,
  approveRfpSection,
  regenerateRfpSection,
} from '../src/server/rami/sectionGeneration';
import { findProjectByDocumentKey } from '../src/server/repositories/ProjectRepository';
import { listProjectFacts } from '../src/server/repositories/ProjectFactsRepository';
import { listSectionContentHistory } from '../src/server/repositories/ProjectSectionContentRepository';
import { getSectionReadiness } from '../src/server/rami/sectionReadiness';
import { hydrateProject } from '../src/server/rami/projectPersistence';
import { GenerationError } from '../src/types/generatedSection';

const DOC = 'rami-gen-core-demo';

async function main() {
  loadLocalEnv();
  clearAllSessionCache();
  clearDefaultProvider();

  const health = await getDefaultProvider().healthCheck();
  console.log('provider', health.providerType, health.smokeTestPassed);
  if (!health.smokeTestPassed) throw new Error('Ollama not ready');

  const project = await findProjectByDocumentKey(DOC);
  if (!project) throw new Error('missing demo project');

  const session = await hydrateProject(DOC);
  console.log(
    'background readiness',
    getSectionReadiness(session.memory, 'background', session.projectContext).readiness,
  );
  console.log(
    'scope readiness',
    getSectionReadiness(session.memory, 'scopeOfWork', session.projectContext).readiness,
  );

  let current = await getGeneratedSection({ documentKey: DOC, sectionId: 'background' });
  if (!current) {
    console.log('No background draft — generating...');
    const r = await generateRfpSection({ documentKey: DOC, sectionId: 'background' });
    current = r.content;
    console.log('generated v', current.version, 'blocks', r.generated.blocks.length);
  } else {
    console.log('existing background v', current.version, 'approval', current.approval_status);
  }

  clearAllSessionCache();
  const reloaded = await getGeneratedSection({ documentKey: DOC, sectionId: 'background' });
  console.log('reload_ok', Boolean(reloaded), 'blocks', reloaded?.content_json.blocks.length);

  const facts = await listProjectFacts(project.project_id);
  console.log('projectFactsCount', facts.length);

  if (current.approval_status !== 'APPROVED') {
    await approveRfpSection({ documentKey: DOC, sectionId: 'background' });
    console.log('approved background');
  }

  try {
    await regenerateRfpSection({ documentKey: DOC, sectionId: 'background' });
    throw new Error('expected APPROVED_CONTENT_PROTECTED');
  } catch (err) {
    if (err instanceof GenerationError && err.code === 'APPROVED_CONTENT_PROTECTED') {
      console.log('approve_protect_ok');
    } else {
      throw err;
    }
  }

  console.log('Regenerating background with reopenApproved...');
  const regen = await regenerateRfpSection({
    documentKey: DOC,
    sectionId: 'background',
    reopenApproved: true,
  });
  console.log('regen', { version: regen.content.version, approval: regen.content.approval_status });

  const scopeReady = getSectionReadiness(
    (await hydrateProject(DOC)).memory,
    'scopeOfWork',
    (await hydrateProject(DOC)).projectContext,
  );
  if (scopeReady.readiness === 'READY_TO_DRAFT' || scopeReady.readiness === 'DRAFTABLE_WITH_TBC') {
    console.log('Generating scopeOfWork...');
    const scope = await generateRfpSection({ documentKey: DOC, sectionId: 'scopeOfWork' });
    console.log('scope', {
      version: scope.content.version,
      blocks: scope.generated.blocks.length,
      types: scope.generated.blocks.map((b) => b.type),
    });
  } else {
    console.log('scope still blocked', scopeReady.readiness, scopeReady.criticalBlockers);
  }

  const hist = await listSectionContentHistory(project.project_id, 'background');
  console.log(
    'background history',
    hist.map((h) => ({ v: h.version, current: h.is_current, a: h.approval_status })),
  );

  const assembled = await assembleRfpDocument(DOC);
  console.log('assembled', {
    applicable: assembled.applicableSectionCount,
    generated: assembled.generatedApplicableCount,
    approved: assembled.approvedApplicableCount,
    complete: assembled.complete,
    generatedIds: assembled.sections.filter((s) => s.generated).map((s) => s.sectionId),
  });

  await closePool();
}

main().catch(async (err) => {
  console.error(err);
  await closePool().catch(() => undefined);
  process.exit(1);
});
