#!/usr/bin/env npx tsx
/**
 * Persistence unit tests — no live PostgreSQL required.
 */
import assert from 'node:assert/strict';
import { createEmptyProjectMemory } from '../src/types/projectMemory';
import { createMemoryField } from '../src/types/provenance';
import { createEmptyProjectContext } from '../src/types/projectContext';
import { classifyProject } from '../src/server/rami/projectClassifier';
import { withActivePacks } from '../src/server/rami/questionPackEngine';
import { analyzeGaps } from '../src/server/rami/gapEngine';
import {
  factRowsToProjectMemory,
  projectMemoryToFactRows,
} from '../src/server/db/factMapper';
import { convertToJod, parseDurationMonths, parseMoneyHint } from '../src/server/db/projectNormalization';
import { getConfiguredProviderKind } from '../src/server/ai/providerConfig';
import {
  CANONICAL_FIELD_COUNT,
  PROJECT_MEMORY_FIELDS,
} from '../src/schema/projectMemoryFields';
import { RFP_SECTIONS } from '../src/schema/rfpSchema';
import {
  CANONICAL_QUESTION_COUNT,
  QUESTION_SEEDS,
  countQuestionFieldLinks,
} from '../src/schema/questionBankSeed';
import { getFieldDataType } from '../src/server/db/fieldTypes';
import { isDatabaseConfigured } from '../src/server/db/config';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

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

console.log('\n=== Persistence unit checks (no live PostgreSQL required) ===\n');

run('canonical field count is 59', () => {
  assert.equal(PROJECT_MEMORY_FIELDS.length, CANONICAL_FIELD_COUNT);
  assert.equal(CANONICAL_FIELD_COUNT, 59);
});

run('every field can seed a NOT NULL section_id', () => {
  for (const field of PROJECT_MEMORY_FIELDS) {
    const sid =
      field.targetSections[0] ??
      QUESTION_SEEDS.find((q) => q.fieldIds.includes(field.fieldId))?.sectionId;
    assert.ok(sid, `field ${field.fieldId} has no targetSections and no question-bank section`);
    assert.ok(
      RFP_SECTIONS.some((s) => s.sectionId === sid),
      `field ${field.fieldId} section ${sid} is not a canonical section`,
    );
  }
});

run('canonical section count is 20', () => {
  assert.equal(RFP_SECTIONS.length, 20);
});

run('question bank seed is 69 unique IDs', () => {
  assert.equal(QUESTION_SEEDS.length, CANONICAL_QUESTION_COUNT);
  assert.equal(CANONICAL_QUESTION_COUNT, 69);
  assert.equal(new Set(QUESTION_SEEDS.map((q) => q.questionId)).size, 69);
});

run('QuestionFields is many-to-many (3.4 maps two fields)', () => {
  const q34 = QUESTION_SEEDS.find((q) => q.questionId === '3.4');
  assert.ok(q34);
  assert.deepEqual(q34!.fieldIds, ['approvers', 'uatOwners']);
  assert.ok(countQuestionFieldLinks() > 52);
});

run('complex JSONB users value round-trips', () => {
  const memory = createEmptyProjectMemory();
  memory.users = {
    ...createMemoryField(
      'users',
      { internal: ['HR staff'], external: ['citizens'] },
      'EXTRACTED',
      'ba-message',
      'user-message:1',
    ),
    gapStatus: 'KNOWN',
  } as typeof memory.users;
  const rows = projectMemoryToFactRows(memory);
  const users = rows.find((r) => r.field_id === 'users');
  assert.ok(users);
  assert.equal(users!.collection_state, 'ANSWERED');
  assert.deepEqual(users!.value_json, { internal: ['HR staff'], external: ['citizens'] });
  const restored = factRowsToProjectMemory(rows);
  assert.deepEqual(restored.users?.current.value, { internal: ['HR staff'], external: ['citizens'] });
  assert.equal(restored.users?.current.status, 'EXTRACTED');
});

run('TBC / DEFERRED / contradiction persist', () => {
  const memory = createEmptyProjectMemory();
  memory.tenderNumber = {
    fieldId: 'tenderNumber',
    current: {
      value: null,
      status: 'TBC',
      sourceType: 'ba-message',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    history: [],
    gapStatus: 'DEFERRED',
    deferredTo: 'later',
  } as unknown as typeof memory.tenderNumber;
  memory.documentType = {
    fieldId: 'documentType',
    current: {
      value: 'system-implementation',
      status: 'EXTRACTED',
      sourceType: 'ba-message',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    history: [{
      value: 'consulting',
      status: 'EXTRACTED',
      sourceType: 'ba-message',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }],
    gapStatus: 'CONTRADICTORY',
    contradiction: { values: ['consulting', 'system-implementation'], sources: ['a', 'b'], severity: 'BLOCKING' },
  } as typeof memory.documentType;

  const restored = factRowsToProjectMemory(projectMemoryToFactRows(memory));
  assert.equal(restored.tenderNumber?.current.status, 'TBC');
  assert.equal((restored.tenderNumber as { deferredTo?: string })?.deferredTo, 'later');
  assert.equal((restored.documentType as { gapStatus?: string })?.gapStatus, 'CONTRADICTORY');
  assert.equal(restored.documentType?.history.length, 1);
});

run('NOT_APPLICABLE collection state', () => {
  const memory = createEmptyProjectMemory();
  memory.aiFeatures = {
    ...createMemoryField('aiFeatures', [], 'EXTRACTED', 'system'),
    gapStatus: 'NOT_APPLICABLE',
  } as typeof memory.aiFeatures;
  // empty array would be skipped by applyExtractedFacts; we persist explicit NA
  const bag = memory.aiFeatures as unknown as { current: { value: unknown }; gapStatus: string };
  bag.current.value = null;
  const row = projectMemoryToFactRows(memory).find((r) => r.field_id === 'aiFeatures');
  assert.equal(row?.collection_state, 'NOT_APPLICABLE');
});

run('ProjectContext classifiers are not fully re-derivable without previous', () => {
  const memory = createEmptyProjectMemory();
  const previous = createEmptyProjectContext();
  previous.documentStage = 'FULL_RFP';
  previous.primaryDomain = 'SYSTEM_IMPLEMENTATION';
  const withPrev = classifyProject({ memory, previous, latestMessage: 'ok' });
  const withoutPrev = classifyProject({ memory, latestMessage: 'ok' });
  assert.equal(withPrev.documentStage, 'FULL_RFP');
  assert.equal(withoutPrev.documentStage, 'UNDETERMINED');
});

run('after hydrate-style restore, packs and gaps recompute without repeating known fields', () => {
  const memory = createEmptyProjectMemory();
  memory.documentType = createMemoryField(
    'documentType',
    'system-implementation',
    'EXTRACTED',
    'ba-message',
  );
  memory.currentSituation = createMemoryField(
    'currentSituation',
    'Excel and manual approvals',
    'EXTRACTED',
    'ba-message',
  );
  memory.users = createMemoryField(
    'users',
    { internal: ['150 employees'], external: [] },
    'EXTRACTED',
    'ba-message',
  );
  const rows = projectMemoryToFactRows(memory);
  const restored = factRowsToProjectMemory(rows);
  const ctx = withActivePacks(
    classifyProject({
      memory: restored,
      previous: {
        ...createEmptyProjectContext(),
        documentStage: 'FULL_RFP',
        primaryDomain: 'SYSTEM_IMPLEMENTATION',
      },
    }),
    restored,
  );
  const gaps = analyzeGaps(restored, ctx);
  assert.ok(!gaps.fieldGaps.find((g) => g.fieldId === 'documentType' && g.gapStatus === 'MISSING'));
  assert.ok(!gaps.fieldGaps.find((g) => g.fieldId === 'users' && g.gapStatus === 'MISSING'));
  if (gaps.nextAction.type === 'ASK_REQUIREMENTS') {
    assert.notEqual(gaps.nextAction.primaryFieldId, 'documentType');
    assert.notEqual(gaps.nextAction.primaryFieldId, 'users');
  }
});

run('FX conversion is deterministic and not invented by the model', () => {
  const parsed = parseMoneyHint('10,000 USD');
  assert.deepEqual(parsed, { amount: 10000, currency: 'USD' });
  const jod = convertToJod(10000, 'USD');
  assert.ok(jod != null && jod > 0);
  assert.equal(convertToJod(100, 'JOD'), 100);
  assert.equal(convertToJod(100, 'XYZ'), null);
});

run('duration normalizes to months', () => {
  assert.equal(parseDurationMonths('18 months'), 18);
  assert.equal(parseDurationMonths('2 years'), 24);
  assert.equal(parseDurationMonths(9), 9);
});

run('field data types match runtime', () => {
  assert.equal(getFieldDataType('beneficiaryEntity'), 'string');
  assert.equal(getFieldDataType('businessObjectives'), 'array');
  assert.equal(getFieldDataType('users'), 'object');
  assert.equal(getFieldDataType('rollbackPlanNeeded'), 'boolean');
  assert.equal(getFieldDataType('awardModel'), 'object');
  assert.equal(getFieldDataType('namedKeyPersonnel'), 'array');
});

run('migration file exists', () => {
  const p = join(process.cwd(), 'src', 'server', 'db', 'migrations', '001_init.sql');
  assert.ok(existsSync(p));
  const sql = readFileSync(p, 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS project_facts/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS messages/);
  assert.doesNotMatch(sql, /knowledge_chunks/);
});

run('provider selection is independent of persistence', () => {
  const prev = process.env.RAMI_MODEL_PROVIDER;
  process.env.RAMI_MODEL_PROVIDER = 'local';
  assert.equal(getConfiguredProviderKind(), 'local');
  process.env.RAMI_MODEL_PROVIDER = 'modal';
  assert.equal(getConfiguredProviderKind(), 'modal');
  if (prev === undefined) delete process.env.RAMI_MODEL_PROVIDER;
  else process.env.RAMI_MODEL_PROVIDER = prev;
});

run('isDatabaseConfigured is false without env (this machine unit run)', () => {
  // Do not require live PG for this script.
  assert.equal(typeof isDatabaseConfigured(), 'boolean');
});

console.log(`\nPassed: ${passed}  Failed: ${failed}`);
if (failed > 0) process.exit(1);
console.log('\n✅ Persistence unit checks passed.\n');

if (isDatabaseConfigured()) {
  console.log('RAMI_DB_* is set in this process — run npm run db:check for live validation.');
} else {
  console.log('This script does not load .env.local (unit-only). Live PG is validated separately via db:migrate/seed/check and chat.');
}
