#!/usr/bin/env npx tsx
/**
 * Project-status / "what is missing?" answers must be Gap Engine grounded.
 * No GPU. Generic fixtures only.
 */
import assert from 'node:assert/strict';
import { createEmptyProjectMemory } from '../src/types/projectMemory';
import { createMemoryField } from '../src/types/provenance';
import { createEmptyProjectContext } from '../src/types/projectContext';
import { classifyProject } from '../src/server/rami/projectClassifier';
import { withActivePacks } from '../src/server/rami/questionPackEngine';
import { applyExtractedFacts, markFieldUnknown } from '../src/server/rami/memoryUpdater';
import { getSectionReadiness } from '../src/server/rami/sectionReadiness';
import {
  classifyStatusMessage,
  isProjectStatusQuestion,
  isPureStatusQuestion,
  messageHasFactualAssertion,
} from '../src/server/rami/projectStatusQuestion';
import {
  answerProjectStatusQuestion,
  assertStatusReplyGrounded,
} from '../src/server/rami/projectStatusSnapshot';
import { FORBIDDEN_STATUS_SECTION_PHRASES } from '../src/types/projectStatus';
import type { ProjectMemory } from '../src/types/projectMemory';
import type { ProjectContext } from '../src/types/projectContext';
import { PROJECT_MEMORY_FIELDS } from '../src/schema/projectMemoryFields';
import { analyzeGaps } from '../src/server/rami/gapEngine';

let passed = 0;
let failed = 0;

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(err);
  }
}

function systemCtx(memory: ProjectMemory): ProjectContext {
  let ctx = classifyProject({
    memory,
    signals: { documentStageSignal: 'FULL_RFP', domainSignals: ['system-implementation'] },
    latestMessage: 'system implementation platform',
  });
  ctx = {
    ...ctx,
    documentStage: 'FULL_RFP',
    contractingGranularity: 'SINGLE_PROJECT',
    primaryDomain: 'SYSTEM_IMPLEMENTATION',
  };
  return withActivePacks(ctx, memory);
}

function setKnown(memory: ProjectMemory, fieldId: string, value: unknown) {
  (memory as unknown as Record<string, unknown>)[fieldId] = {
    ...createMemoryField(fieldId, value, 'EXTRACTED', 'ba-message'),
    gapStatus: 'KNOWN',
  };
}

function sampleValue(fieldId: string): unknown {
  switch (fieldId) {
    case 'documentType':
      return 'system-implementation';
    case 'documentTitle':
      return 'Civic Records Platform Implementation';
    case 'beneficiaryEntity':
      return 'Ministry of Digital Economy';
    case 'issuerEntity':
      return 'Government Procurement Department';
    case 'engagementType':
      return 'system implementation';
    case 'engagementDuration':
      return '18 months';
    case 'users':
      return { internal: ['records officers'], external: [] };
    case 'inScope':
      return ['platform implementation', 'training'];
    case 'outOfScope':
      return ['hardware procurement'];
    case 'functionalModules':
      return ['registration', 'workflow'];
    case 'keyWorkflows':
      return ['intake to publication'];
    case 'hostingModel':
      return 'government cloud';
    case 'integrations':
      return ['national ID'];
    case 'securityRequirements':
      return ['encryption at rest'];
    case 'deliverableItems':
      return ['working platform', 'training materials'];
    case 'acceptanceCriteria':
      return ['UAT sign-off'];
    case 'evaluationWeights':
      return '70/30 technical/financial';
    case 'evaluationRules':
      return 'minimum technical score 70';
    case 'pricingModelAndCostBreakdown':
      return {
        pricingModel: 'lump sum JOD',
        costBreakdown: [{ component: 'implementation' }],
      };
    case 'legalTerms':
      return 'Jordanian law';
    case 'awardModel':
      return { model: 'single-supplier', supplierCount: 1 };
    case 'namedKeyPersonnel':
      return [{ role: 'project manager', minExperience: '8 years' }];
    case 'slaTiers':
      return [
        {
          severity: 'S1',
          description: 'outage',
          responseTime: '1h',
          resolutionTime: '4h',
        },
      ];
    case 'supportPeriodAndHours':
      return '12 months 8x5';
    case 'supportPenalties':
      return 'service credits';
    case 'requiredAnnexes':
      return 'Custom Security Questionnaire';
    default:
      return `Confirmed ${PROJECT_MEMORY_FIELDS.find((f) => f.fieldId === fieldId)?.label ?? fieldId}`;
  }
}

function fillUntilStop(memory: ProjectMemory, except: Set<string>): ProjectContext {
  let ctx = systemCtx(memory);
  setKnown(memory, 'documentTitle', sampleValue('documentTitle'));
  for (let pass = 0; pass < 40; pass++) {
    ctx = withActivePacks(ctx, memory);
    const gaps = analyzeGaps(memory, ctx);
    let filled = 0;
    for (const gap of gaps.fieldGaps) {
      if (except.has(gap.fieldId)) continue;
      if (gap.gapStatus !== 'MISSING' && gap.gapStatus !== 'UNKNOWN') continue;
      const askable =
        gap.materiality === 'CRITICAL' ||
        gap.materiality === 'HIGH' ||
        (gaps.nextAction.type === 'ASK_REQUIREMENTS' &&
          (gaps.nextAction.primaryFieldId === gap.fieldId ||
            gaps.nextAction.relatedFieldIds.includes(gap.fieldId)));
      if (!askable) continue;
      setKnown(memory, gap.fieldId, sampleValue(gap.fieldId));
      filled++;
    }
    if (
      gaps.nextAction.type === 'ASK_REQUIREMENTS' &&
      !except.has(gaps.nextAction.primaryFieldId)
    ) {
      const already = (memory as unknown as Record<string, { current?: { value?: unknown } }>)[
        gaps.nextAction.primaryFieldId
      ]?.current?.value;
      if (already == null) {
        setKnown(
          memory,
          gaps.nextAction.primaryFieldId,
          sampleValue(gaps.nextAction.primaryFieldId),
        );
        filled++;
      }
    }
    ctx = withActivePacks(ctx, memory);
    const after = analyzeGaps(memory, ctx);
    if (
      after.nextAction.type === 'STOP_COLLECTION' ||
      after.nextAction.type === 'OPEN_ENDED' ||
      after.nextAction.type === 'CLARIFY_CONTRADICTION' ||
      (after.nextAction.type === 'ASK_REQUIREMENTS' &&
        except.has(after.nextAction.primaryFieldId) &&
        filled === 0)
    ) {
      return ctx;
    }
    if (filled === 0) return ctx;
  }
  return ctx;
}

function statusOf(memory: ProjectMemory, ctx: ProjectContext) {
  return answerProjectStatusQuestion({ memory, projectContext: ctx, language: 'en' });
}

console.log('\n=== Chat gap-grounding (project status) ===\n');

run('detects generic status / missing-information questions', () => {
  const positives = [
    'what do you need now, what\'s still missing?',
    'What is still missing?',
    'what do you need from me?',
    'what should I answer next?',
    'what information is missing?',
    'what is incomplete?',
    'what do we still need for the RFP?',
    'where are we now',
    'what sections are ready',
    'what remains incomplete',
  ];
  for (const q of positives) {
    assert.equal(isProjectStatusQuestion(q), true, q);
  }
  const negatives = [
    'The engagement duration is 18 months.',
    'Please draft the Introduction.',
    'Show me historical examples of evaluation weights.',
  ];
  for (const q of negatives) {
    assert.equal(isProjectStatusQuestion(q), false, q);
  }
});

run('CASE A: duration gap — no Executive Summary, annexes not missing, intro not an info gap', () => {
  const memory = createEmptyProjectMemory();
  const ctx = fillUntilStop(memory, new Set(['engagementDuration']));
  const intro = getSectionReadiness(memory, 'introduction', ctx);
  assert.equal(intro.readiness, 'READY_TO_DRAFT');
  const engagement = getSectionReadiness(memory, 'engagementDefinition', ctx);
  assert.equal(engagement.readiness, 'NOT_READY');
  assert.ok(engagement.criticalBlockers.includes('engagementDuration'));

  const { snapshot, reply } = statusOf(memory, ctx);
  assertStatusReplyGrounded(reply, snapshot);
  for (const phrase of FORBIDDEN_STATUS_SECTION_PHRASES) {
    assert.equal(reply.includes(phrase), false, phrase);
  }
  assert.equal(snapshot.sections.find((s) => s.sectionId === 'coverPage')?.progressKind, 'automatically_prepared');
  assert.equal(snapshot.sections.find((s) => s.sectionId === 'tableOfContents')?.progressKind, 'automatically_prepared');
  assert.equal(snapshot.sections.find((s) => s.sectionId === 'annexes')?.progressKind, 'automatically_prepared');
  assert.equal(snapshot.standardAnnexesAutomaticallyPrepared, true);
  assert.equal(snapshot.sections.find((s) => s.sectionId === 'introduction')?.progressKind, 'ready_to_draft');
  assert.equal(
    snapshot.needsInformation.some((s) => s.sectionId === 'introduction'),
    false,
  );
  assert.ok(snapshot.needsInformation.some((s) => s.sectionId === 'engagementDefinition'));
  assert.equal(snapshot.nextInformationNeed.type, 'ASK_REQUIREMENTS');
  assert.equal(snapshot.nextInformationNeed.fieldId, 'engagementDuration');
  assert.match(reply, /engagement duration/i);
  assert.doesNotMatch(reply, /\b(annexes?|appendices) are missing\b/i);
  assert.match(reply, /already prepared automatically/i);
  assert.doesNotMatch(reply, /draft Evaluation Criteria/i);
});

run('CASE B: Introduction ready but not generated is ready-to-draft, not missing information', () => {
  const memory = createEmptyProjectMemory();
  const ctx = fillUntilStop(memory, new Set(['engagementDuration']));
  const { snapshot, reply } = statusOf(memory, ctx);
  const intro = snapshot.sections.find((s) => s.sectionId === 'introduction');
  assert.equal(intro?.progressKind, 'ready_to_draft');
  assert.equal(intro?.generated, false);
  assert.match(reply, /Ready to draft/i);
  assert.match(reply, /Introduction/);
});

run('CASE C: Evaluation NOT_READY names actual missing fields', () => {
  const memory = createEmptyProjectMemory();
  const ctx = fillUntilStop(memory, new Set(['evaluationWeights', 'evaluationRules']));
  const evalReady = getSectionReadiness(memory, 'evaluationCriteria', ctx);
  assert.equal(evalReady.readiness, 'NOT_READY');
  const { snapshot, reply } = statusOf(memory, ctx);
  assertStatusReplyGrounded(reply, snapshot);
  const evalStatus = snapshot.needsInformation.find((s) => s.sectionId === 'evaluationCriteria');
  assert.ok(evalStatus, 'evaluation should need information');
  assert.ok(evalStatus.missingFieldIds.includes('evaluationWeights'));
  assert.match(reply, /Technical vs Financial Evaluation Weights/);
  assert.equal(reply.includes('Executive Summary'), false);
  assert.doesNotMatch(reply, /Evaluation Criteria needed/i);
});

run('CASE D: facts present, sections ungenerated → ready to draft, no more information required', () => {
  const memory = createEmptyProjectMemory();
  const ctx = fillUntilStop(memory, new Set());
  const { snapshot, reply } = statusOf(memory, ctx);
  assertStatusReplyGrounded(reply, snapshot);
  assert.equal(snapshot.needsInformation.length, 0);
  assert.ok(snapshot.readyToDraft.length > 0);
  assert.ok(
    snapshot.nextAction.type === 'STOP_COLLECTION' || snapshot.collectionSufficient,
    `expected stop/sufficient, got ${snapshot.nextAction.type}`,
  );
  assert.match(reply, /No additional project information is currently required/i);
  assert.match(reply, /ready to draft/i);
});

run('CASE E: contradiction is the priority clarification', () => {
  const memory = createEmptyProjectMemory();
  applyExtractedFacts(memory, [
    { fieldId: 'beneficiaryEntity', value: 'Ministry of Interior', confidence: 'high' },
  ]);
  applyExtractedFacts(
    memory,
    [{ fieldId: 'beneficiaryEntity', value: 'Ministry of Finance', confidence: 'high' }],
    'msg-conflict',
    'The beneficiary is the Ministry of Finance.',
  );
  const ctx = systemCtx(memory);
  const { snapshot, reply } = statusOf(memory, ctx);
  assertStatusReplyGrounded(reply, snapshot);
  assert.equal(snapshot.nextAction.type, 'CLARIFY_CONTRADICTION');
  assert.equal(snapshot.nextInformationNeed.fieldId, 'beneficiaryEntity');
  assert.match(reply, /Beneficiary Entity/);
  assert.match(reply, /which value should govern/i);
  assert.doesNotMatch(reply, /draft Evaluation Criteria/i);
});

run('CASE F: standard Annex pack — not requested as missing information', () => {
  const memory = createEmptyProjectMemory();
  const ctx = fillUntilStop(memory, new Set(['requiredAnnexes']));
  const { snapshot, reply } = statusOf(memory, ctx);
  assertStatusReplyGrounded(reply, snapshot);
  assert.equal(snapshot.standardAnnexesAutomaticallyPrepared, true);
  assert.equal(snapshot.projectSpecificAnnexStatus, 'none');
  assert.equal(snapshot.sections.find((s) => s.sectionId === 'annexes')?.progressKind, 'automatically_prepared');
  assert.equal(
    snapshot.needsInformation.some((s) => s.sectionId === 'annexes'),
    false,
  );
  assert.match(reply, /standard Annexes are already prepared automatically/i);
  assert.doesNotMatch(reply, /\b(annexes?|appendices) are missing\b/i);
  assert.equal(snapshot.nextInformationNeed.fieldId !== 'requiredAnnexes', true);
});

run('CASE G: project-specific annex details missing — ask only that', () => {
  const memory = createEmptyProjectMemory();
  const ctx = fillUntilStop(memory, new Set(['requiredAnnexes']));
  markFieldUnknown(memory, 'requiredAnnexes');
  const { snapshot, reply } = statusOf(memory, withActivePacks(ctx, memory));
  assertStatusReplyGrounded(reply, snapshot);
  assert.equal(snapshot.projectSpecificAnnexStatus, 'details_missing');
  assert.equal(
    snapshot.sections.find((s) => s.sectionId === 'annexes')?.progressKind,
    'automatically_prepared',
  );
  assert.match(reply, /project-specific annex/i);
  assert.match(reply, /already prepared automatically/i);
  assert.doesNotMatch(reply, /Appendices/);
  assert.equal(snapshot.nextInformationNeed.fieldId, 'requiredAnnexes');
});

run('status replies use canonical titles only (no invented section names)', () => {
  const memory = createEmptyProjectMemory();
  const ctx = fillUntilStop(memory, new Set(['engagementDuration']));
  const { reply } = statusOf(memory, ctx);
  assert.equal(reply.includes('Executive Summary'), false);
  assert.equal(reply.includes('Terms and Conditions'), false);
  assert.equal(reply.includes('Appendices'), false);
  assert.match(reply, /Cover Page/);
  assert.match(reply, /Table of Contents/);
  assert.match(reply, /Annexes/);
});

run('CASE H — PURE STATUS: no fact mutation, deterministic status', () => {
  const memory = createEmptyProjectMemory();
  const ctx = fillUntilStop(memory, new Set(['engagementDuration']));
  const msg = "what's still missing?";
  assert.equal(classifyStatusMessage(msg), 'pure_status');
  assert.equal(isPureStatusQuestion(msg), true);
  assert.equal(messageHasFactualAssertion(msg), false);
  const before = JSON.stringify(memory.engagementDuration);
  const { snapshot, reply } = statusOf(memory, ctx);
  assert.equal(JSON.stringify(memory.engagementDuration), before);
  assert.equal(snapshot.nextInformationNeed.fieldId, 'engagementDuration');
  assertStatusReplyGrounded(reply, snapshot);
});

run('CASE I — PURE FACT: not classified as status', () => {
  const msg = 'The engagement duration is 18 months.';
  assert.equal(isProjectStatusQuestion(msg), false);
  assert.equal(classifyStatusMessage(msg), 'none');
  assert.equal(isPureStatusQuestion(msg), false);
  assert.equal(messageHasFactualAssertion(msg), true);
});

run('CASE J — MIXED STATUS + FACT: persist duration then recompute status', () => {
  const memory = createEmptyProjectMemory();
  const ctx = fillUntilStop(memory, new Set(['engagementDuration']));
  const stale = statusOf(memory, ctx);
  assert.equal(stale.snapshot.nextInformationNeed.fieldId, 'engagementDuration');

  const msg = "What's still missing? The engagement duration is 18 months.";
  assert.equal(classifyStatusMessage(msg), 'mixed_status_and_facts');
  assert.equal(isPureStatusQuestion(msg), false);
  assert.equal(isProjectStatusQuestion(msg), true);

  const applied = applyExtractedFacts(
    memory,
    [{ fieldId: 'engagementDuration', value: '18 months', confidence: 'high' }],
    'msg-mixed',
    msg,
  );
  assert.ok(applied.applied.includes('engagementDuration'));
  assert.equal(memory.engagementDuration?.current.value, '18 months');

  const freshCtx = withActivePacks(ctx, memory);
  const { snapshot, reply } = statusOf(memory, freshCtx);
  assertStatusReplyGrounded(reply, snapshot);
  assert.notEqual(snapshot.nextInformationNeed.fieldId, 'engagementDuration');
  const engagement = snapshot.needsInformation.find((s) => s.sectionId === 'engagementDefinition');
  assert.equal(engagement?.missingFieldIds.includes('engagementDuration') ?? false, false);
  assert.doesNotMatch(reply, /next information I need is the engagement duration/i);
});

run('CASE K — MIXED CORRECTION + STATUS: trust rules then status from result', () => {
  const memory = createEmptyProjectMemory();
  applyExtractedFacts(memory, [
    { fieldId: 'beneficiaryEntity', value: 'Agency A', confidence: 'high' },
  ]);
  const msg = 'The beneficiary is Agency B. What do you still need?';
  assert.equal(classifyStatusMessage(msg), 'mixed_status_and_facts');

  const update = applyExtractedFacts(
    memory,
    [{ fieldId: 'beneficiaryEntity', value: 'Agency B', confidence: 'high' }],
    'msg-mixed-correction',
    msg,
  );
  const ctx = systemCtx(memory);
  const { snapshot, reply } = statusOf(memory, ctx);
  assertStatusReplyGrounded(reply, snapshot);

  const bag = memory.beneficiaryEntity as { gapStatus?: string; current?: { value?: unknown } };
  if (update.contradicted.includes('beneficiaryEntity') || bag?.gapStatus === 'CONTRADICTORY') {
    assert.equal(snapshot.nextAction.type, 'CLARIFY_CONTRADICTION');
    assert.equal(snapshot.nextInformationNeed.fieldId, 'beneficiaryEntity');
    assert.match(reply, /Beneficiary Entity/);
  } else {
    assert.ok(update.applied.includes('beneficiaryEntity') || update.corrected.includes('beneficiaryEntity'));
    assert.equal(bag?.current?.value, 'Agency B');
    assert.notEqual(snapshot.nextInformationNeed.fieldId, 'beneficiaryEntity');
  }
});

run('CASE L — STATUS WITH NO FACTUAL ASSERTION: pure deterministic path', () => {
  const msg = 'Can you tell me where we stand and what I need to answer next?';
  assert.equal(classifyStatusMessage(msg), 'pure_status');
  assert.equal(isPureStatusQuestion(msg), true);
  assert.equal(messageHasFactualAssertion(msg), false);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
