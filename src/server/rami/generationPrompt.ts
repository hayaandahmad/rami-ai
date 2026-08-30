/**
 * Generation prompts + JSON schema for structured GeneratedSection blocks.
 */

import type { SectionGenerationContext } from '@/types/generatedSection';
import { TBC_MARKER_PREFIX } from '@/types/generatedSection';

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
  const system = [
    'You are Rami, drafting one RFP section in professional English.',
    'Return JSON only that matches the provided schema (blocks array).',
    'TypeScript already decided this section may be drafted. Do not invent readiness.',
    'Anti-hallucination rules:',
    ...ctx.antiHallucinationRules.map((r) => `- ${r}`),
    `For TBC items use block type "tbc" with label starting with "${TBC_MARKER_PREFIX}".`,
    'Start with a level-1 heading equal to the section title.',
    'Use subsection headings (level 2) where helpful.',
  ].join('\n');

  const userPayload = {
    sectionId: ctx.sectionId,
    title: ctx.title,
    subsections: ctx.subsections,
    readiness: ctx.readiness,
    documentMeta: ctx.documentMeta,
    answeredFacts: ctx.answeredFacts,
    sharedFacts: ctx.sharedFacts,
    tbcFields: ctx.tbcFields,
    notApplicableFields: ctx.notApplicableFields,
    instruction:
      'Draft this section using only the facts above. Every tbcFields entry must appear as an explicit tbc block. Do not invent unresolved values.',
  };

  return [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(userPayload, null, 2) },
  ];
}
