/**
 * Generation prompts + JSON schema for structured GeneratedSection blocks.
 */

import type { SectionGenerationContext } from '@/types/generatedSection';
import { TBC_MARKER_PREFIX } from '@/types/generatedSection';
import { HIGH_RISK_GENERATION_SECTIONS } from '@/types/generationReference';

export const GENERATED_SECTION_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['blocks'],
  properties: {
    blocks: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type'],
        properties: {
          type: {
            type: 'string',
            enum: [
              'heading',
              'paragraph',
              'bullet_list',
              'numbered_list',
              'table',
              'tbc',
            ],
          },
          level: { type: 'integer', enum: [1, 2, 3] },
          text: { type: 'string' },
          items: { type: 'array', items: { type: 'string' } },
          headers: { type: 'array', items: { type: 'string' } },
          rows: {
            type: 'array',
            items: { type: 'array', items: { type: 'string' } },
          },
          label: { type: 'string' },
          fieldId: { type: 'string' },
        },
      },
    },
  },
};

export function buildGenerationMessages(ctx: SectionGenerationContext): Array<{
  role: 'system' | 'user';
  content: string;
}> {
  const highRisk = HIGH_RISK_GENERATION_SECTIONS.has(ctx.sectionId);
  const system = [
    'You are Rami, drafting one RFP section in professional English.',
    'Return JSON only that matches the provided schema (blocks array).',
    'TypeScript already decided this section may be drafted. Do not invent readiness.',
    '',
    'HIERARCHY (strict):',
    '1. CURRENT PROJECT FACTS (answeredFacts, sharedFacts, documentMeta) are authoritative.',
    '2. APPROVED HISTORICAL REFERENCES are examples only — structure, style, and level of detail.',
    '3. UNRESOLVED items (tbcFields) stay TBC. Missing facts stay missing.',
    'Anti-hallucination rules:',
    ...ctx.antiHallucinationRules.map((r) => `- ${r}`),
    highRisk
      ? 'This is a high-risk commercial/legal/evaluation section. Be extra conservative: do not copy historical percentages, penalties, weights, or legal citations.'
      : '',
    `For TBC items use block type "tbc" with label starting with "${TBC_MARKER_PREFIX}".`,
    'Start with a level-1 heading equal to the section title.',
    'Use subsection headings (level 2) where helpful.',
  ]
    .filter(Boolean)
    .join('\n');

  const userPayload = {
    sectionId: ctx.sectionId,
    title: ctx.title,
    subsections: ctx.subsections,
    readiness: ctx.readiness,
    CURRENT_PROJECT_FACTS: {
      documentMeta: ctx.documentMeta,
      answeredFacts: ctx.answeredFacts,
      sharedFacts: ctx.sharedFacts,
    },
    UNRESOLVED: {
      tbcFields: ctx.tbcFields,
      notApplicableFields: ctx.notApplicableFields,
    },
    APPROVED_HISTORICAL_REFERENCES: ctx.approvedHistoricalReferences.map((r) => ({
      generationReferenceId: r.generationReferenceId,
      chunkId: r.chunkId,
      historicalRfpId: r.historicalRfpId,
      historicalRfpTitle: r.historicalRfpTitle,
      excerpt: r.excerpt,
      mappedFieldIds: r.mappedFieldIds,
      canonicalQuestionIds: r.canonicalQuestionIds,
      sectionIds: r.sectionIds,
      provenanceClass: r.provenanceClass,
      sourceLocator: r.sourceLocator,
      usageScope: r.usageScope,
      note: 'Example only. Do not copy project-specific values.',
    })),
    instruction:
      'Draft this section using CURRENT_PROJECT_FACTS as truth. Historical references may guide structure and wording only. Every tbcFields entry must appear as an explicit tbc block. Do not invent unresolved values. Do not copy historical numbers, names, or legal terms that are not in CURRENT_PROJECT_FACTS.',
  };

  return [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(userPayload, null, 2) },
  ];
}
