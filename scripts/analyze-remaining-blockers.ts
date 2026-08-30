#!/usr/bin/env npx tsx
/**
 * Report exact readiness blockers for remaining demo sections.
 */
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { hydrateProject } from '../src/server/rami/projectPersistence';
import { getSectionReadiness } from '../src/server/rami/sectionReadiness';
import { getSectionFieldLinks } from '../src/schema/sectionFieldMap';
import { getFieldDef } from '../src/schema/projectMemoryFields';
import { getFieldControlMeta } from '../src/schema/fieldControlMeta';
import { QUESTION_SEEDS } from '../src/schema/questionBankSeed';

const DOC = 'rami-gen-core-demo';
const SECTIONS = [
  'deliverables',
  'evaluationCriteria',
  'financialProposal',
  'legalContractualTerms',
] as const;

async function main() {
  loadLocalEnv();
  const session = await hydrateProject(DOC);
  for (const sectionId of SECTIONS) {
    const r = getSectionReadiness(session.memory, sectionId, session.projectContext);
    console.log(`\n=== ${sectionId} → ${r.readiness} ===`);
    const links = getSectionFieldLinks().filter((l) => l.sectionId === sectionId);
    for (const fieldId of [...new Set([...r.criticalBlockers, ...r.missingFields, ...r.tbcFields])]) {
      if (fieldId === '__coverage_gap__') continue;
      const link = links.find((l) => l.fieldId === fieldId);
      const def = getFieldDef(fieldId);
      const meta = getFieldControlMeta(fieldId);
      const q = QUESTION_SEEDS.find((qq) => qq.fieldIds.includes(fieldId));
      console.log(
        JSON.stringify(
          {
            fieldId,
            label: def?.label ?? fieldId,
            role: link?.role ?? 'unknown',
            tbcAllowsDraft: link?.tbcAllowsDraft ?? null,
            materiality: meta.materiality,
            packs: meta.packs,
            statusInSection: r.criticalBlockers.includes(fieldId)
              ? 'blocker'
              : r.tbcFields.includes(fieldId)
                ? 'tbc'
                : r.missingFields.includes(fieldId)
                  ? 'missing'
                  : 'other',
            intendedQuestion: q
              ? { questionId: q.questionId, text: q.questionText }
              : null,
          },
          null,
          2,
        ),
      );
    }
  }
  await closePool();
}

main().catch(async (e) => {
  console.error(e);
  await closePool().catch(() => undefined);
  process.exit(1);
});
