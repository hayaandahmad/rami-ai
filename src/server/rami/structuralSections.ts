/**
 * Deterministic / derived RFP sections — TypeScript owns structure.
 * Qwen is not called. Unknown metadata renders as TBC, never invented.
 */

import type { ProjectMemory } from '@/types/projectMemory';
import type { GeneratedBlock, GeneratedSection } from '@/types/generatedSection';
import { getRfpSection, isStructuralSectionId as schemaIsStructuralSectionId } from '@/schema/rfpSchema';
import { classifySpokenNotApplicable, classifySpokenUnknown } from '@/server/rami/spokenTbc';
import {
  STANDARD_ANNEX_PACK,
  STANDARD_ANNEX_PLACEHOLDER,
  listProjectSpecificAnnexTitles,
  standardAnnexItemCaption,
} from '@/schema/standardAnnexPack';

export const DETERMINISTIC_SECTION_IDS = new Set(['coverPage', 'tableOfContents', 'annexes']);
export const DERIVED_SECTION_IDS = new Set(['abbreviations']);

/** Internal UI/DOCX diagnostic strings that must not appear in document body. */
export const INTERNAL_GENERATION_PLACEHOLDER_RE =
  /\[.+ — not yet generated(?:; information incomplete)?\]/;

export function isStructuralSectionId(sectionId: string): boolean {
  return schemaIsStructuralSectionId(sectionId);
}

function bag(memory: ProjectMemory, fieldId: string) {
  const raw = (memory as unknown as Record<string, unknown>)[fieldId];
  if (!raw || typeof raw !== 'object') return null;
  return raw as {
    current?: { value?: unknown; status?: string };
    gapStatus?: string;
  };
}

export function memoryFieldDisplay(memory: ProjectMemory, fieldId: string): {
  text: string | null;
  isTbc: boolean;
} {
  const field = bag(memory, fieldId);
  const value = field?.current?.value;
  if (field?.gapStatus === 'NOT_APPLICABLE') return { text: null, isTbc: false };
  if (
    field?.gapStatus === 'UNKNOWN' ||
    field?.gapStatus === 'DEFERRED' ||
    field?.current?.status === 'TBC' ||
    classifySpokenUnknown(value) !== null
  ) {
    return { text: null, isTbc: true };
  }
  if (value == null) return { text: null, isTbc: true };
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return { text: null, isTbc: true };
    return { text: t, isTbc: false };
  }
  if (Array.isArray(value)) {
    const items = value.map((v) => String(v).trim()).filter(Boolean);
    if (!items.length) return { text: null, isTbc: true };
    return { text: items.join(', '), isTbc: false };
  }
  return { text: String(value), isTbc: false };
}

function metaLine(label: string, display: { text: string | null; isTbc: boolean }): GeneratedBlock[] {
  if (display.text) {
    return [{ type: 'paragraph', text: `${label}: ${display.text}` }];
  }
  return [{ type: 'paragraph', text: `${label}: TBC` }];
}

export function buildCoverPageSection(memory: ProjectMemory): GeneratedSection {
  const section = getRfpSection('coverPage')!;
  const title = memoryFieldDisplay(memory, 'documentTitle');
  const issuer = memoryFieldDisplay(memory, 'issuerEntity');
  const beneficiary = memoryFieldDisplay(memory, 'beneficiaryEntity');
  const docType = memoryFieldDisplay(memory, 'documentType');
  const tender = memoryFieldDisplay(memory, 'tenderNumber');
  const deadline = memoryFieldDisplay(memory, 'proposalDeadline');

  const blocks: GeneratedBlock[] = [
    { type: 'heading', level: 1, text: 'REQUEST FOR PROPOSAL' },
    title.text
      ? { type: 'heading', level: 2, text: title.text }
      : { type: 'paragraph', text: 'Project title: TBC' },
    ...metaLine('Issued by', issuer),
    ...metaLine('Beneficiary', beneficiary),
    ...metaLine('Project type', docType),
    ...metaLine('RFP Reference', tender),
    { type: 'paragraph', text: 'Issue Date: TBC' },
    ...metaLine('Proposal Submission Deadline', deadline),
  ];

  const coverFields = [
    'documentTitle',
    'issuerEntity',
    'beneficiaryEntity',
    'documentType',
    'tenderNumber',
    'proposalDeadline',
  ];
  const sourceFieldIds = coverFields.filter((id) => memoryFieldDisplay(memory, id).text);
  const tbcFieldIds = coverFields.filter((id) => !memoryFieldDisplay(memory, id).text);

  return makeSection('coverPage', section.title, blocks, sourceFieldIds, tbcFieldIds);
}

export function buildTableOfContentsSection(
  entries: Array<{ sectionId: string; title: string }>,
): GeneratedSection {
  const section = getRfpSection('tableOfContents')!;
  const items = entries
    .filter((e) => e.sectionId !== 'coverPage' && e.sectionId !== 'tableOfContents')
    .map((e) => e.title);
  const blocks: GeneratedBlock[] = [
    { type: 'heading', level: 1, text: section.title },
    items.length
      ? { type: 'numbered_list', items }
      : { type: 'paragraph', text: 'No applicable sections to list yet.' },
  ];
  return makeSection('tableOfContents', section.title, blocks, [], []);
}

const GENERIC_ACRONYMS = new Set([
  'RFP',
  'TBC',
  'TBD',
  'AND',
  'THE',
  'FOR',
  'OF',
  'TO',
  'OR',
  'A',
  'AN',
  'NA',
  'N/A',
  'PDF',
  'DOC',
  'URL',
  'API',
  'ID',
]);

export function deriveAbbreviationEntries(memory: ProjectMemory): Array<{ term: string; meaning: string }> {
  const blobs: string[] = [];
  for (const key of Object.keys(memory as object)) {
    const display = memoryFieldDisplay(memory, key);
    if (display.text) blobs.push(display.text);
  }
  const text = blobs.join('\n');
  const found = new Map<string, string>();
  const expanded = /\b([A-Z]{2,8})\b(?:\s*\(([^)]{3,80})\)|\s+[–-]\s+([^.\n]{3,80}))/g;
  let m: RegExpExecArray | null;
  while ((m = expanded.exec(text))) {
    const term = m[1];
    if (GENERIC_ACRONYMS.has(term)) continue;
    const meaning = (m[2] || m[3] || '').trim();
    if (meaning) found.set(term, meaning);
  }
  return [...found.entries()].map(([term, meaning]) => ({ term, meaning }));
}

export function hasDerivedGlossary(memory: ProjectMemory): boolean {
  return deriveAbbreviationEntries(memory).length > 0;
}

export function buildAbbreviationsSection(memory: ProjectMemory): GeneratedSection | null {
  const entries = deriveAbbreviationEntries(memory);
  if (!entries.length) return null;
  const section = getRfpSection('abbreviations')!;
  const blocks: GeneratedBlock[] = [
    { type: 'heading', level: 1, text: section.title },
    {
      type: 'table',
      headers: ['Term', 'Definition'],
      rows: entries.map((e) => [e.term, e.meaning]),
    },
  ];
  return makeSection('abbreviations', section.title, blocks, [], []);
}

export function hasAnnexMaterial(memory: ProjectMemory): boolean {
  const field = bag(memory, 'requiredAnnexes');
  if (!field?.current) return false;
  if (field.gapStatus === 'NOT_APPLICABLE') return false;
  const value = field.current.value;
  if (classifySpokenNotApplicable(value) || classifySpokenUnknown(value)) return false;
  if (value == null) return false;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    if (!s || s === 'none' || s === 'n/a' || s === 'not applicable' || s === 'no annexes') {
      return false;
    }
    return listProjectSpecificAnnexTitles(value).length > 0;
  }
  if (Array.isArray(value)) return listProjectSpecificAnnexTitles(value).length > 0;
  return true;
}

function annexDatesLine(memory: ProjectMemory): string {
  const tender = memoryFieldDisplay(memory, 'tenderNumber');
  const deadline = memoryFieldDisplay(memory, 'proposalDeadline');
  return [
    `RFP reference: ${tender.text ?? 'TBC'}`,
    `Proposal submission deadline: ${deadline.text ?? 'TBC'}`,
    'Issue date: TBC',
  ].join('. ') + '.';
}

export function buildAnnexesSection(memory: ProjectMemory): GeneratedSection {
  const section = getRfpSection('annexes')!;
  const extras = hasAnnexMaterial(memory)
    ? listProjectSpecificAnnexTitles(bag(memory, 'requiredAnnexes')?.current?.value)
    : [];
  const tbcFieldIds: string[] = [];
  const sourceFieldIds: string[] = [];
  const tender = memoryFieldDisplay(memory, 'tenderNumber');
  const deadline = memoryFieldDisplay(memory, 'proposalDeadline');
  if (tender.text) sourceFieldIds.push('tenderNumber');
  else tbcFieldIds.push('tenderNumber');
  if (deadline.text) sourceFieldIds.push('proposalDeadline');
  else tbcFieldIds.push('proposalDeadline');
  if (extras.length) sourceFieldIds.push('requiredAnnexes');

  const standardItems = STANDARD_ANNEX_PACK.map((item) => {
    const caption = standardAnnexItemCaption(item);
    if (item.id === 'key-rfp-dates') {
      return `${caption} ${annexDatesLine(memory)}`;
    }
    return caption;
  });

  const blocks: GeneratedBlock[] = [
    { type: 'heading', level: 1, text: section.title },
    {
      type: 'paragraph',
      text: `The following standard annexes belong in this RFP pack. ${STANDARD_ANNEX_PLACEHOLDER} Form bodies are not reproduced in this draft.`,
    },
    { type: 'heading', level: 2, text: 'Standard annexes' },
    { type: 'numbered_list', items: standardItems },
  ];

  if (extras.length) {
    blocks.push({ type: 'heading', level: 2, text: 'Project-specific annexes' });
    blocks.push({
      type: 'numbered_list',
      items: extras.map((title) => title),
    });
  }

  return makeSection('annexes', section.title, blocks, sourceFieldIds, tbcFieldIds);
}

function makeSection(
  sectionId: string,
  title: string,
  blocks: GeneratedBlock[],
  sourceFieldIds: string[],
  tbcFieldIds: string[],
): GeneratedSection {
  return {
    sectionId,
    title,
    version: 1,
    approvalStatus: 'DRAFT',
    generatedAt: new Date().toISOString(),
    readinessAtGeneration: tbcFieldIds.length ? 'DRAFTABLE_WITH_TBC' : 'READY_TO_DRAFT',
    modelUsed: 'structural-deterministic',
    blocks,
    sourceFieldIds,
    tbcFieldIds,
  };
}

export function buildStructuralSection(input: {
  sectionId: string;
  memory: ProjectMemory;
  tocEntries: Array<{ sectionId: string; title: string }>;
}): GeneratedSection | null {
  if (input.sectionId === 'coverPage') return buildCoverPageSection(input.memory);
  if (input.sectionId === 'tableOfContents') {
    return buildTableOfContentsSection(input.tocEntries);
  }
  if (input.sectionId === 'abbreviations') return buildAbbreviationsSection(input.memory);
  if (input.sectionId === 'annexes') return buildAnnexesSection(input.memory);
  return null;
}
