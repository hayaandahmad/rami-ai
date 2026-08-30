/**
 * Static Question Bank seed — source-of-truth for Questions + QuestionFields.
 * Question text from 01-question-bank.txt; field links from question-information-mapping.md.
 * SYSTEM_DEFAULT / AGENT_RULE lines are still seeded as questions; they may have zero fields.
 */

export interface QuestionSeed {
  questionId: string;
  questionText: string;
  /** Canonical section_id (RFP schema), not Question Bank group number. */
  sectionId: string;
  fieldIds: string[];
}

export const QUESTION_SEEDS: readonly QuestionSeed[] = [
  { questionId: '0.1', questionText: 'What type of RFP/document is this?', sectionId: 'coverPage', fieldIds: ['documentType'] },
  { questionId: '0.2', questionText: 'What is the document/RFP title?', sectionId: 'coverPage', fieldIds: ['documentTitle'] },
  { questionId: '0.3', questionText: 'What is the beneficiary entity / ministry?', sectionId: 'coverPage', fieldIds: ['beneficiaryEntity'] },
  { questionId: '0.4', questionText: 'What is the RFP or tender number (if any)?', sectionId: 'coverPage', fieldIds: ['tenderNumber'] },
  { questionId: '0.5', questionText: 'What is the deadline?', sectionId: 'coverPage', fieldIds: ['proposalDeadline'] },
  { questionId: '0.6', questionText: 'Language is English only for now (do not ask for Arabic/bilingual in Phase 1)', sectionId: 'coverPage', fieldIds: [] },
  { questionId: '0.7', questionText: 'Which approved template or reference RFP should be followed?', sectionId: 'coverPage', fieldIds: ['referenceTemplateId'] },

  { questionId: '1.1', questionText: 'What is the current situation?', sectionId: 'background', fieldIds: ['currentSituation'] },
  { questionId: '1.2', questionText: 'What pain points exist today?', sectionId: 'background', fieldIds: ['painPoints'] },
  { questionId: '1.3', questionText: 'Why is this project needed now?', sectionId: 'background', fieldIds: ['businessNeedRationale'] },
  { questionId: '1.4', questionText: 'What are the objectives and expected impact?', sectionId: 'background', fieldIds: ['businessObjectives'] },
  { questionId: '1.5', questionText: 'Are there previous phases, systems, or contracts to consider?', sectionId: 'background', fieldIds: ['previousPhases'] },

  { questionId: '2.1', questionText: 'Is this a one-time project, framework agreement, system implementation, consulting service, assessment, support contract, PoC, or mixed?', sectionId: 'engagementDefinition', fieldIds: ['engagementType'] },
  { questionId: '2.2', questionText: 'Are there phases? If yes, list them.', sectionId: 'engagementDefinition', fieldIds: ['engagementPhases'] },
  { questionId: '2.3', questionText: 'What is the expected duration?', sectionId: 'engagementDefinition', fieldIds: ['engagementDuration'] },

  { questionId: '3.1', questionText: 'Who is the beneficiary / system owner?', sectionId: 'coverPage', fieldIds: ['beneficiaryEntity'] },
  { questionId: '3.2', questionText: 'Who are internal users? External users?', sectionId: 'introduction', fieldIds: ['users'] },
  { questionId: '3.3', questionText: 'What roles are required?', sectionId: 'introduction', fieldIds: ['stakeholderRoles'] },
  { questionId: '3.4', questionText: 'Who approves? Who does UAT?', sectionId: 'introduction', fieldIds: ['approvers', 'uatOwners'] },
  { questionId: '3.5', questionText: 'Who owns the system after go-live?', sectionId: 'introduction', fieldIds: ['postGoLiveOwner'] },

  { questionId: '4.1', questionText: 'What is in scope?', sectionId: 'scopeOfWork', fieldIds: ['inScope'] },
  { questionId: '4.2', questionText: 'What is out of scope?', sectionId: 'scopeOfWork', fieldIds: ['outOfScope'] },
  { questionId: '4.3', questionText: 'What are bidder responsibilities?', sectionId: 'scopeOfWork', fieldIds: ['bidderResponsibilities'] },
  { questionId: '4.4', questionText: 'What are MODEE / entity responsibilities?', sectionId: 'scopeOfWork', fieldIds: ['entityResponsibilities'] },
  { questionId: '4.5', questionText: 'Assumptions, dependencies, constraints?', sectionId: 'scopeOfWork', fieldIds: ['assumptionsDependenciesConstraints'] },

  { questionId: '5.1', questionText: 'Main modules / services?', sectionId: 'functionalRequirements', fieldIds: ['functionalModules'] },
  { questionId: '5.2', questionText: 'Key workflows / approvals?', sectionId: 'functionalRequirements', fieldIds: ['keyWorkflows'] },
  { questionId: '5.3', questionText: 'Reports / dashboards / notifications needed?', sectionId: 'functionalRequirements', fieldIds: ['reportingNeeds'] },
  { questionId: '5.4', questionText: 'Document management / case / ticketing needs?', sectionId: 'functionalRequirements', fieldIds: ['caseManagementNeeds'] },
  { questionId: '5.5', questionText: 'Any AI or advanced features required/optional?', sectionId: 'functionalRequirements', fieldIds: ['aiFeatures'] },

  { questionId: '6.1', questionText: 'Hosting / infrastructure model?', sectionId: 'technicalRequirements', fieldIds: ['hostingModel'] },
  { questionId: '6.2', questionText: 'Integrations / APIs?', sectionId: 'technicalRequirements', fieldIds: ['integrations'] },
  { questionId: '6.3', questionText: 'Security / data residency requirements?', sectionId: 'technicalRequirements', fieldIds: ['securityRequirements'] },
  { questionId: '6.4', questionText: 'Performance / availability / backup / DR?', sectionId: 'technicalRequirements', fieldIds: ['performanceAvailabilityTargets'] },
  { questionId: '6.5', questionText: 'Data migration needs?', sectionId: 'technicalRequirements', fieldIds: ['dataMigrationNeeds'] },
  { questionId: '6.6', questionText: 'Accessibility requirements? (English drafting only in Phase 1)', sectionId: 'technicalRequirements', fieldIds: [] },

  { questionId: '7.1', questionText: 'What documents/reports/designs/tests/training materials are required?', sectionId: 'deliverables', fieldIds: ['deliverableItems'] },
  { questionId: '7.2', questionText: 'Required formats?', sectionId: 'deliverables', fieldIds: ['deliverableFormats'] },
  { questionId: '7.3', questionText: 'Who approves each deliverable?', sectionId: 'deliverables', fieldIds: ['deliverableApprovers'] },

  { questionId: '8.1', questionText: 'Stages, timeline, milestones?', sectionId: 'implementationRequirements', fieldIds: ['engagementPhases', 'engagementDuration'] },
  { questionId: '8.2', questionText: 'Testing / UAT rounds?', sectionId: 'acceptanceCriteria', fieldIds: ['uatRounds'] },
  { questionId: '8.3', questionText: 'Acceptance criteria and go-live conditions?', sectionId: 'acceptanceCriteria', fieldIds: ['acceptanceCriteria'] },
  { questionId: '8.4', questionText: 'Rollback plan needed?', sectionId: 'acceptanceCriteria', fieldIds: ['rollbackPlanNeeded'] },

  { questionId: '9.1', questionText: 'Support period and hours?', sectionId: 'supportMaintenance', fieldIds: ['supportPeriodAndHours'] },
  { questionId: '9.2', questionText: 'Severity levels / response / resolution times?', sectionId: 'supportMaintenance', fieldIds: ['slaTiers'] },
  { questionId: '9.3', questionText: 'Resident engineer / ticketing / reports?', sectionId: 'supportMaintenance', fieldIds: ['supportOperatingModel'] },
  { questionId: '9.4', questionText: 'Penalties?', sectionId: 'supportMaintenance', fieldIds: ['supportPenalties'] },

  { questionId: '10.1', questionText: 'Technical vs financial weights?', sectionId: 'evaluationCriteria', fieldIds: ['evaluationWeights'] },
  { questionId: '10.2', questionText: 'Minimum score / PoC scoring / disqualification rules?', sectionId: 'evaluationCriteria', fieldIds: ['evaluationRules'] },
  { questionId: '10.3', questionText: 'Pricing model and cost breakdown requirements?', sectionId: 'financialProposal', fieldIds: ['pricingModelAndCostBreakdown'] },
  { questionId: '10.4', questionText: 'Optional priced items? Taxes?', sectionId: 'financialProposal', fieldIds: ['optionalItemsAndTaxes'] },

  { questionId: '11.1', questionText: 'Applicable laws / confidentiality / IP?', sectionId: 'legalContractualTerms', fieldIds: ['legalTerms'] },
  { questionId: '11.2', questionText: 'Joint venture / subcontracting rules?', sectionId: 'legalContractualTerms', fieldIds: ['jvSubcontractingRules'] },
  { questionId: '11.3', questionText: 'Required forms, compliance sheets, questionnaires, annexes?', sectionId: 'annexes', fieldIds: ['requiredAnnexes'] },

  { questionId: '12.1', questionText: 'What must not be missed in this RFP?', sectionId: 'background', fieldIds: ['riskNotes'] },
  { questionId: '12.2', questionText: 'What mistakes happened in previous similar RFPs?', sectionId: 'background', fieldIds: ['riskNotes'] },
  { questionId: '12.3', questionText: 'Which parts usually cause vendor questions or scope disputes?', sectionId: 'background', fieldIds: ['riskNotes'] },
  { questionId: '12.4', questionText: 'Which requirements are mandatory, optional, excluded, or pending approval?', sectionId: 'scopeOfWork', fieldIds: [] },
  { questionId: '12.5', questionText: 'What should be priced separately as optional?', sectionId: 'financialProposal', fieldIds: ['optionalItemsAndTaxes'] },
  { questionId: '12.6', questionText: 'What is still unknown and should be [To be confirmed]?', sectionId: 'background', fieldIds: [] },
  { questionId: '12.7', questionText: 'Should Rami generate a risk/ambiguity list before final drafting?', sectionId: 'background', fieldIds: [] },
  { questionId: '12.8', questionText: 'What standards, policies, or annexes must be referenced?', sectionId: 'annexes', fieldIds: ['requiredAnnexes'] },

  // Group 18 — promoted facts. IDs start at 18.x to avoid colliding with historical Suggested Addition 13.x–17.x.
  { questionId: '18.1', questionText: 'How many suppliers will be awarded, and what is the award model (single winner, multi-supplier, ranked panel, or service-specific)?', sectionId: 'evaluationCriteria', fieldIds: ['awardModel'] },
  { questionId: '18.2', questionText: 'If this is a framework agreement, how will work orders / call-offs / SOWs be issued, allocated, or mini-competed?', sectionId: 'engagementDefinition', fieldIds: ['callOffOrSowProcess'] },
  { questionId: '18.3', questionText: 'Which named key personnel roles must the bidder nominate, with CVs and minimum qualifications or experience?', sectionId: 'manpowerRequirements', fieldIds: ['namedKeyPersonnel'] },
  { questionId: '18.4', questionText: 'Who is the clarification contact (name, email, or channel) and any clarification deadline?', sectionId: 'administrativeProcedures', fieldIds: ['clarificationContact'] },
  { questionId: '18.5', questionText: 'How and where must proposals be submitted (portal, email, address)?', sectionId: 'administrativeProcedures', fieldIds: ['submissionChannel'] },
  { questionId: '18.6', questionText: 'What governance and reporting cadence is required (steering committee, PMO, progress reports)?', sectionId: 'projectManagementGovernance', fieldIds: ['governanceCadence'] },
  { questionId: '18.7', questionText: 'What knowledge-transfer, training-of-trainers, or operational handover obligations apply?', sectionId: 'implementationRequirements', fieldIds: ['knowledgeTransferRequirements'] },
];

/** Question count present in the 7 historical Excel workbooks (pre-expansion). */
export const HISTORICAL_WORKBOOK_QUESTION_COUNT = 62;

/** Current canonical Question Bank size (workbook + promoted 18.x). */
export const CANONICAL_QUESTION_COUNT = QUESTION_SEEDS.length;

export const PROMOTED_QUESTION_IDS = [
  '18.1',
  '18.2',
  '18.3',
  '18.4',
  '18.5',
  '18.6',
  '18.7',
] as const;

export function countQuestionFieldLinks(): number {
  return QUESTION_SEEDS.reduce((n, q) => n + q.fieldIds.length, 0);
}
