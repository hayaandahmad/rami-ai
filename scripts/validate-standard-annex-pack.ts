#!/usr/bin/env npx tsx
/**
 * Prove the standard Annex pack against the historical RFP corpus (Q 11.3).
 * Does not write ProjectFacts. No GPU.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STANDARD_ANNEX_PACK,
  standardAnnexHitsInText,
} from '../src/schema/standardAnnexPack';

const FULL_RFP_EVIDENCE_IDS = [
  'rfp-22-egovt-2026-reengineering-ofa',
  'rfp-ssc-bpr',
  'rfp-nur-v2-lakehouse',
  'rfp-connectivity-ofa',
  'rfp-17-egovt-2026-performance-assessment',
] as const;

const EXCLUDED_FROM_FORMS_PACK = {
  'pq-15-egovt-2026-sanad-ai': 'pre-qualification forms, not a standard RFP annex pack',
  'rfp-itas-vol2b': 'technical-volume annexures A–N, not the commercial forms pack',
} as const;

let passed = 0;
let failed = 0;

function run(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(err);
  }
}

function loadCorpus() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const payload = JSON.parse(
    readFileSync(join(root, 'resources/historical-rfps/derived/import-payload.json'), 'utf8'),
  ) as {
    documents: Array<{ historicalRfpId: string; title: string; documentKinds?: string[] }>;
    answers: Array<{
      historicalRfpId: string;
      canonicalQuestionId?: string | null;
      exactQuestionText?: string;
      answerText?: string;
    }>;
  };
  return payload;
}

function main() {
  console.log('\n=== Historical standard Annex pack verification ===\n');

  const payload = loadCorpus();
  const docs = payload.documents;
  const q113 = payload.answers.filter((a) => a.canonicalQuestionId === '11.3');

  console.log(`Historical RFPs inspected: ${docs.length}`);
  console.log(`Q 11.3 answers: ${q113.length}`);

  const byRfp = new Map<string, { title: string; kinds: string[]; answer: string; hits: string[] }>();
  for (const d of docs) {
    const answer = q113.find((a) => a.historicalRfpId === d.historicalRfpId)?.answerText ?? '';
    byRfp.set(d.historicalRfpId, {
      title: d.title,
      kinds: d.documentKinds ?? [],
      answer,
      hits: standardAnnexHitsInText(answer),
    });
  }

  for (const [id, row] of byRfp) {
    console.log(`\n  ${id}`);
    console.log(`    ${row.title}`);
    console.log(`    kinds: ${row.kinds.join(', ') || 'n/a'}`);
    console.log(`    standard-pack hits: ${row.hits.join(', ') || '(none)'}`);
    const excluded = EXCLUDED_FROM_FORMS_PACK[id as keyof typeof EXCLUDED_FROM_FORMS_PACK];
    if (excluded) console.log(`    excluded from pack evidence: ${excluded}`);
  }

  run('corpus includes all 7 historical datasets', () => {
    assert.equal(docs.length, 7);
    assert.equal(q113.length, 7);
  });

  run('every full-RFP evidence document has a non-empty 11.3 answer', () => {
    for (const id of FULL_RFP_EVIDENCE_IDS) {
      const row = byRfp.get(id);
      assert.ok(row, id);
      assert.ok(row!.answer.trim().length > 40, id);
    }
  });

  run('each chosen standard annex is attested in at least 3 of 5 full RFPs', () => {
    const min = 3;
    for (const item of STANDARD_ANNEX_PACK) {
      const supporters = FULL_RFP_EVIDENCE_IDS.filter((id) => byRfp.get(id)?.hits.includes(item.id));
      console.log(`    ${item.title}: ${supporters.length}/5 [${supporters.join(', ')}]`);
      assert.ok(
        supporters.length >= min,
        `${item.title} only supported by ${supporters.length}/5 full RFPs`,
      );
    }
  });

  run('ITAS and SANAD remain documented as non-pack patterns, not copied into the template', () => {
    const itas = byRfp.get('rfp-itas-vol2b');
    const sanad = byRfp.get('pq-15-egovt-2026-sanad-ai');
    assert.ok(itas?.answer.toLowerCase().includes('annexures'));
    assert.ok(sanad?.answer.toLowerCase().includes('solvency'));
    const packSrc = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../src/schema/standardAnnexPack.ts'),
      'utf8',
    );
    assert.doesNotMatch(packSrc, /Natiq/i);
    assert.doesNotMatch(packSrc, /ITAS Annexures/i);
    assert.doesNotMatch(packSrc, /SANAD/i);
  });

  run('standard pack titles are organization-level, not a named historical project', () => {
    for (const item of STANDARD_ANNEX_PACK) {
      assert.doesNotMatch(item.title, /Natiq|ITAS|SANAD|SSC|NUR|MoDEE BPR/i);
      assert.doesNotMatch(item.purpose, /Natiq|ITAS|SANAD|SSC|NUR/i);
    }
  });

  console.log(`\nChosen canonical pack (${STANDARD_ANNEX_PACK.length}):`);
  for (const [i, item] of STANDARD_ANNEX_PACK.entries()) {
    console.log(`  ${i + 1}. ${item.title}`);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
