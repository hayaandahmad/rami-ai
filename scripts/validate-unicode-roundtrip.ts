#!/usr/bin/env npx tsx
/**
 * Unicode round-trip regression — no GPU, no DB.
 * Proves UTF-8 survives JSON/SSE-style encoding and chunked TextDecoder paths.
 */
import assert from 'node:assert/strict';
import { TextDecoder, TextEncoder } from 'node:util';
import { buildModalBridgeEnv } from '../src/server/ai/utf8BridgeEnv';
import { ThinkStripper } from '../src/server/ai/thinkStripper';

export const UNICODE_FIXTURE =
  'RAMI test — – \u2019 \u201c \u201d \u2022 \u2713 \u2705 \u26a0\ufe0f مرحباً، هذا اختبار RAMI — اختبار عربي / English';

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

function sseRoundTrip(text: string): string {
  const line = `data: ${JSON.stringify({ type: 'text', chunk: text })}\n\n`;
  const encoded = new TextEncoder().encode(line);
  const decoded = new TextDecoder('utf-8').decode(encoded);
  const jsonStr = decoded.slice(6).trim();
  const event = JSON.parse(jsonStr) as { chunk: string };
  return event.chunk;
}

function decodeChunkedUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const decoder = new TextDecoder('utf-8');
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    out += decoder.decode(bytes.subarray(i, i + 3), { stream: true });
  }
  out += decoder.decode();
  return out;
}

function main() {
  console.log('\n=== Unicode round-trip checks ===\n');

  run('fixture contains no replacement character before test', () => {
    assert.ok(!UNICODE_FIXTURE.includes('\uFFFD'));
  });

  run('JSON + TextEncoder SSE round-trip preserves Unicode', () => {
    const out = sseRoundTrip(UNICODE_FIXTURE);
    assert.equal(out, UNICODE_FIXTURE);
    assert.ok(!out.includes('\uFFFD'));
  });

  run('chunked TextDecoder preserves multi-byte characters', () => {
    const out = decodeChunkedUtf8(UNICODE_FIXTURE);
    assert.equal(out, UNICODE_FIXTURE);
    assert.ok(!out.includes('\uFFFD'));
  });

  run('ThinkStripper passes Unicode through unchanged', () => {
    const stripper = new ThinkStripper();
    const out = stripper.process(UNICODE_FIXTURE) + stripper.flush();
    assert.equal(out, UNICODE_FIXTURE);
  });

  run('Modal bridge env enables UTF-8 on Windows subprocess', () => {
    const env = buildModalBridgeEnv({ PATH: 'x' });
    assert.equal(env.PYTHONUTF8, '1');
    assert.equal(env.PYTHONIOENCODING, 'utf-8');
    assert.equal(env.PATH, 'x');
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

if (process.argv[1]?.includes('validate-unicode-roundtrip')) {
  main();
}
