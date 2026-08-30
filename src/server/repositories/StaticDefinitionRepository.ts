import type { PoolClient } from 'pg';
import { RFP_SECTIONS } from '@/schema/rfpSchema';
import { PROJECT_MEMORY_FIELDS } from '@/schema/projectMemoryFields';
import { QUESTION_SEEDS } from '@/schema/questionBankSeed';
import { getSectionFieldLinks } from '@/schema/sectionFieldMap';
import { getFieldDataType } from '@/server/db/fieldTypes';
import { query } from '@/server/db/connection';

async function exec(sql: string, params: unknown[], client?: PoolClient) {
  if (client) return client.query(sql, params);
  return query(sql, params);
}

/** Fields table requires section_id. Cross-cutting fields (empty targetSections) use the question-bank section. */
function resolveFieldSectionId(field: (typeof PROJECT_MEMORY_FIELDS)[number]): string {
  const fromTarget = field.targetSections[0];
  if (fromTarget) return fromTarget;
  const fromQuestion = QUESTION_SEEDS.find((q) => q.fieldIds.includes(field.fieldId))?.sectionId;
  if (fromQuestion) return fromQuestion;
  throw new Error(
    `Cannot seed field '${field.fieldId}': no targetSections and no question-bank section_id.`,
  );
}

export async function seedStaticDefinitions(client?: PoolClient): Promise<{
  sections: number;
  fields: number;
  questions: number;
  questionFields: number;
  sectionFields: number;
}> {
  for (const section of RFP_SECTIONS) {
    await exec(
      `INSERT INTO sections (section_id, title, sort_order, classification)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (section_id) DO UPDATE SET
         title = EXCLUDED.title,
         sort_order = EXCLUDED.sort_order,
         classification = EXCLUDED.classification`,
      [section.sectionId, section.title, section.order, section.classification],
      client,
    );
  }

  for (const field of PROJECT_MEMORY_FIELDS) {
    const primarySection = resolveFieldSectionId(field);
    await exec(
      `INSERT INTO fields (field_id, field_key, name, data_type, section_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (field_id) DO UPDATE SET
         field_key = EXCLUDED.field_key,
         name = EXCLUDED.name,
         data_type = EXCLUDED.data_type,
         section_id = EXCLUDED.section_id`,
      [field.fieldId, field.fieldId, field.label, getFieldDataType(field.fieldId), primarySection],
      client,
    );
  }

  let questionFields = 0;
  for (const q of QUESTION_SEEDS) {
    await exec(
      `INSERT INTO questions (question_id, question_text, section_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (question_id) DO UPDATE SET
         question_text = EXCLUDED.question_text,
         section_id = EXCLUDED.section_id`,
      [q.questionId, q.questionText, q.sectionId],
      client,
    );
    for (const fieldId of q.fieldIds) {
      await exec(
        `INSERT INTO question_fields (question_id, field_id)
         VALUES ($1, $2)
         ON CONFLICT (question_id, field_id) DO NOTHING`,
        [q.questionId, fieldId],
        client,
      );
      questionFields += 1;
    }
  }

  let sectionFields = 0;
  for (const link of getSectionFieldLinks()) {
    await exec(
      `INSERT INTO section_fields (section_id, field_id, role, tbc_allows_draft, na_valid)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (section_id, field_id) DO UPDATE SET
         role = EXCLUDED.role,
         tbc_allows_draft = EXCLUDED.tbc_allows_draft,
         na_valid = EXCLUDED.na_valid`,
      [link.sectionId, link.fieldId, link.role, link.tbcAllowsDraft, link.naValid],
      client,
    );
    sectionFields += 1;
  }

  return {
    sections: RFP_SECTIONS.length,
    fields: PROJECT_MEMORY_FIELDS.length,
    questions: QUESTION_SEEDS.length,
    questionFields,
    sectionFields,
  };
}

export async function countStaticDefinitions() {
  const [s, f, q, qf, sf] = await Promise.all([
    query<{ n: string }>('SELECT COUNT(*)::text AS n FROM sections'),
    query<{ n: string }>('SELECT COUNT(*)::text AS n FROM fields'),
    query<{ n: string }>('SELECT COUNT(*)::text AS n FROM questions'),
    query<{ n: string }>('SELECT COUNT(*)::text AS n FROM question_fields'),
    query<{ n: string }>('SELECT COUNT(*)::text AS n FROM section_fields'),
  ]);
  return {
    sections: Number(s.rows[0].n),
    fields: Number(f.rows[0].n),
    questions: Number(q.rows[0].n),
    questionFields: Number(qf.rows[0].n),
    sectionFields: Number(sf.rows[0].n),
  };
}
