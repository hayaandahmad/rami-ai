/**
 * Deterministic leakage checks: historical example values must not appear
 * as current project truth unless independently present in ProjectFacts.
 */

import type { GenerationHistoricalReference } from '@/types/generationReference';
import type { GeneratedBlock, SectionGenerationContext } from '@/types/generatedSection';
import { TBC_MARKER_PREFIX } from '@/types/generatedSection';

const NUMBERISH =
  /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:%|percent|months?|years?|days?|hours?|JD|JOD|USD|suppliers?|bidders?|staff|FTE|CVs?)\b|\b\d+(?:\.\d+)?%/gi;

const COMMON_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'this',
  'that',
  'project',
  'ministry',
  'department',
  'system',
  'service',
  'services',
  'deliverable',
  'deliverables',
  'report',
  'reports',
  'requirements',
  'section',
  'scope',
  'work',
  'modee',
  'jordan',
  'government',
  'rfp',
  'tender',
]);

export function extractNumberishTokens(text: string): string[] {
  const out: string[] = [];
  const re = new RegExp(NUMBERISH.source, NUMBERISH.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const t = m[0].replace(/\s+/g, ' ').trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

export function extractNameishTokens(text: string): string[] {
  const out: string[] = [];
  const phrases =
    text.match(
      /\b[A-Z][A-Za-z0-9&'-]{1,}(?:\s+(?:of|the|and|for|de|al|wa|[A-Z][A-Za-z0-9&'-]{1,})){1,6}\b/g,
    ) ?? [];
  const caps = text.match(/\b[A-Z]{4,}(?:\s+[A-Z]{2,}){0,4}\b/g) ?? [];
  for (const p of [...phrases, ...caps]) {
    const norm = p.trim();
    if (norm.length < 4) continue;
    if (!out.includes(norm)) out.push(norm);
  }
  return out;
}

function factAllowlist(ctx: SectionGenerationContext): string {
  return JSON.stringify({
    answered: ctx.answeredFacts.map((f) => f.value),
    shared: ctx.sharedFacts.map((f) => f.value),
    meta: ctx.documentMeta,
  }).toLowerCase();
}

export function leakedHistoricalTokens(
  ctx: SectionGenerationContext,
  historical: GenerationHistoricalReference[],
): { numbers: string[]; names: string[] } {
  const allow = factAllowlist(ctx);
  const numbers = new Set<string>();
  const names = new Set<string>();
  for (const ref of historical) {
    const blob = `${ref.excerpt}\n${ref.historicalRfpTitle}`;
    for (const n of extractNumberishTokens(blob)) {
      if (!allow.includes(n.toLowerCase())) numbers.add(n);
    }
    for (const name of extractNameishTokens(blob)) {
      const parts = name.toLowerCase().split(/\s+/);
      if (parts.every((p) => COMMON_WORDS.has(p))) continue;
      if (!allow.includes(name.toLowerCase())) names.add(name);
    }
    const title = ref.historicalRfpTitle?.trim();
    if (title && title.length > 8 && !allow.includes(title.toLowerCase())) names.add(title);
  }
  return { numbers: [...numbers], names: [...names] };
}

function blockText(b: GeneratedBlock): string {
  if (b.type === 'heading' || b.type === 'paragraph') return b.text;
  if (b.type === 'tbc') return b.label;
  if (b.type === 'bullet_list' || b.type === 'numbered_list') return b.items.join('\n');
  if (b.type === 'table') return [...b.headers, ...b.rows.flat()].join('\n');
  return '';
}

function replaceToken(text: string, token: string): string {
  if (!token) return text;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, 'gi'), TBC_MARKER_PREFIX);
}

function rewriteBlock(b: GeneratedBlock, tokens: string[]): GeneratedBlock {
  const apply = (s: string) => tokens.reduce((acc, t) => replaceToken(acc, t), s);
  if (b.type === 'heading' || b.type === 'paragraph') return { ...b, text: apply(b.text) };
  if (b.type === 'tbc') return { ...b, label: apply(b.label) };
  if (b.type === 'bullet_list' || b.type === 'numbered_list') {
    return { ...b, items: b.items.map(apply) };
  }
  if (b.type === 'table') {
    return {
      ...b,
      headers: b.headers.map(apply),
      rows: b.rows.map((row) => row.map(apply)),
    };
  }
  return b;
}

function tokenAppears(hay: string, token: string): boolean {
  if (!token) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, 'i').test(hay);
}

export function findLeakageInBlocks(
  blocks: GeneratedBlock[],
  leaked: { numbers: string[]; names: string[] },
): string[] {
  const hay = blocks.map(blockText).join('\n');
  const hits: string[] = [];
  for (const t of [...leaked.numbers, ...leaked.names]) {
    if (tokenAppears(hay, t)) hits.push(t);
  }
  return hits;
}

/**
 * Replace leaked historical numbers/names that are not in current facts.
 * Conservative: only tokens extracted from approved historical excerpts.
 */
export function sanitizeHistoricalLeakage(
  blocks: GeneratedBlock[],
  ctx: SectionGenerationContext,
): { blocks: GeneratedBlock[]; removedTokens: string[] } {
  const leaked = leakedHistoricalTokens(ctx, ctx.approvedHistoricalReferences);
  const hits = findLeakageInBlocks(blocks, leaked);
  if (hits.length === 0) return { blocks, removedTokens: [] };
  return {
    blocks: blocks.map((b) => rewriteBlock(b, hits)),
    removedTokens: hits,
  };
}

export function ngramOverlapRatio(a: string, b: string, n = 5): number {
  const grams = (s: string) => {
    const words = s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    const out = new Set<string>();
    for (let i = 0; i <= words.length - n; i++) out.add(words.slice(i, i + n).join(' '));
    return out;
  };
  const A = grams(a);
  const B = grams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / Math.min(A.size, B.size);
}
