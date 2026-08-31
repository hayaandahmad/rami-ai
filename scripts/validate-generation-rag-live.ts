#!/usr/bin/env npx tsx
/**
 * LIVE Qwen A/B quality validation for generation-time RAG.
 * Requires local Ollama qwen3:8b (or set RAMI_MODEL_PROVIDER=modal for ALL cases).
 * Does NOT run in CI — invoke intentionally: npm run validate:generation-rag-live
 *
 * Mock safety checks remain in validate:generation-rag.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { loadLocalEnv } from '../src/server/db/loadEnv';
import { closePool } from '../src/server/db/connection';
import { clearAllSessionCache } from '../src/server/rami/sessionStore';
import { clearDefaultProvider, getDefaultProvider } from '../src/server/ai';
import type { RamiModelProvider } from '../src/server/ai/RamiModelProvider';
import {
  generateRfpSection,
  getGeneratedSection,
} from '../src/server/rami/sectionGeneration';
import { getSectionReadiness } from '../src/server/rami/sectionReadiness';
import {
  approveDraftingReference,
  listDraftingReferences,
  revokeDraftingReference,
} from '../src/server/rami/generationReferenceService';
import { retrieveHistoricalReferences } from '../src/server/rami/historicalRetrieval';
import { getChunkById } from '../src/server/rami/historicalChunkRepository';
import {
  extractNameishTokens,
  extractNumberishTokens,
  findLeakageInBlocks,
  leakedHistoricalTokens,
  ngramOverlapRatio,
} from '../src/server/rami/generationReferenceLeakage';
import { buildSectionGenerationContext } from '../src/server/rami/sectionGenerationContext';
import { hydrateProject } from '../src/server/rami/projectPersistence';
import { findProjectByDocumentKey } from '../src/server/repositories/ProjectRepository';
import { listProjectFacts } from '../src/server/repositories/ProjectFactsRepository';
import { listSectionContentHistory } from '../src/server/repositories/ProjectSectionContentRepository';
import { CANONICAL_FIELD_COUNT } from '../src/schema/projectMemoryFields';
import { CANONICAL_QUESTION_COUNT } from '../src/schema/questionBankSeed';
import { RFP_SECTIONS } from '../src/schema/rfpSchema';
import { getFieldIdsForSection } from '../src/schema/sectionFieldMap';
import { TBC_MARKER_PREFIX } from '../src/types/generatedSection';
import type { GeneratedBlock, SectionGenerationContext } from '../src/types/generatedSection';
import { EVAL_DOCUMENT_KEY } from './seed-rag-live-eval';

const DERIVED = join(process.cwd(), 'resources', 'historical-rfps', 'derived');
const JSON_OUT = join(DERIVED, 'generation-rag-live-eval.json');
const MD_OUT = join(DERIVED, 'generation-rag-live-summary.md');

type CaseId = 'A_DELIVERABLES' | 'B_SCOPE' | 'C_ACCEPTANCE' | 'D_EVAL_HIGH_RISK';

interface LiveCaseConfig {
  id: CaseId;
  sectionId: string;
  label: string;
  retrievalQuery: string;
  preferNumericLeakage: boolean;
}

const CASES: LiveCaseConfig[] = [
  {
    id: 'A_DELIVERABLES',
    sectionId: 'deliverables',
    label: 'Deliverables — structure/detail',
    retrievalQuery: 'deliverable examples formats approval',
    preferNumericLeakage: true,
  },
  {
    id: 'B_SCOPE',
    sectionId: 'scopeOfWork',
    label: 'Scope of Work — requirement organization',
    retrievalQuery: 'scope boundaries in scope out of scope',
    preferNumericLeakage: false,
  },
  {
    id: 'C_ACCEPTANCE',
    sectionId: 'background',
    label: 'Background & Business Need — TBC preservation + structure',
    retrievalQuery: 'background business need current situation objectives',
    preferNumericLeakage: false,
  },
  {
    id: 'D_EVAL_HIGH_RISK',
    sectionId: 'evaluationCriteria',
    label: 'Evaluation Criteria — safety (weights TBC)',
    retrievalQuery: 'evaluation methodology scoring weights',
    preferNumericLeakage: true,
  },
];

function casesToRun(): LiveCaseConfig[] {
  const filter = process.env.LIVE_EVAL_CASES?.trim();
  if (!filter) return CASES;
  const ids = new Set(filter.split(',').map((s) => s.trim()));
  return CASES.filter((c) => ids.has(c.id));
}

function loadExistingArtifact(): Record<string, unknown> | null {
  try {
    const { readFileSync } = require('fs') as typeof import('fs');
    return JSON.parse(readFileSync(JSON_OUT, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function mergeCaseResults(
  prior: Array<Record<string, unknown>>,
  fresh: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const byId = new Map(prior.map((c) => [String(c.caseId), c]));
  for (const c of fresh) byId.set(String(c.caseId), c);
  return CASES.map((cfg) => byId.get(cfg.id)).filter(Boolean) as Array<Record<string, unknown>>;
}

function factFingerprint(
  rows: Array<{
    field_id: string;
    value_json: unknown;
    provenance_status: string;
    gap_status: string | null;
    collection_state?: string;
  }>,
) {
  return JSON.stringify(
    [...rows]
      .map((r) => ({
        field_id: r.field_id,
        value_json: r.value_json,
        provenance_status: r.provenance_status,
        gap_status: r.gap_status,
        collection_state: r.collection_state,
      }))
      .sort((a, b) => a.field_id.localeCompare(b.field_id)),
  );
}

function blockHaystack(blocks: GeneratedBlock[]): string {
  return JSON.stringify(blocks).toLowerCase();
}

function structureMetrics(blocks: GeneratedBlock[]) {
  return {
    blockCount: blocks.length,
    headings: blocks.filter((b) => b.type === 'heading').length,
    paragraphs: blocks.filter((b) => b.type === 'paragraph').length,
    lists: blocks.filter((b) => b.type === 'bullet_list' || b.type === 'numbered_list').length,
    tables: blocks.filter((b) => b.type === 'table').length,
    tbcBlocks: blocks.filter((b) => b.type === 'tbc').length,
    listItems: blocks
      .filter((b) => b.type === 'bullet_list' || b.type === 'numbered_list')
      .reduce((n, b) => n + b.items.length, 0),
  };
}

function longestMatchingPhrase(a: string, b: string): number {
  const wordsA = a.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const wordsB = b.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  let best = 0;
  for (let i = 0; i < wordsA.length; i++) {
    for (let j = 0; j < wordsB.length; j++) {
      let k = 0;
      while (
        i + k < wordsA.length &&
        j + k < wordsB.length &&
        wordsA[i + k] === wordsB[j + k]
      ) {
        k++;
      }
      if (k > best) best = k;
    }
  }
  return best;
}

function factBlob(ctx: SectionGenerationContext): string {
  return JSON.stringify({
    meta: ctx.documentMeta,
    answered: ctx.answeredFacts.map((f) => ({ id: f.fieldId, v: f.value })),
    shared: ctx.sharedFacts.map((f) => ({ id: f.fieldId, v: f.value })),
  }).toLowerCase();
}

function classifyMaterialClaims(
  blocks: GeneratedBlock[],
  ctx: SectionGenerationContext,
): Array<{ claim: string; classification: string }> {
  const allow = factBlob(ctx);
  const probes = [
    { re: /\b18\s*months?\b/i, label: 'duration 18 months' },
    { re: /\b24\s*months?\b/i, label: 'duration 24 months' },
    { re: /\b5\s*%|\bfive\s*percent\b/i, label: '5% / bid bond' },
    { re: /\b99\.9\s*%/i, label: '99.9% SLA' },
    { re: /\b3\s+suppliers?\b/i, label: '3 suppliers' },
    { re: /\b30\s+days?\b/i, label: '30 days' },
    { re: /modee|ministry of digital economy/i, label: 'MoDEE beneficiary' },
    { re: /inception report|monthly steering|final advisory/i, label: 'named deliverables' },
    { re: /evaluation weight|technical\s+\d+\s*%|financial\s+\d+\s*%/i, label: 'evaluation weights' },
  ];
  const hay = blocks
    .map((b) => {
      if (b.type === 'heading' || b.type === 'paragraph') return b.text;
      if (b.type === 'tbc') return b.label;
      if (b.type === 'bullet_list' || b.type === 'numbered_list') return b.items.join(' ');
      if (b.type === 'table') return [...b.headers, ...b.rows.flat()].join(' ');
      return '';
    })
    .join('\n');

  const out: Array<{ claim: string; classification: string }> = [];
  for (const p of probes) {
    if (!p.re.test(hay)) continue;
    const m = hay.match(p.re)?.[0] ?? p.label;
    if (allow.includes(m.toLowerCase()) || allow.includes(p.label.toLowerCase())) {
      out.push({ claim: p.label, classification: 'SUPPORTED_BY_PROJECTFACT' });
    } else if (hay.includes(TBC_MARKER_PREFIX) && /weight|bond|sla|supplier/i.test(p.label)) {
      out.push({ claim: p.label, classification: 'TBC' });
    } else if (/evaluation weight|5%|99\.9|24 month|3 supplier|30 day/i.test(p.label)) {
      out.push({ claim: p.label, classification: 'UNSUPPORTED' });
    } else if (/modee|inception|steering|advisory/i.test(p.label)) {
      out.push({ claim: p.label, classification: 'SUPPORTED_BY_PROJECTFACT' });
    } else {
      out.push({ claim: p.label, classification: 'GENERIC_NON_PROJECT_SPECIFIC' });
    }
  }
  return out;
}

function scoreRubric(input: {
  baseline: ReturnType<typeof structureMetrics>;
  assisted: ReturnType<typeof structureMetrics>;
  unsupportedBaseline: number;
  unsupportedAssisted: number;
  leakageCount: number;
  overlap: number;
  tbcPreserved: boolean;
  readinessUnchanged: boolean;
  factsUnchanged: boolean;
}) {
  const A = input.unsupportedAssisted <= input.unsupportedBaseline && input.leakageCount === 0 ? 5 : input.leakageCount > 0 ? 1 : 3;
  const B =
    input.assisted.headings >= input.baseline.headings &&
    input.assisted.lists + input.assisted.tables >= input.baseline.lists + input.baseline.tables
      ? 4
      : input.assisted.blockCount >= input.baseline.blockCount
        ? 3
        : 2;
  const C = input.overlap < 0.35 ? 4 : 2;
  const D = B;
  const E = input.assisted.paragraphs >= 1 ? 4 : 2;
  const F = input.assisted.blockCount <= input.baseline.blockCount + 6 ? 4 : 2;
  const G = input.tbcPreserved ? 5 : 1;
  const H = input.leakageCount === 0 && input.factsUnchanged && input.readinessUnchanged ? 5 : 1;
  return { A, B, C, D, E, F, G, H };
}

function caseVerdict(scores: ReturnType<typeof scoreRubric>, leakage: number, improved: boolean): string {
  if (leakage > 0 || scores.H <= 2) return 'UNSAFE';
  if (scores.B >= 4 && scores.H >= 4 && improved) return 'CLEAR_IMPROVEMENT';
  if (scores.B >= 3 && scores.H >= 4) return 'MIXED';
  if (scores.B <= 2 && scores.H >= 4) return 'WORSE';
  return 'NO_MEANINGFUL_CHANGE';
}

async function revokeSectionRefs(sectionId: string) {
  const listed = await listDraftingReferences({
    documentKey: EVAL_DOCUMENT_KEY,
    sectionId,
    status: 'ACTIVE',
  });
  for (const row of listed) {
    await revokeDraftingReference({
      documentKey: EVAL_DOCUMENT_KEY,
      generationReferenceId: row.generationReferenceId,
    });
  }
}

async function pickChunk(
  cfg: LiveCaseConfig,
  fieldIds: string[],
): Promise<{ chunkId: string; historicalRfpId: string; excerpt: string; numericTokens: string[]; nameTokens: string[] }> {
  const refs = await retrieveHistoricalReferences(cfg.retrievalQuery, {
    mode: 'structured',
    fieldIds: fieldIds.slice(0, 8),
    sectionIds: [cfg.sectionId],
    topK: 8,
  });
  if (refs.length === 0) {
    throw new Error(`No structured historical refs for ${cfg.sectionId}`);
  }
  let chosen = refs[0];
  if (cfg.preferNumericLeakage) {
    for (const r of refs) {
      const nums = extractNumberishTokens(r.chunkText);
      const chunk = await getChunkById(r.chunkId);
      const text = chunk?.chunkText ?? r.chunkText;
      if (extractNumberishTokens(text).some((n) => /24|5%|99\.9|30 day|3 supplier/i.test(n))) {
        chosen = r;
        break;
      }
    }
  }
  const chunk = await getChunkById(chosen.chunkId);
  const excerpt = chunk?.chunkText ?? chosen.chunkText;
  return {
    chunkId: chosen.chunkId,
    historicalRfpId: chosen.historicalRfpId,
    excerpt,
    numericTokens: extractNumberishTokens(excerpt).slice(0, 12),
    nameTokens: extractNameishTokens(excerpt).slice(0, 8),
  };
}

async function ensureEvalProject() {
  clearAllSessionCache();
  const { execSync } = await import('node:child_process');
  execSync('npx tsx scripts/seed-rag-live-eval.ts', { stdio: 'inherit' });
  clearAllSessionCache();
}

async function runCase(
  cfg: LiveCaseConfig,
  provider: RamiModelProvider,
  providerLabel: string,
  modelLabel: string,
): Promise<Record<string, unknown>> {
  const project = await findProjectByDocumentKey(EVAL_DOCUMENT_KEY);
  if (!project) throw new Error('Eval project missing');

  await revokeSectionRefs(cfg.sectionId);

  const session = await hydrateProject(EVAL_DOCUMENT_KEY);
  const readinessBefore = getSectionReadiness(
    session.memory,
    cfg.sectionId,
    session.projectContext,
  );
  if (readinessBefore.readiness === 'NOT_READY' || readinessBefore.readiness === 'NOT_APPLICABLE') {
    return {
      caseId: cfg.id,
      sectionId: cfg.sectionId,
      skipped: true,
      reason: `Readiness ${readinessBefore.readiness}`,
    };
  }

  const facts0 = await listProjectFacts(project.project_id);
  const fp0 = factFingerprint(facts0);

  const t0 = Date.now();
  const baseline = await generateRfpSection({
    documentKey: EVAL_DOCUMENT_KEY,
    sectionId: cfg.sectionId,
    provider,
    reopenApproved: true,
  });
  const baselineMs = Date.now() - t0;

  const facts1 = await listProjectFacts(project.project_id);
  const fp1 = factFingerprint(facts1);
  if (fp1 !== fp0) throw new Error(`${cfg.id}: ProjectFacts changed after baseline`);

  const fieldIds = getFieldIdsForSection(cfg.sectionId);
  const picked = await pickChunk(cfg, fieldIds);

  const approved = await approveDraftingReference({
    documentKey: EVAL_DOCUMENT_KEY,
    sectionId: cfg.sectionId,
    chunkId: picked.chunkId,
  });

  const facts2 = await listProjectFacts(project.project_id);
  const fp2 = factFingerprint(facts2);
  if (fp2 !== fp0) throw new Error(`${cfg.id}: ProjectFacts changed after reference approval`);

  const readinessAfterApprove = getSectionReadiness(
    session.memory,
    cfg.sectionId,
    session.projectContext,
  );
  if (readinessAfterApprove.readiness !== readinessBefore.readiness) {
    throw new Error(`${cfg.id}: Readiness changed after reference approval`);
  }

  const t1 = Date.now();
  const assisted = await generateRfpSection({
    documentKey: EVAL_DOCUMENT_KEY,
    sectionId: cfg.sectionId,
    provider,
    reopenApproved: true,
  });
  const assistedMs = Date.now() - t1;

  const facts3 = await listProjectFacts(project.project_id);
  const fp3 = factFingerprint(facts3);
  if (fp3 !== fp0) throw new Error(`${cfg.id}: ProjectFacts changed after assisted generation`);

  const sessionAfter = await hydrateProject(EVAL_DOCUMENT_KEY);
  const readinessAfter = getSectionReadiness(
    sessionAfter.memory,
    cfg.sectionId,
    sessionAfter.projectContext,
  );
  if (readinessAfter.readiness !== readinessBefore.readiness) {
    throw new Error(`${cfg.id}: Readiness changed after assisted generation`);
  }

  const baselineMetrics = structureMetrics(baseline.generated.blocks);
  const assistedMetrics = structureMetrics(assisted.generated.blocks);
  const assistedHay = blockHaystack(assisted.generated.blocks);
  const leaked = leakedHistoricalTokens(assisted.context, assisted.context.approvedHistoricalReferences);
  const leakageHits = findLeakageInBlocks(assisted.generated.blocks, leaked);
  const overlap = ngramOverlapRatio(assistedHay, picked.excerpt, 5);
  const longestPhrase = longestMatchingPhrase(assistedHay, picked.excerpt);

  const claimsBaseline = classifyMaterialClaims(baseline.generated.blocks, baseline.context);
  const claimsAssisted = classifyMaterialClaims(assisted.generated.blocks, assisted.context);
  const unsupportedBaseline = claimsBaseline.filter((c) => c.classification === 'UNSUPPORTED').length;
  const unsupportedAssisted = claimsAssisted.filter((c) => c.classification === 'UNSUPPORTED').length;

  const tbcFieldIds = baseline.context.tbcFields.map((f) => f.fieldId);
  const tbcPreserved =
    tbcFieldIds.length === 0 ||
    (baselineMetrics.tbcBlocks > 0 &&
      assistedMetrics.tbcBlocks > 0 &&
      tbcFieldIds.every(
        (id) =>
          baseline.generated.blocks.some((b) => b.type === 'tbc' && b.fieldId === id) &&
          assisted.generated.blocks.some((b) => b.type === 'tbc' && b.fieldId === id),
      ));

  const rubric = scoreRubric({
    baseline: baselineMetrics,
    assisted: assistedMetrics,
    unsupportedBaseline,
    unsupportedAssisted,
    leakageCount: leakageHits.length,
    overlap,
    tbcPreserved,
    readinessUnchanged: true,
    factsUnchanged: true,
  });

  const improved =
    assistedMetrics.headings > baselineMetrics.headings ||
    assistedMetrics.listItems > baselineMetrics.listItems;

  const verdict = caseVerdict(rubric, leakageHits.length, improved);

  clearAllSessionCache();
  const reloaded = await getGeneratedSection({
    documentKey: EVAL_DOCUMENT_KEY,
    sectionId: cfg.sectionId,
  });

  return {
    caseId: cfg.id,
    label: cfg.label,
    sectionId: cfg.sectionId,
    readiness: readinessBefore.readiness,
    provider: providerLabel,
    model: modelLabel,
    projectFactFingerprint: fp0.slice(0, 64) + '…',
    factsUnchanged: fp0 === fp1 && fp1 === fp2 && fp2 === fp3,
    readinessUnchanged: true,
    baseline: {
      version: baseline.content.version,
      durationMs: baselineMs,
      metrics: baselineMetrics,
      historicalReferenceIds: baseline.generated.historicalReferenceIds ?? [],
      modelUsed: baseline.generated.modelUsed,
    },
    reference: {
      chunkId: picked.chunkId,
      historicalRfpId: picked.historicalRfpId,
      generationReferenceId: approved.generationReferenceId,
      excerptChars: picked.excerpt.length,
      numericTokensInReference: picked.numericTokens,
      nameTokensInReference: picked.nameTokens,
    },
    assisted: {
      version: assisted.content.version,
      durationMs: assistedMs,
      metrics: assistedMetrics,
      historicalReferenceIds: assisted.generated.historicalReferenceIds ?? [],
      generationReferenceIds: assisted.generated.generationReferenceIds ?? [],
      modelUsed: assisted.generated.modelUsed,
      reloadVersion: reloaded?.version ?? null,
    },
    leakage: {
      deterministicHits: leakageHits,
      ngramOverlap5: Number(overlap.toFixed(3)),
      longestMatchingPhraseWords: longestPhrase,
      sourceOverlapFlag: overlap > 0.35,
    },
    claims: { baseline: claimsBaseline, assisted: claimsAssisted, unsupportedAssisted },
    tbc: {
      fieldIds: tbcFieldIds,
      baselineTbcBlocks: baselineMetrics.tbcBlocks,
      assistedTbcBlocks: assistedMetrics.tbcBlocks,
      preserved: tbcPreserved,
    },
    rubric,
    verdict,
  };
}

async function revokeFlowTest(provider: RamiModelProvider) {
  const sectionId = 'deliverables';
  await revokeSectionRefs(sectionId);
  const project = await findProjectByDocumentKey(EVAL_DOCUMENT_KEY);
  if (!project) throw new Error('missing project');
  const fpBefore = factFingerprint(await listProjectFacts(project.project_id));

  const fieldIds = getFieldIdsForSection(sectionId);
  const refs = await retrieveHistoricalReferences('deliverables examples', {
    mode: 'structured',
    fieldIds: fieldIds.slice(0, 6),
    sectionIds: [sectionId],
    topK: 3,
  });
  const chunkId = refs[0]?.chunkId;
  if (!chunkId) return { ok: false, reason: 'no chunk' };

  const approved = await approveDraftingReference({
    documentKey: EVAL_DOCUMENT_KEY,
    sectionId,
    chunkId,
  });
  const assisted = await generateRfpSection({
    documentKey: EVAL_DOCUMENT_KEY,
    sectionId,
    provider,
    reopenApproved: true,
  });
  const assistedVersion = assisted.content.version;
  const assistedLineage = assisted.generated.historicalReferenceIds ?? [];

  await revokeDraftingReference({
    documentKey: EVAL_DOCUMENT_KEY,
    generationReferenceId: approved.generationReferenceId,
  });

  const regen = await generateRfpSection({
    documentKey: EVAL_DOCUMENT_KEY,
    sectionId,
    provider,
    reopenApproved: true,
  });

  const fpAfter = factFingerprint(await listProjectFacts(project.project_id));
  const hist = await listSectionContentHistory(project.project_id, sectionId);
  const kept = hist.find((h) => h.version === assistedVersion);

  return {
    ok:
      fpBefore === fpAfter &&
      (regen.generated.historicalReferenceIds ?? []).length === 0 &&
      (kept?.content_json.historicalReferenceIds ?? []).includes(chunkId),
    assistedLineage,
    regenRefs: regen.generated.historicalReferenceIds ?? [],
    keptLineage: kept?.content_json.historicalReferenceIds ?? [],
  };
}

function decisionGate(cases: Array<Record<string, unknown>>): {
  gate: 'A' | 'B' | 'C' | 'INCOMPLETE';
  label: string;
} {
  const ran = cases.filter((c) => !c.skipped && !c.error);
  const errors = cases.filter((c) => c.error).length;
  const unsafe = ran.filter((c) => c.verdict === 'UNSAFE').length;
  const clear = ran.filter((c) => c.verdict === 'CLEAR_IMPROVEMENT').length;
  const mixed = ran.filter((c) => c.verdict === 'MIXED').length;
  if (errors > 0) return { gate: 'INCOMPLETE', label: 'INCOMPLETE — generation errors' };
  if (unsafe > 0) return { gate: 'C', label: 'NOT SAFE YET' };
  if (clear >= Math.ceil(ran.length / 2)) return { gate: 'A', label: 'SAFE AND BENEFICIAL' };
  if (clear + mixed >= ran.length) return { gate: 'B', label: 'SAFE BUT QUALITY BENEFIT UNCLEAR' };
  return { gate: 'B', label: 'SAFE BUT QUALITY BENEFIT UNCLEAR' };
}

async function main() {
  loadLocalEnv();
  mkdirSync(DERIVED, { recursive: true });

  clearDefaultProvider();
  const provider = getDefaultProvider();
  const health = await provider.healthCheck();
  if (!health.defaultModelAvailable || !health.smokeTestPassed) {
    throw new Error(
      `Real provider not ready: ${health.providerType} smoke=${health.smokeTestPassed} ${health.smokeTestError ?? ''}`,
    );
  }
  const providerLabel = health.providerType;
  const modelLabel = health.models.find((m) => m.role === 'default')?.name ?? 'qwen3:8b';

  console.log('\n=== LIVE generation-RAG quality validation (real Qwen) ===\n');
  console.log('provider', providerLabel, 'model', modelLabel);

  await ensureEvalProject();

  const selected = casesToRun();
  const merge = process.env.LIVE_EVAL_MERGE === '1';
  const priorArtifact = merge ? loadExistingArtifact() : null;
  const priorCases = (priorArtifact?.cases as Array<Record<string, unknown>> | undefined) ?? [];

  const caseResults: Array<Record<string, unknown>> = [];
  for (const cfg of selected) {
    console.log(`\n--- Case ${cfg.id} (${cfg.sectionId}) ---`);
    try {
      const result = await runCase(cfg, provider, providerLabel, modelLabel);
      caseResults.push(result);
      console.log('verdict', result.verdict, result.skipped ? `(skipped: ${result.reason})` : '');
      if (!result.skipped) {
        console.log('baselineMs', result.baseline, 'assistedMs', result.assisted);
        console.log('leakage', result.leakage);
      }
    } catch (err) {
      console.error(`Case ${cfg.id} FAILED`, err);
      const project = await findProjectByDocumentKey(EVAL_DOCUMENT_KEY);
      const fp = project ? factFingerprint(await listProjectFacts(project.project_id)) : null;
      const priorVersion = await getGeneratedSection({
        documentKey: EVAL_DOCUMENT_KEY,
        sectionId: cfg.sectionId,
      });
      const activeRefs = await listDraftingReferences({
        documentKey: EVAL_DOCUMENT_KEY,
        sectionId: cfg.sectionId,
        status: 'ACTIVE',
      });
      caseResults.push({
        caseId: cfg.id,
        sectionId: cfg.sectionId,
        error: err instanceof Error ? err.message : String(err),
        verdict: 'ERROR',
        generationFailureSafety: {
          priorVersionIntact: priorVersion != null,
          priorVersion: priorVersion?.version ?? null,
          projectFactsFingerprintStable: fp != null,
          activeDraftingRefs: activeRefs.length,
        },
      });
    }
  }

  const mergedCases = merge ? mergeCaseResults(priorCases, caseResults) : caseResults;

  let revokeTest = priorArtifact?.revokeReferenceTest as Record<string, unknown> | undefined;
  if (selected.length === CASES.length) {
    console.log('\n--- Revoke reference flow (deliverables) ---');
    revokeTest = await revokeFlowTest(provider);
    console.log(revokeTest);
  }

  const decision = decisionGate(mergedCases);
  const out = {
    generatedAt: new Date().toISOString(),
    validationType: 'LIVE_QWEN_QUALITY',
    mockValidationSeparate: 'npm run validate:generation-rag',
    startingCommitNote: '4697c9b48bd3469bb8b284bc38acbc6c3d9e0327',
    provider: providerLabel,
    model: modelLabel,
    evaluationProject: EVAL_DOCUMENT_KEY,
    canonical: { sections: RFP_SECTIONS.length, fields: CANONICAL_FIELD_COUNT, questions: CANONICAL_QUESTION_COUNT },
    pgvector: 'not installed',
    automaticRetrievalOnGenerate: false,
    cases: mergedCases,
    revokeReferenceTest: revokeTest ?? null,
    decisionGate: decision,
  };

  writeFileSync(JSON_OUT, `${JSON.stringify(out, null, 2)}\n`);

  const ran = mergedCases.filter((c) => !c.skipped && !c.error);
  const md = [
    '# Live generation-RAG quality validation',
    '',
    `Generated: ${out.generatedAt}`,
    '',
    `- **Provider:** ${providerLabel} / ${modelLabel}`,
    `- **Project:** \`${EVAL_DOCUMENT_KEY}\``,
    `- **Cases run:** ${ran.length}/${CASES.length}`,
    `- **Decision gate:** ${decision.gate} — ${decision.label}`,
    '',
    '## Distinction',
    '',
    '- **Mock safety:** `npm run validate:generation-rag` (deterministic / mock provider)',
    '- **Live quality:** `npm run validate:generation-rag-live` (this run — real Qwen)',
    '',
    '## Case verdicts',
    '',
    ...mergedCases.map(
      (c) =>
        `- **${c.caseId}** (${c.sectionId}): ${c.skipped ? `SKIPPED — ${c.reason}` : c.error ? `ERROR — ${c.error}` : c.verdict}`,
    ),
    '',
    '## Isolation',
    '',
    `- ProjectFacts unchanged across all A/B pairs: ${ran.every((c) => c.factsUnchanged) ? 'yes' : 'NO'}`,
    `- Readiness unchanged: ${ran.every((c) => c.readinessUnchanged) ? 'yes' : 'NO'}`,
    '',
    `Full artifact: \`${JSON_OUT}\``,
    '',
  ].join('\n');
  writeFileSync(MD_OUT, md);

  console.log('\nWrote', JSON_OUT);
  console.log('Wrote', MD_OUT);
  console.log('Decision gate:', decision);

  await closePool();
  const unsafe = caseResults.some((c) => c.verdict === 'UNSAFE' || c.error);
  process.exit(unsafe ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await closePool().catch(() => undefined);
  process.exit(1);
});
