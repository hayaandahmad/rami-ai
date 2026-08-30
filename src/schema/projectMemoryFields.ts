/**
 * Canonical project information requirements (52 legacy + 7 promoted 2026-08).
 * Authority: .private-context/analysis/question-information-mapping.md
 *
 * These are the ONLY facts that belong in structured project memory.
 * AGENT_RULE / HEURISTIC lines and SYSTEM_DEFAULT lines from the Question Bank
 * are explicitly excluded (see question-information-mapping.md §2 Group 12).
 *
 * Do NOT add fields for Group-12 agent heuristics or duplicate Question Bank lines.
 */

import type { RfpSectionId } from './rfpSchema';
import type { PackId } from '@/types/projectContext';
import type { ExplorationDepth, Materiality } from '@/types/gapStatus';
import { getFieldControlMeta } from './fieldControlMeta';

export type FieldRequirement = 'required' | 'conditional';

export type FieldCategory =
  | 'PROJECT_INFORMATION'
  | 'AGENT_RULE'      // not stored — documented here only for traceability, not as live fields
  | 'SYSTEM_DEFAULT'; // not stored — configuration assumption

export interface ProjectMemoryFieldDef {
  /** Stable camelCase identifier. Used as the key in ProjectMemory. */
  fieldId: string;
  /** Human-readable label for UI and logs. */
  label: string;
  /** Canonical sections this field's value feeds into. */
  targetSections: RfpSectionId[];
  requirement: FieldRequirement;
  category: FieldCategory;
  /**
   * Whether Rami should explicitly ask the BA if this field is missing
   * (required=true: always ask; conditional=true: ask only when section is applicable).
   */
  explicitAskIfMissing: boolean;
  /** Whether historical RAG retrieval can provide supporting evidence. */
  historicalRetrievalSupported: boolean;
  /** Whether an explicit BA confirmation action is required (beyond just answering). */
  baConfirmationRequired: boolean;
  /** Free-text note for implementation reference. */
  notes?: string;
}

/** Phase 2.2 control-plane view of a field (packs / materiality / depth). */
export interface ProjectMemoryFieldControlView extends ProjectMemoryFieldDef {
  packs: PackId[];
  materiality: Materiality;
  defaultDepth: ExplorationDepth;
  relatedAskPeers: string[];
}

/**
 * Canonical information requirements, in Question Bank group order.
 * Groups: 0=DocumentSetup, 1=Background, 2=Engagement, 3=Stakeholders,
 *         4=Scope, 5=Functional, 6=Technical, 7=Deliverables,
 *         8=Implementation, 9=Support, 10=Evaluation, 11=Legal, 12=riskNotes
 */
export const PROJECT_MEMORY_FIELDS: readonly ProjectMemoryFieldDef[] = [
  // ── Group 0: Document Setup ──────────────────────────────────────────────
  {
    fieldId: 'documentType',
    label: 'Document / RFP Type',
    targetSections: ['coverPage'],
    requirement: 'required',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: false,
    baConfirmationRequired: true,
    notes: 'Master gate — drives conditional-section applicability for all other sections.',
  },
  {
    fieldId: 'documentTitle',
    label: 'Document / RFP Title',
    targetSections: ['coverPage'],
    requirement: 'required',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: false,
    baConfirmationRequired: false,
    notes: 'Usually volunteered in the opening BA message.',
  },
  {
    fieldId: 'beneficiaryEntity',
    label: 'Beneficiary Entity / Ministry',
    targetSections: ['coverPage', 'introduction'],
    requirement: 'required',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: false,
    baConfirmationRequired: true,
    notes: 'Merges Question Bank 0.3 and 3.1 (same fact, two angles).',
  },
  {
    fieldId: 'tenderNumber',
    label: 'Tender / RFP Number',
    targetSections: ['coverPage'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: false,
    baConfirmationRequired: false,
    notes: 'Often not yet assigned; TBC-eligible without blocking drafting.',
  },
  {
    fieldId: 'proposalDeadline',
    label: 'Proposal Deadline',
    targetSections: ['coverPage', 'administrativeProcedures'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: false,
    baConfirmationRequired: false,
    notes: 'TBC-eligible; low drafting risk if deferred.',
  },
  {
    fieldId: 'referenceTemplateId',
    label: 'Reference Template / Historical RFP to Follow',
    targetSections: ['coverPage'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: true,
    baConfirmationRequired: true,
    notes: 'Functions as a RAG retrieval hint. Rami can propose based on documentType if BA has no preference.',
  },

  // ── Group 1: Background and Business Need ───────────────────────────────
  {
    fieldId: 'currentSituation',
    label: 'Current Situation',
    targetSections: ['background'],
    requirement: 'required',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: true,
    baConfirmationRequired: false,
    notes: 'Often satisfied implicitly by the opening BA message.',
  },
  {
    fieldId: 'painPoints',
    label: 'Pain Points Today',
    targetSections: ['background'],
    requirement: 'required',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: true,
    baConfirmationRequired: false,
    notes: 'Distinct from currentSituation (symptom vs. situation).',
  },
  {
    fieldId: 'businessNeedRationale',
    label: 'Business Need Rationale (why now)',
    targetSections: ['background'],
    requirement: 'required',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: false,
    baConfirmationRequired: false,
  },
  {
    fieldId: 'businessObjectives',
    label: 'Business Objectives and Expected Impact',
    targetSections: ['background'],
    requirement: 'required',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: false,
    baConfirmationRequired: false,
  },
  {
    fieldId: 'previousPhases',
    label: 'Previous Phases / Systems / Contracts',
    targetSections: ['background'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: true,
    baConfirmationRequired: true,
    notes: 'Continuity claims are consequential — BA confirmation required.',
  },

  // ── Group 2: Engagement Type ─────────────────────────────────────────────
  {
    fieldId: 'engagementType',
    label: 'Engagement Type',
    targetSections: ['engagementDefinition'],
    requirement: 'required',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: false,
    baConfirmationRequired: true,
    notes: 'Distinct from documentType: 0.1 gates sections; 2.1 is the Engagement Definition wording. They can diverge.',
  },
  {
    fieldId: 'engagementPhases',
    label: 'Engagement Phases',
    targetSections: ['engagementDefinition', 'implementationRequirements'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: true,
    baConfirmationRequired: true,
    notes: 'Absorbs Question Bank 8.1 "stages/milestones" — same underlying data, redisplayed in two sections.',
  },
  {
    fieldId: 'engagementDuration',
    label: 'Engagement Duration',
    targetSections: ['engagementDefinition'],
    requirement: 'required',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: false,
    baConfirmationRequired: false,
    notes: 'Absorbs Question Bank 8.1 "timeline" aspect.',
  },

  // ── Group 3: Stakeholders and Users ─────────────────────────────────────
  {
    fieldId: 'users',
    label: 'Users (Internal and External)',
    targetSections: ['scopeOfWork'],
    requirement: 'required',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: false,
    baConfirmationRequired: false,
    notes: 'Structured field: { internal: string[], external: string[] }.',
  },
  {
    fieldId: 'stakeholderRoles',
    label: 'Stakeholder Roles Required',
    targetSections: ['scopeOfWork'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: false,
    baConfirmationRequired: false,
  },
  {
    fieldId: 'approvers',
    label: 'Approvers',
    targetSections: ['scopeOfWork', 'deliverables'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: false,
    baConfirmationRequired: false,
    notes: 'Split from Q-Bank 3.4: approvers feed general governance and Deliverables sign-off.',
  },
  {
    fieldId: 'uatOwners',
    label: 'UAT Owners',
    targetSections: ['acceptanceCriteria'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: false,
    baConfirmationRequired: false,
    notes: 'Split from Q-Bank 3.4: UAT owners feed Acceptance Criteria and Go-Live section.',
  },
  {
    fieldId: 'postGoLiveOwner',
    label: 'Post Go-Live System Owner',
    targetSections: ['scopeOfWork'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: false,
    baConfirmationRequired: true,
  },

  // ── Group 4: Scope of Work ───────────────────────────────────────────────
  {
    fieldId: 'inScope',
    label: 'In-Scope Activities',
    targetSections: ['scopeOfWork'],
    requirement: 'required',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: false,
    baConfirmationRequired: true,
    notes: 'High-impact / contractual — BA confirmation required before drafting.',
  },
  {
    fieldId: 'outOfScope',
    label: 'Out-of-Scope Activities',
    targetSections: ['scopeOfWork'],
    requirement: 'required',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: false,
    baConfirmationRequired: true,
    notes: 'Same importance as inScope — both are contractual boundaries.',
  },
  {
    fieldId: 'bidderResponsibilities',
    label: 'Bidder Responsibilities',
    targetSections: ['scopeOfWork'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: true,
    baConfirmationRequired: true,
    notes: 'Near-boilerplate — GeneralTemplate provides a strong default list; Rami PROPOSEs, BA edits.',
  },
  {
    fieldId: 'entityResponsibilities',
    label: 'MODEE / Entity Responsibilities',
    targetSections: ['scopeOfWork'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: true,
    baConfirmationRequired: true,
    notes: 'Same PROPOSE-then-confirm pattern as bidderResponsibilities.',
  },
  {
    fieldId: 'assumptionsDependenciesConstraints',
    label: 'Assumptions, Dependencies, and Constraints',
    targetSections: ['scopeOfWork'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: false,
    baConfirmationRequired: false,
    notes: 'One compound field: { assumptions: string[], dependencies: string[], constraints: string[] }.',
  },

  // ── Group 5: Functional Requirements (conditional block) ─────────────────
  {
    fieldId: 'functionalModules',
    label: 'Main Functional Modules / Services',
    targetSections: ['functionalRequirements'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: true,
    baConfirmationRequired: false,
    notes: 'Applicable when documentType involves software. Strong historical support from ITAS workstream tables.',
  },
  {
    fieldId: 'keyWorkflows',
    label: 'Key Workflows and Approvals',
    targetSections: ['functionalRequirements'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: false,
    baConfirmationRequired: false,
  },
  {
    fieldId: 'reportingNeeds',
    label: 'Reporting, Dashboards, and Notifications',
    targetSections: ['functionalRequirements'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: false,
    baConfirmationRequired: false,
  },
  {
    fieldId: 'caseManagementNeeds',
    label: 'Document Management / Case / Ticketing Needs',
    targetSections: ['functionalRequirements'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: false,
    baConfirmationRequired: false,
  },
  {
    fieldId: 'aiFeatures',
    label: 'AI or Advanced Features',
    targetSections: ['functionalRequirements'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: false,
    baConfirmationRequired: false,
    notes: 'No historical precedent in current corpus — genuinely new territory per engagement.',
  },

  // ── Group 6: Technical / Non-Functional Requirements (conditional block) ──
  {
    fieldId: 'hostingModel',
    label: 'Hosting / Infrastructure Model',
    targetSections: ['technicalRequirements'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: true,
    baConfirmationRequired: true,
    notes: 'Cost/architecture impact — BA confirmation required. Strong historical support (ITAS §4.5).',
  },
  {
    fieldId: 'integrations',
    label: 'Integration Requirements / APIs',
    targetSections: ['technicalRequirements'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: true,
    baConfirmationRequired: false,
  },
  {
    fieldId: 'securityRequirements',
    label: 'Security and Data Residency Requirements',
    targetSections: ['technicalRequirements'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: true,
    baConfirmationRequired: true,
    notes: 'Near-boilerplate MODEE/government cybersecurity clause; Rami PROPOSEs, BA confirms deviations.',
  },
  {
    fieldId: 'performanceAvailabilityTargets',
    label: 'Performance, Availability, Backup, and DR Targets',
    targetSections: ['technicalRequirements'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: true,
    baConfirmationRequired: true,
  },
  {
    fieldId: 'dataMigrationNeeds',
    label: 'Data Migration Needs',
    targetSections: ['technicalRequirements'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: false,
    baConfirmationRequired: false,
  },

  // ── Group 7: Deliverables ────────────────────────────────────────────────
  {
    fieldId: 'deliverableItems',
    label: 'Required Deliverables',
    targetSections: ['deliverables'],
    requirement: 'required',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: true,
    baConfirmationRequired: true,
    notes: 'GeneralTemplate supplies a 6-item default list; Rami PROPOSEs, BA edits.',
  },
  {
    fieldId: 'deliverableFormats',
    label: 'Required Deliverable Formats',
    targetSections: ['deliverables'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: true,
    baConfirmationRequired: false,
  },
  {
    fieldId: 'deliverableApprovers',
    label: 'Approver(s) per Deliverable',
    targetSections: ['deliverables'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: false,
    baConfirmationRequired: false,
    notes: 'Template default is "Yes" (approval required) for all rows — usable as a PROPOSED default.',
  },

  // ── Group 8: Implementation and Acceptance ───────────────────────────────
  // Note: engagementPhases and engagementDuration (Group 2) absorb Q-Bank 8.1.
  {
    fieldId: 'uatRounds',
    label: 'Testing / UAT Rounds',
    targetSections: ['implementationRequirements'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: false,
    baConfirmationRequired: false,
  },
  {
    fieldId: 'acceptanceCriteria',
    label: 'Acceptance Criteria and Go-Live Conditions',
    targetSections: ['acceptanceCriteria'],
    requirement: 'required',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: true,
    baConfirmationRequired: true,
    notes: 'Required when acceptanceCriteria section is applicable. BA confirmation required.',
  },
  {
    fieldId: 'rollbackPlanNeeded',
    label: 'Rollback Plan Required?',
    targetSections: ['acceptanceCriteria'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: false,
    baConfirmationRequired: false,
    notes: 'Rare in historical sources; default to TBC if BA has no answer.',
  },

  // ── Group 9: Support and SLA (conditional block) ──────────────────────────
  {
    fieldId: 'supportPeriodAndHours',
    label: 'Support Period and Hours',
    targetSections: ['supportMaintenance'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: true,
    baConfirmationRequired: false,
  },
  {
    fieldId: 'slaTiers',
    label: 'SLA Severity Tiers (Response and Resolution Times)',
    targetSections: ['supportMaintenance'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: true,
    baConfirmationRequired: true,
    notes: 'Template Severity 1–4 table usable as a PROPOSED default. BA confirmation required.',
  },
  {
    fieldId: 'supportOperatingModel',
    label: 'Support Operating Model (Resident Engineer / Ticketing / Reports)',
    targetSections: ['supportMaintenance'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: false,
    baConfirmationRequired: false,
  },
  {
    fieldId: 'supportPenalties',
    label: 'SLA Penalties',
    targetSections: ['supportMaintenance', 'legalContractualTerms'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: true,
    baConfirmationRequired: true,
    notes: 'Financial exposure — BA confirmation required. OFA/ITAS have concrete penalty formulas usable as PROPOSED.',
  },

  // ── Group 10: Evaluation and Financials ─────────────────────────────────
  {
    fieldId: 'evaluationWeights',
    label: 'Technical vs Financial Evaluation Weights',
    targetSections: ['evaluationCriteria'],
    requirement: 'required',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: true,
    baConfirmationRequired: true,
    notes: 'Often PROPOSED from a historical/template default (e.g. 70/30) and confirmed by BA.',
  },
  {
    fieldId: 'evaluationRules',
    label: 'Evaluation Rules (Minimum Score, PoC Scoring, Disqualification)',
    targetSections: ['evaluationCriteria'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: true,
    baConfirmationRequired: true,
  },
  {
    fieldId: 'pricingModelAndCostBreakdown',
    label: 'Pricing Model and Cost Breakdown',
    targetSections: ['financialProposal'],
    requirement: 'required',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: true,
    baConfirmationRequired: true,
    notes: 'Compound field: { pricingModel: string, costBreakdown: CostItem[] }. Template 12-row table is a strong PROPOSED default.',
  },
  {
    fieldId: 'optionalItemsAndTaxes',
    label: 'Optional Priced Items and Tax Notes',
    targetSections: ['financialProposal'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: false,
    baConfirmationRequired: false,
    notes: 'Absorbs Q-Bank duplicate 12.5 (what should be priced separately as optional).',
  },

  // ── Group 11: Legal and Annexes ──────────────────────────────────────────
  {
    fieldId: 'legalTerms',
    label: 'Legal Terms (Applicable Law, Confidentiality, IP)',
    targetSections: ['legalContractualTerms'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: true,
    baConfirmationRequired: true,
    notes: 'Near-boilerplate (Jordanian law, consistent across all 3 historical PDFs). Rami PROPOSEs; BA confirms deviations only.',
  },
  {
    fieldId: 'jvSubcontractingRules',
    label: 'Joint Venture / Subcontracting Rules',
    targetSections: ['legalContractualTerms'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: true,
    baConfirmationRequired: true,
    notes: 'Same PROPOSE-then-confirm-deviations pattern as legalTerms.',
  },
  {
    fieldId: 'requiredAnnexes',
    label: 'Required Annexes and Compliance Forms',
    targetSections: ['annexes'],
    requirement: 'required',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: true,
    baConfirmationRequired: true,
    notes: 'Template lists 12 candidate annexes usable as a PROPOSED checklist. Absorbs Q-Bank duplicate 12.8.',
  },

  // ── Group 18: Promoted procurement / delivery facts (evidence-driven 2026-08) ──
  {
    fieldId: 'awardModel',
    label: 'Award Model and Supplier Count',
    targetSections: ['evaluationCriteria', 'engagementDefinition'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: true,
    baConfirmationRequired: true,
    notes:
      'Structured { model, supplierCount }. Evidence 7/7 historical RFPs. Not a ProjectContext classifier.',
  },
  {
    fieldId: 'callOffOrSowProcess',
    label: 'Call-off / SOW Process',
    targetSections: ['engagementDefinition', 'scopeOfWork'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: true,
    baConfirmationRequired: true,
    notes: 'FRAMEWORK / ASSIGNMENT only. Evidence 4/7 framework datasets. N/A for one-off RFPs.',
  },
  {
    fieldId: 'namedKeyPersonnel',
    label: 'Named Key Personnel Requirements',
    targetSections: ['manpowerRequirements'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: true,
    baConfirmationRequired: true,
    notes:
      'Array of { role, minExperience?, qualification?, cvRequired?, notes? }. Distinct from stakeholderRoles. N/A when no named staff.',
  },
  {
    fieldId: 'clarificationContact',
    label: 'Clarification Contact',
    targetSections: ['administrativeProcedures'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: true,
    baConfirmationRequired: false,
    notes: 'Tender admin contact. PROCUREMENT/PQ only. TBC allowed. Evidence 7/7.',
  },
  {
    fieldId: 'submissionChannel',
    label: 'Proposal Submission Channel',
    targetSections: ['administrativeProcedures'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: true,
    baConfirmationRequired: false,
    notes: 'Portal/email/address — not general comms. Distinct from proposalDeadline. TBC allowed.',
  },
  {
    fieldId: 'governanceCadence',
    label: 'Governance and Reporting Cadence',
    targetSections: ['projectManagementGovernance'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: true,
    baConfirmationRequired: false,
    notes: 'Steering/PMO/progress-report cadence. Distinct from engagementPhases. Ask only when governance section applies.',
  },
  {
    fieldId: 'knowledgeTransferRequirements',
    label: 'Knowledge Transfer Requirements',
    targetSections: ['implementationRequirements', 'deliverables'],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: true,
    historicalRetrievalSupported: true,
    baConfirmationRequired: false,
    notes: 'KT / handover / ToT — not a duplicate of deliverableItems. System/training packs. N/A when no handover.',
  },

  // ── Group 12 spinoff: Risk Notes (aggregate, not explicitly asked) ────────
  {
    fieldId: 'riskNotes',
    label: 'Risk Notes and Lessons Learned',
    targetSections: [],
    requirement: 'conditional',
    category: 'PROJECT_INFORMATION',
    explicitAskIfMissing: false,
    historicalRetrievalSupported: false,
    baConfirmationRequired: false,
    notes: 'Never explicitly asked. Populated when the BA volunteers a specific risk / lesson from Q-Bank 12.1–12.3 heuristic context. Cross-cutting: surfaced as caution flags during section drafting.',
  },
] as const satisfies ProjectMemoryFieldDef[];

/** Legacy count before 2026-08 evidence-driven expansion. */
export const LEGACY_CANONICAL_FIELD_COUNT = 52;

/** Promoted in the 2026-08 information-model expansion. */
export const PROMOTED_FIELD_IDS = [
  'awardModel',
  'callOffOrSowProcess',
  'namedKeyPersonnel',
  'clarificationContact',
  'submissionChannel',
  'governanceCadence',
  'knowledgeTransferRequirements',
] as const;

/** Total canonical field count — validated at module level. */
export const CANONICAL_FIELD_COUNT = PROJECT_MEMORY_FIELDS.length;

/** Set of all canonical field IDs for fast membership checks. */
export const CANONICAL_FIELD_IDS = new Set<string>(
  PROJECT_MEMORY_FIELDS.map((f) => f.fieldId),
);

/** Look up a field definition by its fieldId. Returns undefined if not found. */
export function getFieldDef(fieldId: string): ProjectMemoryFieldDef | undefined {
  return PROJECT_MEMORY_FIELDS.find((f) => f.fieldId === fieldId);
}

/** Returns all fields that target the given section. */
export function getFieldsForSection(sectionId: string): readonly ProjectMemoryFieldDef[] {
  return PROJECT_MEMORY_FIELDS.filter((f) =>
    (f.targetSections as readonly string[]).includes(sectionId),
  );
}

/** Returns only the required fields. */
export function getRequiredFields(): readonly ProjectMemoryFieldDef[] {
  return PROJECT_MEMORY_FIELDS.filter((f) => f.requirement === 'required');
}

/** Merge static field def with Phase 2.2 pack/materiality metadata. */
export function getFieldControlView(fieldId: string): ProjectMemoryFieldControlView | undefined {
  const def = getFieldDef(fieldId);
  if (!def) return undefined;
  const meta = getFieldControlMeta(fieldId);
  return {
    ...def,
    packs: meta.packs,
    materiality: meta.materiality,
    defaultDepth: meta.defaultDepth,
    relatedAskPeers: meta.relatedAskPeers ?? [],
  };
}
