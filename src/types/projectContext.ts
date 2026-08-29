/**
 * ProjectContext — control-plane classifiers for Adaptive Control Plane (Phase 2.2).
 *
 * IMPORTANT: documentStage, contractingGranularity, primaryDomain, secondaryDomains,
 * complexity, and activePacks live HERE only — never duplicate them inside ProjectMemory.
 * Existing documentType / engagementType ProjectMemory fields remain compatibility signals.
 */

export type DocumentStage =
  | 'UNDETERMINED'
  | 'RFI'
  | 'MARKET_SOUNDING'
  | 'PRE_QUALIFICATION'
  | 'FULL_RFP'
  | 'FRAMEWORK_QUALIFICATION'
  | 'SOW_OR_CALL_OFF'
  | 'CONTRACT_OR_AWARD';

export type ContractingGranularity =
  | 'UNDETERMINED'
  | 'SINGLE_PROJECT'
  | 'FRAMEWORK'
  | 'ASSIGNMENT';

export type ProjectDomain =
  | 'UNDETERMINED'
  | 'GENERAL'
  | 'CONSULTING'
  | 'BPR'
  | 'ASSESSMENT'
  | 'SYSTEM_IMPLEMENTATION'
  | 'DATA_PLATFORM'
  | 'CONNECTIVITY'
  | 'AI_AGENTIC'
  | 'SECURITY'
  | 'PMO'
  | 'TRAINING'
  | 'SLA_SUPPORT';

/** Frozen PackId names — Phase 2.3 may add richer requirements under these packs. */
export type PackId =
  | 'CORE'
  | 'PROCUREMENT'
  | 'PRE_QUALIFICATION'
  | 'FRAMEWORK'
  | 'BPR'
  | 'DOWNSTREAM_DT_RFP'
  | 'SYSTEM_IMPLEMENTATION'
  | 'DATA_PLATFORM'
  | 'CONNECTIVITY'
  | 'AI_AGENTIC'
  | 'SECURITY'
  | 'PMO'
  | 'TRAINING_CHANGE'
  | 'SLA_SUPPORT'
  | 'ASSESSMENT_TESTING';

export const ALL_PACK_IDS: readonly PackId[] = [
  'CORE',
  'PROCUREMENT',
  'PRE_QUALIFICATION',
  'FRAMEWORK',
  'BPR',
  'DOWNSTREAM_DT_RFP',
  'SYSTEM_IMPLEMENTATION',
  'DATA_PLATFORM',
  'CONNECTIVITY',
  'AI_AGENTIC',
  'SECURITY',
  'PMO',
  'TRAINING_CHANGE',
  'SLA_SUPPORT',
  'ASSESSMENT_TESTING',
] as const;

export type ComplexityDim =
  | 'technical'
  | 'process'
  | 'stakeholder'
  | 'securityRegulatory'
  | 'operationalSla'
  | 'procurement';

export type ComplexityLevel = 'UNDETERMINED' | 'LOW' | 'MEDIUM' | 'HIGH';

export type ComplexityProfile = Record<ComplexityDim, ComplexityLevel>;

export const COMPLEXITY_DIMS: readonly ComplexityDim[] = [
  'technical',
  'process',
  'stakeholder',
  'securityRegulatory',
  'operationalSla',
  'procurement',
] as const;

export interface ProjectContext {
  documentStage: DocumentStage;
  contractingGranularity: ContractingGranularity;
  primaryDomain: ProjectDomain;
  secondaryDomains: ProjectDomain[];
  complexity: ComplexityProfile;
  activePacks: PackId[];
  /** True when materiality-based stop condition is met. */
  collectionSufficient: boolean;
}

export function createEmptyComplexity(): ComplexityProfile {
  return {
    technical: 'UNDETERMINED',
    process: 'UNDETERMINED',
    stakeholder: 'UNDETERMINED',
    securityRegulatory: 'UNDETERMINED',
    operationalSla: 'UNDETERMINED',
    procurement: 'UNDETERMINED',
  };
}

export function createEmptyProjectContext(): ProjectContext {
  return {
    documentStage: 'UNDETERMINED',
    contractingGranularity: 'UNDETERMINED',
    primaryDomain: 'UNDETERMINED',
    secondaryDomains: [],
    complexity: createEmptyComplexity(),
    activePacks: ['CORE'],
    collectionSufficient: false,
  };
}

/** True when stage / granularity / primary domain are still unresolved. */
export function isClassificationUnresolved(ctx: ProjectContext): boolean {
  return (
    ctx.documentStage === 'UNDETERMINED' ||
    ctx.contractingGranularity === 'UNDETERMINED' ||
    ctx.primaryDomain === 'UNDETERMINED'
  );
}
