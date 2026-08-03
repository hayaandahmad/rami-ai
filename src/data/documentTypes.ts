import type { DocumentType } from "@/types/document";

export interface DocumentTypeDefinition {
  id: DocumentType;
  label: string;
  description: string;
  demoEnabled: boolean;
  availabilityLabel: string;
  unavailableMessage: string;
}

export const DOCUMENT_TYPE_DEFINITIONS: DocumentTypeDefinition[] = [
  {
    id: "system-implementation",
    label: "System Implementation",
    description: "Implementation of systems, platforms, or digital services.",
    demoEnabled: true,
    availabilityLabel: "Demo Available",
    unavailableMessage: "",
  },
  {
    id: "framework-agreement",
    label: "Framework Agreement",
    description: "Multi-supplier or recurring engagement framework.",
    demoEnabled: false,
    availabilityLabel: "Supported",
    unavailableMessage:
      "This document type is recognized by Rami but is not configured in this demo.",
  },
  {
    id: "consulting",
    label: "Consulting",
    description: "Advisory or consulting services engagement.",
    demoEnabled: false,
    availabilityLabel: "Supported",
    unavailableMessage:
      "This document type is recognized by Rami but is not configured in this demo.",
  },
  {
    id: "assessment",
    label: "Assessment",
    description: "Assessment, review, or evaluation engagement.",
    demoEnabled: false,
    availabilityLabel: "Supported",
    unavailableMessage:
      "This document type is recognized by Rami but is not configured in this demo.",
  },
  {
    id: "support",
    label: "Support",
    description: "Support or maintenance contract engagement.",
    demoEnabled: false,
    availabilityLabel: "Supported",
    unavailableMessage:
      "This document type is recognized by Rami but is not configured in this demo.",
  },
  {
    id: "connectivity-telecom",
    label: "Connectivity / Telecom",
    description: "Connectivity, telecom, or network-related engagement.",
    demoEnabled: false,
    availabilityLabel: "Supported",
    unavailableMessage:
      "This document type is recognized by Rami but is not configured in this demo.",
  },
  {
    id: "other",
    label: "Other",
    description: "Other approved document or engagement type.",
    demoEnabled: false,
    availabilityLabel: "Supported",
    unavailableMessage:
      "This document type is recognized by Rami but is not configured in this demo.",
  },
];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> =
  Object.fromEntries(
    DOCUMENT_TYPE_DEFINITIONS.map((definition) => [definition.id, definition.label]),
  ) as Record<DocumentType, string>;

export const DOCUMENT_TYPES: DocumentType[] = DOCUMENT_TYPE_DEFINITIONS.map(
  (definition) => definition.id,
);

export const DEMO_DOCUMENT_TYPE: DocumentType = "system-implementation";

export function getDocumentTypeDefinition(
  type: DocumentType,
): DocumentTypeDefinition {
  const definition = DOCUMENT_TYPE_DEFINITIONS.find((item) => item.id === type);

  if (!definition) {
    throw new Error(`Unknown document type: ${type}`);
  }

  return definition;
}

export function isDemoDocumentType(type: DocumentType): boolean {
  return getDocumentTypeDefinition(type).demoEnabled;
}
