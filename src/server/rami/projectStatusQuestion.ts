/**
 * Detect BA questions about project status / missing information.
 * Deterministic phrasing patterns — not an LLM classifier, not exact-string-only.
 */

import {
  extractBeneficiaryEntityFromMessage,
  extractIssuerEntityFromMessage,
} from '@/server/rami/factValueGuards';

const STATUS_PATTERNS: RegExp[] = [
  /\bwhat(?:'s|s| is) still missing\b/i,
  /\bwhat(?:'s|s| is) missing\b/i,
  /\bwhat information (?:is|are) missing\b/i,
  /\bwhat(?:'s|s)? (?:still )?incomplete\b/i,
  /\bwhat remains incomplete\b/i,
  /\bwhat remains\b/i,
  /\bwhat(?:'s|s| is) left (?:to (?:do|provide|answer|collect))?\b/i,
  /\bwhat do (?:you|we) (?:still )?(?:need|require)(?: from me)?\b/i,
  /\bwhat do you need now\b/i,
  /\bwhat (?:information|details) do you (?:still )?(?:need|require)(?: from me)?\b/i,
  /\bwhat should i (?:answer|provide|give|tell you) next\b/i,
  /\bwhat i (?:still )?need to (?:answer|provide|give|tell you) next\b/i,
  /\bwhat should we (?:do|cover|collect) next\b/i,
  /\bwhere are we now\b/i,
  /\bwhere (?:we|i|you) stand\b/i,
  /\bwhat(?:'s|s| is) (?:the )?(?:current )?(?:status|progress)\b/i,
  /\bwhat sections are (?:ready|done|complete|prepared)\b/i,
  /\bwhat do we still need(?: for the rfp)?\b/i,
  /\bwhat(?:'s|s| is) still needed\b/i,
  /\b(?:remaining gaps|gap analysis|what (?:are )?the (?:remaining )?gaps)\b/i,
  /\bwhat is incomplete\b/i,
  /\bما(?:ذا)? (?:ينقص|ناقص|المتبقي|المطلوب)\b/,
  /\bوين صرنا\b/,
  /\bشو ناقص\b/,
];

const ASSERTION_PATTERNS: RegExp[] = [
  /\b(?:the\s+)?[\w][\w\s/&-]{1,40}\s+(?:is|are|was|were|will be|equals?|lasts?|takes?)\s+\S+/i,
  /\b\d+\s*(?:months?|years?|weeks?|days?|hours?)\b/i,
  /\b(?:duration|deadline|title|beneficiary|issuer|scope|budget)\s*(?:is|:)\b/i,
  /\bissued by\b/i,
];

export type StatusMessageKind = 'none' | 'pure_status' | 'mixed_status_and_facts';

function withGlobalFlag(pattern: RegExp): RegExp {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return new RegExp(pattern.source, flags);
}

/** Remove status-question phrasing so leftover text can be checked for facts. */
export function stripStatusQuestionSpans(message: string): string {
  let out = message;
  for (const pattern of STATUS_PATTERNS) {
    out = out.replace(withGlobalFlag(pattern), ' ');
  }
  out = out.replace(/[^.!?]*\?/g, ' ');
  out = out.replace(
    /\b(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:tell me|say|explain|show me|let me know)\b/gi,
    ' ',
  );
  out = out.replace(/\bplease\b/gi, ' ');
  out = out.replace(/\b(?:also|additionally)\b/gi, ' ');
  return out.replace(/[\s,;:]+/g, ' ').trim();
}

/**
 * True when the message contains a declarative project-fact assertion
 * in addition to (or instead of) a status question. Generic — not field-id lists.
 */
export function messageHasFactualAssertion(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  if (extractBeneficiaryEntityFromMessage(text) || extractIssuerEntityFromMessage(text)) {
    return true;
  }
  const remainder = stripStatusQuestionSpans(text);
  if (remainder.length < 8) return false;
  return ASSERTION_PATTERNS.some((re) => re.test(remainder));
}

/**
 * True when the BA is asking for project-status / missing-information
 * (whether or not the same message also supplies facts).
 */
export function isProjectStatusQuestion(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return STATUS_PATTERNS.some((re) => re.test(text));
}

export function classifyStatusMessage(message: string): StatusMessageKind {
  if (!isProjectStatusQuestion(message)) return 'none';
  return messageHasFactualAssertion(message) ? 'mixed_status_and_facts' : 'pure_status';
}

export function isPureStatusQuestion(message: string): boolean {
  return classifyStatusMessage(message) === 'pure_status';
}
