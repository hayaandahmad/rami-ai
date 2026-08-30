#!/usr/bin/env npx tsx
/**
 * Live vertical-slice proof: generate Background for rami-gen-core-demo via local Ollama.
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
import { DEMO_DOCUMENT_KEY } from './seed-generation-demo';

async function main() {
  loadLocalEnv();
  clearAllSessionCache();
  clearDefaultProvider();

  const health = await getDefaultProvider().healthCheck();
  console.log('provider', {
    type: health.providerType,
    defaultModel: health.defaultModelAvailable,
    smoke: health.smokeTestPassed,
    smokeError: health.smokeTestError,
  });
  if (!health.defaultModelAvailable || !health.smokeTestPassed) {
    throw new Error('Local Ollama qwen3:8b is not ready');
  }

  // Ensure demo facts are present (idempotent seed via subprocess would also work)
  const { execSync } = await import('node:child_process');
  execSync('npx tsx scripts/seed-generation-demo.ts', { stdio: 'inherit' });
  clearAllSessionCache();

  const doc = DEMO_DOCUMENT_KEY;
  const project = await findProjectByDocumentKey(doc);
  if (!project) throw new Error(`Missing project ${doc} — run npm run seed:generation-demo`);

  const factsBefore = await listProjectFacts(project.project_id);
  console.log('factsBefore', factsBefore.length);

  console.log('Generating background via RamiModelProvider...');
  const t0 = Date.now();
  const result = await generateRfpSection({ documentKey: doc, sectionId: 'background' });
  console.log('elapsedMs', Date.now() - t0);
  console.log(
    JSON.stringify(
      {
        version: result.content.version,
        approval: result.content.approval_status,
        readiness: result.context.readiness,
        model: result.generated.modelUsed,
        sourceFieldIds: result.generated.sourceFieldIds,
        tbcFieldIds: result.generated.tbcFieldIds,
        blocks: result.generated.blocks,
      },
      null,
      2,
    ),
  );

  clearAllSessionCache();
  const reloaded = await getGeneratedSection({ documentKey: doc, sectionId: 'background' });
  console.log('reload', {
    ok: Boolean(reloaded),
    version: reloaded?.version,
    blockCount: reloaded?.content_json.blocks.length,
  });

  const factsAfter = await listProjectFacts(project.project_id);
  console.log('factsUnchanged', factsAfter.length === factsBefore.length, {
    before: factsBefore.length,
    after: factsAfter.length,
  });

  // Also generate scope (READY_TO_DRAFT) to prove reusable pipeline
  console.log('Generating scopeOfWork...');
  const scope = await generateRfpSection({ documentKey: doc, sectionId: 'scopeOfWork' });
  console.log('scope', {
    version: scope.content.version,
    blockTypes: scope.generated.blocks.map((b) => b.type),
    readiness: scope.context.readiness,
  });

  await approveRfpSection({ documentKey: doc, sectionId: 'background' });
  console.log('background approved');

  try {
    await regenerateRfpSection({ documentKey: doc, sectionId: 'background' });
    console.log('ERROR: regenerate should have been blocked');
    process.exitCode = 1;
  } catch (err) {
    console.log(
      'approve_protect_ok',
      err instanceof Error ? err.message.slice(0, 120) : String(err),
    );
  }

  const regen = await regenerateRfpSection({
    documentKey: doc,
    sectionId: 'background',
    reopenApproved: true,
  });
  console.log('regen_after_reopen', {
    version: regen.content.version,
    approval: regen.content.approval_status,
  });

  const hist = await listSectionContentHistory(project.project_id, 'background');
  console.log(
    'history',
    hist.map((h) => ({
      v: h.version,
      current: h.is_current,
      approval: h.approval_status,
    })),
  );

  const assembled = await assembleRfpDocument(doc);
  console.log('assembled', {
    applicable: assembled.applicableSectionCount,
    generatedApplicable: assembled.generatedApplicableCount,
    approvedApplicable: assembled.approvedApplicableCount,
    complete: assembled.complete,
  });

  await closePool();
}

main().catch(async (err) => {
  console.error(err);
  await closePool().catch(() => undefined);
  process.exit(1);
});
