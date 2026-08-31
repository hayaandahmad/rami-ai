/**
 * Organization-level standard RFP annex pack.
 *
 * Derived from the historical RFP corpus (structured Q 11.3 answers) plus
 * GeneralTemplate's candidate annex checklist. This is template structure,
 * not current-project truth and not RAG retrieval.
 *
 * Exact titles, numbering, and form bodies are NOT identical across RFPs.
 * This pack keeps only the recurring *forms family* as titles + generic
 * placeholders. Project-specific annexes stay on `requiredAnnexes`.
 *
 * The repository does not currently store reusable annex form files.
 * Captions must not imply that a form is already attached.
 */

export interface StandardAnnexItem {
  id: string;
  title: string;
  /** Short role note — never claim a file is attached. */
  purpose: string;
  /** Match keys used to detect the same annex under variant historical titles. */
  matchKeys: string[];
}

/** Flip only when real annex template files are stored with the RFP package. */
export const STANDARD_ANNEX_TEMPLATE_FILES_AVAILABLE = false;

export const STANDARD_ANNEX_PLACEHOLDER =
  'Standard annex template to be attached to the final RFP package.';

export const STANDARD_ANNEX_ATTACHED_CAPTION = 'Complete the attached form.';

/**
 * Canonical standard annex titles, in a stable generic order.
 * Content is never copied from a named historical project.
 */
export const STANDARD_ANNEX_PACK: readonly StandardAnnexItem[] = [
  {
    id: 'technical-proposal-response-format',
    title: 'Technical Proposal Response Format',
    purpose: STANDARD_ANNEX_PLACEHOLDER,
    matchKeys: [
      'technical proposal response format',
      'technical proposal forms',
      'technical response format',
      'technical and financial response format',
    ],
  },
  {
    id: 'financial-proposal-response-format',
    title: 'Financial Proposal Response Format',
    purpose: `${STANDARD_ANNEX_PLACEHOLDER} Do not include prices in the technical proposal.`,
    matchKeys: [
      'financial proposal response format',
      'financial proposal forms',
      'financial response format',
      'financial compliance sheet',
      'technical and financial response format',
    ],
  },
  {
    id: 'compliance-sheet',
    title: 'Compliance Sheet',
    purpose: STANDARD_ANNEX_PLACEHOLDER,
    matchKeys: [
      'compliance sheet',
      'solution compliance matrix',
      'mandatory compliance matrix',
      'compliance matrix',
    ],
  },
  {
    id: 'confidentiality-undertaking',
    title: 'Confidentiality Undertaking',
    purpose: STANDARD_ANNEX_PLACEHOLDER,
    matchKeys: ['confidentiality undertaking'],
  },
  {
    id: 'joint-venture-agreement',
    title: 'Joint Venture Agreement',
    purpose: `${STANDARD_ANNEX_PLACEHOLDER} Include only when the bid is submitted as a joint venture; otherwise not applicable.`,
    matchKeys: ['joint venture agreement', 'jv agreement', 'jv template'],
  },
  {
    id: 'sample-agreement',
    title: 'Sample Agreement',
    purpose: STANDARD_ANNEX_PLACEHOLDER,
    matchKeys: [
      'sample arabic agreement',
      'sample framework agreement',
      'sample agreement',
    ],
  },
  {
    id: 'key-rfp-dates',
    title: 'Key RFP Dates and Deadlines',
    purpose: `${STANDARD_ANNEX_PLACEHOLDER} Unknown dates remain TBC.`,
    matchKeys: ['key rfp dates', 'key rfp dates and deadlines'],
  },
] as const;

/** Stages that are not a standard RFP package (PQ/RFI evidence differs). */
const NON_STANDARD_RFP_STAGES = new Set([
  'PRE_QUALIFICATION',
  'RFI',
  'MARKET_SOUNDING',
]);

export function isStandardAnnexPackApplicable(documentStage?: string): boolean {
  const stage = (documentStage ?? '').trim().toUpperCase();
  if (!stage || stage === 'UNDETERMINED') return true;
  return !NON_STANDARD_RFP_STAGES.has(stage);
}

export function normalizeAnnexTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\bannex(ure)?s?\b/g, ' ')
    .replace(/\b\d+(\.\d+)*\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchStandardAnnexItem(title: string): StandardAnnexItem | null {
  const normalized = normalizeAnnexTitle(title);
  if (!normalized) return null;
  for (const item of STANDARD_ANNEX_PACK) {
    if (item.matchKeys.some((key) => normalized === key || normalized.includes(key))) {
      return item;
    }
  }
  return null;
}

export function standardAnnexHitsInText(text: string): string[] {
  const normalized = normalizeAnnexTitle(text);
  if (!normalized) return [];
  return STANDARD_ANNEX_PACK.filter((item) =>
    item.matchKeys.some((key) => normalized.includes(key)),
  ).map((item) => item.id);
}

export function listProjectSpecificAnnexTitles(raw: unknown): string[] {
  const items: string[] = [];
  if (raw == null) return items;
  if (Array.isArray(raw)) {
    for (const v of raw) {
      const s = String(v).trim();
      if (s) items.push(s);
    }
  } else if (typeof raw === 'string') {
    for (const part of raw.split(/[;\n]/)) {
      const s = part.trim().replace(/^[-•]\s*/, '');
      if (s) items.push(s);
    }
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const title of items) {
    const key = normalizeAnnexTitle(title);
    if (!key || seen.has(key)) continue;
    if (matchStandardAnnexItem(title)) continue;
    seen.add(key);
    out.push(title);
  }
  return out;
}

export function standardAnnexItemCaption(
  item: StandardAnnexItem,
  filesAvailable: boolean = STANDARD_ANNEX_TEMPLATE_FILES_AVAILABLE,
): string {
  if (filesAvailable) {
    return `${item.title} — ${STANDARD_ANNEX_ATTACHED_CAPTION}`;
  }
  return `${item.title} — ${item.purpose}`;
}
