import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Briefcase,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileStack,
  HelpCircle,
  Layers,
  MonitorCog,
  Radio,
  Server,
} from "lucide-react";
import type { DocumentType } from "@/types/document";

export const DOCUMENT_TYPE_ICONS: Record<DocumentType, LucideIcon> = {
  "system-implementation": Server,
  "framework-agreement": Layers,
  consulting: Briefcase,
  assessment: ClipboardCheck,
  support: MonitorCog,
  "connectivity-telecom": Radio,
  other: HelpCircle,
};

export const SUMMARY_METRIC_ICONS = {
  totalDocuments: FileStack,
  inProgress: Clock3,
  needsClarification: AlertCircle,
  draftsGenerated: FileCheck2,
} as const;

export const SUMMARY_METRIC_TINTS = {
  totalDocuments: "bg-[var(--color-primary-100)] text-[var(--color-primary-800)]",
  inProgress: "bg-[var(--color-info-100)] text-[var(--color-info-700)]",
  needsClarification: "bg-[var(--color-warning-100)] text-[var(--color-warning-700)]",
  draftsGenerated: "bg-[var(--color-success-100)] text-[var(--color-success-700)]",
} as const;
