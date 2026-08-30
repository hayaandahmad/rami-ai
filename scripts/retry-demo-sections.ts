#!/usr/bin/env npx tsx
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { clearAllSessionCache } from '../src/server/rami/sessionStore';
import { clearDefaultProvider } from '../src/server/ai';
import {
  assembleRfpDocument,
  generateRfpSection,
} from '../src/server/rami/sectionGeneration';

async function main() {
  loadLocalEnv();
  clearAllSessionCache();
  clearDefaultProvider();
  const DOC = 'rami-gen-core-demo';
  for (const sectionId of ['coverPage', 'deliverables', 'scopeOfWork'] as const) {
    console.log('gen', sectionId);
    try {
      const r = await generateRfpSection({
        documentKey: DOC,
        sectionId,
      });
      console.log(' ok', sectionId, 'v' + r.content.version, 'blocks', r.generated.blocks.length);
    } catch (e) {
      console.error(' fail', sectionId, e instanceof Error ? e.message : e);
    }
  }
  const a = await assembleRfpDocument(DOC);
  console.log('final', {
    generated: a.generatedApplicableCount,
    approved: a.approvedApplicableCount,
    missing: a.sections.filter((s) => s.missingGeneration).map((s) => s.sectionId),
  });
  await closePool();
}

main().catch(async (e) => {
  console.error(e);
  await closePool().catch(() => undefined);
  process.exit(1);
});
