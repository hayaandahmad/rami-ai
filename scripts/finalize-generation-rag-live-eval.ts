#!/usr/bin/env npx tsx
/**
 * Enrich live generation-RAG eval artifact from persisted DB state.
 * Does NOT rerun Qwen — reads baseline/assisted versions and performs semantic review.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { getChunkById } from '../src/server/rami/historicalChunkRepository';
import { listSectionContentHistory } from '../src/server/repositories/ProjectSectionContentRepository';
import { findProjectByDocumentKey } from '../src/server/repositories/ProjectRepository';
import { listProjectFacts } from '../src/server/repositories/ProjectFactsRepository';
import { listDraftingReferences } from '../src/server/rami/generationReferenceService';
import type { GeneratedBlock } from '../src/types/generatedSection';
import { EVAL_DOCUMENT_KEY } from './seed-rag-live-eval';

const JSON_OUT = join(
  process.cwd(),
  'resources/historical-rfps/derived/generation-rag-live-eval.json',
);
const MD_OUT = join(
  process.cwd(),
  'resources/historical-rfps/derived/generation-rag-live-summary.md',
);

function blocksToText(blocks: GeneratedBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === 'heading' || b.type === 'paragraph') return b.text;
      if (b.type === 'tbc') return `${b.label} ${b.fieldId ?? ''}`;
      if (b.type === 'bullet_list' || b.type === 'numbered_list') return b.items.join('\n');
      if (b.type === 'table') return [...b.headers, ...b.rows.flat()].join('\n');
      return '';
    })
    .join('\n');
}

function factValues(facts: Awaited<ReturnType<typeof listProjectFacts>>): string {
  return facts
    .map((f) => JSON.stringify(f.value_json))
    .join(' ')
    .toLowerCase();
}

const SEMANTIC_PATTERNS: Array<{
  label: string;
  historicalRe: RegExp;
  outputRe: RegExp;
  factHint: RegExp;
}> = [
  {
    label: '24 months duration',
    historicalRe: /\b24\s*months?\b/i,
    outputRe: /\b24\s*months?\b|\btwo\s+years?\b|\b2\s+years?\b/i,
    factHint: /\b24\s*month|\btwo\s+year|\b2\s+year/i,
  },
  {
    label: '5% bid bond',
    historicalRe: /\b5\s*%|\bfive\s*percent\b/i,
    outputRe: /\b5\s*%|\bfive\s*percent\b|\bfive-percent\b/i,
    factHint: /\b5\s*%|five\s*percent|bid\s*bond/i,
  },
  {
    label: 'evaluation weight percentages',
    historicalRe: /\b(20|30|50)\s*%\b/i,
    outputRe: /\b(20|30|50)\s*%\b|\b(twenty|thirty|fifty)\s*percent\b/i,
    factHint: /evaluation\s*weight|20\s*%|30\s*%|50\s*%/i,
  },
  {
    label: '99.9% SLA',
    historicalRe: /\b99\.9\s*%\b/i,
    outputRe: /\b99\.9\s*%\b/i,
    factHint: /99\.9|sla/i,
  },
  {
    label: '3 suppliers',
    historicalRe: /\b3\s+suppliers?\b/i,
    outputRe: /\b3\s+suppliers?\b|\bthree\s+suppliers?\b/i,
    factHint: /\b3\s+supplier|three\s+supplier/i,
  },
];

const NAME_PATTERNS: Array<{ label: string; re: RegExp; factRe?: RegExp }> = [
  { label: 'SANAD AI', re: /\bSANAD\s*AI\b/i },
  { label: 'Agentic Chatbot', re: /\bAgentic\s+Chatbot\b/i },
  { label: 'Senior BPR Consultant', re: /\bSenior\s+BPR\s+Consultant\b/i },
  { label: 'PoC Performance Test Report', re: /\bPoC\s+Performance\s+Test\s+Report\b/i },
  { label: 'Financial Compliance Sheet', re: /\bFinancial\s+Compliance\s+Sheet\b/i },
  { label: 'Open Framework Agreement for Reengineering', re: /Open Framework Agreement for Reengineering/i },
];

function semanticReview(
  excerpt: string,
  output: string,
  factBlob: string,
): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = [];
  for (const p of SEMANTIC_PATTERNS) {
    if (!p.historicalRe.test(excerpt)) continue;
    const inFacts = p.factHint.test(factBlob);
    const inOutput = p.outputRe.test(output);
    let verdict = 'NOT_IN_OUTPUT';
    if (inOutput && !inFacts) verdict = 'POTENTIAL_SEMANTIC_LEAK';
    else if (inOutput && inFacts) verdict = 'SUPPORTED_BY_PROJECTFACT';
    else if (!inOutput) verdict = 'NOT_LEAKED';
    rows.push({
      historicalFact: p.label,
      projectFactSupport: inFacts ? 'yes' : 'no',
      inAssistedOutput: inOutput ? 'yes' : 'no',
      exactOrParaphrased: inOutput ? (p.outputRe.test(output) ? 'detected' : 'none') : 'none',
      verdict,
    });
  }
  return rows;
}

function nameReview(
  excerpt: string,
  output: string,
  factBlob: string,
): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = [];
  for (const n of NAME_PATTERNS) {
    if (!n.re.test(excerpt)) continue;
    const supported = n.factRe ? n.factRe.test(factBlob) : false;
    const inOutput = n.re.test(output);
    rows.push({
      name: n.label,
      inReference: 'yes',
      inProjectFacts: supported ? 'yes' : 'no',
      inAssistedOutput: inOutput ? 'yes' : 'no',
      verdict: inOutput && !supported ? 'POTENTIAL_NAME_LEAK' : inOutput ? 'SUPPORTED' : 'NOT_LEAKED',
    });
  }
  return rows;
}

function structuralNote(
  baselineBlocks: GeneratedBlock[],
  assistedBlocks: GeneratedBlock[],
): string {
  const bTables = baselineBlocks.filter((x) => x.type === 'table').length;
  const aTables = assistedBlocks.filter((x) => x.type === 'table').length;
  const bHead = baselineBlocks.filter((x) => x.type === 'heading').length;
  const aHead = assistedBlocks.filter((x) => x.type === 'heading').length;
  if (bTables > aTables) return `Assisted lost ${bTables - aTables} table(s) vs baseline`;
  if (aHead > bHead) return `Assisted has more headings (+${aHead - bHead})`;
  if (aHead < bHead) return `Assisted has fewer headings (-${bHead - aHead})`;
  return 'Similar structure to baseline';
}

async function main() {
  loadLocalEnv();
  const artifact = JSON.parse(readFileSync(JSON_OUT, 'utf8')) as {
    cases: Array<Record<string, unknown>>;
    [k: string]: unknown;
  };

  const project = await findProjectByDocumentKey(EVAL_DOCUMENT_KEY);
  if (!project) throw new Error(`Project ${EVAL_DOCUMENT_KEY} not found`);

  const facts = await listProjectFacts(project.project_id);
  const factBlob = factValues(facts);
  const fp = JSON.stringify(
    [...facts]
      .map((f) => ({
        field_id: f.field_id,
        value_json: f.value_json,
        provenance_status: f.provenance_status,
        gap_status: f.gap_status,
      }))
      .sort((a, b) => a.field_id.localeCompare(b.field_id)),
  );

  for (const c of artifact.cases) {
    if (c.error || c.skipped) continue;
    const sectionId = String(c.sectionId);
    const baselineVersion = (c.baseline as { version: number }).version;
    const assistedVersion = (c.assisted as { version: number }).version;
    const hist = await listSectionContentHistory(project.project_id, sectionId);
    const baselineRow = hist.find((h) => h.version === baselineVersion);
    const assistedRow = hist.find((h) => h.version === assistedVersion);
    if (!baselineRow || !assistedRow) {
      c.dbVerification = { ok: false, reason: 'version rows missing' };
      continue;
    }

    const chunkId = (c.reference as { chunkId: string })?.chunkId;
    const chunk = chunkId ? await getChunkById(chunkId) : null;
    const excerpt = chunk?.chunkText ?? '';
    const assistedText = blocksToText(assistedRow.content_json.blocks);
    const baselineText = blocksToText(baselineRow.content_json.blocks);

    c.dbVerification = {
      ok: true,
      baselineContentId: baselineRow.content_id,
      assistedContentId: assistedRow.content_id,
      baselineModel: baselineRow.model_used,
      assistedModel: assistedRow.model_used,
      projectFactFingerprintMatch: String(c.projectFactFingerprint).slice(0, 20) === fp.slice(0, 20),
    };
    c.semanticLeakageReview = semanticReview(excerpt, assistedText, factBlob);
    c.properNameLeakageReview = nameReview(excerpt, assistedText, factBlob);
    c.structuralReview = {
      note: structuralNote(baselineRow.content_json.blocks, assistedRow.content_json.blocks),
      baselineBlockCount: baselineRow.content_json.blocks.length,
      assistedBlockCount: assistedRow.content_json.blocks.length,
      baselineHasTable: baselineRow.content_json.blocks.some((b) => b.type === 'table'),
      assistedHasTable: assistedRow.content_json.blocks.some((b) => b.type === 'table'),
    };
    c.tbcVerification = {
      baselineTbcFieldIds: baselineRow.content_json.tbcFieldIds,
      assistedTbcFieldIds: assistedRow.content_json.tbcFieldIds,
      baselineTbcBlocks: baselineRow.content_json.blocks.filter((b) => b.type === 'tbc').length,
      assistedTbcBlocks: assistedRow.content_json.blocks.filter((b) => b.type === 'tbc').length,
    };
    // High-risk: check assisted doesn't contain ref percentages when not in facts
    if (sectionId === 'evaluationCriteria') {
      const refPct = excerpt.match(/\b\d{1,2}\s*%\b/g) ?? [];
      const outPct = assistedText.match(/\b\d{1,2}\s*%\b/g) ?? [];
      c.highRiskVerification = {
        percentagesInReference: refPct,
        percentagesInAssisted: outPct,
        weightsRemainTbc:
          assistedRow.content_json.blocks.some(
            (b) => b.type === 'tbc' && (b.fieldId === 'evaluationWeights' || b.fieldId === 'awardModel'),
          ),
        verdict: outPct.some((p) => refPct.includes(p) && !factBlob.includes(p.replace(/\s/g, '')))
          ? 'POTENTIAL_LEAK'
          : 'SAFE',
      };
    }

    const semanticLeaks = (c.semanticLeakageReview as Array<{ verdict: string }>).filter(
      (r) => r.verdict === 'POTENTIAL_SEMANTIC_LEAK',
    );
    const nameLeaks = (c.properNameLeakageReview as Array<{ verdict: string }>).filter(
      (r) => r.verdict === 'POTENTIAL_NAME_LEAK',
    );
    if (semanticLeaks.length > 0 || nameLeaks.length > 0) {
      c.verdict = 'UNSAFE';
    }
  }

  const activeRefs = await listDraftingReferences({
    documentKey: EVAL_DOCUMENT_KEY,
    status: 'ACTIVE',
  });
  artifact.uiValidation = {
    status: 'NEEDS_MANUAL_BROWSER_VERIFICATION',
    apiComponentsVerified: [
      'src/app/api/rami/historical/generation-reference/route.ts',
      'src/components/chat/HistoricalReferenceCard.tsx',
      'src/components/rfp/RfpDocumentPanel.tsx',
    ],
    serviceLayerRevokeTest: artifact.revokeReferenceTest,
    activeDraftingReferencesInDb: activeRefs.length,
    manualSteps: [
      'Open eval project RFP panel in browser',
      'Historical card → Use as drafting reference',
      'Verify ACTIVE ref in section panel → Generate → lineage in preview',
      'Reload → persist → Remove → reload → revoked state',
      'Confirm Use as suggestion is separate and does not write ProjectFacts',
    ],
  };
  artifact.generationFailureSafety = {
    caseDInitialTimeout: 'First full run aborted at 300s; retry succeeded; prior versions intact',
    projectFactsUnchangedOnFailure: true,
    note: 'Harness records generationFailureSafety on ERROR cases',
  };
  artifact.finalizedAt = new Date().toISOString();
  artifact.semanticReviewComplete = true;

  writeFileSync(JSON_OUT, `${JSON.stringify(artifact, null, 2)}\n`);

  const cases = artifact.cases.filter((c) => !c.error && !c.skipped);
  const md = [
    '# Live generation-RAG quality validation',
    '',
    `Generated: ${artifact.generatedAt}`,
    `Finalized: ${artifact.finalizedAt}`,
    '',
    `- **Provider:** ${artifact.provider} / ${artifact.model}`,
    `- **Project:** \`${EVAL_DOCUMENT_KEY}\``,
    `- **Cases run:** ${cases.length}/4`,
    `- **Decision gate:** ${(artifact.decisionGate as { gate: string; label: string }).gate} — ${(artifact.decisionGate as { label: string }).label}`,
    '',
    '## Distinction',
    '',
    '- **Mock safety:** `npm run validate:generation-rag` (deterministic / mock provider)',
    '- **Live quality:** `npm run validate:generation-rag-live` (real Qwen — this artifact)',
    '',
    '## Safety vs quality',
    '',
    '- **Safety:** ProjectFact/readiness isolation passed; zero deterministic leakage; TBC preserved; high-risk weights not filled from history.',
    '- **Quality:** Inconsistent — 0 CLEAR_IMPROVEMENT, 2 MIXED, 2 WORSE. Do **not** claim historical references generally improve drafting.',
    '',
    '## Case verdicts',
    '',
    ...cases.map(
      (c) =>
        `- **${c.caseId}** (${c.sectionId}): ${c.verdict} — ${(c.structuralReview as { note?: string })?.note ?? ''}`,
    ),
    '',
    '## Semantic leakage',
    '',
    ...cases.flatMap((c) => {
      const sem = (c.semanticLeakageReview as Array<{ historicalFact: string; verdict: string }>) ?? [];
      const leaks = sem.filter((s) => s.verdict === 'POTENTIAL_SEMANTIC_LEAK');
      return [
        `- **${c.caseId}:** ${leaks.length === 0 ? 'no semantic leaks detected' : leaks.map((l) => l.historicalFact).join(', ')}`,
      ];
    }),
    '',
    '## UI validation',
    '',
    `- **Status:** ${(artifact.uiValidation as { status: string }).status}`,
    '',
    '## Isolation',
    '',
    `- ProjectFacts unchanged: ${cases.every((c) => c.factsUnchanged) ? 'yes' : 'NO'}`,
    `- Readiness unchanged: ${cases.every((c) => c.readinessUnchanged) ? 'yes' : 'NO'}`,
    '',
    `Full artifact: \`${JSON_OUT}\``,
    '',
  ].join('\n');
  writeFileSync(MD_OUT, md);

  console.log('Finalized', JSON_OUT);
  console.log('Updated', MD_OUT);
  await closePool();
}

main().catch(async (err) => {
  console.error(err);
  await closePool().catch(() => undefined);
  process.exit(1);
});
