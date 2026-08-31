#!/usr/bin/env npx tsx
/**
 * UI Phase B2 — thinking dots, sidebar persistence, engine OFF/ERROR, project understanding.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SIDEBAR_COLLAPSED_KEY } from '../src/hooks/useDesktopSidebarCollapsed';

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

console.log('\n=== UI Phase B2 checks ===\n');

run('thinking indicator renders three dot spans', () => {
  const src = readSrc('src/components/chat/ThinkingIndicator.tsx');
  assert.match(src, /rami-thinking-dot/);
  const dotCount = (src.match(/className="rami-thinking-dot"/g) ?? []).length;
  assert.equal(dotCount, 3);
});

run('thinking dots CSS is global with reduced-motion visibility', () => {
  const css = readSrc('src/styles/globals.css');
  assert.match(css, /\.rami-thinking-dots/);
  assert.match(css, /\.rami-thinking-dot/);
  assert.match(css, /@keyframes rami-thinking-dot-pulse/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /animation: none/);
});

run('sidebar persistence key is versioned', () => {
  assert.equal(SIDEBAR_COLLAPSED_KEY, 'rami-sidebar-collapsed-v1');
});

run('AppShell uses desktop sidebar collapse hook', () => {
  const src = readSrc('src/layouts/AppShell/AppShell.tsx');
  assert.match(src, /useDesktopSidebarCollapsed/);
  assert.match(src, /onToggleCollapse/);
  assert.match(src, /desktopSidebarWidth/);
});

run('ChatLayout uses desktop sidebar collapse hook', () => {
  const src = readSrc('src/layouts/ChatLayout.tsx');
  assert.match(src, /useDesktopSidebarCollapsed/);
  assert.doesNotMatch(src, /w-\[var\(--spacing-sidebar-expanded\)\]/);
});

run('engine provider distinguishes OFF from ERROR', () => {
  const src = readSrc('src/providers/RamiEngineStatusProvider.tsx');
  assert.match(src, /isModalStopped/);
  assert.match(src, /isModalError/);
  assert.match(src, /isModalEngineUnavailable/);
});

run('engine panel shows separate OFF and ERROR messaging', () => {
  const src = readSrc('src/components/ai/RamiEngineControl.tsx');
  assert.match(src, /isModalStopped/);
  assert.match(src, /isModalError/);
  assert.match(src, /rami-engine-off-note/);
  assert.match(src, /rami-engine-error-note/);
});

run('project understanding defaults collapsed with summary chips', () => {
  const src = readSrc('src/components/chat/ProjectUnderstandingPanel.tsx');
  assert.match(src, /useState\(false\)/);
  assert.match(src, /% gathered/);
  assert.match(src, /need attention/);
  assert.match(src, /ATTENTION_PREVIEW/);
});

run('chat messages no longer duplicate clarifying banner', () => {
  const src = readSrc('src/components/chat/ChatMessages.tsx');
  assert.doesNotMatch(src, /currentlyClarifying && messages/);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
