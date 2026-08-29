/**
 * Question pack activation — metadata tags only (Phase 2.2).
 * Does not invent Phase 2.3 domain catalogs.
 */

import type {
  PackId,
  ProjectContext,
  ProjectDomain,
} from '@/types/projectContext';
import { isClassificationUnresolved } from '@/types/projectContext';
import type { ProjectMemory } from '@/types/projectMemory';

function hasEvidence(memory: ProjectMemory, fieldId: keyof ProjectMemory): boolean {
  const f = memory[fieldId];
  const v = f?.current?.value;
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/**
 * Compute active packs from ProjectContext + memory evidence.
 * UNDETERMINED classification ⇒ CORE only unless another pack is explicitly evidenced.
 */
export function activatePacks(ctx: ProjectContext, memory: ProjectMemory): PackId[] {
  const packs = new Set<PackId>(['CORE']);
  const unresolved = isClassificationUnresolved(ctx);

  const add = (p: PackId, evidence: boolean) => {
    if (evidence) packs.add(p);
  };

  // Explicit stage / granularity evidence always allowed
  add('PRE_QUALIFICATION', ctx.documentStage === 'PRE_QUALIFICATION');
  add('FRAMEWORK', ctx.contractingGranularity === 'FRAMEWORK');
  add(
    'PROCUREMENT',
    ctx.documentStage === 'FULL_RFP' ||
      ctx.documentStage === 'FRAMEWORK_QUALIFICATION' ||
      ctx.documentStage === 'CONTRACT_OR_AWARD' ||
      ctx.contractingGranularity === 'FRAMEWORK',
  );

  if (unresolved) {
    // Only CORE + packs with hard evidence while unresolved — never default FULL_RFP procurement
    if (
      ctx.documentStage === 'UNDETERMINED' &&
      ctx.contractingGranularity !== 'FRAMEWORK'
    ) {
      packs.delete('PROCUREMENT');
    }
    return [...packs];
  }

  const domains: ProjectDomain[] = [ctx.primaryDomain, ...ctx.secondaryDomains];

  const hasDomain = (...ds: ProjectDomain[]) => ds.some((d) => domains.includes(d));

  add('SYSTEM_IMPLEMENTATION', hasDomain('SYSTEM_IMPLEMENTATION'));
  add('DATA_PLATFORM', hasDomain('DATA_PLATFORM') || hasEvidence(memory, 'dataMigrationNeeds'));
  add('CONNECTIVITY', hasDomain('CONNECTIVITY'));
  add(
    'AI_AGENTIC',
    hasDomain('AI_AGENTIC') || hasEvidence(memory, 'aiFeatures'),
  );
  add('BPR', hasDomain('BPR'));
  add('ASSESSMENT_TESTING', hasDomain('ASSESSMENT'));
  add('SLA_SUPPORT', hasDomain('SLA_SUPPORT') || hasEvidence(memory, 'slaTiers'));
  add(
    'SECURITY',
    hasDomain('SECURITY') ||
      hasEvidence(memory, 'securityRequirements') ||
      hasDomain('SYSTEM_IMPLEMENTATION', 'DATA_PLATFORM', 'AI_AGENTIC'),
  );
  add(
    'PMO',
    hasDomain('PMO') ||
      ctx.complexity.process === 'HIGH' ||
      hasDomain('SYSTEM_IMPLEMENTATION'),
  );
  add(
    'TRAINING_CHANGE',
    hasDomain('TRAINING') ||
      (hasDomain('SYSTEM_IMPLEMENTATION') && hasEvidence(memory, 'deliverableItems')),
  );

  // Downstream DT RFP: only with explicit language in scope/objectives (evidence)
  const scopeBlob = JSON.stringify(memory.inScope?.current?.value ?? '').toLowerCase();
  const objBlob = JSON.stringify(memory.businessObjectives?.current?.value ?? '').toLowerCase();
  add(
    'DOWNSTREAM_DT_RFP',
    /\b(prepare|draft|write).{0,40}(rfp|tender)\b/.test(`${scopeBlob} ${objBlob}`) ||
      /\b(implementation-ready|downstream rfp|digital transformation rfp)\b/.test(
        `${scopeBlob} ${objBlob}`,
      ),
  );

  // Consulting without system: do not activate SYSTEM
  if (hasDomain('CONSULTING') && !hasDomain('SYSTEM_IMPLEMENTATION')) {
    packs.delete('SYSTEM_IMPLEMENTATION');
  }

  return [...packs];
}

export function withActivePacks(ctx: ProjectContext, memory: ProjectMemory): ProjectContext {
  return { ...ctx, activePacks: activatePacks(ctx, memory) };
}
