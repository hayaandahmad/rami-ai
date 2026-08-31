#!/usr/bin/env npx tsx
/**
 * UI Phase B3 — document workspace polish, sidebar icon control, UI persistence.
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

console.log('\n=== UI Phase B3 checks ===\n');

run('sidebar collapse is icon-only at top (no large bottom button)', () => {
  const src = readSrc('src/layouts/AppShell/Sidebar.tsx');
  assert.match(src, /PanelLeftClose/);
  assert.match(src, /aria-label=\{collapseLabel\}/);
  assert.doesNotMatch(src, /Collapse sidebar<\/span>/);
  assert.doesNotMatch(src, /border-t border-sidebar-border.*onToggleCollapse/s);
});

run('RFP Document header label preserved', () => {
  const src = readSrc('src/components/rfp/RfpDocumentPanel.tsx');
  assert.match(src, /RFP Document/);
  assert.match(src, /Section/);
  assert.match(src, /Full RFP/);
  assert.match(src, /Download Word|Export approved RFP/);
});

run('Section and Full RFP modes remain separate', () => {
  const src = readSrc('src/components/rfp/RfpDocumentPanel.tsx');
  assert.match(src, /doc\.viewMode === 'section'/);
  assert.match(src, /doc\.viewMode === 'full'/);
  assert.match(src, /setViewMode\('section'\)/);
  assert.match(src, /setViewMode\('full'\)/);
});

run('section action semantics preserved', () => {
  const src = readSrc('src/components/rfp/RfpDocumentPanel.tsx');
  assert.match(src, /Generate/);
  assert.match(src, /Regenerate/);
  assert.match(src, /Approve section/);
  assert.match(src, /Edit/);
  assert.match(src, /Reopen \/ Regenerate/);
  assert.match(src, /reopenApproved/);
});

run('document UI state uses document-scoped sessionStorage', () => {
  const src = readSrc('src/hooks/useRfpDocument.ts');
  assert.match(src, /rami-rfp-ui-v1:\$\{documentKey\}/);
  assert.match(src, /sessionStorage\.setItem/);
  assert.match(src, /readStoredSection/);
  assert.match(src, /readStoredView/);
});

run('section navigator width optimized without removing status chips', () => {
  const src = readSrc('src/components/rfp/RfpDocumentPanel.tsx');
  assert.match(src, /w-\[10rem\]/);
  assert.match(src, /StatusChip/);
  assert.match(src, /READINESS_LABEL/);
  assert.match(src, /DOC_STATUS_LABEL/);
});

run('thinking indicator unchanged from Phase 2', () => {
  const src = readSrc('src/components/chat/ThinkingIndicator.tsx');
  assert.match(src, /rami-thinking-dot/);
  assert.equal((src.match(/className="rami-thinking-dot"/g) ?? []).length, 3);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
