/**
 * Phase 2.2 field control metadata: packs, materiality, default depth.
 * Does NOT add Phase 2.3 domain catalog fields — tags the existing 52 only.
 */

import type { PackId } from '@/types/projectContext';
import type { ExplorationDepth, Materiality } from '@/types/gapStatus';
import { CANONICAL_FIELD_IDS } from './projectMemoryFields';

export interface FieldControlMeta {
  packs: PackId[];
  materiality: Materiality;
  defaultDepth: ExplorationDepth;
  /** Fields that are tightly related for ASK_REQUIREMENTS clustering. */
  relatedAskPeers?: string[];
}

const M = {
  CRITICAL: 'CRITICAL' as Materiality,
  HIGH: 'HIGH' as Materiality,
  STANDARD: 'STANDARD' as Materiality,
  LOW: 'LOW' as Materiality,
};

const D = {
  SHORT: 'SHORT' as ExplorationDepth,
  STANDARD: 'STANDARD' as ExplorationDepth,
  DETAILED: 'DETAILED' as ExplorationDepth,
};

/**
 * Control metadata for all 52 canonical fields.
 * Pack tags are frozen PackIds; Phase 2.3 may add more fields under these packs.
 */
export const FIELD_CONTROL_META: Record<string, FieldControlMeta> = {
  // CORE — classification & discovery
  documentType: {
    packs: ['CORE'],
    materiality: M.CRITICAL,
    defaultDepth: D.STANDARD,
    relatedAskPeers: ['engagementType', 'beneficiaryEntity'],
  },
  documentTitle: { packs: ['CORE'], materiality: M.LOW, defaultDepth: D.SHORT },
  beneficiaryEntity: {
    packs: ['CORE'],
    materiality: M.CRITICAL,
    defaultDepth: D.STANDARD,
    relatedAskPeers: ['documentType'],
  },
  tenderNumber: { packs: ['CORE', 'PROCUREMENT'], materiality: M.LOW, defaultDepth: D.SHORT },
  proposalDeadline: { packs: ['CORE', 'PROCUREMENT'], materiality: M.LOW, defaultDepth: D.SHORT },
  referenceTemplateId: { packs: ['CORE'], materiality: M.LOW, defaultDepth: D.SHORT },

  currentSituation: {
    packs: ['CORE'],
    materiality: M.CRITICAL,
    defaultDepth: D.STANDARD,
    relatedAskPeers: ['painPoints', 'businessNeedRationale'],
  },
  painPoints: {
    packs: ['CORE', 'BPR'],
    materiality: M.HIGH,
    defaultDepth: D.STANDARD,
    relatedAskPeers: ['currentSituation', 'businessObjectives'],
  },
  businessNeedRationale: {
    packs: ['CORE'],
    materiality: M.CRITICAL,
    defaultDepth: D.STANDARD,
    relatedAskPeers: ['currentSituation', 'businessObjectives'],
  },
  businessObjectives: {
    packs: ['CORE'],
    materiality: M.HIGH,
    defaultDepth: D.STANDARD,
    relatedAskPeers: ['painPoints', 'inScope'],
  },
  previousPhases: { packs: ['CORE'], materiality: M.STANDARD, defaultDepth: D.SHORT },

  engagementType: {
    packs: ['CORE'],
    materiality: M.CRITICAL,
    defaultDepth: D.STANDARD,
    relatedAskPeers: ['documentType', 'engagementDuration'],
  },
  engagementPhases: { packs: ['CORE', 'PMO'], materiality: M.STANDARD, defaultDepth: D.STANDARD },
  engagementDuration: {
    packs: ['CORE'],
    materiality: M.HIGH,
    defaultDepth: D.STANDARD,
    relatedAskPeers: ['engagementType'],
  },

  users: {
    packs: ['CORE'],
    materiality: M.HIGH,
    defaultDepth: D.STANDARD,
    relatedAskPeers: ['stakeholderRoles', 'inScope'],
  },
  stakeholderRoles: {
    packs: ['CORE', 'PMO', 'BPR'],
    materiality: M.STANDARD,
    defaultDepth: D.STANDARD,
    relatedAskPeers: ['users', 'painPoints'],
  },
  approvers: { packs: ['CORE', 'PMO'], materiality: M.STANDARD, defaultDepth: D.SHORT },
  uatOwners: { packs: ['SYSTEM_IMPLEMENTATION'], materiality: M.STANDARD, defaultDepth: D.SHORT },
  postGoLiveOwner: { packs: ['SYSTEM_IMPLEMENTATION'], materiality: M.STANDARD, defaultDepth: D.SHORT },

  inScope: {
    packs: ['CORE'],
    materiality: M.CRITICAL,
    defaultDepth: D.DETAILED,
    relatedAskPeers: ['outOfScope', 'businessObjectives'],
  },
  outOfScope: {
    packs: ['CORE'],
    materiality: M.HIGH,
    defaultDepth: D.STANDARD,
    relatedAskPeers: ['inScope'],
  },
  bidderResponsibilities: {
    packs: ['PROCUREMENT', 'CORE'],
    materiality: M.STANDARD,
    defaultDepth: D.STANDARD,
  },
  entityResponsibilities: {
    packs: ['PROCUREMENT', 'CORE'],
    materiality: M.STANDARD,
    defaultDepth: D.STANDARD,
  },
  assumptionsDependenciesConstraints: {
    packs: ['CORE'],
    materiality: M.STANDARD,
    defaultDepth: D.SHORT,
  },

  // SYSTEM
  functionalModules: {
    packs: ['SYSTEM_IMPLEMENTATION'],
    materiality: M.HIGH,
    defaultDepth: D.DETAILED,
    relatedAskPeers: ['keyWorkflows', 'users'],
  },
  keyWorkflows: {
    packs: ['SYSTEM_IMPLEMENTATION', 'BPR'],
    materiality: M.HIGH,
    defaultDepth: D.DETAILED,
    relatedAskPeers: ['functionalModules', 'painPoints'],
  },
  reportingNeeds: {
    packs: ['SYSTEM_IMPLEMENTATION'],
    materiality: M.STANDARD,
    defaultDepth: D.STANDARD,
  },
  caseManagementNeeds: {
    packs: ['SYSTEM_IMPLEMENTATION'],
    materiality: M.STANDARD,
    defaultDepth: D.STANDARD,
  },
  aiFeatures: {
    packs: ['SYSTEM_IMPLEMENTATION', 'AI_AGENTIC'],
    materiality: M.STANDARD,
    defaultDepth: D.STANDARD,
  },

  hostingModel: {
    packs: ['SYSTEM_IMPLEMENTATION', 'SECURITY'],
    materiality: M.HIGH,
    defaultDepth: D.STANDARD,
    relatedAskPeers: ['securityRequirements', 'integrations'],
  },
  integrations: {
    packs: ['SYSTEM_IMPLEMENTATION', 'DATA_PLATFORM'],
    materiality: M.HIGH,
    defaultDepth: D.DETAILED,
    relatedAskPeers: ['hostingModel', 'functionalModules'],
  },
  securityRequirements: {
    packs: ['SECURITY', 'SYSTEM_IMPLEMENTATION'],
    materiality: M.HIGH,
    defaultDepth: D.STANDARD,
    relatedAskPeers: ['hostingModel'],
  },
  performanceAvailabilityTargets: {
    packs: ['SYSTEM_IMPLEMENTATION', 'SLA_SUPPORT', 'CONNECTIVITY'],
    materiality: M.STANDARD,
    defaultDepth: D.STANDARD,
  },
  dataMigrationNeeds: {
    packs: ['SYSTEM_IMPLEMENTATION', 'DATA_PLATFORM'],
    materiality: M.STANDARD,
    defaultDepth: D.STANDARD,
  },

  deliverableItems: {
    packs: ['CORE'],
    materiality: M.HIGH,
    defaultDepth: D.STANDARD,
    relatedAskPeers: ['inScope', 'engagementDuration'],
  },
  deliverableFormats: { packs: ['CORE'], materiality: M.LOW, defaultDepth: D.SHORT },
  deliverableApprovers: { packs: ['CORE', 'PMO'], materiality: M.LOW, defaultDepth: D.SHORT },

  uatRounds: {
    packs: ['SYSTEM_IMPLEMENTATION'],
    materiality: M.STANDARD,
    defaultDepth: D.SHORT,
  },
  acceptanceCriteria: {
    packs: ['CORE', 'SYSTEM_IMPLEMENTATION', 'ASSESSMENT_TESTING'],
    materiality: M.HIGH,
    defaultDepth: D.STANDARD,
    relatedAskPeers: ['deliverableItems'],
  },
  rollbackPlanNeeded: {
    packs: ['SYSTEM_IMPLEMENTATION'],
    materiality: M.LOW,
    defaultDepth: D.SHORT,
  },

  // SLA
  supportPeriodAndHours: {
    packs: ['SLA_SUPPORT'],
    materiality: M.HIGH,
    defaultDepth: D.STANDARD,
    relatedAskPeers: ['slaTiers'],
  },
  slaTiers: {
    packs: ['SLA_SUPPORT', 'CONNECTIVITY'],
    materiality: M.HIGH,
    defaultDepth: D.DETAILED,
    relatedAskPeers: ['supportPeriodAndHours', 'supportPenalties'],
  },
  supportOperatingModel: {
    packs: ['SLA_SUPPORT'],
    materiality: M.STANDARD,
    defaultDepth: D.STANDARD,
  },
  supportPenalties: {
    packs: ['SLA_SUPPORT', 'PROCUREMENT'],
    materiality: M.HIGH,
    defaultDepth: D.STANDARD,
  },

  // PROCUREMENT
  evaluationWeights: {
    packs: ['PROCUREMENT', 'PRE_QUALIFICATION'],
    materiality: M.HIGH,
    defaultDepth: D.STANDARD,
    relatedAskPeers: ['evaluationRules'],
  },
  evaluationRules: {
    packs: ['PROCUREMENT', 'PRE_QUALIFICATION'],
    materiality: M.HIGH,
    defaultDepth: D.STANDARD,
    relatedAskPeers: ['evaluationWeights'],
  },
  pricingModelAndCostBreakdown: {
    packs: ['PROCUREMENT'],
    materiality: M.HIGH,
    defaultDepth: D.STANDARD,
  },
  optionalItemsAndTaxes: {
    packs: ['PROCUREMENT'],
    materiality: M.STANDARD,
    defaultDepth: D.SHORT,
  },
  legalTerms: {
    packs: ['PROCUREMENT'],
    materiality: M.HIGH,
    defaultDepth: D.STANDARD,
  },
  jvSubcontractingRules: {
    packs: ['PROCUREMENT', 'FRAMEWORK'],
    materiality: M.STANDARD,
    defaultDepth: D.SHORT,
  },
  requiredAnnexes: {
    packs: ['PROCUREMENT', 'PRE_QUALIFICATION'],
    materiality: M.HIGH,
    defaultDepth: D.STANDARD,
  },

  riskNotes: { packs: ['CORE'], materiality: M.LOW, defaultDepth: D.SHORT },
};

const DEFAULT_META: FieldControlMeta = {
  packs: ['CORE'],
  materiality: M.STANDARD,
  defaultDepth: D.STANDARD,
};

export function getFieldControlMeta(fieldId: string): FieldControlMeta {
  return FIELD_CONTROL_META[fieldId] ?? DEFAULT_META;
}

/** Sanity: every canonical field has an entry (dev-time check used by validators). */
export function assertAllFieldsHaveControlMeta(): string[] {
  const missing: string[] = [];
  for (const id of CANONICAL_FIELD_IDS) {
    if (!FIELD_CONTROL_META[id]) missing.push(id);
  }
  return missing;
}
