#!/usr/bin/env tsx
/**
 * Phase 1 validation script.
 * Verifies:
 *   - Canonical schema has exactly 20 sections (11 mandatory, 9 conditional)
 *   - Canonical field list matches CANONICAL_FIELD_COUNT (60: 52 + 7 + issuerEntity)
 *   - No duplicate sectionIds or fieldIds
 *   - All fieldId targetSections reference valid section IDs
 *   - Section state machine transitions are internally consistent
 *   - Provenance transitions are internally consistent
 *   - Model manifest parses correctly
 *
 * Usage: npx tsx scripts/validate-phase1.ts
 */

import {
  RFP_SECTIONS,
  RFP_SECTION_IDS,
  getMandatorySections,
  getConditionalSections,
} from '../src/schema/rfpSchema';
import {
  PROJECT_MEMORY_FIELDS,
  CANONICAL_FIELD_COUNT,
  LEGACY_CANONICAL_FIELD_COUNT,
  POST_EXPANSION_FIELD_IDS,
  PROMOTED_FIELD_IDS,
} from '../src/schema/projectMemoryFields';
import { createEmptyProjectMemory } from '../src/types/projectMemory';
import {
  ALLOWED_SECTION_TRANSITIONS,
  isSectionTransitionAllowed,
  assertSectionTransition,
  createSectionStateRecord,
  advanceSectionState,
} from '../src/types/sectionState';
import {
  isProvenanceTransitionAllowed,
  updateMemoryField,
  createMemoryField,
} from '../src/types/provenance';
import { getModelManifest } from '../src/server/ai/modelManifest';

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

console.log('\n=== Rami Phase 1 Validation ===\n');

// ─────────────────────────────────────────────────────────────────────────────
// 1. Canonical RFP schema
// ─────────────────────────────────────────────────────────────────────────────
console.log('1. Canonical RFP Schema');

check('Total section count = 20', () => {
  if (RFP_SECTIONS.length !== 20) throw new Error(`Got ${RFP_SECTIONS.length}`);
});

check('Mandatory section count = 11 (Annexes are conditional on the standard pack / extras)', () => {
  const n = getMandatorySections().length;
  if (n !== 11) throw new Error(`Got ${n} mandatory sections`);
});

check('Conditional section count = 9', () => {
  const n = getConditionalSections().length;
  if (n !== 9) throw new Error(`Got ${n} conditional sections`);
});

check('Sections are ordered 1–20 with no gaps', () => {
  for (let i = 0; i < RFP_SECTIONS.length; i++) {
    if (RFP_SECTIONS[i].order !== i + 1) {
      throw new Error(`Section at index ${i} has order ${RFP_SECTIONS[i].order}, expected ${i + 1}`);
    }
  }
});

check('No duplicate sectionIds', () => {
  const seen = new Set<string>();
  for (const s of RFP_SECTIONS) {
    if (seen.has(s.sectionId)) throw new Error(`Duplicate: ${s.sectionId}`);
    seen.add(s.sectionId);
  }
});

check('RFP_SECTION_IDS set size matches section count', () => {
  if (RFP_SECTION_IDS.size !== 20) throw new Error(`Set size = ${RFP_SECTION_IDS.size}`);
});

check('Last section is annexes at order 20', () => {
  const last = RFP_SECTIONS[RFP_SECTIONS.length - 1];
  if (last.sectionId !== 'annexes' || last.order !== 20) {
    throw new Error(`Last section: ${last.sectionId} order ${last.order}`);
  }
});

check('First section is coverPage at order 1', () => {
  const first = RFP_SECTIONS[0];
  if (first.sectionId !== 'coverPage' || first.order !== 1) {
    throw new Error(`First section: ${first.sectionId} order ${first.order}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Canonical information requirements
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n2. Canonical Information Requirements');

check(`Total field count = ${LEGACY_CANONICAL_FIELD_COUNT + PROMOTED_FIELD_IDS.length + POST_EXPANSION_FIELD_IDS.length} (legacy 52 + 7 promoted + issuerEntity)`, () => {
  if (
    CANONICAL_FIELD_COUNT !==
    LEGACY_CANONICAL_FIELD_COUNT + PROMOTED_FIELD_IDS.length + POST_EXPANSION_FIELD_IDS.length
  ) {
    throw new Error(`CANONICAL_FIELD_COUNT = ${CANONICAL_FIELD_COUNT}`);
  }
  if (CANONICAL_FIELD_COUNT !== 60) throw new Error(`Expected 60, got ${CANONICAL_FIELD_COUNT}`);
  if (!PROJECT_MEMORY_FIELDS.some((f) => f.fieldId === 'issuerEntity')) {
    throw new Error('issuerEntity missing from PROJECT_MEMORY_FIELDS');
  }
});

check('PROJECT_MEMORY_FIELDS.length matches CANONICAL_FIELD_COUNT', () => {
  if (PROJECT_MEMORY_FIELDS.length !== CANONICAL_FIELD_COUNT) {
    throw new Error(`Length = ${PROJECT_MEMORY_FIELDS.length}`);
  }
});

check('ProjectMemory keys match canonical field IDs', () => {
  const keys = Object.keys(createEmptyProjectMemory()).sort();
  const ids = PROJECT_MEMORY_FIELDS.map((f) => f.fieldId).sort();
  if (keys.join() !== ids.join()) {
    throw new Error(`Memory keys ≠ field IDs`);
  }
});

check('No duplicate fieldIds', () => {
  const seen = new Set<string>();
  for (const f of PROJECT_MEMORY_FIELDS) {
    if (seen.has(f.fieldId)) throw new Error(`Duplicate fieldId: ${f.fieldId}`);
    seen.add(f.fieldId);
  }
});

check('All fields have category PROJECT_INFORMATION (no AGENT_RULE or SYSTEM_DEFAULT in memory)', () => {
  const bad = PROJECT_MEMORY_FIELDS.filter(f => f.category !== 'PROJECT_INFORMATION');
  if (bad.length > 0) throw new Error(`Non-PROJECT_INFORMATION fields found: ${bad.map(f => f.fieldId).join(', ')}`);
});

check('All targetSection references are valid sectionIds', () => {
  const invalid: string[] = [];
  for (const f of PROJECT_MEMORY_FIELDS) {
    for (const sid of f.targetSections) {
      if (!RFP_SECTION_IDS.has(sid)) invalid.push(`${f.fieldId}→${sid}`);
    }
  }
  if (invalid.length > 0) throw new Error(`Invalid section refs: ${invalid.join(', ')}`);
});

check('documentType field exists and is required', () => {
  const f = PROJECT_MEMORY_FIELDS.find(x => x.fieldId === 'documentType');
  if (!f) throw new Error('documentType not found');
  if (f.requirement !== 'required') throw new Error('documentType must be required');
});

check('riskNotes field exists and targets no sections (cross-cutting)', () => {
  const f = PROJECT_MEMORY_FIELDS.find(x => x.fieldId === 'riskNotes');
  if (!f) throw new Error('riskNotes not found');
  if (f.targetSections.length !== 0) throw new Error(`riskNotes.targetSections should be empty, got ${JSON.stringify(f.targetSections)}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Section state machine
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n3. Section State Machine');

const validTransitions: [string, string][] = [
  ['NOT_STARTED', 'COLLECTING'],
  ['COLLECTING', 'READY_TO_DRAFT'],
  ['READY_TO_DRAFT', 'DRAFTING'],
  ['DRAFTING', 'REVIEW'],
  ['REVIEW', 'REVISING'],
  ['REVIEW', 'APPROVED'],
  ['REVISING', 'DRAFTING'],
  ['APPROVED', 'REOPENED'],
  ['REOPENED', 'COLLECTING'],
];

const invalidTransitions: [string, string][] = [
  ['NOT_STARTED', 'APPROVED'],
  ['COLLECTING', 'APPROVED'],
  ['REVIEW', 'NOT_STARTED'],
  ['APPROVED', 'NOT_STARTED'],
  ['APPROVED', 'DRAFTING'],
  ['DRAFTING', 'APPROVED'],
  ['NOT_STARTED', 'REOPENED'],
];

for (const [from, to] of validTransitions) {
  check(`Valid: ${from} → ${to}`, () => {
    if (!isSectionTransitionAllowed(from as never, to as never)) {
      throw new Error('Expected allowed');
    }
  });
}

for (const [from, to] of invalidTransitions) {
  check(`Invalid (must reject): ${from} → ${to}`, () => {
    if (isSectionTransitionAllowed(from as never, to as never)) {
      throw new Error('Expected rejected');
    }
  });
}

check('assertSectionTransition throws on illegal transition', () => {
  try {
    assertSectionTransition('scopeOfWork', 'NOT_STARTED', 'APPROVED');
    throw new Error('Should have thrown');
  } catch (err) {
    if (String(err).includes('Should have thrown')) throw err;
  }
});

check('advanceSectionState walks NOT_STARTED→COLLECTING→READY_TO_DRAFT', () => {
  let rec = createSectionStateRecord('scopeOfWork');
  rec = advanceSectionState(rec, 'COLLECTING');
  rec = advanceSectionState(rec, 'READY_TO_DRAFT');
  if (rec.state !== 'READY_TO_DRAFT') throw new Error(`Got ${rec.state}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Provenance model
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n4. Provenance Model');

check('REFERENCE → PROPOSED is allowed', () => {
  if (!isProvenanceTransitionAllowed('REFERENCE', 'PROPOSED')) throw new Error('Expected allowed');
});

check('REFERENCE → CONFIRMED is NOT allowed (hard rule)', () => {
  if (isProvenanceTransitionAllowed('REFERENCE', 'CONFIRMED')) throw new Error('Expected rejected');
});

check('EXTRACTED → CONFIRMED is allowed', () => {
  if (!isProvenanceTransitionAllowed('EXTRACTED', 'CONFIRMED')) throw new Error('Expected allowed');
});

check('updateMemoryField throws on REFERENCE → CONFIRMED attempt', () => {
  const field = createMemoryField('testField', 'some value', 'REFERENCE', 'historical-retrieval');
  try {
    updateMemoryField(field, 'confirmed value', 'CONFIRMED', 'ba-message');
    throw new Error('Should have thrown');
  } catch (err) {
    if (String(err).includes('Should have thrown')) throw err;
  }
});

check('updateMemoryField records history on valid transition', () => {
  const field = createMemoryField('testField', 'extracted', 'EXTRACTED', 'ba-message');
  const updated = updateMemoryField(field, 'confirmed', 'CONFIRMED', 'ba-message', undefined, 'ba-user-1');
  if (updated.history.length !== 1) throw new Error(`Expected 1 history entry, got ${updated.history.length}`);
  if (updated.current.status !== 'CONFIRMED') throw new Error('Status not updated');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Model manifest
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n5. Model Manifest');

check('Model manifest parses and has required fields', () => {
  const m = getModelManifest();
  if (!m.provider) throw new Error('Missing provider');
  if (!m.inferenceBaseUrl) throw new Error('Missing inferenceBaseUrl');
  if (!m.models?.default) throw new Error('Missing models.default');
  if (!m.models?.lightweight) throw new Error('Missing models.lightweight');
  if (!m.embeddings?.model) throw new Error('Missing embeddings.model');
});

check('Manifest provider = ollama', () => {
  const m = getModelManifest();
  if (m.provider !== 'ollama') throw new Error(`Got: ${m.provider}`);
});

check('Manifest inferenceBaseUrl = http://localhost:11434', () => {
  const m = getModelManifest();
  if (m.inferenceBaseUrl !== 'http://localhost:11434') throw new Error(`Got: ${m.inferenceBaseUrl}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Passed: ${passed}  Failed: ${failed}`);

if (failed > 0) {
  console.error('\n❌ Phase 1 validation FAILED — see errors above.\n');
  process.exit(1);
} else {
  console.log('\n✅ Phase 1 validation passed.\n');
}
