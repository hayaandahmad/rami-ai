/**
 * Canonical 20-section RFP schema.
 * Authority: .private-context/analysis/canonical-rfp-schema.md §3
 *
 * This is the SINGLE source of truth for section identity, order, and
 * mandatory/conditional classification in all Rami code. Do NOT derive section
 * structure from the old interviewSections.ts (13 sections, demo-era).
 *
 * To change this schema: re-validate against all 4 historical sources
 * (02-rfp-master-structure.txt, GeneralTemplate.docx, and the 3 historical PDFs)
 * and update canonical-rfp-schema.md before editing this file.
 */

export type SectionClassification = 'mandatory' | 'conditional';

/** Cover / TOC / standard Annexes: TypeScript-rendered. Abbreviations: derived, never Qwen-invented. */
export const STRUCTURAL_SECTION_IDS = new Set([
  'coverPage',
  'tableOfContents',
  'abbreviations',
  'annexes',
]);

export function isStructuralSectionId(sectionId: string): boolean {
  return STRUCTURAL_SECTION_IDS.has(sectionId);
}

/** Applicability context used by isSectionApplicable(). */
export interface SectionApplicabilityContext {
  /** e.g. 'system-implementation' | 'framework-agreement' | 'consulting' | ... */
  documentType?: string;
  engagementType?: string;
  /** Phase 2.2 classifiers — optional; section outline may show without implying field requirements. */
  documentStage?: string;
  primaryDomain?: string;
  contractingGranularity?: string;
  activePacks?: string[];
  hasDeliveryMilestone?: boolean;
  hasSupportPeriod?: boolean;
  hasNamedRoles?: boolean;
  isLargeEngagement?: boolean;
  /** True when requiredAnnexes has real project-specific annex/form/attachment material. */
  hasAnnexRequirements?: boolean;
  /** True when the organization standard RFP annex pack applies (not PQ/RFI). */
  hasStandardAnnexPack?: boolean;
  /** True when a derived glossary can be built from confirmed terminology. */
  hasGlossaryTerms?: boolean;
}

export interface RfpSubsection {
  id: string;
  title: string;
  /** True if this subsection always appears when the parent section is applicable. */
  alwaysIncluded: boolean;
}

export interface RfpSection {
  /** Stable, machine-readable identifier. Used as foreign key in field mappings. */
  sectionId: string;
  title: string;
  /** 1-based canonical order — never reorder without updating canonical-rfp-schema.md */
  order: number;
  classification: SectionClassification;
  /**
   * Human-readable note on when this section is included.
   * The programmatic gate is isSectionApplicable().
   */
  applicableWhenNote: string;
  /**
   * Optional umbrella chapter label for table-of-contents rollup.
   * Multiple sections sharing the same chapterGroup appear under one ToC entry.
   * Phase 4/5 generation uses this for document assembly.
   */
  chapterGroup?: string;
  representativeSubsections: RfpSubsection[];
  sourceSupport: string;
}

/**
 * Determines whether a section is applicable given the current project context.
 * Mandatory sections are always applicable. Conditional sections check context flags.
 * This is the authoritative applicability gate for gap-detection and drafting.
 */
export function isSectionApplicable(
  section: RfpSection,
  ctx: SectionApplicabilityContext,
): boolean {
  if (section.classification === 'mandatory') return true;

  const { documentType = '', primaryDomain = '', activePacks = [] } = ctx;
  const domain = (primaryDomain || '').toUpperCase();
  const packs = new Set(activePacks);

  // While packs are CORE-only / domain UNDETERMINED: still allow preview of
  // conditional sections based on documentType when known; otherwise hide
  // system-heavy conditionals so outline stays generic.
  const isSystem =
    domain === 'SYSTEM_IMPLEMENTATION' ||
    documentType === 'system-implementation' ||
    packs.has('SYSTEM_IMPLEMENTATION');
  const isConnectivity =
    domain === 'CONNECTIVITY' ||
    documentType === 'connectivity-telecom' ||
    packs.has('CONNECTIVITY');
  const isSupport =
    domain === 'SLA_SUPPORT' ||
    documentType === 'support' ||
    packs.has('SLA_SUPPORT');
  const isConsulting =
    domain === 'CONSULTING' ||
    domain === 'BPR' ||
    documentType === 'consulting';

  // Consulting / BPR without system pack: do not show system technical sections
  if (isConsulting && !isSystem) {
    if (
      [
        'functionalRequirements',
        'technicalRequirements',
        'implementationRequirements',
        'acceptanceCriteria',
        'supportMaintenance',
        'manpowerRequirements',
      ].includes(section.sectionId)
    ) {
      return false;
    }
  }

  const { isLargeEngagement = false } = ctx;

  switch (section.sectionId) {
    case 'abbreviations':
      return (isSystem || isConnectivity) && Boolean(ctx.hasGlossaryTerms);

    case 'functionalRequirements':
      return isSystem;

    case 'technicalRequirements':
      return isSystem || isConnectivity || isSupport;

    case 'implementationRequirements':
      return isSystem || isLargeEngagement;

    case 'projectManagementGovernance':
      return isLargeEngagement || isSystem || packs.has('PMO');

    case 'acceptanceCriteria':
      return ctx.hasDeliveryMilestone ?? isSystem;

    case 'supportMaintenance':
      return ctx.hasSupportPeriod ?? (isSystem || isSupport || isConnectivity);

    case 'manpowerRequirements':
      return (
        (ctx.hasNamedRoles ?? false) ||
        isLargeEngagement ||
        packs.has('FRAMEWORK') ||
        packs.has('PMO')
      );

    case 'annexes':
      return Boolean(ctx.hasStandardAnnexPack) || Boolean(ctx.hasAnnexRequirements);

    default:
      return false;
  }
}

/** The canonical 20-section RFP schema. Immutable at runtime. */
export const RFP_SECTIONS = [
  {
    sectionId: 'coverPage',
    title: 'Cover Page',
    order: 1,
    classification: 'mandatory',
    applicableWhenNote: 'Always',
    chapterGroup: undefined,
    representativeSubsections: [
      { id: 'title', title: 'Project / Service Title', alwaysIncluded: true },
      { id: 'issuerEntity', title: 'Issuing / Procuring Entity', alwaysIncluded: true },
      { id: 'beneficiaryEntity', title: 'Beneficiary Entity', alwaysIncluded: true },
      { id: 'rfpNumber', title: 'RFP Number', alwaysIncluded: true },
      { id: 'deadline', title: 'Proposal Deadline', alwaysIncluded: true },
      { id: 'versionDate', title: 'Version / Date', alwaysIncluded: true },
    ],
    sourceSupport: 'All 3 historical PDFs; GeneralTemplate.docx',
  },
  {
    sectionId: 'tableOfContents',
    title: 'Table of Contents',
    order: 2,
    classification: 'mandatory',
    applicableWhenNote: 'Always',
    chapterGroup: undefined,
    representativeSubsections: [],
    sourceSupport: 'All 3 historical PDFs; GeneralTemplate.docx',
  },
  {
    sectionId: 'abbreviations',
    title: 'Abbreviations and Definitions',
    order: 3,
    classification: 'conditional',
    applicableWhenNote: 'Technical/complex RFPs (system implementation, technical connectivity)',
    chapterGroup: undefined,
    representativeSubsections: [
      { id: 'glossaryTable', title: 'Glossary Table', alwaysIncluded: true },
    ],
    sourceSupport: 'ITAS (full table); GeneralTemplate.docx (listed conditional); absent in smaller PDFs',
  },
  {
    sectionId: 'introduction',
    title: 'Introduction',
    order: 4,
    classification: 'mandatory',
    applicableWhenNote: 'Always',
    chapterGroup: 'Introduction',
    representativeSubsections: [
      { id: 'rfpPurpose', title: 'RFP Purpose', alwaysIncluded: true },
      { id: 'rfpOrganization', title: 'RFP Organization', alwaysIncluded: true },
    ],
    sourceSupport: 'All 3 historical PDFs; GeneralTemplate.docx',
  },
  {
    sectionId: 'background',
    title: 'Background and Business Need',
    order: 5,
    classification: 'mandatory',
    applicableWhenNote: 'Always',
    chapterGroup: 'Background and Engagement Definition',
    representativeSubsections: [
      { id: 'currentSituation', title: 'Current Situation', alwaysIncluded: true },
      { id: 'problemStatement', title: 'Problem Statement', alwaysIncluded: true },
      { id: 'projectObjectives', title: 'Project Objectives', alwaysIncluded: true },
    ],
    sourceSupport: 'All 3 historical PDFs; GeneralTemplate.docx',
  },
  {
    sectionId: 'engagementDefinition',
    title: 'Engagement Definition',
    order: 6,
    classification: 'mandatory',
    applicableWhenNote: 'Always',
    chapterGroup: 'Background and Engagement Definition',
    representativeSubsections: [
      { id: 'engagementType', title: 'Engagement Type', alwaysIncluded: true },
      { id: 'phases', title: 'Project Phases', alwaysIncluded: false },
      { id: 'duration', title: 'Engagement Duration', alwaysIncluded: true },
    ],
    sourceSupport: 'Performance-Assessment PDF; OFA PDF (Framework Agreement variant); GeneralTemplate.docx',
  },
  {
    sectionId: 'scopeOfWork',
    title: 'Scope of Work',
    order: 7,
    classification: 'mandatory',
    applicableWhenNote: 'Always',
    chapterGroup: 'Scope of Work',
    representativeSubsections: [
      { id: 'scopeOverview', title: 'Scope Overview', alwaysIncluded: true },
      { id: 'inScope', title: 'In-Scope Activities', alwaysIncluded: true },
      { id: 'outOfScope', title: 'Out-of-Scope Activities', alwaysIncluded: true },
      { id: 'bidderResponsibilities', title: 'Bidder Responsibilities', alwaysIncluded: true },
      { id: 'entityResponsibilities', title: 'MODEE / Entity Responsibilities', alwaysIncluded: true },
      { id: 'assumptions', title: 'Assumptions, Dependencies, Constraints', alwaysIncluded: false },
    ],
    sourceSupport: 'All 3 historical PDFs; GeneralTemplate.docx',
  },
  {
    sectionId: 'functionalRequirements',
    title: 'Functional Requirements',
    order: 8,
    classification: 'conditional',
    applicableWhenNote: 'documentType involves software / system delivery',
    chapterGroup: 'Requirements',
    representativeSubsections: [
      { id: 'modulesTable', title: 'Modules Table (Module / Description / Required? / Notes)', alwaysIncluded: true },
      { id: 'userTypes', title: 'User Types', alwaysIncluded: true },
      { id: 'businessProcesses', title: 'Business Processes / Workflows', alwaysIncluded: true },
      { id: 'reportingDashboards', title: 'Reporting and Dashboards', alwaysIncluded: false },
    ],
    sourceSupport: 'ITAS (dense workstream tables); GeneralTemplate.docx (sample table); absent in connectivity/assessment PDFs',
  },
  {
    sectionId: 'technicalRequirements',
    title: 'Technical and Non-Functional Requirements',
    order: 9,
    classification: 'conditional',
    applicableWhenNote: 'documentType involves a technical / hosted solution',
    chapterGroup: 'Requirements',
    representativeSubsections: [
      { id: 'solutionArchitecture', title: 'Solution Architecture', alwaysIncluded: true },
      { id: 'infrastructureHosting', title: 'Infrastructure / Hosting', alwaysIncluded: true },
      { id: 'integrations', title: 'Integration Requirements', alwaysIncluded: false },
      { id: 'informationSecurity', title: 'Information Security Requirements', alwaysIncluded: true },
      { id: 'performance', title: 'Performance Requirements', alwaysIncluded: false },
      { id: 'dataMigration', title: 'Data Migration Requirements', alwaysIncluded: false },
      { id: 'reportingAnalytics', title: 'Reporting and Analytics', alwaysIncluded: false },
      { id: 'bilingualAccessibility', title: 'Bilingual and Accessibility Requirements', alwaysIncluded: false },
    ],
    sourceSupport: 'ITAS (heaviest); OFA (per-service spec tables); GeneralTemplate.docx',
  },
  {
    sectionId: 'implementationRequirements',
    title: 'Implementation Requirements',
    order: 10,
    classification: 'conditional',
    applicableWhenNote: 'Multi-stage engagements (system implementation, large services)',
    chapterGroup: 'Requirements',
    representativeSubsections: [
      { id: 'requirementGathering', title: 'Requirement Gathering', alwaysIncluded: true },
      { id: 'design', title: 'Design', alwaysIncluded: true },
      { id: 'development', title: 'Development / Configuration / Customization', alwaysIncluded: true },
      { id: 'testing', title: 'Testing and Quality Assurance', alwaysIncluded: true },
      { id: 'deployment', title: 'Deployment and Go-Live', alwaysIncluded: true },
      { id: 'training', title: 'Training and Knowledge Transfer', alwaysIncluded: true },
    ],
    sourceSupport: 'ITAS (§4.1–4.9 equivalent); GeneralTemplate.docx (9.1–9.6)',
  },
  {
    sectionId: 'deliverables',
    title: 'Deliverables',
    order: 11,
    classification: 'mandatory',
    applicableWhenNote: 'Always',
    chapterGroup: 'Deliverables',
    representativeSubsections: [
      { id: 'deliverablesTable', title: 'Deliverables Table (No. / Deliverable / Description / Format / Approval Required)', alwaysIncluded: true },
    ],
    sourceSupport: 'Performance-Assessment PDF (explicit); GeneralTemplate.docx (7-row sample table); embedded in Scope for OFA/ITAS',
  },
  {
    sectionId: 'projectManagementGovernance',
    title: 'Project Management and Governance',
    order: 12,
    classification: 'conditional',
    applicableWhenNote: 'Larger / longer engagements',
    chapterGroup: undefined,
    representativeSubsections: [
      { id: 'pmApproach', title: 'Project Management Approach', alwaysIncluded: true },
      { id: 'projectPlan', title: 'Project Plan', alwaysIncluded: true },
      { id: 'communication', title: 'Communication and Reporting', alwaysIncluded: true },
      { id: 'riskIssue', title: 'Risk and Issue Management', alwaysIncluded: true },
      { id: 'changeControl', title: 'Change Control', alwaysIncluded: true },
    ],
    sourceSupport: 'ITAS (§7 full PMO); GeneralTemplate.docx (11.1–11.5)',
  },
  {
    sectionId: 'acceptanceCriteria',
    title: 'Acceptance Criteria and Go-Live',
    order: 13,
    classification: 'conditional',
    applicableWhenNote: 'Engagements with a delivery / go-live milestone',
    chapterGroup: undefined,
    representativeSubsections: [
      { id: 'acceptanceConditions', title: 'Acceptance Conditions', alwaysIncluded: true },
      { id: 'uat', title: 'User Acceptance Testing', alwaysIncluded: true },
      { id: 'goLiveRequirements', title: 'Go-Live Requirements', alwaysIncluded: true },
    ],
    sourceSupport: 'ITAS (§6); GeneralTemplate.docx (12.1–12.3)',
  },
  {
    sectionId: 'supportMaintenance',
    title: 'Support and Maintenance',
    order: 14,
    classification: 'conditional',
    applicableWhenNote: 'Engagements with a post-delivery support period',
    chapterGroup: undefined,
    representativeSubsections: [
      { id: 'supportPeriod', title: 'Support Period and Hours', alwaysIncluded: true },
      { id: 'slaTable', title: 'SLA Severity / Response / Resolution Table', alwaysIncluded: true },
      { id: 'supportReports', title: 'Support Reports', alwaysIncluded: false },
    ],
    sourceSupport: 'ITAS (§3.3, severity + liquidated-damages); OFA (per-service SLA); GeneralTemplate.docx (5-row severity table)',
  },
  {
    sectionId: 'manpowerRequirements',
    title: 'Manpower / Resource Requirements',
    order: 15,
    classification: 'conditional',
    applicableWhenNote: 'Engagements requiring named on-site / dedicated roles',
    chapterGroup: undefined,
    representativeSubsections: [
      { id: 'rolesTable', title: 'Roles Table (Role / Min. Experience / Qualification / Notes)', alwaysIncluded: true },
    ],
    sourceSupport: 'ITAS (§5, detailed); GeneralTemplate.docx (4-row sample table)',
  },
  {
    sectionId: 'administrativeProcedures',
    title: 'Administrative Procedures and Requirements',
    order: 16,
    classification: 'mandatory',
    applicableWhenNote: 'Always',
    chapterGroup: 'Administrative Procedures and Requirements',
    representativeSubsections: [
      { id: 'responseProcedures', title: 'Response Procedures', alwaysIncluded: true },
      { id: 'responseFormat', title: 'Response Format', alwaysIncluded: true },
      { id: 'submission', title: 'Response Submission', alwaysIncluded: true },
      { id: 'lateSubmission', title: 'Late Submission Rule', alwaysIncluded: true },
    ],
    sourceSupport: 'All 3 historical PDFs (near-identical boilerplate); GeneralTemplate.docx',
  },
  {
    sectionId: 'evaluationCriteria',
    title: 'Proposal Evaluation Criteria',
    order: 17,
    classification: 'mandatory',
    applicableWhenNote: 'Always',
    chapterGroup: 'Evaluation Criteria',
    representativeSubsections: [
      { id: 'technicalEvaluationTable', title: 'Technical Evaluation Weights Table (Criteria / Weight)', alwaysIncluded: true },
      { id: 'minimumScore', title: 'Minimum Passing Score', alwaysIncluded: true },
      { id: 'disqualification', title: 'Disqualification Conditions', alwaysIncluded: true },
      { id: 'pocScoring', title: 'PoC / Demonstration Scoring', alwaysIncluded: false },
    ],
    sourceSupport: 'All 3 historical PDFs; GeneralTemplate.docx (weights table + rules)',
  },
  {
    sectionId: 'financialProposal',
    title: 'Financial Proposal Requirements',
    order: 18,
    classification: 'mandatory',
    applicableWhenNote: 'Always',
    chapterGroup: 'Financial Proposal Requirements',
    representativeSubsections: [
      { id: 'pricingModel', title: 'Pricing Model', alwaysIncluded: true },
      { id: 'costBreakdownTable', title: 'Cost Breakdown Table (Component / Amount)', alwaysIncluded: true },
      { id: 'optionalItems', title: 'Optional Priced Items', alwaysIncluded: false },
      { id: 'taxes', title: 'Taxes and Fees', alwaysIncluded: true },
    ],
    sourceSupport: 'All 3 historical PDFs; GeneralTemplate.docx (12-row cost breakdown table)',
  },
  {
    sectionId: 'legalContractualTerms',
    title: 'Legal and Contractual Terms',
    order: 19,
    classification: 'mandatory',
    applicableWhenNote: 'Always',
    chapterGroup: 'Legal and Contractual Terms',
    representativeSubsections: [
      { id: 'applicableLaw', title: 'Applicable Law', alwaysIncluded: true },
      { id: 'conflictOfInterest', title: 'Conflict of Interest', alwaysIncluded: true },
      { id: 'confidentiality', title: 'Confidentiality', alwaysIncluded: true },
      { id: 'intellectualProperty', title: 'Intellectual Property', alwaysIncluded: true },
      { id: 'jvSubcontracting', title: 'Joint Venture / Subcontracting', alwaysIncluded: false },
      { id: 'bonds', title: 'Bonds / Guarantees', alwaysIncluded: false },
    ],
    sourceSupport: 'All 3 historical PDFs (near-identical boilerplate, high reuse potential); GeneralTemplate.docx',
  },
  {
    sectionId: 'annexes',
    title: 'Annexes',
    order: 20,
    classification: 'conditional',
    applicableWhenNote:
      'Standard organization annex pack for ordinary RFPs; project-specific annexes appended when confirmed. Not forced for pre-qualification / RFI stages unless extra annex material exists',
    chapterGroup: 'Annexes',
    representativeSubsections: [
      { id: 'complianceSheet', title: 'Annex: Compliance Sheet', alwaysIncluded: false },
      { id: 'financialForms', title: 'Annex: Financial Proposal Forms', alwaysIncluded: true },
      { id: 'technicalForms', title: 'Annex: Technical Proposal Forms', alwaysIncluded: true },
      { id: 'confidentialityUndertaking', title: 'Annex: Confidentiality Undertaking', alwaysIncluded: false },
      { id: 'securityQuestionnaire', title: 'Annex: Security Questionnaire', alwaysIncluded: false },
      { id: 'standardsPolicies', title: 'Annex: Standards / Policies', alwaysIncluded: false },
      { id: 'functionalMatrix', title: 'Annex: Functional Requirements Matrix', alwaysIncluded: false },
      { id: 'technicalMatrix', title: 'Annex: Technical Requirements Matrix', alwaysIncluded: false },
    ],
    sourceSupport: 'All 3 historical PDFs; GeneralTemplate.docx lists 12 candidate annexes',
  },
] as const satisfies RfpSection[];

export type RfpSectionId = (typeof RFP_SECTIONS)[number]['sectionId'];

/** Set of all valid section IDs for fast membership checks. */
export const RFP_SECTION_IDS = new Set<string>(
  RFP_SECTIONS.map((s) => s.sectionId),
);

/** Lookup a section by its sectionId. Returns undefined if not found. */
export function getRfpSection(sectionId: string): RfpSection | undefined {
  return RFP_SECTIONS.find((s) => s.sectionId === sectionId);
}

/** Returns only mandatory sections. */
export function getMandatorySections(): typeof RFP_SECTIONS[number][] {
  return RFP_SECTIONS.filter((s) => s.classification === 'mandatory') as typeof RFP_SECTIONS[number][];
}

/** Returns only conditional sections. */
export function getConditionalSections(): typeof RFP_SECTIONS[number][] {
  return RFP_SECTIONS.filter((s) => s.classification === 'conditional') as typeof RFP_SECTIONS[number][];
}

/** Returns sections applicable in the given context, in canonical order. */
export function getApplicableSections(
  ctx: SectionApplicabilityContext,
): typeof RFP_SECTIONS[number][] {
  return RFP_SECTIONS.filter((s) => isSectionApplicable(s, ctx)) as typeof RFP_SECTIONS[number][];
}
