#!/usr/bin/env npx tsx
/**
 * Document experience unit checks (renderer + edit persistence + assembly view).
 */
import assert from 'node:assert/strict';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { isDatabaseConfigured } from '../src/server/db/config';
import type { GeneratedBlock, GeneratedSection } from '../src/types/generatedSection';
import {
  assembleRfpDocument,
  editRfpSection,
  getGeneratedSection,
  approveRfpSection,
} from '../src/server/rami/sectionGeneration';
import { GenerationError } from '../src/types/generatedSection';
import { clearAllSessionCache } from '../src/server/rami/sessionStore';

let passed = 0;
let failed = 0;

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    failed++;
  }
}

function sampleSection(): GeneratedSection {
  return {
    sectionId: 'background',
    title: 'Background and Business Need',
    version: 1,
    approvalStatus: 'DRAFT',
    generatedAt: new Date().toISOString(),
    readinessAtGeneration: 'DRAFTABLE_WITH_TBC',
    modelUsed: 'test',
    sourceFieldIds: ['currentSituation'],
    tbcFieldIds: ['painPoints'],
    blocks: [
      { type: 'heading', level: 1, text: 'Background and Business Need' },
      { type: 'heading', level: 2, text: 'Current Situation' },
      { type: 'paragraph', text: 'Fragmented portals remain in use.' },
      { type: 'bullet_list', items: ['Assess maturity', 'Recommend TOM'] },
      { type: 'numbered_list', items: ['Phase 1', 'Phase 2'] },
      {
        type: 'table',
        headers: ['Item', 'Status'],
        rows: [['Assessment', 'Planned']],
      },
      { type: 'tbc', label: '[To be confirmed]: Pain Points Today', fieldId: 'painPoints' },
    ],
  };
}

function assertBlockTypes(blocks: GeneratedBlock[]) {
  const types = new Set(blocks.map((b) => b.type));
  for (const t of [
    'heading',
    'paragraph',
    'bullet_list',
    'numbered_list',
    'table',
    'tbc',
  ] as const) {
    assert.ok(types.has(t), `missing block type ${t}`);
  }
}

console.log('\n=== RFP document experience checks ===\n');

async function main() {
  loadLocalEnv();

  await run('sample GeneratedSection includes all block types', () => {
    assertBlockTypes(sampleSection().blocks);
  });

  await run('TBC block keeps professional marker text', () => {
    const tbc = sampleSection().blocks.find((b) => b.type === 'tbc');
    assert.ok(tbc && tbc.type === 'tbc');
    assert.match(tbc.label, /to be confirmed/i);
  });

  if (!isDatabaseConfigured()) {
    console.log('\n(Skipping live DB document checks)\n');
  } else {
    const doc = 'rami-gen-core-demo';
    clearAllSessionCache();

    await run('demo project exposes persisted background+scope in assembly', async () => {
      const assembled = await assembleRfpDocument(doc);
      assert.equal(assembled.sections.length, 20);
      const bg = assembled.sections.find((s) => s.sectionId === 'background');
      const scope = assembled.sections.find((s) => s.sectionId === 'scopeOfWork');
      assert.ok(bg?.generated);
      assert.ok(scope?.generated);
      assert.ok(assembled.generatedApplicableCount >= 2);
      // Does not invent missing applicable sections
      const missing = assembled.sections.filter((s) => s.applicable && s.missingGeneration);
      assert.ok(missing.length >= 1);
      for (const m of missing) assert.equal(m.generated, null);
    });

    await run('manual edit persists new DRAFT version without changing facts path', async () => {
      const before = await getGeneratedSection({ documentKey: doc, sectionId: 'scopeOfWork' });
      assert.ok(before);
      const marker = `Manual edit persistence check ${Date.now()}`;
      const blocks = [
        ...before!.content_json.blocks,
        { type: 'paragraph' as const, text: marker },
      ];
      const edited = await editRfpSection({
        documentKey: doc,
        sectionId: 'scopeOfWork',
        blocks,
      });
      assert.equal(edited.approval_status, 'DRAFT');
      assert.ok(edited.version > before!.version);
      clearAllSessionCache();
      const reloaded = await getGeneratedSection({
        documentKey: doc,
        sectionId: 'scopeOfWork',
      });
      assert.ok(
        reloaded?.content_json.blocks.some(
          (b) => b.type === 'paragraph' && b.text.includes('Manual edit persistence check'),
        ),
      );
    });

    await run('approved content refuses silent edit', async () => {
      // Ensure background current is approved for this test if possible
      const cur = await getGeneratedSection({ documentKey: doc, sectionId: 'background' });
      if (cur && cur.approval_status !== 'APPROVED') {
        await approveRfpSection({ documentKey: doc, sectionId: 'background' });
      }
      await assert.rejects(
        () =>
          editRfpSection({
            documentKey: doc,
            sectionId: 'background',
            blocks: [{ type: 'paragraph', text: 'should fail' }],
          }),
        (e: unknown) =>
          e instanceof GenerationError && e.code === 'APPROVED_CONTENT_PROTECTED',
      );
    });
  }

  console.log('\n──────────────────────────────────────');
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  if (failed > 0) {
    await closePool().catch(() => undefined);
    process.exit(1);
  }
  console.log('\n✅ Document experience validation passed.\n');
  await closePool().catch(() => undefined);
}

main().catch(async (err) => {
  console.error(err);
  await closePool().catch(() => undefined);
  process.exit(1);
});
