#!/usr/bin/env npx tsx
/**
 * Deterministic consistency review of assembled persisted RFP (no Qwen rewrite).
 */
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { hydrateProject } from '../src/server/rami/projectPersistence';
import { assembleRfpDocument } from '../src/server/rami/sectionGeneration';
import { RFP_SECTIONS } from '../src/schema/rfpSchema';
import { clearAllSessionCache } from '../src/server/rami/sessionStore';

const DOC = process.argv[2] || 'rami-gen-core-demo';

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

async function main() {
  loadLocalEnv();
  clearAllSessionCache();
  const session = await hydrateProject(DOC);
  const assembled = await assembleRfpDocument(DOC);
  const issues: string[] = [];

  const catalogOrder = RFP_SECTIONS.map((s) => s.sectionId);
  const applicableIds = assembled.sections.filter((s) => s.applicable).map((s) => s.sectionId);
  for (let i = 1; i < applicableIds.length; i++) {
    const a = catalogOrder.indexOf(applicableIds[i - 1] as never);
    const b = catalogOrder.indexOf(applicableIds[i] as never);
    if (a < 0 || b < 0 || a > b) {
      issues.push(`order: ${applicableIds[i - 1]} before ${applicableIds[i]} looks wrong`);
    }
  }

  const titles = new Map<string, number>();
  const paragraphs = new Map<string, number>();
  let tbcCount = 0;
  let emptyGenerated = 0;

  const titleFromMem = session.memory.documentTitle?.current?.value;
  const durationFromMem = session.memory.engagementDuration?.current?.value;
  const beneficiary = session.memory.beneficiaryEntity?.current?.value;

  for (const slot of assembled.sections) {
    if (!slot.applicable) continue;
    if (slot.missingGeneration) {
      issues.push(`missing generation: ${slot.sectionId} (${slot.readiness})`);
      continue;
    }
    const g = slot.generated!;
    if (!g.blocks.length) {
      emptyGenerated++;
      issues.push(`empty blocks: ${slot.sectionId}`);
    }
    for (const b of g.blocks) {
      if (b.type === 'heading' && b.level === 1) {
        const k = normalize(b.text);
        titles.set(k, (titles.get(k) ?? 0) + 1);
      }
      if (b.type === 'paragraph') {
        const k = normalize(b.text);
        if (k.length > 80) paragraphs.set(k, (paragraphs.get(k) ?? 0) + 1);
        if (titleFromMem && typeof titleFromMem === 'string') {
          // soft check only when alternate titles appear with different wording — skip
        }
        if (
          durationFromMem &&
          typeof durationFromMem === 'string' &&
          /\b\d+\s*(month|week|year)/i.test(b.text)
        ) {
          const memNorm = normalize(String(durationFromMem));
          if (!normalize(b.text).includes(memNorm) && !/\btbc\b|to be confirmed/i.test(b.text)) {
            // mention of a duration that may conflict — flag if numbers differ
            const numsInText = b.text.match(/\d+/g) ?? [];
            const numsInMem = String(durationFromMem).match(/\d+/g) ?? [];
            if (
              numsInText.length &&
              numsInMem.length &&
              !numsInText.some((n) => numsInMem.includes(n))
            ) {
              issues.push(
                `possible duration conflict in ${slot.sectionId}: text has [${numsInText.join(',')}] vs fact [${numsInMem.join(',')}]`,
              );
            }
          }
        }
        if (
          beneficiary &&
          typeof beneficiary === 'string' &&
          /ministry|modee|entity|organization/i.test(b.text)
        ) {
          /* informational — do not auto-fail */
        }
      }
      if (b.type === 'tbc') tbcCount++;
      if (b.type === 'table' && (!b.headers.length || !b.rows.length)) {
        issues.push(`malformed table in ${slot.sectionId}`);
      }
    }

    // sourceFieldIds should intersect known memory keys when present
    for (const fid of g.sourceFieldIds ?? []) {
      if (!(fid in session.memory) && fid !== '__coverage_gap__') {
        issues.push(`unknown sourceFieldId ${fid} in ${slot.sectionId}`);
      }
    }
  }

  for (const [t, n] of titles) {
    if (n > 1) issues.push(`duplicate H1 "${t}" x${n}`);
  }
  for (const [p, n] of paragraphs) {
    if (n > 1) issues.push(`duplicate paragraph (${n}x): ${p.slice(0, 100)}…`);
  }

  console.log(
    JSON.stringify(
      {
        documentKey: DOC,
        applicable: assembled.applicableSectionCount,
        generated: assembled.generatedApplicableCount,
        approved: assembled.approvedApplicableCount,
        tbcBlocks: tbcCount,
        emptyGenerated,
        issueCount: issues.length,
        issues,
        documentTitle: titleFromMem,
        beneficiary,
        duration: durationFromMem,
      },
      null,
      2,
    ),
  );

  await closePool();
  process.exit(issues.some((i) => i.startsWith('empty') || i.startsWith('malformed') || i.startsWith('duplicate H1') || i.startsWith('order:')) ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await closePool().catch(() => undefined);
  process.exit(1);
});
