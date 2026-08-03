/**
 * Normalizes whitespace and casing for reliable follow-up trigger comparison.
 * Matches the spec requirement to normalize whitespace and case before comparing.
 */
export function normalizeForTriggerMatch(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Returns true when an answer matches the defined follow-up trigger string.
 */
export function matchesFollowUpTrigger(answer: string, triggerMatch: string): boolean {
  return normalizeForTriggerMatch(answer) === normalizeForTriggerMatch(triggerMatch);
}
