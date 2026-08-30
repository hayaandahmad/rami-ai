/**
 * Deterministic project classifier (Phase 2.2).
 * LLM emits signals only; this module decides enums / complexity / context fields.
 * Never invents FULL_RFP / SINGLE_PROJECT / domain without evidence.
 */

import type { ProjectMemory } from '@/types/projectMemory';
import type {
  ComplexityLevel,
  ComplexityProfile,
  ContractingGranularity,
  DocumentStage,
  ProjectContext,
  ProjectDomain,
} from '@/types/projectContext';
import {
  createEmptyProjectContext,
  createEmptyComplexity,
} from '@/types/projectContext';
import type { ExtractionSignals } from '@/server/ai/extractionSchema';

function memStr(memory: ProjectMemory, fieldId: keyof ProjectMemory): string {
  const field = memory[fieldId];
  const v = field?.current?.value;
  if (typeof v === 'string') return v.toLowerCase();
  if (Array.isArray(v)) return v.map(String).join(' ').toLowerCase();
  if (v && typeof v === 'object') return JSON.stringify(v).toLowerCase();
  return '';
}

function mapDocumentTypeToDomain(docType: string): ProjectDomain | null {
  const t = docType.toLowerCase().trim();
  if (!t) return null;
  if (t.includes('system') || t.includes('implementation')) return 'SYSTEM_IMPLEMENTATION';
  if (t.includes('framework')) return 'GENERAL'; // granularity handles framework
  if (t.includes('consult')) return 'CONSULTING';
  if (t.includes('assess') || t.includes('audit') || t.includes('test')) return 'ASSESSMENT';
  if (t.includes('support') || t.includes('sla') || t.includes('maintenance')) return 'SLA_SUPPORT';
  if (t.includes('connect') || t.includes('telecom') || t.includes('mpls') || t.includes('vpn')) {
    return 'CONNECTIVITY';
  }
  if (t.includes('bpr') || t.includes('reengine') || t.includes('process')) return 'BPR';
  if (t.includes('data') || t.includes('lakehouse') || t.includes('warehouse')) return 'DATA_PLATFORM';
  if (t.includes('ai') || t.includes('chatbot') || t.includes('llm') || t.includes('agentic')) {
    return 'AI_AGENTIC';
  }
  return 'GENERAL';
}

function inferStageFromText(blob: string, signal?: string): DocumentStage {
  const s = `${signal ?? ''} ${blob}`.toLowerCase();
  if (!s.trim()) return 'UNDETERMINED';
  // Prefer explicit enum-like signals when provided
  if (signal) {
    const sig = signal.toUpperCase().replace(/[\s-]+/g, '_');
    const stages: DocumentStage[] = [
      'RFI',
      'MARKET_SOUNDING',
      'PRE_QUALIFICATION',
      'FULL_RFP',
      'FRAMEWORK_QUALIFICATION',
      'SOW_OR_CALL_OFF',
      'CONTRACT_OR_AWARD',
    ];
    if ((stages as string[]).includes(sig)) return sig as DocumentStage;
  }
  if (/\b(pre[-_]?qual|pq\b|eoi\b|shortlist|expression of interest)\b/.test(s)) {
    return 'PRE_QUALIFICATION';
  }
  if (/\b(rfi|request for information|market sounding)\b/.test(s)) {
    return s.includes('market') ? 'MARKET_SOUNDING' : 'RFI';
  }
  if (/\b(sow|call-?off|work order|assignment under)\b/.test(s)) return 'SOW_OR_CALL_OFF';
  if (/\b(framework qualification|qualify.*framework)\b/.test(s)) return 'FRAMEWORK_QUALIFICATION';
  if (/\b(contract award|award notice)\b/.test(s)) return 'CONTRACT_OR_AWARD';
  if (/\b(rfp|tender|request for proposal)\b/.test(s)) return 'FULL_RFP';
  return 'UNDETERMINED';
}

function inferGranularity(
  docType: string,
  engType: string,
  blob: string,
  signal?: string,
): ContractingGranularity {
  const s = `${signal ?? ''} ${docType} ${engType} ${blob}`.toLowerCase();
  if (!s.trim()) return 'UNDETERMINED';
  if (/\bframework\b/.test(s)) return 'FRAMEWORK';
  if (/\b(call-?off|sow|assignment|work order)\b/.test(s)) return 'ASSIGNMENT';
  if (/\b(one-?time|single project|fixed scope|one off)\b/.test(s)) return 'SINGLE_PROJECT';
  // Known concrete document types that are not frameworks
  if (
    docType.includes('system') ||
    docType.includes('consult') ||
    docType.includes('assess') ||
    docType.includes('support') ||
    docType.includes('connect')
  ) {
    return 'SINGLE_PROJECT';
  }
  return 'UNDETERMINED';
}

function bump(level: ComplexityLevel, to: ComplexityLevel): ComplexityLevel {
  const order: ComplexityLevel[] = ['UNDETERMINED', 'LOW', 'MEDIUM', 'HIGH'];
  return order.indexOf(to) > order.indexOf(level) ? to : level;
}

function scoreComplexity(memory: ProjectMemory, domain: ProjectDomain): ComplexityProfile {
  const c = createEmptyComplexity();
  const blob = [
    memStr(memory, 'documentType'),
    memStr(memory, 'engagementType'),
    memStr(memory, 'inScope'),
    memStr(memory, 'currentSituation'),
    memStr(memory, 'painPoints'),
    memStr(memory, 'integrations'),
    memStr(memory, 'securityRequirements'),
    memStr(memory, 'aiFeatures'),
  ].join(' ');

  if (domain === 'UNDETERMINED' && !blob.trim()) return c;

  // technical
  if (
    domain === 'SYSTEM_IMPLEMENTATION' ||
    domain === 'DATA_PLATFORM' ||
    domain === 'AI_AGENTIC' ||
    domain === 'CONNECTIVITY'
  ) {
    c.technical = bump(c.technical, 'HIGH');
  } else if (domain === 'CONSULTING' || domain === 'BPR' || domain === 'ASSESSMENT') {
    c.technical = bump(c.technical, 'LOW');
  }
  if (/\b(integrat|api|hosting|cloud|lakehouse|cdc|gpu)\b/.test(blob)) {
    c.technical = bump(c.technical, 'HIGH');
  }

  // process
  if (domain === 'BPR' || /\b(process|as-?is|to-?be|bpmn|workshop|reengine)\b/.test(blob)) {
    c.process = bump(c.process, 'HIGH');
  } else if (domain !== 'UNDETERMINED') {
    c.process = bump(c.process, 'MEDIUM');
  }

  // stakeholder
  const users = memory.users?.current?.value as { internal?: string[]; external?: string[] } | undefined;
  if ((users?.external?.length ?? 0) > 0 || /\b(citizen|public|multi-?ministr|committee)\b/.test(blob)) {
    c.stakeholder = bump(c.stakeholder, 'HIGH');
  } else if (domain !== 'UNDETERMINED') {
    c.stakeholder = bump(c.stakeholder, 'MEDIUM');
  }

  // securityRegulatory — independent of technical
  if (
    /\b(secur|privacy|sovereign|residen|pii|dlp|classif|regulatory|compliance|cyber)\b/.test(blob) ||
    !!memory.securityRequirements?.current?.value
  ) {
    c.securityRegulatory = bump(c.securityRegulatory, 'HIGH');
  } else if (domain === 'SYSTEM_IMPLEMENTATION' || domain === 'DATA_PLATFORM' || domain === 'AI_AGENTIC') {
    c.securityRegulatory = bump(c.securityRegulatory, 'MEDIUM');
  } else if (domain === 'BPR' || domain === 'CONSULTING') {
    // may still be medium if citizen data — leave UNDETERMINED unless signals
    c.securityRegulatory = bump(c.securityRegulatory, 'LOW');
  }

  // operationalSla
  if (
    domain === 'SLA_SUPPORT' ||
    domain === 'CONNECTIVITY' ||
    /\b(sla|24\/7|severity|noc|helpdesk|severity)\b/.test(blob) ||
    !!memory.slaTiers?.current?.value
  ) {
    c.operationalSla = bump(c.operationalSla, 'HIGH');
  } else if (domain === 'SYSTEM_IMPLEMENTATION') {
    c.operationalSla = bump(c.operationalSla, 'MEDIUM');
  }

  // procurement
  if (
    /\b(framework|pre-?qual|bid bond|tender bond|evaluation weight|jv\b|donor)\b/.test(blob)
  ) {
    c.procurement = bump(c.procurement, 'HIGH');
  } else if (domain !== 'UNDETERMINED') {
    c.procurement = bump(c.procurement, 'MEDIUM');
  }

  return c;
}

function collectSecondary(
  domain: ProjectDomain,
  memory: ProjectMemory,
  signals?: ExtractionSignals,
): ProjectDomain[] {
  const set = new Set<ProjectDomain>();
  for (const d of signals?.domainSignals ?? []) {
    const mapped = mapDocumentTypeToDomain(d) ?? (d as ProjectDomain);
    if (mapped && mapped !== 'UNDETERMINED' && mapped !== domain) set.add(mapped);
  }
  if (memory.aiFeatures?.current?.value) set.add('AI_AGENTIC');
  if (memory.securityRequirements?.current?.value) set.add('SECURITY');
  if (memory.slaTiers?.current?.value || memory.supportPeriodAndHours?.current?.value) {
    set.add('SLA_SUPPORT');
  }
  if (
    /\b(train|change management|ocm)\b/i.test(memStr(memory, 'deliverableItems')) ||
    !!memory.knowledgeTransferRequirements?.current?.value
  ) {
    set.add('TRAINING');
  }
  if (/\b(data platform|lakehouse|cdc)\b/i.test(memStr(memory, 'inScope'))) {
    set.add('DATA_PLATFORM');
  }
  set.delete(domain);
  set.delete('UNDETERMINED');
  return [...set];
}

export interface ClassifyInput {
  memory: ProjectMemory;
  previous?: ProjectContext;
  signals?: ExtractionSignals;
  /** Raw latest BA message for light heuristics (optional). */
  latestMessage?: string;
}

/**
 * Produce an updated ProjectContext from memory + extraction signals.
 * Does not set activePacks or collectionSufficient — those are pack/gap engines.
 */
export function classifyProject(input: ClassifyInput): ProjectContext {
  const prev = input.previous ?? createEmptyProjectContext();
  const docType = (input.memory.documentType?.current?.value as string | undefined) ?? '';
  const engType = (input.memory.engagementType?.current?.value as string | undefined) ?? '';
  const blob = [
    docType,
    engType,
    memStr(input.memory, 'currentSituation'),
    memStr(input.memory, 'inScope'),
    memStr(input.memory, 'businessNeedRationale'),
    memStr(input.memory, 'awardModel'),
    memStr(input.memory, 'callOffOrSowProcess'),
    memStr(input.memory, 'namedKeyPersonnel'),
    memStr(input.memory, 'knowledgeTransferRequirements'),
    input.latestMessage ?? '',
  ].join(' ');

  let documentStage = inferStageFromText(blob, input.signals?.documentStageSignal);
  // Hysteresis: do not downgrade a determined stage to UNDETERMINED on a vague turn
  if (documentStage === 'UNDETERMINED' && prev.documentStage !== 'UNDETERMINED') {
    documentStage = prev.documentStage;
  }

  let contractingGranularity = inferGranularity(
    docType,
    engType,
    blob,
    input.signals?.granularitySignal,
  );
  if (
    contractingGranularity === 'UNDETERMINED' &&
    prev.contractingGranularity !== 'UNDETERMINED'
  ) {
    contractingGranularity = prev.contractingGranularity;
  }

  let primaryDomain: ProjectDomain =
    mapDocumentTypeToDomain(docType) ??
    (input.signals?.domainSignals?.[0]
      ? mapDocumentTypeToDomain(input.signals.domainSignals[0]) ?? 'UNDETERMINED'
      : 'UNDETERMINED');

  // BPR override from language even if documentType is consulting
  if (/\b(bpr|reengine|as-?is|to-?be|process redesign|process re-?engineer)\b/i.test(blob)) {
    if (primaryDomain === 'CONSULTING' || primaryDomain === 'GENERAL' || primaryDomain === 'UNDETERMINED') {
      primaryDomain = 'BPR';
    }
  }

  if (primaryDomain === 'UNDETERMINED' && prev.primaryDomain !== 'UNDETERMINED') {
    primaryDomain = prev.primaryDomain;
  }

  // Framework docType without domain → keep GENERAL but granularity FRAMEWORK
  if (docType.toLowerCase().includes('framework') && contractingGranularity === 'UNDETERMINED') {
    contractingGranularity = 'FRAMEWORK';
  }
  if (
    contractingGranularity === 'UNDETERMINED' &&
    memStr(input.memory, 'callOffOrSowProcess').trim()
  ) {
    contractingGranularity = 'FRAMEWORK';
  }

  const secondaryDomains = collectSecondary(primaryDomain, input.memory, input.signals);
  const complexity = scoreComplexity(input.memory, primaryDomain);

  return {
    documentStage,
    contractingGranularity,
    primaryDomain,
    secondaryDomains,
    complexity,
    activePacks: ['CORE'], // filled by questionPackEngine
    collectionSufficient: false, // filled by gapEngine
  };
}
