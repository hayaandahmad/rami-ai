/**
 * Deterministic historical knowledge chunk builder.
 * Source of truth: historical_question_answers (+ documents). No LLM chunking.
 */

import { createHash } from 'crypto';
import { QUESTION_SEEDS } from '@/schema/questionBankSeed';
import type { HistoricalQuestionAnswer, HistoricalRfpDocument } from '@/types/historicalRfp';
import type { HistoricalChunkType, HistoricalKnowledgeChunk } from '@/types/historicalRag';

const Q_SECTION = new Map(QUESTION_SEEDS.map((q) => [q.questionId, q.sectionId]));

const PROCUREMENT_TOPIC_PATTERNS: Array<{ topicKey: string; re: RegExp }> = [
  { topicKey: 'procurementStage', re: /pre-?qualification|\bPQ\b|procurement stage|stage\s*1/i },
  { topicKey: 'awardModelAndSupplierCount', re: /award|top\s*\d|number of (bidders|suppliers|winners)/i },
  { topicKey: 'callOffOrSowProcess', re: /call-?off|\bSOW\b|work order|assignment/i },
  { topicKey: 'namedKeyPersonnelRequirements', re: /key personnel|project manager|\bPMP\b|staff roles|\bCV\b/i },
  { topicKey: 'clarificationContact', re: /clarification|enquir|contact person/i },
  { topicKey: 'submissionChannel', re: /JONEPS|e-?procurement|submission portal|submit proposal/i },
  { topicKey: 'governanceCadence', re: /steering committee|governance|progress report|\bPMO\b/i },
  { topicKey: 'knowledgeTransferRequirements', re: /knowledge transfer|training of trainers|handover/i },
];

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function stableChunkId(parts: string[]): string {
  return sha256(parts.join('|')).slice(0, 40);
}

function uniq(xs: string[]): string[] {
  return [...new Set(xs.filter(Boolean))];
}

function formatQa(a: HistoricalQuestionAnswer): string {
  const qid = a.canonicalQuestionId || a.sourceQuestionId;
  return [
    `Question ${qid}: ${a.exactQuestionText}`,
    `Status: ${a.extractionStatus}`,
    `Answer: ${a.answerText}`,
    a.sourceLocator ? `Source: ${a.sourceLocator}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildBase(
  doc: HistoricalRfpDocument,
  partial: Omit<
    HistoricalKnowledgeChunk,
    | 'excelRelPath'
    | 'excelSha256'
    | 'pdfAvailable'
    | 'provenanceClass'
    | 'contentHash'
    | 'chunkId'
  > & { chunkIdParts: string[]; contentHashSource: string },
): HistoricalKnowledgeChunk {
  const contentHash = sha256(partial.contentHashSource);
  const chunkId = stableChunkId([...partial.chunkIdParts, contentHash]);
  return {
    chunkId,
    historicalRfpId: doc.historicalRfpId,
    chunkType: partial.chunkType,
    chunkText: partial.chunkText,
    contentHash,
    sourceSheet: partial.sourceSheet,
    sourceRows: partial.sourceRows,
    sourceAnswerIds: partial.sourceAnswerIds,
    sourceQuestionIds: partial.sourceQuestionIds,
    canonicalQuestionIds: partial.canonicalQuestionIds,
    mappedFieldIds: partial.mappedFieldIds,
    sectionIds: partial.sectionIds,
    extractionStatuses: partial.extractionStatuses,
    sourceLocators: partial.sourceLocators,
    excelRelPath: doc.excelRelPath,
    excelSha256: doc.excelSha256,
    pdfAvailable: doc.hasPdf,
    provenanceClass: 'REFERENCE',
    topicKey: partial.topicKey,
    metadata: partial.metadata,
  };
}

function qaChunk(
  doc: HistoricalRfpDocument,
  a: HistoricalQuestionAnswer,
): HistoricalKnowledgeChunk {
  const sectionIds = a.canonicalQuestionId
    ? [Q_SECTION.get(a.canonicalQuestionId)].filter(Boolean) as string[]
    : [];
  const text = formatQa(a);
  return buildBase(doc, {
    chunkType: 'QUESTION_ANSWER',
    chunkText: text,
    sourceSheet: a.sourceSheet,
    sourceRows: a.sourceRow != null ? [a.sourceRow] : [],
    sourceAnswerIds: [a.answerId],
    sourceQuestionIds: [a.sourceQuestionId],
    canonicalQuestionIds: a.canonicalQuestionId ? [a.canonicalQuestionId] : [],
    mappedFieldIds: a.mappedFieldIds,
    sectionIds,
    extractionStatuses: [a.extractionStatus],
    sourceLocators: a.sourceLocator ? [a.sourceLocator] : [],
    topicKey: a.isCanonical ? `canonical:${a.canonicalQuestionId}` : `suggested:${a.sourceQuestionId}`,
    metadata: {
      isCanonical: a.isCanonical,
      answerId: a.answerId,
    },
    chunkIdParts: ['qa', doc.historicalRfpId, a.answerId],
    contentHashSource: text,
  });
}

/** Soft target for SECTION / MULTI_QA_TOPIC body size before splitting. */
const GROUP_CHUNK_SOFT_MAX = 4500;

function partitionAnswersBySize(
  answers: HistoricalQuestionAnswer[],
  softMax = GROUP_CHUNK_SOFT_MAX,
): HistoricalQuestionAnswer[][] {
  if (answers.length === 0) return [];
  const parts: HistoricalQuestionAnswer[][] = [];
  let cur: HistoricalQuestionAnswer[] = [];
  let curLen = 0;
  for (const a of answers) {
    const len = formatQa(a).length + 12;
    if (cur.length > 0 && curLen + len > softMax) {
      parts.push(cur);
      cur = [];
      curLen = 0;
    }
    cur.push(a);
    curLen += len;
  }
  if (cur.length) parts.push(cur);
  return parts;
}

function sectionChunk(
  doc: HistoricalRfpDocument,
  sectionId: string,
  answers: HistoricalQuestionAnswer[],
  partIndex: number,
  partCount: number,
): HistoricalKnowledgeChunk | null {
  if (answers.length === 0) return null;
  const body = answers.map(formatQa).join('\n\n---\n\n');
  const partLabel = partCount > 1 ? ` (part ${partIndex + 1}/${partCount})` : '';
  const text = `Section: ${sectionId}${partLabel}\nHistorical RFP: ${doc.title}\n\n${body}`;
  const partKey = partCount > 1 ? `:p${partIndex + 1}` : '';
  return buildBase(doc, {
    chunkType: 'SECTION',
    chunkText: text,
    sourceSheet: 'Rami Q&A',
    sourceRows: answers.map((a) => a.sourceRow).filter((n): n is number => n != null),
    sourceAnswerIds: answers.map((a) => a.answerId),
    sourceQuestionIds: answers.map((a) => a.sourceQuestionId),
    canonicalQuestionIds: uniq(
      answers.map((a) => a.canonicalQuestionId || '').filter(Boolean),
    ),
    mappedFieldIds: uniq(answers.flatMap((a) => a.mappedFieldIds)),
    sectionIds: [sectionId],
    extractionStatuses: uniq(answers.map((a) => a.extractionStatus)),
    sourceLocators: uniq(
      answers.map((a) => a.sourceLocator || '').filter(Boolean),
    ),
    topicKey: `section:${sectionId}`,
    metadata: { sectionId, answerCount: answers.length, partIndex, partCount },
    chunkIdParts: ['section', doc.historicalRfpId, sectionId + partKey],
    contentHashSource: text,
  });
}

function multiTopicChunk(
  doc: HistoricalRfpDocument,
  topicKey: string,
  answers: HistoricalQuestionAnswer[],
  partIndex: number,
  partCount: number,
): HistoricalKnowledgeChunk | null {
  if (answers.length === 0) return null;
  const body = answers.map(formatQa).join('\n\n---\n\n');
  const partLabel = partCount > 1 ? ` (part ${partIndex + 1}/${partCount})` : '';
  const text = `Topic: ${topicKey}${partLabel}\nHistorical RFP: ${doc.title}\n\n${body}`;
  const sectionIds = uniq(
    answers
      .map((a) => (a.canonicalQuestionId ? Q_SECTION.get(a.canonicalQuestionId) : undefined))
      .filter((s): s is string => Boolean(s)),
  );
  const partKey = partCount > 1 ? `:p${partIndex + 1}` : '';
  return buildBase(doc, {
    chunkType: 'MULTI_QA_TOPIC',
    chunkText: text,
    sourceSheet: answers[0]?.sourceSheet ?? null,
    sourceRows: answers.map((a) => a.sourceRow).filter((n): n is number => n != null),
    sourceAnswerIds: answers.map((a) => a.answerId),
    sourceQuestionIds: answers.map((a) => a.sourceQuestionId),
    canonicalQuestionIds: uniq(
      answers.map((a) => a.canonicalQuestionId || '').filter(Boolean),
    ),
    mappedFieldIds: uniq(answers.flatMap((a) => a.mappedFieldIds)),
    sectionIds,
    extractionStatuses: uniq(answers.map((a) => a.extractionStatus)),
    sourceLocators: uniq(
      answers.map((a) => a.sourceLocator || '').filter(Boolean),
    ),
    topicKey,
    metadata: { topicKey, answerCount: answers.length, partIndex, partCount },
    chunkIdParts: ['topic', doc.historicalRfpId, topicKey + partKey],
    contentHashSource: text,
  });
}

function suggestedPackKey(sourceQuestionId: string): string | null {
  const m = /^(\d+)\./.exec(sourceQuestionId);
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 13) return null;
  return `suggested_pack:${n}`;
}

/**
 * Build all chunks for one historical RFP from its answers.
 */
export function buildChunksForDocument(
  doc: HistoricalRfpDocument,
  answers: HistoricalQuestionAnswer[],
): HistoricalKnowledgeChunk[] {
  const chunks: HistoricalKnowledgeChunk[] = [];

  // A. QUESTION_ANSWER
  for (const a of answers) {
    chunks.push(qaChunk(doc, a));
  }

  // B. SECTION — canonical answers grouped by Question Bank section
  const bySection = new Map<string, HistoricalQuestionAnswer[]>();
  for (const a of answers.filter((x) => x.isCanonical && x.canonicalQuestionId)) {
    const sid = Q_SECTION.get(a.canonicalQuestionId!);
    if (!sid) continue;
    if (!bySection.has(sid)) bySection.set(sid, []);
    bySection.get(sid)!.push(a);
  }
  for (const [sectionId, group] of bySection) {
    const parts = partitionAnswersBySize(group);
    parts.forEach((part, i) => {
      const c = sectionChunk(doc, sectionId, part, i, parts.length);
      if (c) chunks.push(c);
    });
  }

  // C. MULTI_QA_TOPIC — suggested packs 13.x+
  const byPack = new Map<string, HistoricalQuestionAnswer[]>();
  for (const a of answers.filter((x) => !x.isCanonical)) {
    const key = suggestedPackKey(a.sourceQuestionId);
    if (!key) continue;
    if (!byPack.has(key)) byPack.set(key, []);
    byPack.get(key)!.push(a);
  }
  for (const [topicKey, group] of byPack) {
    const parts = partitionAnswersBySize(group);
    parts.forEach((part, i) => {
      const c = multiTopicChunk(doc, topicKey, part, i, parts.length);
      if (c) chunks.push(c);
    });
  }

  // C2. MULTI_QA_TOPIC — procurement/gap themes across answers in this RFP
  for (const { topicKey, re } of PROCUREMENT_TOPIC_PATTERNS) {
    const group = answers.filter((a) => re.test(`${a.exactQuestionText}\n${a.answerText}`));
    if (group.length < 2) continue;
    const parts = partitionAnswersBySize(group);
    parts.forEach((part, i) => {
      const c = multiTopicChunk(doc, `gap:${topicKey}`, part, i, parts.length);
      if (c) chunks.push(c);
    });
  }

  return chunks;
}

export function summarizeChunkSizes(chunks: HistoricalKnowledgeChunk[]): {
  total: number;
  byType: Record<string, number>;
  avgLen: number;
  medianLen: number;
  minLen: number;
  maxLen: number;
  tinyCount: number;
  largeCount: number;
} {
  const lens = chunks.map((c) => c.chunkText.length).sort((a, b) => a - b);
  const byType: Record<string, number> = {};
  for (const c of chunks) byType[c.chunkType] = (byType[c.chunkType] ?? 0) + 1;
  const sum = lens.reduce((s, n) => s + n, 0);
  return {
    total: chunks.length,
    byType,
    avgLen: chunks.length ? Math.round(sum / chunks.length) : 0,
    medianLen: lens[Math.floor(lens.length / 2)] ?? 0,
    minLen: lens[0] ?? 0,
    maxLen: lens[lens.length - 1] ?? 0,
    tinyCount: lens.filter((n) => n < 40).length,
    largeCount: lens.filter((n) => n > 8000).length,
  };
}

export type { HistoricalChunkType };
