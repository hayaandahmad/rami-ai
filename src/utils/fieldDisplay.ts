/**
 * Human-readable Field labels for BA-facing UI.
 * Canonical source: PROJECT_MEMORY_FIELDS — do not duplicate a second dictionary.
 */

import { getFieldDef } from '@/schema/projectMemoryFields';

const CONTEXT_LABELS: Record<string, string> = {
  documentStage: 'Document / procurement stage',
  contractingGranularity: 'Contracting model',
  primaryDomain: 'Primary domain',
  secondaryDomains: 'Secondary domains',
};

export function fieldLabel(fieldId: string): string {
  if (!fieldId || fieldId === '__coverage_gap__') return 'Additional section coverage';
  return getFieldDef(fieldId)?.label ?? CONTEXT_LABELS[fieldId] ?? humanizeCamel(fieldId);
}

function humanizeCamel(id: string): string {
  const spaced = id.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function looksLikeRawFieldId(text: string): boolean {
  return /^[a-z][a-zA-Z0-9]+$/.test(text) && /[A-Z]/.test(text);
}

export function describeBlocker(
  fieldId: string,
  kind: 'missing' | 'tbc' | 'contradiction' = 'missing',
): string {
  const label = fieldLabel(fieldId);
  if (kind === 'tbc') return `${label} — To be confirmed`;
  if (kind === 'contradiction') return `${label} — Conflicting information needs review`;
  return label;
}

export function formatValuePreview(value: unknown, max = 80): string {
  if (value == null) return '—';
  if (typeof value === 'string') {
    const t = value.trim();
    return t.length > max ? `${t.slice(0, max)}…` : t;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const joined = value.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(', ');
    return joined.length > max ? `${joined.slice(0, max)}…` : joined || '—';
  }
  try {
    const s = JSON.stringify(value);
    return s.length > max ? `${s.slice(0, max)}…` : s;
  } catch {
    return '—';
  }
}

export function exportStatusCopy(complete: boolean): {
  buttonLabel: string;
  helper: string;
} {
  if (complete) {
    return {
      buttonLabel: 'Download Word (.docx)',
      helper: 'All applicable sections are approved.',
    };
  }
  return {
    buttonLabel: 'Download Word (.docx)',
    helper: 'Working draft — includes TBC or unapproved sections.',
  };
}
