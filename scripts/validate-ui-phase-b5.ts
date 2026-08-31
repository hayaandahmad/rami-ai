#!/usr/bin/env npx tsx
/**
 * UI Phase B5 — engine panel dismiss interactions.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname ?? __dirname, '..');

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

function readSrc(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

console.log('\n=== UI Phase B5 checks ===\n');

run('engine panel has collapsePanel and outside dismiss listeners', () => {
  const src = readSrc('src/components/ai/RamiEngineControl.tsx');
  assert.match(src, /collapsePanel/);
  assert.match(src, /document\.addEventListener\('pointerdown', onPointerDown\)/);
  assert.match(src, /event\.key === 'Escape'/);
  assert.match(src, /aria-label="Collapse Rami AI Engine"/);
});

run('chevron and header call collapse directly (not toggleExpand+movedRef guard)', () => {
  const src = readSrc('src/components/ai/RamiEngineControl.tsx');
  assert.match(src, /onClick=\{collapsePanel\}/);
  assert.doesNotMatch(src, /toggleExpand/);
});

run('expanded panel stops propagation on inner controls', () => {
  const src = readSrc('src/components/ai/RamiEngineControl.tsx');
  assert.match(src, /stopPropagation/);
  assert.match(src, /closest\('button,a,input,textarea,select'\)/);
});

run('dismiss persists collapsed expanded state', () => {
  const src = readSrc('src/components/ai/RamiEngineControl.tsx');
  assert.match(src, /persistExpanded\(false\)/);
  assert.match(src, /EXPANDED_KEY/);
});

run('pill retains aria-expanded when collapsed', () => {
  const src = readSrc('src/components/ai/RamiEngineControl.tsx');
  assert.match(src, /aria-expanded=\{false\}/);
  assert.match(src, /aria-label="Collapse Rami AI Engine"/);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
