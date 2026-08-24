/**
 * JSON Schema and prompt for structured fact extraction from BA messages.
 * Authority: .private-context/analysis/question-information-mapping.md
 *
 * The extraction call is separate from the conversational response call.
 * It uses temperature=0 for determinism.
 *
 * IMPORTANT: The schema only asks the model to extract facts EXPLICITLY stated
 * or clearly implied in the message. It must NOT fabricate absent information.
 */

import { CANONICAL_FIELD_IDS } from '@/schema/projectMemoryFields';

/** JSON Schema for the structured extraction output. */
export const EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    extractedFacts: {
      type: 'array',
      description: 'Facts explicitly stated or clearly implied in the BA message. Only include fields you are confident about.',
      items: {
        type: 'object',
        properties: {
          fieldId: {
            type: 'string',
            description: 'One of the canonical field IDs listed in the system context',
          },
          value: {
            description: 'The extracted value. Use a string for simple values, array for lists.',
          },
          confidence: {
            type: 'string',
            enum: ['high', 'medium'],
            description: 'high = explicitly stated; medium = clearly implied',
          },
        },
        required: ['fieldId', 'value', 'confidence'],
      },
    },
    rfpIntentSignal: {
      type: 'string',
      enum: ['CREATE_RFP', 'POSSIBLE', 'NONE'],
      description: 'Whether the message clearly indicates intent to create an RFP',
    },
    internalContext: {
      type: 'string',
      description: 'Brief one-sentence summary of what was discussed, to inform the next response',
    },
  },
  required: ['extractedFacts', 'rfpIntentSignal'],
} as const;

/** Build the extraction system message describing canonical field IDs. */
export function buildExtractionSystemPrompt(): string {
  const fieldList = Array.from(CANONICAL_FIELD_IDS).join(', ');
  return `/no_think
You are a structured information extraction engine for an RFP preparation system.

Extract ONLY facts that are explicitly stated or clearly implied in the Business Analyst's message.
Do NOT infer, assume, or fabricate any information not present in the message.
Do NOT extract partial or uncertain values — omit them entirely.

CANONICAL FIELD IDs you may use (use these exact strings):
${fieldList}

FIELD GUIDANCE:
- documentType: one of system-implementation, framework-agreement, consulting, assessment, support, connectivity-telecom
- Values for list fields (inScope, businessObjectives, etc.) should be arrays of concise strings
- For simple text fields, use a plain string value
- beneficiaryEntity: the ministry or government entity name
- engagementDuration: e.g. "12 months", "2 years"
- evaluationWeights: e.g. "70/30 technical/financial"

Only return fieldIds from the list above. Do not invent new field names.
If no facts were extractable, return an empty extractedFacts array.`.trim();
}

/** Validate that an extracted fieldId is canonical. */
export function isValidFieldId(fieldId: string): boolean {
  return CANONICAL_FIELD_IDS.has(fieldId);
}
