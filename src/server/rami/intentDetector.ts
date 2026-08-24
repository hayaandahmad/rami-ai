/**
 * RFP intent detection — deterministic rules + extraction signal.
 * Decides when to transition from plain chat to the RFP split workspace.
 */

import type { ProjectMemory } from '@/types/projectMemory';
import type { RfpIntent } from '@/types/conversation';

/**
 * Determine the current RFP intent from:
 * 1. What the LLM extraction signal returned (from the user's message)
 * 2. What is already present in ProjectMemory
 *
 * Transition rules:
 * - NONE → POSSIBLE: extraction signals POSSIBLE or we have weak signals
 * - POSSIBLE → CREATE_RFP: explicit intent + at least one key field (documentType or documentTitle)
 * - NONE/POSSIBLE → CREATE_RFP: strong extraction signal directly
 * - CREATE_RFP: never downgraded (once in RFP mode, stay there)
 */
export function detectIntent(
  currentIntent: RfpIntent,
  extractionSignal: RfpIntent,
  memory: ProjectMemory,
): RfpIntent {
  // Once confirmed, never downgrade
  if (currentIntent === 'CREATE_RFP') return 'CREATE_RFP';

  // Strong explicit signal from extraction
  if (extractionSignal === 'CREATE_RFP') {
    return 'CREATE_RFP';
  }

  // Check memory for confirmed RFP signals
  const hasDocumentType = !!memory.documentType?.current?.value;
  const hasDocumentTitle = !!memory.documentTitle?.current?.value;
  const hasBeneficiary = !!memory.beneficiaryEntity?.current?.value;
  const hasBackground = !!memory.currentSituation?.current?.value;

  const strongSignalCount = [hasDocumentType, hasDocumentTitle, hasBeneficiary].filter(Boolean).length;
  const hasAnySignal = strongSignalCount > 0 || hasBackground;

  if (strongSignalCount >= 2) return 'CREATE_RFP';
  if (strongSignalCount >= 1 && extractionSignal === 'POSSIBLE') return 'CREATE_RFP';
  if (hasAnySignal || extractionSignal === 'POSSIBLE') return 'POSSIBLE';

  return currentIntent;
}

/** Returns true if the intent is strong enough to show the split workspace. */
export function shouldShowSplitWorkspace(intent: RfpIntent): boolean {
  return intent === 'CREATE_RFP';
}
