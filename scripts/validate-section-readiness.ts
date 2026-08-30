#!/usr/bin/env npx tsx
/**
 * Section Readiness + spoken-TBC unit checks (no live PostgreSQL required).
 */
import assert from 'node:assert/strict';
import { createEmptyProjectMemory } from '../src/types/projectMemory';
import { createMemoryField } from '../src/types/provenance';
import { createEmptyProjectContext } from '../src/types/projectContext';
import { applyExtractedFacts, markFieldUnknown } from '../src/server/rami/memoryUpdater';
import { classifySpokenUnknown, isSpokenUnknownValue } from '../src/server/rami/spokenTbc';
import { getSectionReadiness, getAllSectionReadiness } from '../src/server/rami/sectionReadiness';
import { getSectionFieldLinks, getSectionIdsForField } from '../src/schema/sectionFieldMap';
import { PROJECT_MEMORY_FIELDS } from '../src/schema/projectMemoryFields';
import { RFP_SECTIONS } from '../src/schema/rfpSchema';
import {
  factRowsToProjectMemory,
  projectMemoryToFactRows,
} from '../src/server/db/factMapper';
import { withActivePacks } from '../src/server/rami/questionPackEngine';

let passed = 0;
let failed = 0;

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    failed++;
  }
}

console.log('\n=== Section readiness + spoken-TBC checks ===\n');

run('spoken TBC: whole-value phrases classify as unknown', () => {
  assert.equal(classifySpokenUnknown('TBC'), 'unknown');
  assert.equal(classifySpokenUnknown('[To be confirmed]'), 'unknown');
  assert.equal(classifySpokenUnknown('we don\'t know yet'), 'unknown');
  assert.equal(classifySpokenUnknown('not confirmed yet'), 'unknown');
  assert.equal(classifySpokenUnknown('keep it TBC'), 'unknown');
  assert.equal(classifySpokenUnknown('to be confirmed later'), 'deferred');
});

run('spoken TBC: legitimate text containing letters TBC is not unknown', () => {
  assert.equal(classifySpokenUnknown('The TBC committee will review submissions'), null);
  assert.equal(classifySpokenUnknown('TBC-certified encryption module'), null);
  assert.equal(isSpokenUnknownValue('18 months'), false);
});

run('applyExtractedFacts stores spoken TBC as UNKNOWN not EXTRACTED value', () => {
  const memory = createEmptyProjectMemory();
  const result = applyExtractedFacts(
    memory,
    [{ fieldId: 'painPoints', value: 'TBC', confidence: 'high' }],
    'user-message:test',
  );
  assert.ok(result.applied.includes('painPoints'));
  assert.equal(memory.painPoints?.current.status, 'TBC');
  assert.equal(memory.painPoints?.current.value, null);
  assert.equal((memory.painPoints as { gapStatus?: string })?.gapStatus, 'UNKNOWN');
});

run('explicit answered value is not misclassified as TBC', () => {
  const memory = createEmptyProjectMemory();
  applyExtractedFacts(
    memory,
    [{ fieldId: 'currentSituation', value: 'Excel and manual approvals', confidence: 'high' }],
    'user-message:test',
  );
  assert.equal(memory.currentSituation?.current.status, 'EXTRACTED');
  assert.equal(memory.currentSituation?.current.value, 'Excel and manual approvals');
});

run('NOT_APPLICABLE section reports no missing fields', () => {
  const memory = createEmptyProjectMemory();
  memory.documentType = createMemoryField('documentType', 'consulting', 'EXTRACTED', 'ba-message');
  const ctx = withActivePacks(
    {
      ...createEmptyProjectContext(),
      documentStage: 'FULL_RFP',
      contractingGranularity: 'SINGLE_PROJECT',
      primaryDomain: 'CONSULTING',
      activePacks: ['CORE', 'PROCUREMENT'],
    },
    memory,
  );
  const r = getSectionReadiness(memory, 'functionalRequirements', ctx);
  assert.equal(r.applicable, false);
  assert.equal(r.readiness, 'NOT_APPLICABLE');
  assert.equal(r.missingFields.length, 0);
  assert.equal(r.criticalBlockers.length, 0);
});

run('missing critical field → NOT_READY', () => {
  const memory = createEmptyProjectMemory();
  const ctx = createEmptyProjectContext();
  const r = getSectionReadiness(memory, 'coverPage', ctx);
  assert.equal(r.applicable, true);
  assert.equal(r.readiness, 'NOT_READY');
  assert.ok(r.criticalBlockers.includes('documentType') || r.criticalBlockers.includes('beneficiaryEntity'));
});

run('DRAFTABLE_WITH_TBC when must-have is spoken TBC and others answered', () => {
  const memory = createEmptyProjectMemory();
  memory.documentType = createMemoryField('documentType', 'assessment', 'EXTRACTED', 'ba-message');
  memory.beneficiaryEntity = createMemoryField(
    'beneficiaryEntity',
    'MoDEE',
    'EXTRACTED',
    'ba-message',
  );
  markFieldUnknown(memory, 'currentSituation');
  memory.painPoints = createMemoryField('painPoints', ['Legacy processes'], 'EXTRACTED', 'ba-message');
  memory.businessNeedRationale = createMemoryField(
    'businessNeedRationale',
    'Digital services maturity',
    'EXTRACTED',
    'ba-message',
  );
  memory.businessObjectives = createMemoryField(
    'businessObjectives',
    ['assess maturity'],
    'EXTRACTED',
    'ba-message',
  );
  const ctx = withActivePacks(
    {
      ...createEmptyProjectContext(),
      documentStage: 'FULL_RFP',
      contractingGranularity: 'SINGLE_PROJECT',
      primaryDomain: 'ASSESSMENT',
      activePacks: ['CORE', 'PROCUREMENT', 'ASSESSMENT_TESTING'],
    },
    memory,
  );
  const r = getSectionReadiness(memory, 'background', ctx);
  assert.equal(r.applicable, true);
  assert.ok(r.tbcFields.includes('currentSituation'));
  assert.equal(r.readiness, 'DRAFTABLE_WITH_TBC');
});

run('READY_TO_DRAFT when cover must-haves are answered', () => {
  const memory = createEmptyProjectMemory();
  memory.documentType = createMemoryField('documentType', 'assessment', 'EXTRACTED', 'ba-message');
  memory.beneficiaryEntity = createMemoryField(
    'beneficiaryEntity',
    'MoDEE',
    'EXTRACTED',
    'ba-message',
  );
  memory.documentTitle = createMemoryField(
    'documentTitle',
    'RAMI Persistence Acceptance Test',
    'EXTRACTED',
    'ba-message',
  );
  const ctx = createEmptyProjectContext();
  const r = getSectionReadiness(memory, 'coverPage', ctx);
  assert.equal(r.readiness, 'READY_TO_DRAFT');
  assert.equal(r.criticalBlockers.length, 0);
  assert.equal(r.tbcFields.length, 0);
});

run('boilerplate section with no facts is READY_TO_DRAFT when applicable', () => {
  const memory = createEmptyProjectMemory();
  const r = getSectionReadiness(memory, 'tableOfContents', createEmptyProjectContext());
  assert.equal(r.applicable, true);
  assert.equal(r.readiness, 'READY_TO_DRAFT');
});

run('one field maps to multiple sections', () => {
  const sections = getSectionIdsForField('beneficiaryEntity');
  assert.ok(sections.includes('coverPage'));
  assert.ok(sections.includes('introduction'));
  assert.ok(sections.length >= 2);
});

run('mapping has unique pairs and stays within 52/20', () => {
  const links = getSectionFieldLinks();
  const keys = links.map((l) => `${l.sectionId}::${l.fieldId}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(PROJECT_MEMORY_FIELDS.length, 52);
  assert.equal(RFP_SECTIONS.length, 20);
  for (const link of links) {
    assert.ok(PROJECT_MEMORY_FIELDS.some((f) => f.fieldId === link.fieldId));
    assert.ok(RFP_SECTIONS.some((s) => s.sectionId === link.sectionId));
  }
});

run('ProjectFacts round-trip preserves TBC then matches readiness', () => {
  const memory = createEmptyProjectMemory();
  applyExtractedFacts(memory, [
    { fieldId: 'documentType', value: 'assessment', confidence: 'high' },
    { fieldId: 'painPoints', value: 'to be confirmed', confidence: 'high' },
  ]);
  const rows = projectMemoryToFactRows(memory);
  const pain = rows.find((r) => r.field_id === 'painPoints');
  assert.equal(pain?.collection_state, 'TBC');
  assert.equal(pain?.provenance_status, 'TBC');
  assert.notEqual(pain?.value_json, 'TBC');
  const restored = factRowsToProjectMemory(rows);
  const before = getAllSectionReadiness(memory, createEmptyProjectContext());
  const after = getAllSectionReadiness(restored, createEmptyProjectContext());
  assert.deepEqual(
    before.map((s) => ({ id: s.sectionId, r: s.readiness, t: s.tbcFields })),
    after.map((s) => ({ id: s.sectionId, r: s.readiness, t: s.tbcFields })),
  );
});

run('stale EXTRACTED "TBC" row hydrates as UNKNOWN', () => {
  const restored = factRowsToProjectMemory([
    {
      field_id: 'painPoints',
      value_json: 'TBC',
      collection_state: 'ANSWERED',
      provenance_status: 'EXTRACTED',
      source_type: 'ba-message',
      source_ref: null,
      confirmed_by: null,
      updated_at: '2026-08-30T16:00:00.000Z',
      history_json: [],
      gap_status: 'KNOWN',
      deferred_to: null,
      contradiction_json: null,
    },
  ]);
  assert.equal(restored.painPoints?.current.status, 'TBC');
  assert.equal(restored.painPoints?.current.value, null);
  assert.equal((restored.painPoints as { gapStatus?: string })?.gapStatus, 'UNKNOWN');
});

console.log(`\nPassed: ${passed}  Failed: ${failed}`);
if (failed > 0) process.exit(1);
console.log('\n✅ Section readiness unit checks passed.\n');
