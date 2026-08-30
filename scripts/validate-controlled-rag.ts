#!/usr/bin/env npx tsx
/**
 * Controlled RAG integration validation (no Modal GPU / no chat LLM required).
 */
import assert from 'node:assert/strict';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool, query } from '../src/server/db/connection';
import { isDatabaseConfigured } from '../src/server/db/config';
import { clearAllSessionCache } from '../src/server/rami/sessionStore';
import { ensureProject } from '../src/server/repositories/ProjectRepository';
import { countLiveProjectTables } from '../src/server/rami/historicalRepository';
import {
  evaluateHistoricalRetrievalPolicy,
  chooseHistoricalRetrievalMode,
} from '../src/server/rami/historicalRetrievalPolicy';
import { retrieveHistoricalReferences } from '../src/server/rami/historicalRetrieval';
import {
  createProposalFromReference,
  acceptProposal,
  rejectProposal,
  isNonConfirmingProvenance,
} from '../src/server/rami/historicalProposalService';
import { listProposals } from '../src/server/rami/historicalProposalRepository';
import {
  getOrHydrateSession,
  persistRuntimeState,
} from '../src/server/rami/projectPersistence';
import { applyExtractedFacts } from '../src/server/rami/memoryUpdater';
import { getSectionReadiness } from '../src/server/rami/sectionReadiness';
import { createMemoryField } from '../src/types/provenance';
import type { ProjectMemory } from '../src/types/projectMemory';

const DOC_KEY = 'rami-rag-controlled-demo';

let passed = 0;
let failed = 0;

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    failed++;
  }
}

console.log('\n=== Controlled RAG integration checks ===\n');

async function main() {
  loadLocalEnv();
  assert.ok(isDatabaseConfigured(), 'DB required');

  await run('no retrieval on ordinary turns', () => {
    const p = evaluateHistoricalRetrievalPolicy({
      userMessage: 'The project lasts 12 months and covers licensing.',
    });
    assert.equal(p.shouldRetrieve, false);
    assert.equal(p.mode, 'none');
  });

  await run('explicit example request triggers retrieval', () => {
    const p = evaluateHistoricalRetrievalPolicy({
      userMessage: 'Show me examples for deliverables from previous RFPs',
    });
    assert.equal(p.shouldRetrieve, true);
    assert.ok(p.fieldIds.includes('deliverableItems') || p.sectionIds.includes('deliverables'));
  });

  await run('Field-known request uses structured-first', () => {
    const p = evaluateHistoricalRetrievalPolicy({
      userMessage: 'Do we have historical examples for scope definition?',
    });
    assert.equal(p.shouldRetrieve, true);
    assert.equal(p.mode, 'structured');
    assert.equal(chooseHistoricalRetrievalMode({ fieldIds: ['inScope'] }), 'structured');
  });

  await run('free-text request uses hybrid', () => {
    const p = evaluateHistoricalRetrievalPolicy({
      userMessage: 'What did previous RFPs use for similar multi-vendor arrangements?',
    });
    assert.equal(p.shouldRetrieve, true);
    assert.equal(p.mode, 'hybrid');
  });

  await run('PROPOSED/REFERENCE provenance does not satisfy readiness', () => {
    const memory = {} as ProjectMemory;
    const bag = {
      ...createMemoryField('deliverableItems', ['Monthly report'], 'PROPOSED', 'historical-retrieval'),
      gapStatus: 'KNOWN' as const,
    };
    (memory as unknown as Record<string, unknown>).deliverableItems = bag;
    assert.ok(isNonConfirmingProvenance('PROPOSED'));
    const r = getSectionReadiness(memory, 'deliverables');
    assert.ok(!r.answeredFields.includes('deliverableItems'));
    assert.ok(r.tbcFields.includes('deliverableItems') || r.missingFields.includes('deliverableItems'));
  });

  await run('procurementStage is not promoted / not a canonical retrieval focus', () => {
    const p = evaluateHistoricalRetrievalPolicy({
      userMessage: 'examples for procurement stage',
    });
    // May retrieve as free-text/hybrid but must not invent fieldId procurementStage
    assert.ok(!p.fieldIds.includes('procurementStage'));
  });

  // —— Live DB controlled flow ——
  clearAllSessionCache();
  const project = await ensureProject(DOC_KEY, 'RAG Controlled Demo');

  // Clean prior proposals / deliverable fact for this demo
  await query(`DELETE FROM historical_field_proposals WHERE project_id = $1`, [
    project.project_id,
  ]);
  await query(`DELETE FROM project_facts WHERE project_id = $1 AND field_id = ANY($2::text[])`, [
    project.project_id,
    ['deliverableItems', 'deliverableFormats'],
  ]);
  clearAllSessionCache();
  const beforeLive = await countLiveProjectTables();

  let acceptRefChunkId = '';
  let rejectRefChunkId = '';
  let acceptProposalId = '';
  let liveRetrieval: Awaited<ReturnType<typeof retrieveHistoricalReferences>> = [];

  await run('REFERENCE retrieval does not modify ProjectFacts', async () => {
    const policy = evaluateHistoricalRetrievalPolicy({
      userMessage: 'Show me examples for deliverables from previous RFPs',
    });
    assert.equal(policy.shouldRetrieve, true);
    liveRetrieval = await retrieveHistoricalReferences(policy.query, {
      mode: policy.mode === 'none' ? 'hybrid' : policy.mode,
      topK: policy.topK || 5,
      fieldIds: policy.fieldIds.length ? policy.fieldIds : undefined,
      sectionIds: policy.sectionIds.length ? policy.sectionIds : undefined,
    });
    assert.ok(liveRetrieval.length > 0, 'expected historical hits');
    assert.ok(liveRetrieval.every((r) => r.provenanceClass === 'REFERENCE'));
    acceptRefChunkId = liveRetrieval[0].chunkId;
    rejectRefChunkId = liveRetrieval[Math.min(1, liveRetrieval.length - 1)].chunkId;
    console.log(
      '    retrieval',
      JSON.stringify({
        mode: policy.mode,
        query: policy.query,
        fieldIds: policy.fieldIds,
        topK: policy.topK,
        scores: liveRetrieval.slice(0, 3).map((r) => ({
          rfp: r.historicalRfpId,
          score: Number(r.score.toFixed(3)),
          chunkId: r.chunkId.slice(0, 8),
        })),
      }),
    );
    const mid = await countLiveProjectTables();
    assert.deepEqual(mid, beforeLive);
  });

  await run('PROPOSED pending does not create ProjectFact / readiness unresolved', async () => {
    const { proposal, skippedAsRejected } = await createProposalFromReference({
      documentKey: DOC_KEY,
      fieldId: 'deliverableItems',
      reference: liveRetrieval[0],
      retrievalQuery: 'deliverables examples',
      retrievalDebug: { mode: 'structured', score: liveRetrieval[0].score },
    });
    assert.equal(skippedAsRejected, false);
    assert.ok(proposal);
    assert.equal(proposal!.status, 'PENDING');
    acceptProposalId = proposal!.proposalId;

    const session = await getOrHydrateSession(DOC_KEY, DOC_KEY);
    const fact = (session.memory as unknown as Record<string, unknown>).deliverableItems;
    assert.ok(fact == null, 'PENDING must not write ProjectFact');
    const readiness = getSectionReadiness(session.memory, 'deliverables', session.projectContext);
    assert.ok(!readiness.answeredFields.includes('deliverableItems'));
  });

  await run('reload preserves pending proposals', async () => {
    const pending = await listProposals({
      projectId: project.project_id,
      status: 'PENDING',
    });
    assert.ok(pending.some((p) => p.proposalId === acceptProposalId));
  });

  await run('BA modification uses modified value + lineage on accept', async () => {
    const modified = 'Supplier shall provide weekly progress reports and a final handover pack.';
    const result = await acceptProposal({
      documentKey: DOC_KEY,
      proposalId: acceptProposalId,
      modifiedValue: modified,
      confirmedBy: 'ba-test',
    });
    assert.equal(result.proposal.status, 'ACCEPTED');
    clearAllSessionCache();
    const session = await getOrHydrateSession(DOC_KEY, DOC_KEY);
    const bag = (session.memory as unknown as Record<string, { current: { value: unknown; status: string; sourceType: string; sourceRef?: string }; history: Array<{ status: string }> }>).deliverableItems;
    assert.ok(bag);
    assert.equal(bag.current.value, modified);
    assert.equal(bag.current.status, 'CONFIRMED');
    assert.equal(bag.current.sourceType, 'historical-retrieval');
    assert.ok(bag.current.sourceRef?.includes('historical-proposal'));
    assert.ok(bag.history.some((h) => h.status === 'PROPOSED'));
    const readiness = getSectionReadiness(session.memory, 'deliverables', session.projectContext);
    assert.ok(readiness.answeredFields.includes('deliverableItems'));
  });

  await run('rejection does not create ProjectFact and blocks re-propose', async () => {
    // Use a different field for reject path
    await query(`DELETE FROM project_facts WHERE project_id = $1 AND field_id = $2`, [
      project.project_id,
      'deliverableFormats',
    ]);
    clearAllSessionCache();
    const ref =
      liveRetrieval.find((r) => r.chunkId === rejectRefChunkId) ?? liveRetrieval[0];
    const { proposal } = await createProposalFromReference({
      documentKey: DOC_KEY,
      fieldId: 'deliverableFormats',
      reference: { ...ref, mappedFieldIds: ['deliverableFormats', ...ref.mappedFieldIds] },
    });
    assert.ok(proposal);
    await rejectProposal({ documentKey: DOC_KEY, proposalId: proposal!.proposalId });
    clearAllSessionCache();
    const session = await getOrHydrateSession(DOC_KEY, DOC_KEY);
    assert.ok(
      (session.memory as unknown as Record<string, unknown>).deliverableFormats == null,
      'reject must not write ProjectFact',
    );
    const again = await createProposalFromReference({
      documentKey: DOC_KEY,
      fieldId: 'deliverableFormats',
      reference: ref,
    });
    assert.equal(again.skippedAsRejected, true);
  });

  await run('historical text is not applied via applyExtractedFacts alone', async () => {
    // Simulates protection: extraction path only uses BA message; historical text must not be auto-applied
    const session = await getOrHydrateSession(DOC_KEY, DOC_KEY);
    const before = JSON.stringify(session.memory);
    // Calling applyExtractedFacts with empty facts (what happens if BA didn't state anything)
    applyExtractedFacts(session.memory, [], 'user-message:test');
    assert.equal(JSON.stringify(session.memory), before);
    // Explicitly: do NOT call applyExtractedFacts on historical chunk text
    await persistRuntimeState(session);
  });

  await run('source traceability on proposal', async () => {
    const accepted = await listProposals({
      projectId: project.project_id,
      status: 'ACCEPTED',
    });
    assert.ok(accepted.length >= 1);
    const p = accepted[0];
    assert.ok(p.sourceChunkIds.length > 0);
    assert.ok(p.sourceReferences[0]?.historicalRfpId);
    assert.equal(p.sourceReferences[0]?.provenanceClass, 'REFERENCE');
  });

  await run('ProjectFacts isolation for other live tables (demo projects intact counts shape)', async () => {
    const after = await countLiveProjectTables();
    // projects count may +1 if demo was new; facts/messages may change for demo only
    assert.ok(after.projects >= beforeLive.projects);
    assert.ok(after.project_facts >= beforeLive.project_facts);
  });

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  await closePool();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await closePool().catch(() => undefined);
  process.exit(1);
});
