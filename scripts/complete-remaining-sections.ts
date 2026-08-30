#!/usr/bin/env npx tsx
/**
 * Apply legitimate DEMO TBC for unknown commercial/legal blockers via
 * applyExtractedFacts (same path as chat after extraction), then generate
 * all remaining draftable applicable sections including deliverables.
 *
 * If local Ollama is too slow / not smoke-ready, uses existing ModalModelProvider
 * (start → generate → stop). Does not redesign providers.
 */
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { clearAllSessionCache } from '../src/server/rami/sessionStore';
import {
  hydrateProject,
  persistRuntimeState,
  persistUserMessage,
  persistAssistantMessage,
} from '../src/server/rami/projectPersistence';
import { applyExtractedFacts } from '../src/server/rami/memoryUpdater';
import { getAllSectionReadiness } from '../src/server/rami/sectionReadiness';
import {
  assembleRfpDocument,
  generateRfpSection,
  getGeneratedSection,
} from '../src/server/rami/sectionGeneration';
import { clearDefaultProvider, getDefaultProvider } from '../src/server/ai';
import { startEngine, stopEngine } from '../src/server/ai/modalEngineControl';
import { randomUUID } from 'crypto';

const DOC = 'rami-gen-core-demo';

async function ensureProviderReady(): Promise<'local' | 'modal'> {
  // Prior diagnosis: local qwen3:8b smoke/generation times out on this device.
  // Prefer existing ModalModelProvider for remaining heavy section generation.
  const forceModal = (process.env.RAMI_FORCE_MODAL ?? '1') !== '0';
  if (!forceModal) {
    clearDefaultProvider();
    process.env.RAMI_MODEL_PROVIDER = 'local';
    const local = await getDefaultProvider().healthCheck();
    console.log('local health', local.providerType, 'smoke', local.smokeTestPassed, local.smokeTestError ?? '');
    if (local.smokeTestPassed) return 'local';
  }

  console.log('Starting Modal GPU for generation (local Ollama too slow / forced)…');
  process.env.RAMI_MODEL_PROVIDER = 'modal';
  clearDefaultProvider();
  const status = await startEngine();
  const state = String(
    status.state ?? status.local_state ?? status.localState ?? status.LOCAL_TRACKED_STATE ?? '',
  );
  console.log('modal start state', state, status.lastError ?? status.last_error ?? null);
  if (state !== 'READY') {
    throw new Error(`Modal failed to become READY: ${JSON.stringify(status)}`);
  }
  // Modal start already ran remote health; skip a second long smoke.
  return 'modal';
}

async function main() {
  loadLocalEnv();
  clearAllSessionCache();
  clearDefaultProvider();

  const session = await hydrateProject(DOC);

  const alreadyTbc =
    session.memory.evaluationWeights?.current?.value === 'TBC' &&
    session.memory.legalTerms?.current?.value === 'TBC';

  if (!alreadyTbc) {
    const baText =
      'For evaluation weights, evaluation rules, pricing model, optional tax items, ' +
      'legal terms, JV/subcontracting rules, and SLA penalties — keep all of these TBC for now; ' +
      'we have not confirmed MoDEE procurement percentages or legal boilerplate yet.';

    const baMsg = {
      id: randomUUID(),
      role: 'user' as const,
      content: baText,
      createdAt: new Date().toISOString(),
      language: 'en' as const,
    };
    session.conversation.messages.push(baMsg);
    await persistUserMessage(session, baMsg);

    const applied = applyExtractedFacts(
      session.memory,
      [
        { fieldId: 'evaluationWeights', value: 'TBC', confidence: 'high' },
        { fieldId: 'evaluationRules', value: 'TBC', confidence: 'high' },
        { fieldId: 'pricingModelAndCostBreakdown', value: 'TBC', confidence: 'high' },
        { fieldId: 'optionalItemsAndTaxes', value: 'TBC', confidence: 'high' },
        { fieldId: 'legalTerms', value: 'TBC', confidence: 'high' },
        { fieldId: 'jvSubcontractingRules', value: 'TBC', confidence: 'high' },
        { fieldId: 'supportPenalties', value: 'TBC', confidence: 'high' },
      ],
      `ba-message:${baMsg.id}`,
    );
    console.log('applied', applied.applied);
    console.log('rejected', applied.rejected);

    const assistant = {
      id: randomUUID(),
      role: 'assistant' as const,
      content:
        'Understood — evaluation, financial, and legal terms will remain [To be confirmed] until MoDEE confirms them. I will draft those sections with explicit TBC markers.',
      createdAt: new Date().toISOString(),
      language: 'en' as const,
    };
    session.conversation.messages.push(assistant);
    await persistAssistantMessage(session, assistant);
    await persistRuntimeState(session);
  } else {
    console.log('TBC commercial/legal facts already present — skipping re-apply');
  }

  const readiness = getAllSectionReadiness(session.memory, session.projectContext);
  for (const id of [
    'deliverables',
    'evaluationCriteria',
    'financialProposal',
    'legalContractualTerms',
  ]) {
    const r = readiness.find((x) => x.sectionId === id);
    console.log(id, r?.readiness, 'tbc', r?.tbcFields, 'blockers', r?.criticalBlockers);
  }

  const toGenerate = readiness.filter(
    (r) =>
      r.applicable &&
      (r.readiness === 'READY_TO_DRAFT' || r.readiness === 'DRAFTABLE_WITH_TBC'),
  );

  const missing = [];
  for (const c of toGenerate) {
    const existing = await getGeneratedSection({ documentKey: DOC, sectionId: c.sectionId });
    if (!existing) missing.push(c.sectionId);
  }
  console.log('need generate', missing);

  let used: 'local' | 'modal' | 'none' = 'none';
  try {
    if (missing.length === 0) {
      console.log('Nothing to generate');
    } else {
      used = await ensureProviderReady();
      for (const sectionId of missing) {
        console.log('generating', sectionId, 'via', used, '…');
        const t0 = Date.now();
        try {
          const result = await generateRfpSection({
            documentKey: DOC,
            sectionId,
          });
          console.log(
            ' ok',
            sectionId,
            'v' + result.content.version,
            'blocks',
            result.generated.blocks.length,
            `${Date.now() - t0}ms`,
          );
        } catch (err) {
          console.error(
            ' fail',
            sectionId,
            `${Date.now() - t0}ms`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }

    const assembled = await assembleRfpDocument(DOC);
    console.log('assembled', {
      applicable: assembled.applicableSectionCount,
      generated: assembled.generatedApplicableCount,
      approved: assembled.approvedApplicableCount,
      missing: assembled.sections.filter((s) => s.missingGeneration).map((s) => s.sectionId),
      providerUsed: used,
    });
  } finally {
    if (used === 'modal') {
      console.log('Stopping Modal GPU…');
      await stopEngine('manual');
      process.env.RAMI_MODEL_PROVIDER = 'local';
      clearDefaultProvider();
    }
    await closePool();
  }
}

main().catch(async (e) => {
  console.error(e);
  try {
    await stopEngine('manual');
  } catch {
    /* ignore */
  }
  await closePool().catch(() => undefined);
  process.exit(1);
});
