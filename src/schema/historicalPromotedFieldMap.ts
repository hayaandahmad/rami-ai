/**
 * Deterministic historical Question-text → promoted Field associations.
 * Used only for Suggested Addition / gap-theme rows. No LLM inference.
 */

export const PROMOTED_HISTORICAL_FIELD_PATTERNS: Array<{
  fieldId: string;
  questionRe: RegExp;
}> = [
  {
    fieldId: 'awardModel',
    questionRe:
      /how many (bidders|suppliers).{0,40}award|award model|suppliers will be awarded|may be awarded/i,
  },
  {
    fieldId: 'callOffOrSowProcess',
    questionRe:
      /call-?offs?|work orders|how are (individual )?assignments|how will work orders|initiated and what minimum information must each sow/i,
  },
  {
    fieldId: 'namedKeyPersonnel',
    questionRe:
      /mandatory staff roles|minimum staffing|named (key )?personnel|manpower model applies|key personnel/i,
  },
  {
    fieldId: 'clarificationContact',
    questionRe: /clarification (process|contact|channel)|clarification deadlines/i,
  },
  {
    fieldId: 'submissionChannel',
    questionRe:
      /how must proposals be submitted|proposal submission|submitted through|joneps|e-?procurement portal/i,
  },
  {
    fieldId: 'governanceCadence',
    questionRe:
      /pmo, governance, reporting|governance model and raci|governance and reporting cadence|steering committee/i,
  },
  {
    fieldId: 'knowledgeTransferRequirements',
    questionRe:
      /knowledge-transfer|knowledge transfer|training-of-trainers|training, certification, knowledge|operational-handover|handover obligations/i,
  },
];

export function promotedFieldsForHistoricalQuestion(questionText: string): string[] {
  if (!questionText?.trim()) return [];
  const out: string[] = [];
  for (const p of PROMOTED_HISTORICAL_FIELD_PATTERNS) {
    if (p.questionRe.test(questionText) && !out.includes(p.fieldId)) out.push(p.fieldId);
  }
  return out;
}

export function mergeHistoricalMappedFields(
  existing: string[] | undefined,
  questionText: string,
): string[] {
  const extra = promotedFieldsForHistoricalQuestion(questionText);
  return [...new Set([...(existing ?? []), ...extra])];
}
