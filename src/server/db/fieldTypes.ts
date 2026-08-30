import { PROJECT_MEMORY_FIELDS } from '@/schema/projectMemoryFields';

export type FieldDataType = 'string' | 'array' | 'object' | 'boolean' | 'integer';

const OVERRIDES: Partial<Record<string, FieldDataType>> = {
  rollbackPlanNeeded: 'boolean',
  users: 'object',
  assumptionsDependenciesConstraints: 'object',
  slaTiers: 'object',
  pricingModelAndCostBreakdown: 'object',
  optionalItemsAndTaxes: 'object',
  awardModel: 'object',
};

const ARRAY_FIELDS = new Set([
  'painPoints',
  'businessObjectives',
  'engagementPhases',
  'stakeholderRoles',
  'approvers',
  'inScope',
  'outOfScope',
  'bidderResponsibilities',
  'entityResponsibilities',
  'functionalModules',
  'keyWorkflows',
  'reportingNeeds',
  'caseManagementNeeds',
  'aiFeatures',
  'integrations',
  'securityRequirements',
  'deliverableItems',
  'deliverableFormats',
  'deliverableApprovers',
  'acceptanceCriteria',
  'supportPenalties',
  'requiredAnnexes',
  'riskNotes',
  'namedKeyPersonnel',
  'knowledgeTransferRequirements',
]);

export function getFieldDataType(fieldId: string): FieldDataType {
  if (OVERRIDES[fieldId]) return OVERRIDES[fieldId]!;
  if (ARRAY_FIELDS.has(fieldId)) return 'array';
  return 'string';
}

export function assertKnownFieldCount(): number {
  return PROJECT_MEMORY_FIELDS.length;
}
