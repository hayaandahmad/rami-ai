/**
 * Post-extraction mapping guards.
 * Qwen proposes fieldIds; TypeScript refuses obvious mis-maps before ProjectFacts update.
 * Generic — no project-specific keywords.
 */

import type { ExtractedFact } from '@/types/conversation';
import { isValidFieldId } from '@/server/ai/extractionSchema';
import type { UsersValue } from '@/types/projectMemory';
import {
  extractBeneficiaryEntityFromMessage,
  extractIssuerEntityFromMessage,
  isAudienceNotEntity,
  isIssuerMentionNotBeneficiary,
  shouldMapAudienceToUsers,
  stringifyFactValue,
  valueMatchesBeneficiaryRole,
  valueMatchesIssuerRole,
} from '@/server/rami/factValueGuards';

export { isAudienceNotEntity, stringifyFactValue } from '@/server/rami/factValueGuards';

const PROJECT_NAME_LINE =
  /(?:^|\n)\s*(?:project\s+name|rfp\s+title|document\s+title)\s*[:–-]\s*(.+)/i;
const PROJECT_NAME_IS =
  /(?:the\s+)?project(?:\s+name)?\s+is\s+(.+)/i;
const BUSINESS_NEED_LABELED =
  /(?:^|\n)\s*(?:business\s+need|problem\s+statement|the\s+need(?:\s+is)?)\s*[:–-]\s*(.+)/i;
const BUSINESS_NEED_REQUIRES =
  /((?:the\s+)?(?:ministry|authority|entity|client|organisation|organization|government)\s+(?:requires?|needs?)\s+(?:a|an|the)\s+[^.!?\n]{20,400})/i;

function asUsersValue(raw: unknown): UsersValue {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const cur = raw as UsersValue;
    return {
      internal: Array.isArray(cur.internal) ? cur.internal.map(String) : [],
      external: Array.isArray(cur.external) ? cur.external.map(String) : [],
    };
  }
  const text = stringifyFactValue(raw);
  return { internal: [], external: text ? [text] : [] };
}

function mergeUsers(a: UsersValue, b: UsersValue): UsersValue {
  const uniq = (xs: string[]) => [...new Set(xs.map((s) => s.trim()).filter(Boolean))];
  return {
    internal: uniq([...a.internal, ...b.internal]),
    external: uniq([...a.external, ...b.external]),
  };
}

function stripUnassertedAudience(users: UsersValue, message: string): UsersValue {
  const keep = (item: string) => {
    if (!isAudienceNotEntity(item)) return true;
    return shouldMapAudienceToUsers(item, message);
  };
  return {
    internal: users.internal.filter(keep),
    external: users.external.filter(keep),
  };
}

/**
 * engagementType is the nature of the procured work (Q 2.1: implementation /
 * consulting / assessment / support / framework / PoC / mixed) — not documentType
 * and not the commercial award/pricing model.
 */
function inferEngagementType(message: string): string | null {
  const blob = message.toLowerCase();
  if (/\b(system[- ]implementation|system development|digital platform development|platform development)\b/.test(blob)) {
    return 'system implementation';
  }
  if (/\bconsulting(\s+service|\s+engagement)?\b|\badvisory\b/.test(blob)) return 'consulting';
  if (/\b(assessment|maturity assessment)\b/.test(blob)) return 'assessment';
  if (/\bframework agreement\b/.test(blob)) return 'framework agreement';
  if (/\bsupport(\s+and\s+maintenance)?\s+contract\b/.test(blob)) return 'support';
  if (/\b(proof of concept|\bpoc\b)\b/.test(blob)) return 'poc';
  if (/\bone[- ]time project\b/.test(blob)) return 'one-time project';
  return null;
}

function titleFromMessage(message: string): string | null {
  const labeled = PROJECT_NAME_LINE.exec(message);
  const spoken = PROJECT_NAME_IS.exec(message);
  const raw = labeled?.[1] ?? spoken?.[1];
  if (raw) {
    const title = raw.split('\n')[0].trim().replace(/^["'.]|["'.]$/g, '');
    if (title.length >= 8 && title.length <= 200) return title;
  }
  return null;
}

function needFromMessage(message: string): string | null {
  const labeled = BUSINESS_NEED_LABELED.exec(message);
  if (labeled?.[1]) {
    const t = labeled[1].split('\n')[0].trim().replace(/^["'.]|["'.]$/g, '');
    if (t.length >= 20 && t.length <= 600) return t;
  }
  const requires = BUSINESS_NEED_REQUIRES.exec(message);
  if (requires?.[1]) {
    const t = requires[1].trim().replace(/[.]+$/, '');
    if (t.length >= 20 && t.length <= 600) return t;
  }
  return null;
}

/**
 * Correct obvious field mis-maps. Prefer omitting a fact over storing it on the wrong field.
 */
export function normalizeExtractedFacts(
  facts: ExtractedFact[],
  latestMessage?: string,
): ExtractedFact[] {
  const message = latestMessage ?? '';
  const out: ExtractedFact[] = [];
  let pendingUsers: UsersValue = { internal: [], external: [] };

  for (const fact of facts) {
    if (!isValidFieldId(fact.fieldId)) {
      out.push(fact);
      continue;
    }

    if (fact.fieldId === 'issuerEntity') {
      if (isAudienceNotEntity(fact.value)) {
        continue;
      }
      if (
        valueMatchesBeneficiaryRole(fact.value, message) &&
        !valueMatchesIssuerRole(fact.value, message)
      ) {
        out.push({ ...fact, fieldId: 'beneficiaryEntity' });
        continue;
      }
      out.push(fact);
      continue;
    }

    if (fact.fieldId === 'beneficiaryEntity') {
      if (isAudienceNotEntity(fact.value)) {
        if (shouldMapAudienceToUsers(fact.value, message)) {
          pendingUsers = mergeUsers(pendingUsers, {
            internal: [],
            external: [stringifyFactValue(fact.value)].filter(Boolean),
          });
        }
        continue;
      }
      if (
        isIssuerMentionNotBeneficiary(fact.value, message) ||
        (valueMatchesIssuerRole(fact.value, message) &&
          !valueMatchesBeneficiaryRole(fact.value, message))
      ) {
        out.push({ ...fact, fieldId: 'issuerEntity' });
        continue;
      }
      out.push(fact);
      continue;
    }

    if (fact.fieldId === 'users') {
      const cleaned = stripUnassertedAudience(asUsersValue(fact.value), message);
      if (!cleaned.internal.length && !cleaned.external.length) continue;
      out.push({ ...fact, value: cleaned });
      continue;
    }

    out.push(fact);
  }

  if (pendingUsers.internal.length || pendingUsers.external.length) {
    const existingIdx = out.findIndex((f) => f.fieldId === 'users');
    if (existingIdx >= 0) {
      out[existingIdx] = {
        ...out[existingIdx],
        value: mergeUsers(asUsersValue(out[existingIdx].value), pendingUsers),
        updateKind: out[existingIdx].updateKind ?? 'assert',
      };
    } else {
      out.push({
        fieldId: 'users',
        value: pendingUsers,
        confidence: 'medium',
        updateKind: 'assert',
      });
    }
  }

  const has = (id: string) => out.some((f) => f.fieldId === id);

  if (!has('issuerEntity')) {
    const issuer = extractIssuerEntityFromMessage(message);
    if (issuer) {
      out.push({
        fieldId: 'issuerEntity',
        value: issuer,
        confidence: 'high',
        updateKind: 'assert',
      });
    }
  }

  if (!has('beneficiaryEntity')) {
    const beneficiary = extractBeneficiaryEntityFromMessage(message);
    if (beneficiary) {
      out.push({
        fieldId: 'beneficiaryEntity',
        value: beneficiary,
        confidence: 'high',
        updateKind: 'assert',
      });
    }
  }

  if (!has('documentTitle')) {
    const title = titleFromMessage(message);
    if (title) {
      out.push({
        fieldId: 'documentTitle',
        value: title,
        confidence: 'high',
        updateKind: 'assert',
      });
    }
  }

  if (!has('engagementType')) {
    const inferred = inferEngagementType(message);
    if (inferred) {
      out.push({
        fieldId: 'engagementType',
        value: inferred,
        confidence: 'medium',
        updateKind: 'assert',
      });
    }
  }

  if (!has('businessNeedRationale')) {
    const need = needFromMessage(message);
    if (need) {
      out.push({
        fieldId: 'businessNeedRationale',
        value: need,
        confidence: 'high',
        updateKind: 'assert',
      });
    }
  }

  return out;
}
