/**
 * JSON Schema and prompt for structured fact extraction from BA messages.
 * Phase 2.2: adds classifier signals + updateKind; does NOT choose NextAction.
 */

import { CANONICAL_FIELD_IDS } from '@/schema/projectMemoryFields';

/** Optional classifier / conflict signals from extraction (LLM → TypeScript). */
export interface ExtractionSignals {
  documentStageSignal?: string;
  granularitySignal?: string;
  domainSignals?: string[];
  deferredStatements?: Array<{ topic: string; deferredTo: string }>;
  unknownFields?: string[];
  conflictCandidates?: Array<{ fieldId: string; values: unknown[] }>;
}

export const EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    extractedFacts: {
      type: 'array',
      description:
        'Facts explicitly stated or clearly implied in the BA message. Only include fields you are confident about.',
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
          updateKind: {
            type: 'string',
            enum: ['assert', 'correction', 'conflict'],
            description:
              'assert = new/normal fact; correction = BA supersedes prior value (actually/make that); conflict = competing simultaneous values/sources',
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
    documentStageSignal: {
      type: 'string',
      description:
        'If clearly stated: RFI | MARKET_SOUNDING | PRE_QUALIFICATION | FULL_RFP | FRAMEWORK_QUALIFICATION | SOW_OR_CALL_OFF | CONTRACT_OR_AWARD. Else omit.',
    },
    granularitySignal: {
      type: 'string',
      description: 'If clearly stated: SINGLE_PROJECT | FRAMEWORK | ASSIGNMENT. Else omit.',
    },
    domainSignals: {
      type: 'array',
      items: { type: 'string' },
      description: 'Domain hints if stated (consulting, BPR, system-implementation, etc.)',
    },
    unknownFields: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Canonical fieldIds the BA said they do not know yet / TBC / not confirmed. Do NOT put a fake value in extractedFacts for these.',
    },
    deferredStatements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          deferredTo: { type: 'string' },
        },
      },
      description: 'Topics the BA says belong to a later stage/SOW',
    },
    conflictCandidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fieldId: { type: 'string' },
          values: { type: 'array' },
        },
      },
      description: 'When the BA presents two competing values for the same fact',
    },
    internalContext: {
      type: 'string',
      description: 'Brief one-sentence summary of what was discussed',
    },
  },
  required: ['extractedFacts', 'rfpIntentSignal'],
} as const;

export function buildExtractionSystemPrompt(): string {
  const fieldList = Array.from(CANONICAL_FIELD_IDS).join(', ');
  return `/no_think
You are a structured information extraction engine for an RFP preparation system.

Extract ONLY facts that are explicitly stated or clearly implied in the Business Analyst's message.
Do NOT infer, assume, or fabricate any information not present in the message.
Do NOT extract partial guesses — omit them, unless the BA clearly said the field is unknown/TBC (then use unknownFields).
Do NOT decide workflow, next questions, packs, or stop conditions.

CANONICAL FIELD IDs you may use (use these exact strings):
${fieldList}

FIELD GUIDANCE:
- documentType: one of system-implementation, framework-agreement, consulting, assessment, support, connectivity-telecom
- engagementType: nature of the procured work for Engagement Definition (system implementation, consulting, assessment, support, framework, PoC, mixed). Distinct from documentType (RFP category) and from awardModel / pricing (commercial model). Do not copy documentType into engagementType. Do not extract fixed-price / T&M as engagementType.
- documentTitle: the project / RFP name. Map phrases like "Project Name:" or "The project is called …".
- Values for list fields (inScope, businessObjectives, etc.) should be arrays of concise strings
- For simple text fields, use a plain string value
- issuerEntity: the organization formally issuing or procuring the RFP (issuing entity, procuring entity, contracting authority, RFP issuer, entity issuing this tender, entity publishing the RFP). Distinct from beneficiaryEntity. Do not copy beneficiary into issuer. Do not copy issuer into beneficiary. If the BA says one organization is issuing the RFP on behalf of another, issuerEntity is the issuing organization and beneficiaryEntity is the organization it is on behalf of. If issuer is not stated, omit issuerEntity.
- beneficiaryEntity: the entity the work is for — owning / overseeing beneficiary ministry or agency. Distinct from issuerEntity. NEVER the public, citizens, residents, journalists, media organizations, end users, or "indirect beneficiaries". Those are not beneficiaryEntity. Put them in users ONLY when the BA says they use the system; if they are indirect / not users, omit them.
- Do not put the issuing/procuring authority on beneficiaryEntity unless the BA said that organization is also the beneficiary.
- users: people or roles who operate or use the system (internal/external). Indirect beneficiaries and non-users do not belong here.
- businessNeedRationale: why the project is needed now. If the BA clearly describes the business problem or need, extract it here even if they never say the words "business need".
- currentSituation: the as-is environment (distinct from the need/rationale).
- engagementDuration: e.g. "12 months", "2 years"
- evaluationWeights: e.g. "70/30 technical/financial"
- awardModel: object { model: "single-supplier"|"multi-supplier"|"ranked-panel"|"service-specific", supplierCount?: number } or a short string like "three suppliers on a framework"
- callOffOrSowProcess: how SOWs/call-offs/work orders are issued (frameworks only)
- namedKeyPersonnel: array of { role, minExperience?, qualification?, cvRequired? } or a short list of roles
- clarificationContact: name/email/channel for tender clarifications
- submissionChannel: portal/email/address for proposal submission (not general comms)
- governanceCadence: steering/PMO/progress-report cadence
- knowledgeTransferRequirements: array of KT/handover/ToT obligations
- If the BA says a conditional requirement is not required / not applicable, extract that field with value "not required"

UPDATE KIND (per fact):
- assert: normal new fact
- correction: BA clearly supersedes a prior value ("actually", "make that", "instead")
- conflict: BA presents competing simultaneous sources/values ("document says X but annex says Y")

UNKNOWN / TBC:
- If the BA says they do not know a specific requirement yet ("TBC", "to be confirmed", "we don't know yet", "not confirmed yet"), list that fieldId in unknownFields.
- Do NOT put the literal string "TBC" (or similar) as the field value in extractedFacts.
- If the BA gives a real answer that merely contains the letters TBC as part of a name or sentence, extract that answer normally.

Only return fieldIds from the list above. Do not invent new field names.
If no facts were extractable, return an empty extractedFacts array.`.trim();
}

export function isValidFieldId(fieldId: string): boolean {
  return CANONICAL_FIELD_IDS.has(fieldId);
}
