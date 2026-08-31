export interface UnderstandingItem {
  fieldId: string;
  label: string;
  detail?: string;
}

export interface ProjectUnderstanding {
  documentTitle: string | null;
  beneficiaryEntity: string | null;
  documentType: string | null;
  engagementType: string | null;
  documentStage: string | null;
  completionPercent: number;
  collectionSufficient: boolean;
  currentlyClarifying: string | null;
  missingCritical: UnderstandingItem[];
  tbcItems: UnderstandingItem[];
  contradictions: UnderstandingItem[];
  recentlyConfirmed: UnderstandingItem[];
  readyToDraftHint: string | null;
}
