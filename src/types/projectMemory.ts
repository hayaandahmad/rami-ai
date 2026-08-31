/**
 * Structured project memory — the canonical, queryable store of facts
 * about the current engagement, keyed by the canonical field IDs.
 * Authority: .private-context/architecture/rfp-knowledge-architecture.md §1
 *
 * Domain organisation follows question-information-mapping.md groups:
 *   meta · background · engagement · stakeholders · scope ·
 *   functional · technical · deliverables · implementation ·
 *   support · evaluation · legal · riskNotes
 */

import type { ProjectMemoryField } from './provenance';
import type { SectionStateRecord } from './sectionState';

// ─────────────────────────────────────────────────────────────────────────────
// Value shapes for compound fields
// ─────────────────────────────────────────────────────────────────────────────

export interface UsersValue {
  internal: string[];
  external: string[];
}

export interface AssumptionsValue {
  assumptions: string[];
  dependencies: string[];
  constraints: string[];
}

export interface SlaTier {
  severity: string;    // e.g. "Severity 1 – Critical"
  description: string;
  responseTime: string;
  resolutionTime: string;
}

export interface CostBreakdownItem {
  component: string;
  amount?: string; // may be TBC
}

export interface PricingModelAndCostBreakdownValue {
  pricingModel: string; // e.g. "Fixed lump sum in JD"
  costBreakdown: CostBreakdownItem[];
}

export interface OptionalItemsAndTaxesValue {
  optionalPricedItems: string[];
  taxesNote?: string;
}

export type AwardModelKind =
  | 'single-supplier'
  | 'multi-supplier'
  | 'ranked-panel'
  | 'service-specific';

export interface AwardModelValue {
  /** Controlled award pattern — free text allowed if BA uses other wording. */
  model: AwardModelKind | string;
  supplierCount?: number | string;
}

export interface NamedKeyPerson {
  role: string;
  minExperience?: string;
  qualification?: string;
  cvRequired?: boolean;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// The full structured project memory shape.
// Each field is a nullable ProjectMemoryField (null = never set).
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectMemory {
  // ── meta ──────────────────────────────────────────────────────────────────
  documentType:          ProjectMemoryField<string>         | null;
  documentTitle:         ProjectMemoryField<string>         | null;
  issuerEntity:          ProjectMemoryField<string>         | null;
  beneficiaryEntity:     ProjectMemoryField<string>         | null;
  tenderNumber:          ProjectMemoryField<string>         | null;
  proposalDeadline:      ProjectMemoryField<string>         | null;
  referenceTemplateId:   ProjectMemoryField<string>         | null;

  // ── background ────────────────────────────────────────────────────────────
  currentSituation:      ProjectMemoryField<string>         | null;
  painPoints:            ProjectMemoryField<string[]>       | null;
  businessNeedRationale: ProjectMemoryField<string>         | null;
  businessObjectives:    ProjectMemoryField<string[]>       | null;
  previousPhases:        ProjectMemoryField<string>         | null;

  // ── engagement ────────────────────────────────────────────────────────────
  engagementType:        ProjectMemoryField<string>         | null;
  engagementPhases:      ProjectMemoryField<string[]>       | null;
  engagementDuration:    ProjectMemoryField<string>         | null;

  // ── stakeholders ──────────────────────────────────────────────────────────
  users:                 ProjectMemoryField<UsersValue>     | null;
  stakeholderRoles:      ProjectMemoryField<string[]>       | null;
  approvers:             ProjectMemoryField<string[]>       | null;
  uatOwners:             ProjectMemoryField<string>         | null;
  postGoLiveOwner:       ProjectMemoryField<string>         | null;

  // ── scope ─────────────────────────────────────────────────────────────────
  inScope:               ProjectMemoryField<string[]>       | null;
  outOfScope:            ProjectMemoryField<string[]>       | null;
  bidderResponsibilities:ProjectMemoryField<string[]>       | null;
  entityResponsibilities:ProjectMemoryField<string[]>       | null;
  assumptionsDependenciesConstraints: ProjectMemoryField<AssumptionsValue> | null;

  // ── functional (conditional block) ───────────────────────────────────────
  functionalModules:     ProjectMemoryField<string[]>       | null;
  keyWorkflows:          ProjectMemoryField<string[]>       | null;
  reportingNeeds:        ProjectMemoryField<string[]>       | null;
  caseManagementNeeds:   ProjectMemoryField<string[]>       | null;
  aiFeatures:            ProjectMemoryField<string[]>       | null;

  // ── technical (conditional block) ────────────────────────────────────────
  hostingModel:          ProjectMemoryField<string>         | null;
  integrations:          ProjectMemoryField<string[]>       | null;
  securityRequirements:  ProjectMemoryField<string[]>       | null;
  performanceAvailabilityTargets: ProjectMemoryField<string> | null;
  dataMigrationNeeds:    ProjectMemoryField<string>         | null;

  // ── deliverables ──────────────────────────────────────────────────────────
  deliverableItems:      ProjectMemoryField<string[]>       | null;
  deliverableFormats:    ProjectMemoryField<string[]>       | null;
  deliverableApprovers:  ProjectMemoryField<string[]>       | null;

  // ── implementation and acceptance ─────────────────────────────────────────
  uatRounds:             ProjectMemoryField<string>         | null;
  acceptanceCriteria:    ProjectMemoryField<string[]>       | null;
  rollbackPlanNeeded:    ProjectMemoryField<boolean>        | null;

  // ── support (conditional block) ───────────────────────────────────────────
  supportPeriodAndHours: ProjectMemoryField<string>         | null;
  slaTiers:              ProjectMemoryField<SlaTier[]>      | null;
  supportOperatingModel: ProjectMemoryField<string>         | null;
  supportPenalties:      ProjectMemoryField<string[]>       | null;

  // ── evaluation and financials ─────────────────────────────────────────────
  evaluationWeights:     ProjectMemoryField<string>         | null;
  evaluationRules:       ProjectMemoryField<string>         | null;
  pricingModelAndCostBreakdown: ProjectMemoryField<PricingModelAndCostBreakdownValue> | null;
  optionalItemsAndTaxes: ProjectMemoryField<OptionalItemsAndTaxesValue> | null;

  // ── legal and annexes ─────────────────────────────────────────────────────
  legalTerms:            ProjectMemoryField<string>         | null;
  jvSubcontractingRules: ProjectMemoryField<string>         | null;
  requiredAnnexes:       ProjectMemoryField<string[]>       | null;

  // ── promoted procurement / delivery (2026-08) ─────────────────────────────
  awardModel:            ProjectMemoryField<AwardModelValue> | null;
  callOffOrSowProcess:   ProjectMemoryField<string>         | null;
  namedKeyPersonnel:     ProjectMemoryField<NamedKeyPerson[]> | null;
  clarificationContact:  ProjectMemoryField<string>         | null;
  submissionChannel:     ProjectMemoryField<string>         | null;
  governanceCadence:     ProjectMemoryField<string>         | null;
  knowledgeTransferRequirements: ProjectMemoryField<string[]> | null;

  // ── risk notes (aggregate spinoff) ────────────────────────────────────────
  riskNotes:             ProjectMemoryField<string[]>       | null;
}

/** A complete project document session: memory + section states. */
export interface ProjectSession {
  sessionId: string;
  documentId: string;
  createdAt: string;
  updatedAt: string;
  memory: ProjectMemory;
  sectionStates: Record<string, SectionStateRecord>;
}

/** Creates a brand-new empty ProjectMemory with all fields null. */
export function createEmptyProjectMemory(): ProjectMemory {
  return {
    documentType: null,
    documentTitle: null,
    issuerEntity: null,
    beneficiaryEntity: null,
    tenderNumber: null,
    proposalDeadline: null,
    referenceTemplateId: null,
    currentSituation: null,
    painPoints: null,
    businessNeedRationale: null,
    businessObjectives: null,
    previousPhases: null,
    engagementType: null,
    engagementPhases: null,
    engagementDuration: null,
    users: null,
    stakeholderRoles: null,
    approvers: null,
    uatOwners: null,
    postGoLiveOwner: null,
    inScope: null,
    outOfScope: null,
    bidderResponsibilities: null,
    entityResponsibilities: null,
    assumptionsDependenciesConstraints: null,
    functionalModules: null,
    keyWorkflows: null,
    reportingNeeds: null,
    caseManagementNeeds: null,
    aiFeatures: null,
    hostingModel: null,
    integrations: null,
    securityRequirements: null,
    performanceAvailabilityTargets: null,
    dataMigrationNeeds: null,
    deliverableItems: null,
    deliverableFormats: null,
    deliverableApprovers: null,
    uatRounds: null,
    acceptanceCriteria: null,
    rollbackPlanNeeded: null,
    supportPeriodAndHours: null,
    slaTiers: null,
    supportOperatingModel: null,
    supportPenalties: null,
    evaluationWeights: null,
    evaluationRules: null,
    pricingModelAndCostBreakdown: null,
    optionalItemsAndTaxes: null,
    legalTerms: null,
    jvSubcontractingRules: null,
    requiredAnnexes: null,
    awardModel: null,
    callOffOrSowProcess: null,
    namedKeyPersonnel: null,
    clarificationContact: null,
    submissionChannel: null,
    governanceCadence: null,
    knowledgeTransferRequirements: null,
    riskNotes: null,
  };
}
