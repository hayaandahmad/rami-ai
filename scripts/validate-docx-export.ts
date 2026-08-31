#!/usr/bin/env npx tsx
/**
 * DOCX export validation — export from persisted AssembledRfp only (no model).
 */
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { isDatabaseConfigured } from '../src/server/db/config';
import { assembleRfpDocument } from '../src/server/rami/sectionGeneration';
import {
  buildRfpDocxBuffer,
  safeDocxFilename,
} from '../src/server/rami/docxExport';
import type { AssembledRfp, GeneratedSection } from '../src/types/generatedSection';
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

/** Minimal ZIP central-directory scan for OOXML package members. */
function zipHasEntry(buf: Buffer, name: string): boolean {
  const needle = Buffer.from(name);
  return buf.includes(needle);
}

function extractDocumentXml(buf: Buffer): string {
  // Find local file header for word/document.xml
  const name = 'word/document.xml';
  const nameBuf = Buffer.from(name);
  let offset = 0;
  while (offset < buf.length - 30) {
    if (buf.readUInt32LE(offset) !== 0x04034b50) {
      offset++;
      continue;
    }
    const method = buf.readUInt16LE(offset + 8);
    const compSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const entryName = buf.slice(offset + 30, offset + 30 + nameLen).toString('utf8');
    const dataStart = offset + 30 + nameLen + extraLen;
    if (entryName === name) {
      const data = buf.slice(dataStart, dataStart + compSize);
      if (method === 0) return data.toString('utf8');
      if (method === 8) return inflateRawSync(data).toString('utf8');
      throw new Error(`unsupported compression method ${method}`);
    }
    offset = dataStart + compSize;
  }
  throw new Error('word/document.xml not found in DOCX');
}

function sampleAssembled(): AssembledRfp {
  const section: GeneratedSection = {
    sectionId: 'background',
    title: 'Background and Business Need',
    version: 1,
    approvalStatus: 'DRAFT',
    generatedAt: new Date().toISOString(),
    readinessAtGeneration: 'READY_TO_DRAFT',
    modelUsed: 'test-fixture',
    sourceFieldIds: ['currentSituation'],
    tbcFieldIds: ['painPoints'],
    blocks: [
      { type: 'heading', level: 1, text: 'Background and Business Need' },
      { type: 'paragraph', text: 'Fixture paragraph about portals.' },
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
  return {
    documentKey: 'fixture-docx',
    projectId: 'fixture-project',
    assembledAt: new Date().toISOString(),
    applicableSectionCount: 2,
    generatedApplicableCount: 1,
    structuralPreparedCount: 0,
    approvedApplicableCount: 0,
    complete: false,
    sections: [
      {
        sectionId: 'background',
        title: 'Background and Business Need',
        order: 1,
        applicable: true,
        readiness: 'READY_TO_DRAFT',
        approvalStatus: 'DRAFT',
        generated: section,
        missingGeneration: false,
      },
      {
        sectionId: 'evaluationCriteria',
        title: 'Evaluation Criteria',
        order: 2,
        applicable: true,
        readiness: 'NOT_READY',
        approvalStatus: null,
        generated: null,
        missingGeneration: true,
      },
    ],
  };
}

console.log('\n=== DOCX export checks ===\n');

async function main() {
  loadLocalEnv();

  await run('safeDocxFilename sanitizes title', () => {
    const name = safeDocxFilename(
      { documentTitle: 'MoDEE / Digital*Transformation?' },
      'rami-gen-core-demo',
    );
    assert.equal(name, 'MoDEE-DigitalTransformation.docx');
  });

  await run('fixture DOCX is valid OOXML with expected content', async () => {
    const assembled = sampleAssembled();
    const buf = await buildRfpDocxBuffer({
      assembled,
      documentMeta: {
        documentTitle: 'Fixture RFP Title',
        beneficiaryEntity: 'Ministry of Digital Economy and Entrepreneurship',
      },
    });
    assert.ok(buf.length > 1000, 'DOCX too small');
    assert.equal(buf.readUInt32LE(0), 0x04034b50, 'ZIP local header signature');
    assert.ok(zipHasEntry(buf, 'word/document.xml'));
    assert.ok(zipHasEntry(buf, '[Content_Types].xml'));
    const xml = extractDocumentXml(buf);
    assert.ok(xml.length > 100, 'document.xml empty');
    assert.match(xml, /Fixture RFP Title/);
    assert.match(xml, /Background and Business Need/);
    assert.match(xml, /Fixture paragraph about portals/);
    assert.match(xml, /Assess maturity/);
    assert.match(xml, /Phase 1/);
    assert.match(xml, /Assessment/);
    assert.match(xml, /To be confirmed/i);
    assert.doesNotMatch(xml, /not yet generated/i);
    // Missing section must not invent evaluation weights
    assert.doesNotMatch(xml, /40%|technical score invented/i);
  });

  await run('export path does not require model provider', async () => {
    // Intentionally do not touch getDefaultProvider — build from fixture only.
    const buf = await buildRfpDocxBuffer({
      assembled: sampleAssembled(),
      documentMeta: { documentTitle: 'No Model Touch' },
    });
    assert.ok(buf.length > 500);
  });

  if (isDatabaseConfigured()) {
    clearAllSessionCache();
    const doc = 'rami-gen-core-demo';

    await run('live demo DOCX contains persisted Background + Scope', async () => {
      const assembled = await assembleRfpDocument(doc);
      assert.ok(assembled.generatedApplicableCount >= 1);
      const buf = await buildRfpDocxBuffer({
        assembled,
        documentMeta: {
          documentTitle: 'Digital Transformation Assessment RFP',
        },
      });
      const xml = extractDocumentXml(buf);
      assert.match(xml, /Background/i);
      const bg = assembled.sections.find((s) => s.sectionId === 'background');
      assert.ok(bg?.generated);
      const firstPara = bg!.generated!.blocks.find((b) => b.type === 'paragraph');
      if (firstPara && firstPara.type === 'paragraph') {
        const snippet = firstPara.text.slice(0, 40);
        if (snippet.trim()) assert.ok(xml.includes(snippet.slice(0, 20)));
      }
      const scope = assembled.sections.find((s) => s.sectionId === 'scopeOfWork');
      if (scope?.generated) {
        assert.match(xml, /Scope of Work/i);
      }
      // Canonical order via section H1 titles (avoid ToC/cover false positives)
      if (bg?.generated && scope?.generated) {
        const bgTitle =
          bg.generated.blocks.find((b) => b.type === 'heading' && b.level === 1)?.text ??
          'Background';
        const scopeTitle =
          scope.generated.blocks.find((b) => b.type === 'heading' && b.level === 1)?.text ??
          'Scope of Work';
        // Use last index of title after cover — find unique paragraph markers instead
        const bgMarker =
          firstPara && firstPara.type === 'paragraph'
            ? firstPara.text.slice(0, 48)
            : bgTitle;
        const scopePara = scope.generated.blocks.find((b) => b.type === 'paragraph');
        const scopeMarker =
          scopePara && scopePara.type === 'paragraph'
            ? scopePara.text.slice(0, 48)
            : scopeTitle;
        const iBg = xml.indexOf(bgMarker.slice(0, 24));
        const iScope = xml.indexOf(scopeMarker.slice(0, 24));
        assert.ok(iBg >= 0, 'background content missing from DOCX');
        assert.ok(iScope >= 0, 'scope content missing from DOCX');
        assert.ok(iBg < iScope, 'background should precede scope in DOCX body');
      }
      assert.match(xml, /To be confirmed/i);
      const del = assembled.sections.find((s) => s.sectionId === 'deliverables');
      if (del?.generated?.blocks.some((b) => b.type === 'table')) {
        assert.match(xml, /Deliverable/i);
      }
    });
  } else {
    console.log('\n(Skipping live DB DOCX checks)\n');
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  await closePool().catch(() => undefined);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await closePool().catch(() => undefined);
  process.exit(1);
});
