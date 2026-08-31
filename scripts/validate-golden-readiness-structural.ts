#!/usr/bin/env npx tsx
/**
 * Golden E2E corrective checks: extraction mapping, false conflicts,
 * structural Cover/TOC, annex applicability, Full RFP / DOCX cleanliness.
 * No GPU.
 */
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEmptyProjectMemory } from '../src/types/projectMemory';
import { createMemoryField } from '../src/types/provenance';
import { applyExtractedFacts, markFieldUnknown } from '../src/server/rami/memoryUpdater';
import { normalizeExtractedFacts } from '../src/server/rami/extractedFactNormalize';
import { getSectionReadiness } from '../src/server/rami/sectionReadiness';
import { withActivePacks } from '../src/server/rami/questionPackEngine';
import { buildApplicabilityContext } from '../src/server/rami/gapEngine';
import {
  buildCoverPageSection,
  buildTableOfContentsSection,
  buildAnnexesSection,
  hasAnnexMaterial,
  INTERNAL_GENERATION_PLACEHOLDER_RE,
} from '../src/server/rami/structuralSections';
import { buildRfpDocxBuffer } from '../src/server/rami/docxExport';
import type { AssembledRfp, GeneratedSection } from '../src/types/generatedSection';
import { classifyProject } from '../src/server/rami/projectClassifier';
import { createEmptyProjectContext } from '../src/types/projectContext';
import { RFP_SECTIONS, isSectionApplicable } from '../src/schema/rfpSchema';
import {
  STANDARD_ANNEX_ATTACHED_CAPTION,
  STANDARD_ANNEX_PACK,
  STANDARD_ANNEX_PLACEHOLDER,
  STANDARD_ANNEX_TEMPLATE_FILES_AVAILABLE,
  standardAnnexItemCaption,
} from '../src/schema/standardAnnexPack';
import { summarizeAssembledSectionProgress } from '../src/server/rami/sectionGeneration';
import { buildGenerationMessages } from '../src/server/rami/generationPrompt';

let passed = 0;
let failed = 0;

function run(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      passed++;
      console.log(`  ✓ ${name}`);
    })
    .catch((err) => {
      failed++;
      console.error(`  ✗ ${name}`);
      console.error(err);
    });
}

function systemCtx(memory: ReturnType<typeof createEmptyProjectMemory>) {
  let ctx = classifyProject({
    memory,
    signals: { documentStageSignal: 'FULL_RFP', domainSignals: ['system-implementation'] },
    latestMessage: 'system implementation platform',
  });
  ctx = {
    ...ctx,
    documentStage: 'FULL_RFP',
    contractingGranularity: 'SINGLE_PROJECT',
    primaryDomain: 'SYSTEM_IMPLEMENTATION',
  };
  return withActivePacks(ctx, memory);
}

function extractDocumentXml(buf: Buffer): string {
  const name = 'word/document.xml';
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

function blocksText(section: GeneratedSection): string {
  return section.blocks
    .map((b) => {
      if (b.type === 'heading' || b.type === 'paragraph' || b.type === 'tbc') return b.type === 'tbc' ? b.label : b.text;
      if (b.type === 'numbered_list' || b.type === 'bullet_list') return b.items.join('\n');
      if (b.type === 'table') return [...b.headers, ...b.rows.flat()].join('\n');
      return '';
    })
    .join('\n');
}

async function main() {
  console.log('\n=== Golden readiness + structural checks ===\n');

  await run('beneficiary mapping: overseeing ministry is beneficiaryEntity, not a conflict with the public', () => {
    const memory = createEmptyProjectMemory();
    const msg =
      'The primary beneficiary and overseeing entity is the Ministry of Government Communication. Media organizations and the general public are indirect beneficiaries, not primary users.';
    const facts = normalizeExtractedFacts(
      [
        {
          fieldId: 'beneficiaryEntity',
          value: 'Ministry of Government Communication',
          confidence: 'high',
        },
        {
          fieldId: 'beneficiaryEntity',
          value: 'general public',
          confidence: 'medium',
          updateKind: 'assert',
        },
      ],
      msg,
    );
    assert.equal(
      facts.filter((f) => f.fieldId === 'beneficiaryEntity').length,
      1,
    );
    assert.equal(
      facts.find((f) => f.fieldId === 'beneficiaryEntity')?.value,
      'Ministry of Government Communication',
    );
    const result = applyExtractedFacts(memory, facts, 'msg-1', msg);
    assert.ok(!result.contradicted.includes('beneficiaryEntity'));
    assert.equal(memory.beneficiaryEntity?.current.value, 'Ministry of Government Communication');
    assert.notEqual(
      (memory.beneficiaryEntity as { gapStatus?: string })?.gapStatus,
      'CONTRADICTORY',
    );
    const usersVal = memory.users?.current.value as { external?: string[] } | undefined;
    assert.ok(!(usersVal?.external ?? []).some((u) => /general public/i.test(u)));
  });

  await run('genuine ministry vs ministry conflict is preserved', () => {
    const memory = createEmptyProjectMemory();
    applyExtractedFacts(memory, [
      { fieldId: 'beneficiaryEntity', value: 'Ministry of Interior', confidence: 'high' },
    ]);
    const result = applyExtractedFacts(
      memory,
      [{ fieldId: 'beneficiaryEntity', value: 'Ministry of Finance', confidence: 'high' }],
      'msg-real-conflict',
      'The beneficiary is the Ministry of Finance.',
    );
    assert.ok(result.contradicted.includes('beneficiaryEntity'));
    assert.equal(
      (memory.beneficiaryEntity as { gapStatus?: string })?.gapStatus,
      'CONTRADICTORY',
    );
  });

  await run('existing ministry is not contradicted by a later audience phrase', () => {
    const memory = createEmptyProjectMemory();
    applyExtractedFacts(memory, [
      {
        fieldId: 'beneficiaryEntity',
        value: 'Ministry of Government Communication',
        confidence: 'high',
      },
    ]);
    const result = applyExtractedFacts(
      memory,
      [{ fieldId: 'beneficiaryEntity', value: 'general public', confidence: 'medium' }],
      'msg-2',
      'The general public are considered external stakeholders or indirect beneficiaries rather than primary users.',
    );
    assert.ok(!result.contradicted.includes('beneficiaryEntity'));
    assert.equal(memory.beneficiaryEntity?.current.value, 'Ministry of Government Communication');
  });

  await run('project name line populates documentTitle', () => {
    const memory = createEmptyProjectMemory();
    const msg =
      'The project name is Development and Implementation of the Civic Records Platform.';
    const facts = normalizeExtractedFacts([], msg);
    applyExtractedFacts(memory, facts, 'msg-title', msg);
    assert.equal(
      memory.documentTitle?.current.value,
      'Development and Implementation of the Civic Records Platform',
    );
  });

  await run('business need language maps to businessNeedRationale when extracted', () => {
    const memory = createEmptyProjectMemory();
    const msg =
      'The ministry requires a centralized internal government platform to organize and improve communication and coordination with media spokespersons.';
    applyExtractedFacts(memory, normalizeExtractedFacts([], msg), 'msg-need', msg);
    assert.ok(String(memory.businessNeedRationale?.current.value).includes('centralized internal'));
  });

  await run('labeled Project Name line and overseeing-authority phrasing are generic', () => {
    const memory = createEmptyProjectMemory();
    const msg = [
      'Project Name: Civic Records Modernization Programme',
      'The overseeing authority is the Department of Public Works.',
      'End users and the general public are not the contracting beneficiary.',
    ].join('\n');
    const facts = normalizeExtractedFacts(
      [
        {
          fieldId: 'beneficiaryEntity',
          value: 'Department of Public Works',
          confidence: 'high',
        },
        { fieldId: 'beneficiaryEntity', value: 'end users', confidence: 'medium' },
      ],
      msg,
    );
    applyExtractedFacts(memory, facts, 'msg-generic', msg);
    assert.equal(memory.documentTitle?.current.value, 'Civic Records Modernization Programme');
    assert.equal(memory.beneficiaryEntity?.current.value, 'Department of Public Works');
    assert.notEqual(
      (memory.beneficiaryEntity as { gapStatus?: string })?.gapStatus,
      'CONTRADICTORY',
    );
  });

  await run('system development language infers engagementType', () => {
    const memory = createEmptyProjectMemory();
    const msg =
      'The RFP type is System Development / Digital Platform Development for an internal coordination platform.';
    const facts = normalizeExtractedFacts(
      [{ fieldId: 'documentType', value: 'system-implementation', confidence: 'high' }],
      msg,
    );
    applyExtractedFacts(memory, facts, 'msg-eng', msg);
    assert.equal(memory.documentType?.current.value, 'system-implementation');
    assert.match(String(memory.engagementType?.current.value ?? ''), /system implementation/i);
  });

  await run('confirmed title + issuer make Cover Page structurally renderable with TBC metadata', () => {
    const memory = createEmptyProjectMemory();
    applyExtractedFacts(memory, [
      { fieldId: 'documentTitle', value: 'Civic Records Platform', confidence: 'high' },
      { fieldId: 'beneficiaryEntity', value: 'Ministry of Interior', confidence: 'high' },
      { fieldId: 'documentType', value: 'system-implementation', confidence: 'high' },
    ]);
    const ctx = systemCtx(memory);
    const cover = getSectionReadiness(memory, 'coverPage', ctx);
    assert.ok(cover.readiness === 'READY_TO_DRAFT' || cover.readiness === 'DRAFTABLE_WITH_TBC');
    const built = buildCoverPageSection(memory);
    const text = blocksText(built);
    assert.match(text, /Civic Records Platform/);
    assert.match(text, /Issued by: TBC/);
    assert.match(text, /Beneficiary: Ministry of Interior/);
    assert.doesNotMatch(text, /Issued by: Ministry of Interior/);
    assert.match(text, /RFP Reference/);
    assert.match(text, /TBC/);
    assert.equal(built.modelUsed, 'structural-deterministic');
    assert.doesNotMatch(text, INTERNAL_GENERATION_PLACEHOLDER_RE);
  });

  await run('business need facts make Background ready without greening every section', () => {
    const memory = createEmptyProjectMemory();
    applyExtractedFacts(memory, [
      { fieldId: 'documentType', value: 'system-implementation', confidence: 'high' },
      { fieldId: 'currentSituation', value: 'Coordination is fragmented across ministries.', confidence: 'high' },
      { fieldId: 'painPoints', value: 'Slow responses and inconsistent messaging.', confidence: 'high' },
      {
        fieldId: 'businessNeedRationale',
        value: 'A centralized platform is required to coordinate official communication.',
        confidence: 'high',
      },
      { fieldId: 'businessObjectives', value: ['Improve coordination speed'], confidence: 'high' },
    ]);
    const ctx = systemCtx(memory);
    const bg = getSectionReadiness(memory, 'background', ctx);
    assert.equal(bg.readiness, 'READY_TO_DRAFT');
    const engagement = getSectionReadiness(memory, 'engagementDefinition', ctx);
    assert.equal(engagement.readiness, 'NOT_READY');
  });

  await run('Introduction needs what / who / why facts, not intro prose or users alone', () => {
    const memory = createEmptyProjectMemory();
    applyExtractedFacts(memory, [
      { fieldId: 'documentType', value: 'system-implementation', confidence: 'high' },
      { fieldId: 'users', value: { internal: ['Spokespersons'], external: [] }, confidence: 'high' },
    ]);
    const ctx = systemCtx(memory);
    const intro = getSectionReadiness(memory, 'introduction', ctx);
    assert.equal(intro.readiness, 'NOT_READY');
    applyExtractedFacts(memory, [
      { fieldId: 'beneficiaryEntity', value: 'Ministry of Interior', confidence: 'high' },
      { fieldId: 'documentTitle', value: 'Interior Coordination Platform', confidence: 'high' },
      {
        fieldId: 'businessNeedRationale',
        value: 'A shared platform is required to coordinate official communication.',
        confidence: 'high',
      },
    ]);
    const intro2 = getSectionReadiness(memory, 'introduction', ctx);
    assert.ok(intro2.readiness === 'READY_TO_DRAFT' || intro2.readiness === 'DRAFTABLE_WITH_TBC');
    assert.ok(!intro2.criticalBlockers.includes('introductionText'));
  });

  await run('scope and functional readiness require their own facts', () => {
    const memory = createEmptyProjectMemory();
    applyExtractedFacts(memory, [
      { fieldId: 'documentType', value: 'system-implementation', confidence: 'high' },
      { fieldId: 'inScope', value: ['Design and implement the platform'], confidence: 'high' },
      { fieldId: 'outOfScope', value: ['Citizen-facing services'], confidence: 'high' },
      { fieldId: 'users', value: { internal: ['Operators'], external: [] }, confidence: 'high' },
      { fieldId: 'functionalModules', value: ['Case intake', 'Reporting'], confidence: 'high' },
      { fieldId: 'keyWorkflows', value: ['Submit topic then review'], confidence: 'high' },
    ]);
    const ctx = systemCtx(memory);
    assert.equal(getSectionReadiness(memory, 'scopeOfWork', ctx).readiness, 'READY_TO_DRAFT');
    assert.equal(
      getSectionReadiness(memory, 'functionalRequirements', ctx).readiness,
      'READY_TO_DRAFT',
    );
  });

  await run('TOC derives from applicable sections without Qwen', () => {
    const toc = buildTableOfContentsSection([
      { sectionId: 'coverPage', title: 'Cover Page' },
      { sectionId: 'tableOfContents', title: 'Table of Contents' },
      { sectionId: 'introduction', title: 'Introduction' },
      { sectionId: 'background', title: 'Background and Business Need' },
    ]);
    const text = blocksText(toc);
    assert.match(text, /Introduction/);
    assert.match(text, /Background and Business Need/);
    assert.doesNotMatch(text, /Cover Page/);
    assert.equal(toc.modelUsed, 'structural-deterministic');
  });

  await run('standard Annex pack is applicable without requiredAnnexes', () => {
    const memory = createEmptyProjectMemory();
    applyExtractedFacts(memory, [
      { fieldId: 'documentType', value: 'system-implementation', confidence: 'high' },
    ]);
    assert.equal(hasAnnexMaterial(memory), false);
    const ctx = systemCtx(memory);
    const sectionCtx = buildApplicabilityContext(memory, ctx);
    assert.equal(sectionCtx.hasAnnexRequirements, false);
    assert.equal(sectionCtx.hasStandardAnnexPack, true);
    const annex = getSectionReadiness(memory, 'annexes', ctx);
    assert.equal(annex.applicable, true);
    assert.ok(annex.readiness === 'READY_TO_DRAFT' || annex.readiness === 'DRAFTABLE_WITH_TBC');
    const built = buildAnnexesSection(memory);
    const text = blocksText(built);
    assert.match(text, /Technical Proposal Response Format/);
    assert.match(text, /Confidentiality Undertaking/);
    assert.match(text, /Sample Agreement/);
    assert.doesNotMatch(text, INTERNAL_GENERATION_PLACEHOLDER_RE);
    assert.equal(built.modelUsed, 'structural-deterministic');
    const toc = buildTableOfContentsSection(
      RFP_SECTIONS.filter((s) => isSectionApplicable(s, sectionCtx)).map((s) => ({
        sectionId: s.sectionId,
        title: s.title,
      })),
    );
    assert.match(blocksText(toc), /Annexes/);
  });

  await run('pre-qualification without extra annexes does not force the standard RFP pack', () => {
    const memory = createEmptyProjectMemory();
    const ctx = {
      ...createEmptyProjectContext(),
      documentStage: 'PRE_QUALIFICATION' as const,
    };
    const annex = getSectionReadiness(memory, 'annexes', ctx);
    assert.equal(annex.applicable, false);
    assert.equal(annex.readiness, 'NOT_APPLICABLE');
  });

  await run('project-specific annexes append and do not duplicate the standard pack', () => {
    const memory = createEmptyProjectMemory();
    applyExtractedFacts(memory, [
      {
        fieldId: 'requiredAnnexes',
        value: ['Process Catalogues', 'Compliance Sheet', 'ARIS Convention Manual'],
        confidence: 'high',
      },
    ]);
    const built = buildAnnexesSection(memory);
    const text = blocksText(built);
    assert.match(text, /Standard annexes/);
    assert.match(text, /Project-specific annexes/);
    assert.match(text, /Process Catalogues/);
    assert.match(text, /ARIS Convention Manual/);
    const extraBlock = built.blocks.find(
      (b) => b.type === 'numbered_list' && b.items.some((i) => /Process Catalogues/i.test(i)),
    );
    assert.ok(extraBlock && extraBlock.type === 'numbered_list');
    assert.ok(!extraBlock.items.some((i) => /compliance sheet/i.test(i)));
  });

  await run('Full RFP / DOCX omit internal generation diagnostic strings', async () => {
    const section: GeneratedSection = {
      sectionId: 'background',
      title: 'Background and Business Need',
      version: 1,
      approvalStatus: 'DRAFT',
      generatedAt: new Date().toISOString(),
      readinessAtGeneration: 'READY_TO_DRAFT',
      modelUsed: 'test-fixture',
      sourceFieldIds: ['currentSituation'],
      tbcFieldIds: [],
      blocks: [
        { type: 'heading', level: 1, text: 'Background and Business Need' },
        { type: 'paragraph', text: 'Confirmed need for a centralized platform.' },
        { type: 'tbc', label: '[To be confirmed] Pain points', fieldId: 'painPoints' },
      ],
    };
    const assembled: AssembledRfp = {
      documentKey: 'fixture-golden',
      projectId: 'fixture',
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
          order: 5,
          applicable: true,
          readiness: 'READY_TO_DRAFT',
          approvalStatus: 'DRAFT',
          generated: section,
          missingGeneration: false,
        },
        {
          sectionId: 'introduction',
          title: 'Introduction',
          order: 4,
          applicable: true,
          readiness: 'NOT_READY',
          approvalStatus: null,
          generated: null,
          missingGeneration: true,
        },
      ],
    };
    const buf = await buildRfpDocxBuffer({
      assembled,
      documentMeta: { documentTitle: 'Civic Records Platform' },
    });
    const xml = extractDocumentXml(buf);
    assert.doesNotMatch(xml, INTERNAL_GENERATION_PLACEHOLDER_RE);
    assert.doesNotMatch(xml, /not yet generated/i);
    assert.match(xml, /Confirmed need for a centralized platform/);
  });

  await run('UI Full RFP view no longer embeds diagnostic placeholders', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../src/components/rfp/RfpDocumentPanel.tsx'),
      'utf8',
    );
    assert.doesNotMatch(src, /not yet generated; information incomplete/);
    assert.match(src, /been drafted yet/);
    assert.match(src, /omitted from this preview/);
    assert.match(src, /Deterministic/);
    assert.match(src, /isStructuralSectionId\(selected\.sectionId\)/);
    assert.match(src, /drafted ·/);
    assert.match(src, /automatic ·/);
  });

  await run('postgres authority: read/apply without beneficiary facts does not clear a stored contradiction', () => {
    const memory = createEmptyProjectMemory();
    applyExtractedFacts(memory, [
      { fieldId: 'beneficiaryEntity', value: 'Agency A', confidence: 'high' },
    ]);
    applyExtractedFacts(memory, [
      { fieldId: 'beneficiaryEntity', value: 'Agency B', confidence: 'high' },
    ]);
    assert.equal((memory.beneficiaryEntity as { gapStatus?: string })?.gapStatus, 'CONTRADICTORY');
    applyExtractedFacts(memory, [{ fieldId: 'documentTitle', value: 'Unrelated title', confidence: 'high' }]);
    assert.equal((memory.beneficiaryEntity as { gapStatus?: string })?.gapStatus, 'CONTRADICTORY');
  });

  await run('postgres authority: hydrate source does not silently reconcile', () => {
    const persistSrc = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../src/server/rami/projectPersistence.ts'),
      'utf8',
    );
    assert.doesNotMatch(persistSrc, /reconcileInvalidContradictions/);
  });

  await run('CASE A software procurement: issuer, beneficiary, users, public stay separate', () => {
    const memory = createEmptyProjectMemory();
    const msg =
      'The RFP is issued by the Ministry of Technology. The beneficiary is the Tax Authority. Internal users are tax officers. The public is an indirect beneficiary but is not a system user.';
    const facts = normalizeExtractedFacts(
      [
        { fieldId: 'beneficiaryEntity', value: 'Tax Authority', confidence: 'high' },
        { fieldId: 'beneficiaryEntity', value: 'Ministry of Technology', confidence: 'high' },
        { fieldId: 'beneficiaryEntity', value: 'the public', confidence: 'medium' },
        {
          fieldId: 'users',
          value: { internal: ['tax officers'], external: ['the public'] },
          confidence: 'medium',
        },
      ],
      msg,
    );
    applyExtractedFacts(memory, facts, 'case-a', msg);
    assert.equal(memory.beneficiaryEntity?.current.value, 'Tax Authority');
    assert.notEqual(
      (memory.beneficiaryEntity as { gapStatus?: string })?.gapStatus,
      'CONTRADICTORY',
    );
    const users = memory.users?.current.value as { internal?: string[]; external?: string[] };
    assert.ok(users?.internal?.some((u) => /tax officers/i.test(u)));
    assert.ok(!(users?.external ?? []).some((u) => /public/i.test(u)));
    const cover = blocksText(buildCoverPageSection(memory));
    assert.match(cover, /Issued by: Ministry of Technology/);
    assert.match(cover, /Beneficiary: Tax Authority/);
    assert.equal(memory.issuerEntity?.current.value, 'Ministry of Technology');
  });

  await run('CASE B consulting: same organization can be beneficiary without self-conflict', () => {
    const memory = createEmptyProjectMemory();
    const msg =
      'The RFP is issued by the Ministry of Health. The beneficiary is the Ministry of Health. Internal users are ministry clinicians.';
    applyExtractedFacts(
      memory,
      normalizeExtractedFacts(
        [
          { fieldId: 'beneficiaryEntity', value: 'Ministry of Health', confidence: 'high' },
          { fieldId: 'beneficiaryEntity', value: 'Ministry of Health', confidence: 'high' },
          {
            fieldId: 'users',
            value: { internal: ['ministry clinicians'], external: [] },
            confidence: 'high',
          },
        ],
        msg,
      ),
      'case-b',
      msg,
    );
    assert.equal(memory.beneficiaryEntity?.current.value, 'Ministry of Health');
    assert.equal(memory.issuerEntity?.current.value, 'Ministry of Health');
    assert.notEqual(
      (memory.beneficiaryEntity as { gapStatus?: string })?.gapStatus,
      'CONTRADICTORY',
    );
    assert.notEqual(
      (memory.issuerEntity as { gapStatus?: string })?.gapStatus,
      'CONTRADICTORY',
    );
    const users = memory.users?.current.value as { internal?: string[] };
    assert.ok(users?.internal?.some((u) => /clinicians/i.test(u)));
  });

  await run('CASE C infrastructure: residents are not system users', () => {
    const memory = createEmptyProjectMemory();
    const msg =
      'The beneficiary is the Water Authority. There are no contractor users. Residents are end beneficiaries of the service, not system users.';
    applyExtractedFacts(
      memory,
      normalizeExtractedFacts(
        [
          { fieldId: 'beneficiaryEntity', value: 'Water Authority', confidence: 'high' },
          { fieldId: 'beneficiaryEntity', value: 'residents', confidence: 'medium' },
          {
            fieldId: 'users',
            value: { internal: [], external: ['residents'] },
            confidence: 'medium',
          },
        ],
        msg,
      ),
      'case-c',
      msg,
    );
    assert.equal(memory.beneficiaryEntity?.current.value, 'Water Authority');
    const users = memory.users?.current.value as { external?: string[] } | undefined;
    assert.ok(!(users?.external ?? []).some((u) => /residents/i.test(u)));
  });

  await run('CASE D system integration project type does not fill commercial or engagement fields', () => {
    const memory = createEmptyProjectMemory();
    const msg =
      'Project type: System Integration. The commercial engagement model is not yet confirmed.';
    applyExtractedFacts(
      memory,
      normalizeExtractedFacts(
        [{ fieldId: 'documentType', value: 'system-implementation', confidence: 'high' }],
        msg,
      ),
      'case-d',
      msg,
    );
    assert.equal(memory.documentType?.current.value, 'system-implementation');
    assert.equal(memory.engagementType, null);
    assert.equal(memory.awardModel, null);
  });

  await run('CASE E true beneficiary conflict Agency A then Agency B', () => {
    const memory = createEmptyProjectMemory();
    applyExtractedFacts(memory, [
      { fieldId: 'beneficiaryEntity', value: 'Agency A', confidence: 'high' },
    ]);
    const result = applyExtractedFacts(memory, [
      { fieldId: 'beneficiaryEntity', value: 'Agency B', confidence: 'high' },
    ]);
    assert.ok(result.contradicted.includes('beneficiaryEntity'));
    const ctx = systemCtx(memory);
    const intro = getSectionReadiness(memory, 'introduction', ctx);
    assert.equal(intro.readiness, 'NOT_READY');
    assert.ok(intro.criticalBlockers.includes('beneficiaryEntity'));
  });

  await run('TBC and REFERENCE do not satisfy Introduction readiness', () => {
    const memory = createEmptyProjectMemory();
    applyExtractedFacts(memory, [
      { fieldId: 'documentType', value: 'system-implementation', confidence: 'high' },
    ]);
    markFieldUnknown(memory, 'beneficiaryEntity');
    const ctx = systemCtx(memory);
    const tbcIntro = getSectionReadiness(memory, 'introduction', ctx);
    assert.notEqual(tbcIntro.readiness, 'READY_TO_DRAFT');
    assert.ok(
      tbcIntro.tbcFields.includes('beneficiaryEntity') ||
        tbcIntro.criticalBlockers.includes('beneficiaryEntity'),
    );
    memory.beneficiaryEntity = createMemoryField(
      'beneficiaryEntity',
      'Agency A',
      'REFERENCE',
      'historical-rag',
    );
    const refIntro = getSectionReadiness(memory, 'introduction', ctx);
    assert.notEqual(refIntro.readiness, 'READY_TO_DRAFT');
    assert.ok(
      refIntro.tbcFields.includes('beneficiaryEntity') ||
        refIntro.criticalBlockers.includes('beneficiaryEntity'),
    );
  });

  await run('Cover Page is built by RAMI from metadata without Qwen', () => {
    const empty = buildCoverPageSection(createEmptyProjectMemory());
    assert.equal(empty.modelUsed, 'structural-deterministic');
    assert.match(blocksText(empty), /Issued by: TBC/);
    assert.match(blocksText(empty), /Beneficiary: TBC/);
    const memory = createEmptyProjectMemory();
    applyExtractedFacts(memory, [
      { fieldId: 'documentTitle', value: 'Tax Systems Modernization', confidence: 'high' },
      { fieldId: 'beneficiaryEntity', value: 'Tax Authority', confidence: 'high' },
      { fieldId: 'documentType', value: 'system-implementation', confidence: 'high' },
    ]);
    const cover = buildCoverPageSection(memory);
    assert.match(blocksText(cover), /Tax Systems Modernization/);
    assert.match(blocksText(cover), /Beneficiary: Tax Authority/);
    assert.doesNotMatch(blocksText(cover), /Issued by: Tax Authority/);
  });

  await run('Introduction generation prompt is RAMI-authored from ProjectFacts', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../src/server/rami/generationPrompt.ts'),
      'utf8',
    );
    assert.match(src, /RAMI-authored narrative/);
    assert.match(src, /Do not ask the BA to supply Introduction prose/);
    assert.doesNotMatch(src, /introductionText/);
    const messages = buildGenerationMessages({
      projectId: 'p',
      documentKey: 'd',
      sectionId: 'introduction',
      title: 'Introduction',
      subsections: [],
      applicable: true,
      readiness: 'READY_TO_DRAFT',
      answeredFacts: [],
      sharedFacts: [],
      tbcFields: [],
      notApplicableFields: [],
      approvedHistoricalReferences: [],
      documentMeta: { documentTitle: 'Example' },
      antiHallucinationRules: ['Use only facts listed in answeredFacts'],
    });
    assert.match(messages[0].content, /RAMI-authored narrative/);
    assert.match(messages[1].content, /professional RFP Introduction/);
  });

  await run('DOCX includes standard Annexes without Qwen', async () => {
    const annex = buildAnnexesSection(createEmptyProjectMemory());
    const assembled: AssembledRfp = {
      documentKey: 'fixture-annex',
      projectId: 'fixture',
      assembledAt: new Date().toISOString(),
      applicableSectionCount: 1,
      generatedApplicableCount: 0,
      structuralPreparedCount: 1,
      approvedApplicableCount: 0,
      complete: false,
      sections: [
        {
          sectionId: 'annexes',
          title: 'Annexes',
          order: 20,
          applicable: true,
          readiness: 'READY_TO_DRAFT',
          approvalStatus: null,
          generated: annex,
          missingGeneration: false,
        },
      ],
    };
    const xml = extractDocumentXml(
      await buildRfpDocxBuffer({ assembled, documentMeta: { documentTitle: 'Civic Platform' } }),
    );
    assert.match(xml, /Technical Proposal Response Format/);
    assert.match(xml, /Confidentiality Undertaking/);
    assert.match(xml, /Standard annex template to be attached to the final RFP package/);
    assert.doesNotMatch(xml, /Complete the attached form/i);
    assert.doesNotMatch(xml, /issued with this RFP/i);
    assert.doesNotMatch(xml, INTERNAL_GENERATION_PLACEHOLDER_RE);
  });

  await run('multi-domain Cover / Introduction / Annex structure is generic', () => {
    const scenarios = [
      {
        title: 'Tax Filing Portal',
        type: 'system-implementation',
        beneficiary: 'Tax Authority',
        need: 'Officers need a single case-working platform.',
      },
      {
        title: 'Health Process Review',
        type: 'consulting',
        beneficiary: 'Ministry of Health',
        need: 'The ministry requires an independent process assessment.',
      },
      {
        title: 'Regional Water Network Upgrade',
        type: 'connectivity-telecom',
        beneficiary: 'Water Authority',
        need: 'Network telemetry must be modernized for distribution reliability.',
      },
      {
        title: 'Legacy System Integration',
        type: 'system-implementation',
        beneficiary: 'Customs Authority',
        need: 'Existing registers must be connected through a shared integration layer.',
      },
    ];
    for (const s of scenarios) {
      const memory = createEmptyProjectMemory();
      applyExtractedFacts(memory, [
        { fieldId: 'documentTitle', value: s.title, confidence: 'high' },
        { fieldId: 'documentType', value: s.type, confidence: 'high' },
        { fieldId: 'beneficiaryEntity', value: s.beneficiary, confidence: 'high' },
        { fieldId: 'businessNeedRationale', value: s.need, confidence: 'high' },
      ]);
      const ctx = systemCtx(memory);
      const cover = blocksText(buildCoverPageSection(memory));
      assert.match(cover, new RegExp(s.title));
      assert.match(cover, /Issued by: TBC/);
      const intro = getSectionReadiness(memory, 'introduction', ctx);
      assert.ok(intro.readiness === 'READY_TO_DRAFT' || intro.readiness === 'DRAFTABLE_WITH_TBC');
      const annex = getSectionReadiness(memory, 'annexes', ctx);
      assert.equal(annex.applicable, true);
      const annexText = blocksText(buildAnnexesSection(memory));
      for (const item of STANDARD_ANNEX_PACK) {
        assert.match(annexText, new RegExp(item.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
      assert.match(annexText, /Standard annex template to be attached to the final RFP package/);
      assert.doesNotMatch(annexText, /Complete the attached form/i);
      assert.doesNotMatch(annexText, /issued with this RFP/i);
      assert.doesNotMatch(annexText, /Bidders shall complete/i);
    }
  });

  await run('standard annex captions do not claim a nonexistent attachment', () => {
    assert.equal(STANDARD_ANNEX_TEMPLATE_FILES_AVAILABLE, false);
    const built = blocksText(buildAnnexesSection(createEmptyProjectMemory()));
    assert.match(built, new RegExp(STANDARD_ANNEX_PLACEHOLDER));
    assert.doesNotMatch(built, /Complete the attached form/i);
    assert.doesNotMatch(built, /issued with this RFP/i);
    assert.doesNotMatch(built, /Bidders shall complete the issued forms/i);
    const withFile = standardAnnexItemCaption(STANDARD_ANNEX_PACK[0], true);
    assert.match(withFile, new RegExp(STANDARD_ANNEX_ATTACHED_CAPTION));
    const withoutFile = standardAnnexItemCaption(STANDARD_ANNEX_PACK[0], false);
    assert.match(withoutFile, new RegExp(STANDARD_ANNEX_PLACEHOLDER));
    assert.doesNotMatch(withoutFile, /Complete the attached form/i);
  });

  await run('deterministic Cover/TOC/Annexes do not inflate AI drafted count', () => {
    const cover = buildCoverPageSection(createEmptyProjectMemory());
    const toc = buildTableOfContentsSection([
      { sectionId: 'introduction', title: 'Introduction' },
    ]);
    const annex = buildAnnexesSection(createEmptyProjectMemory());
    const progress = summarizeAssembledSectionProgress([
      {
        sectionId: 'coverPage',
        title: 'Cover Page',
        order: 1,
        applicable: true,
        readiness: 'DRAFTABLE_WITH_TBC',
        approvalStatus: null,
        generated: cover,
        missingGeneration: false,
      },
      {
        sectionId: 'tableOfContents',
        title: 'Table of Contents',
        order: 2,
        applicable: true,
        readiness: 'READY_TO_DRAFT',
        approvalStatus: null,
        generated: toc,
        missingGeneration: false,
      },
      {
        sectionId: 'annexes',
        title: 'Annexes',
        order: 20,
        applicable: true,
        readiness: 'READY_TO_DRAFT',
        approvalStatus: null,
        generated: annex,
        missingGeneration: false,
      },
      {
        sectionId: 'background',
        title: 'Background and Business Need',
        order: 5,
        applicable: true,
        readiness: 'READY_TO_DRAFT',
        approvalStatus: 'DRAFT',
        generated: {
          ...cover,
          sectionId: 'background',
          title: 'Background and Business Need',
          modelUsed: 'qwen-test',
        },
        missingGeneration: false,
      },
    ]);
    assert.equal(progress.generatedApplicableCount, 1);
    assert.equal(progress.structuralPreparedCount, 3);
    assert.equal(progress.approvedApplicableCount, 0);
  });

  await run('issuer/beneficiary CASE A: distinct issuer and beneficiary print on Cover', () => {
    const memory = createEmptyProjectMemory();
    const msg =
      'This RFP is issued by the Ministry of Technology. The beneficiary is the Tax Authority.';
    applyExtractedFacts(
      memory,
      normalizeExtractedFacts(
        [
          { fieldId: 'beneficiaryEntity', value: 'Tax Authority', confidence: 'high' },
          { fieldId: 'issuerEntity', value: 'Ministry of Technology', confidence: 'high' },
        ],
        msg,
      ),
      'issuer-a',
      msg,
    );
    assert.equal(memory.issuerEntity?.current.value, 'Ministry of Technology');
    assert.equal(memory.beneficiaryEntity?.current.value, 'Tax Authority');
    assert.notEqual(
      (memory.issuerEntity as { gapStatus?: string })?.gapStatus,
      'CONTRADICTORY',
    );
    const cover = blocksText(buildCoverPageSection(memory));
    assert.match(cover, /Issued by: Ministry of Technology/);
    assert.match(cover, /Beneficiary: Tax Authority/);
    const ctx = systemCtx(memory);
    const readiness = getSectionReadiness(memory, 'coverPage', ctx);
    assert.notEqual(readiness.readiness, 'NOT_READY');
  });

  await run('issuer/beneficiary CASE B: same organization in both fields is not a conflict', () => {
    const memory = createEmptyProjectMemory();
    const msg =
      'The RFP is issued by the Ministry of Health. The beneficiary is the Ministry of Health.';
    applyExtractedFacts(
      memory,
      normalizeExtractedFacts(
        [
          { fieldId: 'issuerEntity', value: 'Ministry of Health', confidence: 'high' },
          { fieldId: 'beneficiaryEntity', value: 'Ministry of Health', confidence: 'high' },
        ],
        msg,
      ),
      'issuer-b',
      msg,
    );
    assert.equal(memory.issuerEntity?.current.value, 'Ministry of Health');
    assert.equal(memory.beneficiaryEntity?.current.value, 'Ministry of Health');
    assert.notEqual(
      (memory.issuerEntity as { gapStatus?: string })?.gapStatus,
      'CONTRADICTORY',
    );
    assert.notEqual(
      (memory.beneficiaryEntity as { gapStatus?: string })?.gapStatus,
      'CONTRADICTORY',
    );
    const cover = blocksText(buildCoverPageSection(memory));
    assert.match(cover, /Issued by: Ministry of Health/);
    assert.match(cover, /Beneficiary: Ministry of Health/);
  });

  await run('issuer/beneficiary CASE C: beneficiary only leaves issuer TBC on Cover', () => {
    const memory = createEmptyProjectMemory();
    const msg = 'The beneficiary is the Tax Authority.';
    applyExtractedFacts(
      memory,
      normalizeExtractedFacts(
        [{ fieldId: 'beneficiaryEntity', value: 'Tax Authority', confidence: 'high' }],
        msg,
      ),
      'issuer-c',
      msg,
    );
    assert.equal(memory.beneficiaryEntity?.current.value, 'Tax Authority');
    assert.equal(memory.issuerEntity, null);
    const cover = blocksText(buildCoverPageSection(memory));
    assert.match(cover, /Issued by: TBC/);
    assert.match(cover, /Beneficiary: Tax Authority/);
    const ctx = systemCtx(memory);
    assert.notEqual(getSectionReadiness(memory, 'coverPage', ctx).readiness, 'NOT_READY');
  });

  await run('issuer/beneficiary CASE D: issuer only does not fill beneficiary', () => {
    const memory = createEmptyProjectMemory();
    const msg = 'The procuring entity is the Ministry of Finance.';
    applyExtractedFacts(
      memory,
      normalizeExtractedFacts(
        [{ fieldId: 'issuerEntity', value: 'Ministry of Finance', confidence: 'high' }],
        msg,
      ),
      'issuer-d',
      msg,
    );
    assert.equal(memory.issuerEntity?.current.value, 'Ministry of Finance');
    assert.equal(memory.beneficiaryEntity, null);
    const cover = blocksText(buildCoverPageSection(memory));
    assert.match(cover, /Issued by: Ministry of Finance/);
    assert.match(cover, /Beneficiary: TBC/);
  });

  await run('issuer/beneficiary CASE E: issuer A then B does not touch beneficiary', () => {
    const memory = createEmptyProjectMemory();
    applyExtractedFacts(memory, [
      { fieldId: 'beneficiaryEntity', value: 'Tax Authority', confidence: 'high' },
      { fieldId: 'issuerEntity', value: 'Agency A', confidence: 'high' },
    ]);
    const overwritten = applyExtractedFacts(
      memory,
      [
        {
          fieldId: 'issuerEntity',
          value: 'Agency B',
          confidence: 'high',
          updateKind: 'correction',
        },
      ],
      'issuer-e',
      'Actually the issuer is Agency B',
    );
    assert.ok(overwritten.corrected.includes('issuerEntity'));
    assert.ok(!overwritten.contradicted.includes('beneficiaryEntity'));
    assert.ok(!overwritten.corrected.includes('beneficiaryEntity'));
    assert.equal(memory.issuerEntity?.current.value, 'Agency B');
    assert.equal(memory.beneficiaryEntity?.current.value, 'Tax Authority');
    assert.notEqual(
      (memory.beneficiaryEntity as { gapStatus?: string })?.gapStatus,
      'CONTRADICTORY',
    );

    const conflicted = createEmptyProjectMemory();
    applyExtractedFacts(conflicted, [
      { fieldId: 'beneficiaryEntity', value: 'Tax Authority', confidence: 'high' },
      { fieldId: 'issuerEntity', value: 'Agency A', confidence: 'high' },
    ]);
    const conflictResult = applyExtractedFacts(
      conflicted,
      [
        {
          fieldId: 'issuerEntity',
          value: 'Agency B',
          confidence: 'high',
          updateKind: 'conflict',
        },
      ],
      'issuer-e-conflict',
      'The document says Agency A but the annex says Agency B',
    );
    assert.ok(conflictResult.contradicted.includes('issuerEntity'));
    assert.ok(!conflictResult.contradicted.includes('beneficiaryEntity'));
    assert.equal(conflicted.beneficiaryEntity?.current.value, 'Tax Authority');
    assert.equal((conflicted.issuerEntity as { gapStatus?: string })?.gapStatus, 'CONTRADICTORY');
  });

  await run('issuer language maps from BA phrasing without filling the other field', () => {
    const issued = createEmptyProjectMemory();
    const issuedMsg = 'This RFP is issued by the Ministry of Technology.';
    applyExtractedFacts(issued, normalizeExtractedFacts([], issuedMsg), 'phrase-issued', issuedMsg);
    assert.equal(issued.issuerEntity?.current.value, 'Ministry of Technology');
    assert.equal(issued.beneficiaryEntity, null);

    const behalf = createEmptyProjectMemory();
    const behalfMsg =
      'The Ministry of Finance is issuing the RFP on behalf of the Tax Authority.';
    applyExtractedFacts(behalf, normalizeExtractedFacts([], behalfMsg), 'phrase-behalf', behalfMsg);
    assert.equal(behalf.issuerEntity?.current.value, 'Ministry of Finance');
    assert.equal(behalf.beneficiaryEntity?.current.value, 'Tax Authority');
  });

  await run('production normalizer contains no project-specific names', () => {
    const files = [
      '../src/server/rami/extractedFactNormalize.ts',
      '../src/server/rami/factValueGuards.ts',
      '../src/server/rami/structuralSections.ts',
      '../src/server/rami/memoryUpdater.ts',
      '../src/schema/standardAnnexPack.ts',
      '../src/server/rami/sectionReadiness.ts',
      '../src/server/rami/generationPrompt.ts',
    ];
    const root = dirname(fileURLToPath(import.meta.url));
    for (const rel of files) {
      const src = readFileSync(join(root, rel), 'utf8');
      assert.doesNotMatch(src, /Natiq/i);
      assert.doesNotMatch(src, /Ministry of Government Communication/i);
    }
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
