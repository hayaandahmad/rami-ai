#!/usr/bin/env npx tsx
/**
 * UI Phase A2 — project workspace truth: labels, blockers, progress, export copy.
 */
import assert from 'node:assert/strict';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { isDatabaseConfigured } from '../src/server/db/config';
import { describeBlocker, exportStatusCopy, fieldLabel, looksLikeRawFieldId } from '../src/utils/fieldDisplay';
import { assembleRfpDocument } from '../src/server/rami/sectionGeneration';
import { getOrHydrateSession } from '../src/server/rami/projectPersistence';
import { analyzeGaps } from '../src/server/rami/gapEngine';
import { buildProjectUnderstanding } from '../src/server/rami/projectUnderstanding';
import { getDocumentActionHref } from '../src/utils/documentNavigation';

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

console.log('\n=== UI Phase A2 checks ===\n');

async function main() {
  loadLocalEnv();

  await run('canonical field labels are human-readable', () => {
    assert.equal(fieldLabel('evaluationWeights'), 'Technical vs Financial Evaluation Weights');
    assert.ok(!looksLikeRawFieldId(fieldLabel('evaluationWeights')));
    assert.ok(!looksLikeRawFieldId(fieldLabel('awardModel')));
    assert.ok(!looksLikeRawFieldId(fieldLabel('namedKeyPersonnel')));
  });

  await run('blocker copy never leads with raw field IDs for known fields', () => {
    const missing = describeBlocker('evaluationWeights', 'missing');
    const tbc = describeBlocker('evaluationWeights', 'tbc');
    const conflict = describeBlocker('awardModel', 'contradiction');
    assert.equal(missing, 'Technical vs Financial Evaluation Weights');
    assert.match(tbc, /To be confirmed/i);
    assert.match(conflict, /Conflicting/i);
    assert.ok(!missing.startsWith('evaluationWeights'));
    assert.ok(!tbc.startsWith('evaluationWeights'));
  });

  await run('export copy distinguishes working draft vs all-approved', () => {
    const draft = exportStatusCopy(false);
    const approved = exportStatusCopy(true);
    assert.match(draft.helper, /Working draft/i);
    assert.match(approved.helper, /approved/i);
    assert.ok(!draft.helper.toLowerCase().includes('final rfp'));
  });

  await run('Continue Working / Open draft routes to interview workspace', () => {
    assert.equal(
      getDocumentActionHref('rami-gen-core-demo', 'open-draft'),
      '/documents/rami-gen-core-demo/interview',
    );
    assert.equal(
      getDocumentActionHref('rami-gen-core-demo', 'review-inputs'),
      '/documents/rami-gen-core-demo/interview',
    );
  });

  if (isDatabaseConfigured()) {
    await run('assembled approved count is authoritative for demo project', async () => {
      const assembled = await assembleRfpDocument('rami-gen-core-demo');
      assert.ok(assembled.applicableSectionCount > 0);
      assert.equal(
        assembled.approvedApplicableCount,
        assembled.sections.filter((s) => s.applicable && s.approvalStatus === 'APPROVED').length,
      );
      assert.equal(
        assembled.complete,
        assembled.applicableSectionCount > 0 &&
          assembled.approvedApplicableCount === assembled.applicableSectionCount,
      );
    });

    await run('project understanding uses field labels not raw IDs', async () => {
      const session = await getOrHydrateSession('rami-gen-core-demo', 'rami-gen-core-demo');
      const gaps = analyzeGaps(session.memory, session.projectContext, {
        contextContradictions: session.contextContradictions,
      });
      const understanding = buildProjectUnderstanding(
        session.memory,
        session.projectContext,
        gaps,
        session.contextContradictions,
      );
      for (const item of [
        ...understanding.missingCritical,
        ...understanding.tbcItems,
        ...understanding.contradictions,
      ]) {
        assert.ok(!item.label.startsWith(item.fieldId) || item.label.includes(' '));
        assert.notEqual(item.label, item.fieldId);
      }
    });
  } else {
    console.log('\n(Skipping live DB A2 checks — RAMI_DB not configured)\n');
  }

  await closePool();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
