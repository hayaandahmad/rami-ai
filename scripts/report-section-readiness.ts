#!/usr/bin/env npx tsx
/**
 * Live Section Readiness report against a persisted PostgreSQL project.
 * Default: RAMI Persistence Acceptance Test (document_key rami-persist-accept-20260830).
 */
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { isDatabaseConfigured } from '../src/server/db/config';
import { hydrateProject } from '../src/server/rami/projectPersistence';
import { getAllSectionReadiness } from '../src/server/rami/sectionReadiness';
import { withActivePacks } from '../src/server/rami/questionPackEngine';

const KEY = process.argv[2] || 'rami-persist-accept-20260830';

async function main() {
  loadLocalEnv();
  if (!isDatabaseConfigured()) {
    console.error('FAIL: PostgreSQL is not configured.');
    process.exit(1);
  }
  const session = await hydrateProject(KEY);
  const ctx = withActivePacks(session.projectContext, session.memory);
  const results = getAllSectionReadiness(session.memory, ctx);

  console.log(`\n=== Live readiness: ${KEY} ===\n`);
  console.log(
    `classifiers: stage=${ctx.documentStage} domain=${ctx.primaryDomain} packs=${ctx.activePacks.join(',')}`,
  );

  const applicable = results.filter((r) => r.applicable);
  const skipped = results.filter((r) => !r.applicable);
  console.log(`\nApplicable: ${applicable.length}  Non-applicable: ${skipped.length}\n`);

  for (const r of results) {
    if (!r.applicable) {
      console.log(`${r.sectionId.padEnd(32)} NOT_APPLICABLE`);
      continue;
    }
    console.log(
      `${r.sectionId.padEnd(32)} ${r.readiness.padEnd(22)} answered=${r.answeredFields.length} tbc=${r.tbcFields.length} missing=${r.missingFields.length} blockers=${r.criticalBlockers.join(',') || '-'}`,
    );
    if (r.tbcFields.length) console.log(`    tbc: ${r.tbcFields.join(', ')}`);
    if (r.missingFields.length) console.log(`    missing: ${r.missingFields.join(', ')}`);
    if (r.coverageNote) console.log(`    coverage: [${r.coverageGap}] ${r.coverageNote}`);
  }

  await closePool();
}

main().catch(async (err) => {
  console.error(err);
  await closePool().catch(() => undefined);
  process.exit(1);
});
