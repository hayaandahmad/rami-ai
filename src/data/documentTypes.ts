import type { DocumentType } from "@/types/document";

export interface DocumentTypeDefinition {
  id: DocumentType;
  label: string;
  description: string;
  /** Whether RAMI can create and run this document type today. */
  supported: boolean;
  availabilityLabel: string;
}

export const DOCUMENT_TYPE_DEFINITIONS: DocumentTypeDefinition[] = [
  {
    id: "system-implementation",
    label: "System Implementation",
    description: "Implementation of systems, platforms, or digital services.",
    supported: true,
    availabilityLabel: "Supported",
  },
  {
    id: "framework-agreement",
    label: "Framework Agreement",
    description: "Multi-supplier or recurring engagement framework.",
    supported: true,
    availabilityLabel: "Supported",
  },
  {
    id: "consulting",
    label: "Consulting",
    description: "Advisory or consulting services engagement.",
    supported: true,
    availabilityLabel: "Supported",
  },
  {
    id: "assessment",
    label: "Assessment",
    description: "Assessment, review, or evaluation engagement.",
    supported: true,
    availabilityLabel: "Supported",
  },
  {
    id: "support",
    label: "Support",
    description: "Support or maintenance contract engagement.",
    supported: true,
    availabilityLabel: "Supported",
  },
  {
    id: "connectivity-telecom",
    label: "Connectivity / Telecom",
    description: "Connectivity, telecom, or network-related engagement.",
    supported: true,
    availabilityLabel: "Supported",
  },
  {
    id: "other",
    label: "Other",
    description: "Other approved document or engagement type.",
    supported: true,
    availabilityLabel: "Supported",
  },
];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> =
  Object.fromEntries(
    DOCUMENT_TYPE_DEFINITIONS.map((definition) => [definition.id, definition.label]),
  ) as Record<DocumentType, string>;

export const DOCUMENT_TYPES: DocumentType[] = DOCUMENT_TYPE_DEFINITIONS.map(
  (definition) => definition.id,
);

export function getDocumentTypeDefinition(
  type: DocumentType,
): DocumentTypeDefinition {
  const definition = DOCUMENT_TYPE_DEFINITIONS.find((item) => item.id === type);

  if (!definition) {
    throw new Error(`Unknown document type: ${type}`);
  }

  return definition;
}
