#!/usr/bin/env npx tsx
/**
 * UI Phase B1 — chat thinking, engine timers, stop UX, unicode helpers.
 */
import assert from 'node:assert/strict';
import { formatActivityAgo, formatEngineHms } from '../src/utils/engineDisplay';
import { buildModalBridgeEnv } from '../src/server/ai/utf8BridgeEnv';
import { UNICODE_FIXTURE } from './validate-unicode-roundtrip';

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

function shouldShowThinking(
  status: 'idle' | 'thinking' | 'streaming' | 'error',
  lastAssistant?: { role: string; isStreaming?: boolean; content?: string },
): boolean {
  const lastAssistantEmpty =
    lastAssistant?.role === 'assistant' &&
    lastAssistant.isStreaming &&
    !lastAssistant.content?.trim();
  return status === 'thinking' || (status === 'streaming' && Boolean(lastAssistantEmpty));
}

console.log('\n=== UI Phase B1 checks ===\n');

run('thinking visible during thinking status', () => {
  assert.equal(shouldShowThinking('thinking', { role: 'assistant', isStreaming: true, content: '' }), true);
});

run('thinking visible for empty streaming placeholder', () => {
  assert.equal(
    shouldShowThinking('streaming', { role: 'assistant', isStreaming: true, content: '' }),
    true,
  );
});

run('thinking hidden once assistant content arrives', () => {
  assert.equal(
    shouldShowThinking('streaming', { role: 'assistant', isStreaming: true, content: 'Hello' }),
    false,
  );
});

run('engine HMS formatter pads segments', () => {
  assert.equal(formatEngineHms(3661), '01:01:01');
  assert.equal(formatEngineHms(null), null);
});

run('activity ago formatter handles seconds', () => {
  assert.equal(formatActivityAgo(45), '45s ago');
  assert.equal(formatActivityAgo(null), '—');
});

run('modal bridge UTF-8 env is set', () => {
  const env = buildModalBridgeEnv();
  assert.equal(env.PYTHONUTF8, '1');
});

run('unicode fixture is intact for regression', () => {
  assert.ok(UNICODE_FIXTURE.includes('—'));
  assert.ok(UNICODE_FIXTURE.includes('مرحباً'));
  assert.ok(!UNICODE_FIXTURE.includes('\uFFFD'));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
