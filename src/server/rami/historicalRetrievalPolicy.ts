/**
 * Deterministic historical retrieval policy for live RAMI.
 * TypeScript chooses when/how to retrieve — not the LLM.
 */

import { PROJECT_MEMORY_FIELDS } from '@/schema/projectMemoryFields';
import { RFP_SECTIONS } from '@/schema/rfpSchema';
import type { GapAnalysis } from '@/types/conversation';
import type { RetrievalMode } from '@/types/historicalRag';

export type HistoricalRetrievalTrigger =
  | 'explicit_example_request'
  | 'explicit_past_rfp_request'
  | 'explicit_suggest_from_history'
  | 'ba_guidance_with_unresolved_field'
  | 'none';

export interface HistoricalRetrievalPolicyResult {
  shouldRetrieve: boolean;
  trigger: HistoricalRetrievalTrigger;
  mode: Exclude<RetrievalMode, 'vector'> | 'none';
  reason: string;
  query: string;
  fieldIds: string[];
  sectionIds: string[];
  questionIds: string[];
  topK: number;
}

const EXPLICIT_EXAMPLE =
  /\b(examples?|sample|similar (requirements?|rfps?)|show (me )?(an? )?(example|reference)|what did (previous|past|other) rfps?|historical (example|reference|rfp)|based on past rfps?|from (previous|past|other) (rfps?|projects?)|suggest .+ (from|based on) (past|previous|historical))\b/i;

const EXPLICIT_SUGGEST =
  /\b(suggest|propose|recommendation).{0,40}\b(past|previous|historical|prior)\b|\b(past|previous|historical).{0,40}\b(suggest|propose)\b/i;

const GUIDANCE_UNKNOWN =
  /\b(i don'?t know|not sure|unsure|no idea|tbc|to be confirmed|what (do|would) you (suggest|recommend)|any guidance|help me (decide|fill)|give me (an? )?(idea|example))\b/i;

const FIELD_ALIASES: Array<{ re: RegExp; fieldIds: string[]; sectionIds?: string[] }> = [
  {
    re: /\b(scope|in[- ]?scope|out[- ]?of[- ]?scope)\b/i,
    fieldIds: ['inScope', 'outOfScope'],
    sectionIds: ['scopeOfWork'],
  },
  {
    re: /\b(deliverables?|reports?|artefacts?|artifacts?)\b/i,
    fieldIds: ['deliverableItems', 'deliverableFormats'],
    sectionIds: ['deliverables'],
  },
  {
    re: /\b(sla|support|maintenance|response time)\b/i,
    fieldIds: ['supportPeriodAndHours', 'slaTiers'],
    sectionIds: ['supportMaintenance'],
  },
  {
    re: /\b(evaluation|scoring|weights?)\b/i,
    fieldIds: ['evaluationWeights', 'evaluationRules'],
    sectionIds: ['evaluationCriteria'],
  },
  {
    re: /\b(governance|steering|progress report|pmo)\b/i,
    fieldIds: ['engagementPhases'],
    sectionIds: ['projectApproach'],
  },
  {
    re: /\b(knowledge transfer|training of trainers|handover)\b/i,
    fieldIds: ['trainingApproach'],
    sectionIds: ['trainingChange'],
  },
  {
    re: /\b(submission|joneps|e-?procurement)\b/i,
    fieldIds: ['proposalDeadline'],
    sectionIds: ['administrative'],
  },
  {
    re: /\b(clarification|enquir)\b/i,
    fieldIds: ['proposalDeadline'],
    sectionIds: ['administrative'],
  },
];

function detectMentionedFields(message: string): { fieldIds: string[]; sectionIds: string[] } {
  const fieldIds: string[] = [];
  const sectionIds: string[] = [];
  for (const a of FIELD_ALIASES) {
    if (a.re.test(message)) {
      fieldIds.push(...a.fieldIds);
      if (a.sectionIds) sectionIds.push(...a.sectionIds);
    }
  }
  // Exact field labels / ids
  for (const f of PROJECT_MEMORY_FIELDS) {
    if (message.toLowerCase().includes(f.fieldId.toLowerCase())) fieldIds.push(f.fieldId);
    if (message.toLowerCase().includes(f.label.toLowerCase()) && f.label.length > 4) {
      fieldIds.push(f.fieldId);
    }
  }
  for (const s of RFP_SECTIONS) {
    if (message.toLowerCase().includes(s.sectionId.toLowerCase())) sectionIds.push(s.sectionId);
  }
  return {
    fieldIds: [...new Set(fieldIds)],
    sectionIds: [...new Set(sectionIds)],
  };
}

function unresolvedFieldIds(gaps: GapAnalysis | null | undefined): string[] {
  if (!gaps?.fieldGaps) return [];
  return gaps.fieldGaps
    .filter((g) => g.gapStatus === 'MISSING' || g.gapStatus === 'UNKNOWN')
    .map((g) => g.fieldId);
}

/**
 * Decide whether to retrieve and which mode to use.
 * Missing fields alone NEVER trigger retrieval.
 */
export function evaluateHistoricalRetrievalPolicy(input: {
  userMessage: string;
  gaps?: GapAnalysis | null;
  /** Optional explicit field focus from UI / NextAction */
  focusFieldIds?: string[];
  focusSectionIds?: string[];
}): HistoricalRetrievalPolicyResult {
  const msg = input.userMessage.trim();
  const mentioned = detectMentionedFields(msg);
  const focusFields = [
    ...new Set([...(input.focusFieldIds ?? []), ...mentioned.fieldIds]),
  ];
  const focusSections = [
    ...new Set([...(input.focusSectionIds ?? []), ...mentioned.sectionIds]),
  ];
  const unresolved = unresolvedFieldIds(input.gaps);

  // Prefer gap primary when guidance + unresolved
  if (
    input.gaps?.nextAction.type === 'ASK_REQUIREMENTS' &&
    GUIDANCE_UNKNOWN.test(msg) &&
    !EXPLICIT_EXAMPLE.test(msg)
  ) {
    const primary = input.gaps.nextAction.primaryFieldId;
    if (!focusFields.includes(primary)) focusFields.push(primary);
  }

  let trigger: HistoricalRetrievalTrigger = 'none';
  if (EXPLICIT_SUGGEST.test(msg) || /\bsuggest something based on past\b/i.test(msg)) {
    trigger = 'explicit_suggest_from_history';
  } else if (EXPLICIT_EXAMPLE.test(msg)) {
    trigger =
      /\b(previous|past|other|historical)\s+rfps?\b/i.test(msg)
        ? 'explicit_past_rfp_request'
        : 'explicit_example_request';
  } else if (GUIDANCE_UNKNOWN.test(msg) && (focusFields.length > 0 || unresolved.length > 0)) {
    // Only when BA asks for guidance AND we have a field focus — not bare "I don't know" alone without context
    const hasFocus = focusFields.length > 0 || input.gaps?.nextAction.type === 'ASK_REQUIREMENTS';
    trigger = hasFocus ? 'ba_guidance_with_unresolved_field' : 'none';
  }

  if (trigger === 'none') {
    return {
      shouldRetrieve: false,
      trigger: 'none',
      mode: 'none',
      reason: 'No explicit historical/example/guidance trigger — do not retrieve',
      query: msg,
      fieldIds: [],
      sectionIds: [],
      questionIds: [],
      topK: 0,
    };
  }

  // Mode routing from evaluation: structured-first when canonical IDs known
  const hasCanonicalIds = focusFields.length > 0 || focusSections.length > 0;
  const mode: 'structured' | 'hybrid' = hasCanonicalIds ? 'structured' : 'hybrid';

  // If structured but only section/field known, keep structured; hybrid for free-text
  const reason = hasCanonicalIds
    ? 'Canonical Field/Section IDs known — structured-first (stronger MRR in eval)'
    : 'Free-text historical request without strong IDs — hybrid retrieval';

  const query =
    focusFields.length > 0
      ? `${msg} [fields: ${focusFields.slice(0, 4).join(', ')}]`
      : msg;

  return {
    shouldRetrieve: true,
    trigger,
    mode,
    reason,
    query,
    fieldIds: focusFields.slice(0, 6),
    sectionIds: focusSections.slice(0, 4),
    questionIds: [],
    topK: 5,
  };
}

/** Choose mode only (helper for docs/tests). */
export function chooseHistoricalRetrievalMode(context: {
  fieldIds?: string[];
  sectionIds?: string[];
  questionIds?: string[];
}): 'structured' | 'hybrid' {
  if (
    (context.fieldIds?.length ?? 0) > 0 ||
    (context.sectionIds?.length ?? 0) > 0 ||
    (context.questionIds?.length ?? 0) > 0
  ) {
    return 'structured';
  }
  return 'hybrid';
}
