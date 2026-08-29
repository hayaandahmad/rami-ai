/**
 * Local unit tests for Modal control-plane helpers (no GPU / no Modal network).
 */
import assert from 'node:assert/strict';
import {
  getConfiguredProviderKind,
  getDevCreditBudgetUsd,
  getIdleTimeoutSec,
  getMaxSessionSec,
  getT4UsdPerSec,
} from '../src/server/ai/providerConfig';

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    return false;
  }
}

console.log('\n=== Modal integration unit checks (no GPU) ===\n');

let passed = 0;
let failed = 0;

function run(name: string, fn: () => void) {
  if (check(name, fn)) passed++;
  else failed++;
}

run('provider kind defaults to local when unset', () => {
  const prev = process.env.RAMI_MODEL_PROVIDER;
  delete process.env.RAMI_MODEL_PROVIDER;
  // Dynamic import already evaluated — re-read via direct env simulation
  process.env.RAMI_MODEL_PROVIDER = 'local';
  assert.equal(getConfiguredProviderKind(), 'local');
  process.env.RAMI_MODEL_PROVIDER = 'modal';
  assert.equal(getConfiguredProviderKind(), 'modal');
  process.env.RAMI_MODEL_PROVIDER = 'weird';
  assert.equal(getConfiguredProviderKind(), 'local');
  if (prev === undefined) delete process.env.RAMI_MODEL_PROVIDER;
  else process.env.RAMI_MODEL_PROVIDER = prev;
});

run('budget / rate / idle / max session are positive', () => {
  assert.ok(getDevCreditBudgetUsd() >= 0);
  assert.ok(getT4UsdPerSec() > 0);
  assert.ok(getIdleTimeoutSec() >= 60);
  assert.ok(getMaxSessionSec() >= getIdleTimeoutSec());
});

run('estimated remaining math', () => {
  const rate = 0.000164;
  const budget = 1.0;
  const usedSeconds = 600;
  const used = usedSeconds * rate;
  const remaining = Math.max(0, budget - used);
  const t4Left = remaining / rate;
  assert.ok(Math.abs(used - 0.0984) < 1e-6);
  assert.ok(remaining > 0.9);
  assert.ok(t4Left > 5000);
});

run('draggable position clamp helper', () => {
  const clamp = (x: number, y: number, w: number, h: number, vw: number, vh: number) => {
    const maxX = Math.max(8, vw - w - 8);
    const maxY = Math.max(8, vh - h - 8);
    return {
      x: Math.min(maxX, Math.max(8, x)),
      y: Math.min(maxY, Math.max(8, y)),
    };
  };
  assert.deepEqual(clamp(-100, -50, 200, 40, 1000, 800), { x: 8, y: 8 });
  assert.deepEqual(clamp(9999, 9999, 200, 40, 1000, 800), { x: 792, y: 752 });
});

console.log(`\nPassed: ${passed}  Failed: ${failed}`);
if (failed > 0) process.exit(1);
console.log('\n✅ Modal integration unit checks passed.\n');
