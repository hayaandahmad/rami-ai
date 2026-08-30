#!/usr/bin/env npx tsx
/**
 * Regenerate deliverables if thin; fallback to facts-backed manual edit.
 */
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { clearAllSessionCache } from '../src/server/rami/sessionStore';
import { clearDefaultProvider } from '../src/server/ai';
import { startEngine, stopEngine } from '../src/server/ai/modalEngineControl';
import {
  editRfpSection,
  generateRfpSection,
} from '../src/server/rami/sectionGeneration';
import { hydrateProject } from '../src/server/rami/projectPersistence';
import type { GeneratedBlock } from '../src/types/generatedSection';

const DOC = 'rami-gen-core-demo';

function asStringList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter((s) => s.trim());
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

function factsBackedDeliverables(items: string[], formats: string[]): GeneratedBlock[] {
  const rows = items.map((item, i) => [
    String(i + 1),
    item,
    item,
    formats[i] ?? formats[0] ?? '[To be confirmed]',
    'Yes',
  ]);
  return [
    { type: 'heading', level: 1, text: 'Deliverables' },
    {
      type: 'paragraph',
      text:
        'The Supplier shall provide the following deliverables for this engagement. ' +
        'Formats and approval requirements reflect ProjectFacts collected for this RFP.',
    },
    {
      type: 'table',
      headers: ['No.', 'Deliverable', 'Description', 'Format', 'Approval Required'],
      rows: rows.length
        ? rows
        : [['1', '[To be confirmed]', '[To be confirmed]', '[To be confirmed]', 'Yes']],
    },
    {
      type: 'heading',
      level: 2,
      text: 'Deliverable formats',
    },
    {
      type: 'bullet_list',
      items: formats.length ? formats : ['[To be confirmed]'],
    },
  ];
}

async function main() {
  loadLocalEnv();
  clearAllSessionCache();

  const session = await hydrateProject(DOC);
  const items = asStringList(session.memory.deliverableItems?.current?.value);
  const formats = asStringList(session.memory.deliverableFormats?.current?.value);
  console.log('facts items', items.length, 'formats', formats.length);

  let usedModal = false;
  try {
    process.env.RAMI_MODEL_PROVIDER = 'modal';
    clearDefaultProvider();
    const status = await startEngine();
    console.log('modal', status.state);
    usedModal = String(status.state) === 'READY';

    if (usedModal) {
      const t0 = Date.now();
      const result = await generateRfpSection({
        documentKey: DOC,
        sectionId: 'deliverables',
      });
      console.log(
        'regen',
        'v' + result.content.version,
        'blocks',
        result.generated.blocks.length,
        Date.now() - t0 + 'ms',
      );
      const hasTableOrList = result.generated.blocks.some(
        (b) =>
          b.type === 'table' ||
          b.type === 'bullet_list' ||
          b.type === 'numbered_list' ||
          (b.type === 'paragraph' && b.text.length > 40),
      );
      if (hasTableOrList && result.generated.blocks.length >= 3) {
        console.log(JSON.stringify(result.generated.blocks, null, 2));
        return;
      }
      console.log('regen still thin — applying facts-backed edit');
    }
  } finally {
    if (usedModal) {
      await stopEngine('manual');
      process.env.RAMI_MODEL_PROVIDER = 'local';
      clearDefaultProvider();
    }
  }

  const blocks = factsBackedDeliverables(items, formats);
  const edited = await editRfpSection({
    documentKey: DOC,
    sectionId: 'deliverables',
    blocks,
  });
  console.log('edited v' + edited.version, 'blocks', edited.content_json.blocks.length);
  console.log(JSON.stringify(edited.content_json.blocks, null, 2));
}

main().catch(async (e) => {
  console.error(e);
  try {
    await stopEngine('manual');
  } catch {
    /* ignore */
  }
  await closePool().catch(() => undefined);
  process.exit(1);
}).finally(async () => {
  await closePool().catch(() => undefined);
});
