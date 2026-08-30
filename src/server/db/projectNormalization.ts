/**
 * Deterministic project-level normalization.
 * Qwen extracts amount + currency / free-text duration.
 * This module converts to JOD and months. The model never supplies FX rates.
 */

import { getFxRateToJod } from './config';

export interface ExtractedMoney {
  amount: number;
  currency: string;
}

export function parseMoneyHint(raw: unknown): ExtractedMoney | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const amount = Number(obj.amount ?? obj.value);
    const currency = String(obj.currency ?? obj.ccy ?? 'JOD');
    if (Number.isFinite(amount) && amount >= 0) return { amount, currency };
  }
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
  const m = text.replace(/,/g, '').match(/([\d]+(?:\.\d+)?)\s*(USD|EUR|GBP|JOD|JD)?/i);
  if (!m) return null;
  return { amount: Number(m[1]), currency: (m[2] ?? 'JOD').toUpperCase() };
}

export function convertToJod(amount: number, currency: string): number | null {
  const rate = getFxRateToJod(currency);
  if (rate == null) return null;
  return Math.round(amount * rate * 1000) / 1000;
}

/** Normalize free-text duration to whole months. */
export function parseDurationMonths(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.round(raw));
  const text = String(raw).toLowerCase();
  const num = text.match(/(\d+(?:\.\d+)?)/);
  if (!num) return null;
  const n = Number(num[1]);
  if (!Number.isFinite(n)) return null;
  if (/year|yr/.test(text)) return Math.round(n * 12);
  if (/week/.test(text)) return Math.max(1, Math.round(n / 4.345));
  if (/day/.test(text)) return Math.max(1, Math.round(n / 30));
  return Math.round(n);
}

export function deriveProjectBudgetJod(memoryValue: unknown): number | null {
  if (memoryValue && typeof memoryValue === 'object' && !Array.isArray(memoryValue)) {
    const breakdown = (memoryValue as { costBreakdown?: Array<{ amount?: string }> }).costBreakdown;
    if (Array.isArray(breakdown)) {
      let total: number | null = null;
      for (const row of breakdown) {
        const parsed = parseMoneyHint(row.amount);
        if (!parsed) continue;
        const jod = convertToJod(parsed.amount, parsed.currency);
        if (jod == null) continue;
        total = (total ?? 0) + jod;
      }
      if (total != null) return total;
    }
    const parsed = parseMoneyHint(memoryValue);
    if (parsed) return convertToJod(parsed.amount, parsed.currency);
  }
  return parseMoneyHint(memoryValue)
    ? convertToJod(parseMoneyHint(memoryValue)!.amount, parseMoneyHint(memoryValue)!.currency)
    : null;
}
