/**
 * Deterministic spoken-TBC / unknown / deferral classification.
 * Whole-value only — never substring-match letters "TBC" inside real answers.
 */

export type SpokenUnknownKind = 'unknown' | 'deferred';

const UNKNOWN_PHRASES = new Set([
  'tbc',
  'tbd',
  'to be confirmed',
  'to be determined',
  'not confirmed yet',
  'not yet confirmed',
  'keep it tbc',
  'keep this tbc',
  'keep it as tbc',
  'we dont know',
  'we dont know yet',
  'we do not know',
  'we do not know yet',
  'i dont know',
  'i dont know yet',
  'i do not know',
  'i do not know yet',
  'unknown',
  'still unknown',
  'not known',
  'not yet known',
  'pending confirmation',
  'not confirmed',
]);

const DEFERRED_PHRASES = new Set([
  'later',
  'defer to later',
  'deferred to later',
  'deferred to later stage',
  'later stage',
  'belongs to a later stage',
  'later in the sow',
  'defer to sow',
  'to be confirmed later',
  'tbc later',
  'deferred to later stage',
]);

/** Normalize a candidate phrase: trim, lowercase, strip wrappers, collapse space. */
export function normalizeSpokenPhrase(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[\[("']+|[\])"']+$/g, '')
    .replace(/[’']/g, '')
    .replace(/[.,;:!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyNormalizedPhrase(normalized: string): SpokenUnknownKind | null {
  if (!normalized) return null;
  if (DEFERRED_PHRASES.has(normalized)) return 'deferred';
  if (UNKNOWN_PHRASES.has(normalized)) return 'unknown';
  return null;
}

/**
 * True only when the *entire* extracted value is a not-yet-known / deferral
 * statement. "The TBC committee will review" is a real answer and must pass.
 */
export function classifySpokenUnknown(value: unknown): SpokenUnknownKind | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean' || typeof value === 'number') return null;

  if (typeof value === 'string') {
    return classifyNormalizedPhrase(normalizeSpokenPhrase(value));
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const kinds = value.map((item) => classifySpokenUnknown(item));
    if (kinds.some((k) => k === null)) return null;
    if (kinds.some((k) => k === 'deferred')) return 'deferred';
    return 'unknown';
  }

  return null;
}

export function isSpokenUnknownValue(value: unknown): boolean {
  return classifySpokenUnknown(value) !== null;
}
