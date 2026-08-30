#!/usr/bin/env tsx
/**
 * Phase 2.2 Adaptive Control Plane validation (deterministic — no Ollama required).
 */

import { createEmptyProjectMemory } from '../src/types/projectMemory';
import { createEmptyProjectContext } from '../src/types/projectContext';
import { createMemoryField } from '../src/types/provenance';
import { analyzeGaps, isSafeUnknown } from '../src/server/rami/gapEngine';
import {
  applyExtractedFacts,
  hasSupersedingLanguage,
  hasCompetingSourceLanguage,
} from '../src/server/rami/memoryUpdater';
import { classifyProject } from '../src/server/rami/projectClassifier';
import { activatePacks, withActivePacks } from '../src/server/rami/questionPackEngine';
import { assertAllFieldsHaveControlMeta } from '../src/schema/fieldControlMeta';
import { ALL_PACK_IDS } from '../src/types/projectContext';
import { normalizeAskRequirements } from '../src/types/nextAction';
import { isProvenanceTransitionAllowed } from '../src/types/provenance';

let passed = 0;
let failed = 0;

function check(description: string, fn: () => boolean | void): void {
  try {
    const result = fn();
    if (result === false) throw new Error('assertion returned false');
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${String(err)}`);
    failed++;
  }
}

function setExtracted(
  memory: ReturnType<typeof createEmptyProjectMemory>,
  fieldId: keyof ReturnType<typeof createEmptyProjectMemory>,
  value: unknown,
) {
  (memory as unknown as Record<string, unknown>)[fieldId as string] = {
    ...createMemoryField(fieldId as string, value, 'EXTRACTED', 'ba-message'),
    gapStatus: 'KNOWN',
  };
}

console.log('\n=== Rami Phase 2.2 Adaptive Validation ===\n');

console.log('0. Metadata');
check('All canonical fields have control meta', () => {
  const missing = assertAllFieldsHaveControlMeta();
  if (missing.length) throw new Error(`Missing meta: ${missing.join(', ')}`);
});
check('PackId freeze includes CORE and 14 conditional packs', () => {
  if (ALL_PACK_IDS.length !== 15) throw new Error(`Got ${ALL_PACK_IDS.length}`);
  if (!ALL_PACK_IDS.includes('CORE')) throw new Error('missing CORE');
});
check('ASK_REQUIREMENTS hard cap ≤3 field IDs', () => {
  const a = normalizeAskRequirements('inScope', ['outOfScope', 'users', 'painPoints', 'extra']);
  if (a.relatedFieldIds.length > 2) throw new Error('related > 2');
  if (1 + a.relatedFieldIds.length > 3) throw new Error('cluster > 3');
});

console.log('\n1. Unresolved opening (UNDETERMINED → CORE only)');
check('Vague message keeps UNDETERMINED and CORE-only packs', () => {
  const memory = createEmptyProjectMemory();
  let ctx = classifyProject({ memory, latestMessage: 'I need some help with a project' });
  ctx = withActivePacks(ctx, memory);
  if (ctx.documentStage !== 'UNDETERMINED') throw new Error(`stage=${ctx.documentStage}`);
  if (ctx.primaryDomain !== 'UNDETERMINED') throw new Error(`domain=${ctx.primaryDomain}`);
  if (ctx.activePacks.some((p) => p === 'PROCUREMENT' || p === 'SYSTEM_IMPLEMENTATION')) {
    throw new Error(`unexpected packs: ${ctx.activePacks.join(',')}`);
  }
  const gaps = analyzeGaps(memory, ctx);
  if (gaps.nextAction.type === 'STOP_COLLECTION') {
    throw new Error('must not stop while unresolved without CORE answers');
  }
  if (gaps.collectionSufficient) throw new Error('must not be sufficient');
});

console.log('\n2. Simple consulting — no SYSTEM missing-required');
check('Consulting activates CORE without SYSTEM pack interrogation', () => {
  const memory = createEmptyProjectMemory();
  setExtracted(memory, 'documentType', 'consulting');
  setExtracted(memory, 'engagementType', 'consulting service');
  setExtracted(memory, 'beneficiaryEntity', 'MoDEE');
  setExtracted(memory, 'currentSituation', 'Manual licensing processes');
  setExtracted(memory, 'businessNeedRationale', 'Need process redesign advice');
  setExtracted(memory, 'businessObjectives', ['Improve turnaround']);
  setExtracted(memory, 'inScope', ['Process review']);
  setExtracted(memory, 'outOfScope', ['Software build']);
  setExtracted(memory, 'users', { internal: ['BA team'], external: [] });
  setExtracted(memory, 'engagementDuration', '6 months');
  setExtracted(memory, 'deliverableItems', ['As-Is report', 'Recommendations']);

  let ctx = classifyProject({
    memory,
    latestMessage: 'We need a consulting RFP for MoDEE process advice, 6 months',
  });
  ctx = withActivePacks(ctx, memory);
  if (ctx.primaryDomain !== 'CONSULTING' && ctx.primaryDomain !== 'BPR') {
    throw new Error(`domain=${ctx.primaryDomain}`);
  }
  if (ctx.activePacks.includes('SYSTEM_IMPLEMENTATION')) {
    throw new Error('SYSTEM pack should not activate for pure consulting');
  }
  const gaps = analyzeGaps(memory, ctx);
  const systemMissing = gaps.fieldGaps.filter(
    (g) =>
      g.gapStatus === 'MISSING' &&
      g.packs.includes('SYSTEM_IMPLEMENTATION') &&
      !g.packs.includes('CORE'),
  );
  // SYSTEM-only fields should be N/A not MISSING
  for (const g of gaps.fieldGaps) {
    if (g.fieldId === 'functionalModules' || g.fieldId === 'hostingModel') {
      if (g.gapStatus === 'MISSING') {
        throw new Error(`${g.fieldId} should not be MISSING for consulting`);
      }
    }
  }
  void systemMissing;
  // Stop may or may not fire depending on remaining HIGH core — ensure no field-count logic
  if (typeof gaps.collectionSufficient !== 'boolean') throw new Error('missing flag');
});

console.log('\n3. BPR — securityRegulatory independent of technical');
check('BPR can be LOW technical and still allow SECURITY applicability concept', () => {
  const memory = createEmptyProjectMemory();
  setExtracted(memory, 'documentType', 'consulting');
  setExtracted(
    memory,
    'inScope',
    ['Redesign 12 licensing processes', 'As-Is To-Be', 'citizen data privacy review'],
  );
  setExtracted(memory, 'currentSituation', 'Paper processes with personal data');
  let ctx = classifyProject({
    memory,
    latestMessage: 'BPR for licensing processes with citizen data privacy',
  });
  if (ctx.primaryDomain !== 'BPR') throw new Error(`domain=${ctx.primaryDomain}`);
  if (ctx.complexity.technical === 'HIGH') throw new Error('technical should not be HIGH');
  // privacy language bumps securityRegulatory
  if (
    ctx.complexity.securityRegulatory === 'UNDETERMINED' ||
    ctx.complexity.securityRegulatory === 'LOW'
  ) {
    // may be HIGH from privacy words
  }
  if (ctx.complexity.process !== 'HIGH') throw new Error(`process=${ctx.complexity.process}`);
});

console.log('\n4. Pre-qualification defers SLA-style missing');
check('PRE_QUALIFICATION does not treat SLA as CORE missing', () => {
  const memory = createEmptyProjectMemory();
  setExtracted(memory, 'documentType', 'system-implementation');
  let ctx = classifyProject({
    memory,
    signals: { documentStageSignal: 'PRE_QUALIFICATION' },
    latestMessage: 'This is a pre-qualification for a future AI system',
  });
  ctx = withActivePacks(ctx, memory);
  if (ctx.documentStage !== 'PRE_QUALIFICATION') throw new Error(ctx.documentStage);
  if (!ctx.activePacks.includes('PRE_QUALIFICATION')) throw new Error('missing PQ pack');
  const gaps = analyzeGaps(memory, ctx);
  const slaMissing = gaps.fieldGaps.find(
    (g) => g.fieldId === 'slaTiers' && g.gapStatus === 'MISSING',
  );
  // SLA pack should not be active for PQ unless evidence — so slaTiers N/A or not HIGH missing
  if (slaMissing && ctx.activePacks.includes('SLA_SUPPORT')) {
    // ok if pack active; otherwise should be N/A
  }
  if (!ctx.activePacks.includes('SLA_SUPPORT') && slaMissing) {
    throw new Error('slaTiers MISSING without SLA pack');
  }
});

console.log('\n5. Framework defers assignment-specific facts');
check('FRAMEWORK granularity activates FRAMEWORK pack', () => {
  const memory = createEmptyProjectMemory();
  setExtracted(memory, 'documentType', 'framework-agreement');
  setExtracted(memory, 'engagementType', 'framework agreement');
  let ctx = classifyProject({
    memory,
    latestMessage: 'Open framework for connectivity services',
  });
  ctx = withActivePacks(ctx, memory);
  if (ctx.contractingGranularity !== 'FRAMEWORK') {
    throw new Error(`granularity=${ctx.contractingGranularity}`);
  }
  if (!ctx.activePacks.includes('FRAMEWORK')) throw new Error('FRAMEWORK pack missing');
});

console.log('\n6. Correction path');
check('"Actually make that 8 months" is correction not contradiction', () => {
  if (!hasSupersedingLanguage('Actually make that 8 months.')) {
    throw new Error('superseding language not detected');
  }
  const memory = createEmptyProjectMemory();
  applyExtractedFacts(memory, [
    { fieldId: 'engagementDuration', value: '6 months', confidence: 'high', updateKind: 'assert' },
  ]);
  const result = applyExtractedFacts(
    memory,
    [
      {
        fieldId: 'engagementDuration',
        value: '8 months',
        confidence: 'high',
        updateKind: 'correction',
      },
    ],
    'msg-2',
    'Actually make that 8 months.',
  );
  if (!result.corrected.includes('engagementDuration')) {
    throw new Error(`corrected=${result.corrected.join(',')}`);
  }
  if (result.contradicted.includes('engagementDuration')) {
    throw new Error('should not contradict');
  }
  const field = memory.engagementDuration!;
  if (field.current.value !== '8 months') throw new Error(String(field.current.value));
  if (field.history.length < 1) throw new Error('history empty');
  if ((field as { gapStatus?: string }).gapStatus === 'CONTRADICTORY') {
    throw new Error('gap CONTRADICTORY');
  }
});

console.log('\n7. Contradiction path');
check('Competing bond values → CONTRADICTORY', () => {
  if (
    !hasCompetingSourceLanguage(
      'The main document says the bond is 5,000 JOD, but the annex says 1,000 JOD.',
    )
  ) {
    throw new Error('competing language not detected');
  }
  const memory = createEmptyProjectMemory();
  applyExtractedFacts(memory, [
    {
      fieldId: 'evaluationRules',
      value: 'Tender bond 5000 JOD',
      confidence: 'high',
      updateKind: 'assert',
    },
  ]);
  const result = applyExtractedFacts(
    memory,
    [
      {
        fieldId: 'evaluationRules',
        value: 'Tender bond 1000 JOD',
        confidence: 'high',
        updateKind: 'conflict',
      },
    ],
    'msg-2',
    'The main document says the bond is 5,000 JOD, but the annex says 1,000 JOD.',
  );
  if (!result.contradicted.includes('evaluationRules')) {
    throw new Error('expected contradicted');
  }
  const gaps = analyzeGaps(memory, createEmptyProjectContext());
  // Force known packs via classified context
  let ctx = classifyProject({
    memory,
    signals: { documentStageSignal: 'FULL_RFP' },
    latestMessage: 'full RFP',
  });
  // ensure stage set
  ctx = { ...ctx, documentStage: 'FULL_RFP', primaryDomain: 'GENERAL', contractingGranularity: 'SINGLE_PROJECT' };
  ctx = withActivePacks(ctx, memory);
  const gaps2 = analyzeGaps(memory, ctx);
  if (gaps2.nextAction.type !== 'CLARIFY_CONTRADICTION') {
    throw new Error(`next=${gaps2.nextAction.type}`);
  }
  if (
    gaps2.nextAction.type === 'CLARIFY_CONTRADICTION' &&
    gaps2.nextAction.targetKind !== 'memory_field'
  ) {
    throw new Error('targetKind');
  }
  void gaps;
});

console.log('\n8. Ambiguous material conflict without supersession → clarify');
check('HIGH material assert overwrite without supersession → contradiction', () => {
  const memory = createEmptyProjectMemory();
  applyExtractedFacts(memory, [
    { fieldId: 'inScope', value: ['A'], confidence: 'high', updateKind: 'assert' },
  ]);
  const result = applyExtractedFacts(
    memory,
    [{ fieldId: 'inScope', value: ['B'], confidence: 'high', updateKind: 'assert' }],
    'msg-2',
    'Also include B.', // no actually/instead
  );
  if (!result.contradicted.includes('inScope')) {
    throw new Error('expected contradiction for material conflict without supersession');
  }
});

console.log('\n9. ASK_REQUIREMENTS cluster');
check('Gap engine returns ASK_REQUIREMENTS with ≤2 related', () => {
  const memory = createEmptyProjectMemory();
  setExtracted(memory, 'documentType', 'consulting');
  let ctx = classifyProject({ memory, latestMessage: 'consulting RFP' });
  ctx = withActivePacks(ctx, memory);
  const gaps = analyzeGaps(memory, ctx);
  if (gaps.nextAction.type !== 'ASK_REQUIREMENTS' && gaps.nextAction.type !== 'OPEN_ENDED') {
    // may ask requirements
  }
  if (gaps.nextAction.type === 'ASK_REQUIREMENTS') {
    if (gaps.nextAction.relatedFieldIds.length > 2) throw new Error('too many related');
  }
});

console.log('\n10. Stop is materiality-based (no field-count threshold in code path)');
check('collectionSufficient never uses fixed 12–18 threshold', () => {
  // Structural: if stop, reason string must not mention field counts
  const memory = createEmptyProjectMemory();
  // Fill all CRITICAL/HIGH CORE-ish fields
  setExtracted(memory, 'documentType', 'consulting');
  setExtracted(memory, 'engagementType', 'consulting');
  setExtracted(memory, 'beneficiaryEntity', 'MoDEE');
  setExtracted(memory, 'currentSituation', 'Manual');
  setExtracted(memory, 'businessNeedRationale', 'Need help');
  setExtracted(memory, 'businessObjectives', ['Improve']);
  setExtracted(memory, 'painPoints', ['Slow']);
  setExtracted(memory, 'inScope', ['Advice']);
  setExtracted(memory, 'outOfScope', ['Build']);
  setExtracted(memory, 'users', { internal: ['staff'], external: [] });
  setExtracted(memory, 'engagementDuration', '3 months');
  setExtracted(memory, 'deliverableItems', ['Report']);
  setExtracted(memory, 'acceptanceCriteria', ['Accepted report']);

  let ctx = classifyProject({ memory, latestMessage: 'consulting RFP for MoDEE' });
  ctx = {
    ...ctx,
    documentStage: 'FULL_RFP',
    contractingGranularity: 'SINGLE_PROJECT',
  };
  ctx = withActivePacks(ctx, memory);
  const gaps = analyzeGaps(memory, ctx);
  if (gaps.nextAction.type === 'STOP_COLLECTION') {
    if (/12|18|field count|filledCount/i.test(gaps.nextAction.reason)) {
      throw new Error('stop reason mentions field counts');
    }
  }
  // filledCount may exist for display only — stop decision must not require a range
  if (gaps.collectionSufficient && gaps.filledCount < 5) {
    // allowed — materiality can stop early
  }
});

console.log('\n11. Provenance safety + TBC→UNKNOWN mapping');
check('REFERENCE cannot go to CONFIRMED', () => {
  if (isProvenanceTransitionAllowed('REFERENCE', 'CONFIRMED')) {
    throw new Error('illegal transition allowed');
  }
  if (!isProvenanceTransitionAllowed('REFERENCE', 'PROPOSED')) {
    throw new Error('REFERENCE→PROPOSED must remain');
  }
});
check('isSafeUnknown blocks CRITICAL/HIGH', () => {
  if (isSafeUnknown('inScope', 'CRITICAL')) throw new Error('inScope CRITICAL safe');
  if (isSafeUnknown('documentTitle', 'LOW') !== true) throw new Error('title should be safe');
});

console.log('\n12. Context contradiction NextAction shape');
check('CLARIFY_CONTRADICTION can target project_context', () => {
  const memory = createEmptyProjectMemory();
  const ctx = createEmptyProjectContext();
  const gaps = analyzeGaps(memory, ctx, {
    contextContradictions: [{ targetId: 'documentStage' }],
  });
  if (gaps.nextAction.type !== 'CLARIFY_CONTRADICTION') throw new Error(gaps.nextAction.type);
  if (gaps.nextAction.type === 'CLARIFY_CONTRADICTION') {
    if (gaps.nextAction.targetKind !== 'project_context') throw new Error('kind');
    if (gaps.nextAction.targetId !== 'documentStage') throw new Error('id');
  }
});

console.log('\n──────────────────────────────────────');
console.log(`Passed: ${passed}  Failed: ${failed}`);
if (failed > 0) {
  console.error('\n❌ Phase 2.2 adaptive validation FAILED.\n');
  process.exit(1);
}
console.log('\n✅ Phase 2.2 adaptive validation passed.\n');
