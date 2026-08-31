/**
 * Generic role guards for extracted values.
 * Distinguishes contracting entities, audiences, and system users.
 * No project-specific vocabulary.
 */

export function stringifyFactValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(stringifyFactValue).filter(Boolean).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).trim();
}

const ORGANIZATIONAL_ENTITY =
  /\b(ministr(y|ies)|authority|commission|department|institution|municipality|agency|directorate|cabinet|government entit)\b/i;

const AUDIENCE_OR_PUBLIC =
  /\b(general public|the public|citizens?|residents?|inhabitants|journalists?|media organizations?|media organisations?|indirect beneficiaries|end[- ]users?|authenticated users|platform users)\b/i;

function normalizeComparable(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function valuesLikelySame(a: string, b: string): boolean {
  const na = normalizeComparable(a);
  const nb = normalizeComparable(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  return shorter.length >= 8 && longer.includes(shorter);
}

export function isOrganizationalEntity(value: unknown): boolean {
  return ORGANIZATIONAL_ENTITY.test(stringifyFactValue(value));
}

/** Audience / public / user-group language that is not a contracting beneficiary entity. */
export function isAudienceNotEntity(value: unknown): boolean {
  const text = stringifyFactValue(value);
  if (!text) return false;
  if (isOrganizationalEntity(text)) return false;
  return AUDIENCE_OR_PUBLIC.test(text);
}

export function messageDeniesUserRole(message: string): boolean {
  return /\b(not (?:a |the |primary )?users?|not (?:a )?system user|non[- ]users?|rather than primary users|not the contracting beneficiary|indirect beneficiaries)\b/i.test(
    message,
  );
}

export function messageAssertsUserRole(message: string): boolean {
  return /\b((?:internal|external) users?\s+(?:are|include)|system users?\s+(?:are|include)|users?\s+(?:are|include)|will use the (?:system|platform)|end[- ]users?\s+(?:are|include))\b/i.test(
    message,
  );
}

function cleanOrgName(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const text = raw
    .replace(/\s+on behalf of\b[\s\S]*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the\s+/i, '')
    .replace(/[.,;:]+$/g, '')
    .trim();
  if (text.length < 3 || text.length > 160) return null;
  return text;
}

function firstCapture(
  message: string,
  patterns: RegExp[],
): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(message);
    const captured = cleanOrgName(match?.[1]);
    if (captured) return captured;
  }
  return null;
}

/** Named issuing / procuring organization, if the BA used issuer language. Never inferred from beneficiary alone. */
export function extractIssuerEntityFromMessage(message: string): string | null {
  if (!message) return null;
  return firstCapture(message, [
    /(.{3,80}?)\s+is issuing (?:the )?(?:rfp|tender) on behalf of\b/i,
    /(?:the\s+)?(?:rfp|tender)\s+is issued by\s+([^.\n]+)/i,
    /\bissued by\s*[:–-]?\s*([^.\n]+)/i,
    /\b(?:the\s+)?procuring entity\s*(?:is|:)\s*([^.\n]+)/i,
    /\b(?:the\s+)?issuing (?:entity|organisation|organization|authority)\s*(?:is|:)\s*([^.\n]+)/i,
    /\b(?:the\s+)?contracting authority\s*(?:is|:)\s*([^.\n]+)/i,
    /\b(?:the\s+)?rfp issuer\s*(?:is|:)\s*([^.\n]+)/i,
    /\bentity issuing this (?:tender|rfp)\s*(?:is|:)\s*([^.\n]+)/i,
    /\bentity publishing the rfp\s*(?:is|:)\s*([^.\n]+)/i,
  ]);
}

/** Beneficiary named via explicit beneficiary phrasing, or "on behalf of" when issuer language is also present. Never inferred from issuer alone. */
export function extractBeneficiaryEntityFromMessage(message: string): string | null {
  if (!message) return null;
  const explicit = firstCapture(message, [
    /(?:primary\s+)?beneficiary(?:\s+(?:entity|organisation|organization|agency))?\s+is\s*[:–-]?\s*([^.\n]+)/i,
  ]);
  if (explicit) return explicit;
  if (
    /\b(issued by|is issuing|procuring entity|contracting authority|rfp issuer|publishing the rfp)\b/i.test(
      message,
    )
  ) {
    return firstCapture(message, [/\bon behalf of\s+([^.\n]+)/i]);
  }
  return null;
}

export function valueMatchesIssuerRole(value: unknown, message: string): boolean {
  const v = stringifyFactValue(value);
  const issuer = extractIssuerEntityFromMessage(message);
  return Boolean(v && issuer && valuesLikelySame(v, issuer));
}

export function valueMatchesBeneficiaryRole(value: unknown, message: string): boolean {
  const v = stringifyFactValue(value);
  const beneficiary = extractBeneficiaryEntityFromMessage(message);
  return Boolean(v && beneficiary && valuesLikelySame(v, beneficiary));
}

/** True when the sentence treats this value as issuer/procuring party, not beneficiary. */
export function isIssuerMentionNotBeneficiary(value: unknown, message: string): boolean {
  const v = stringifyFactValue(value);
  if (!v || !message) return false;
  const issuedBy = extractIssuerEntityFromMessage(message);
  const beneficiaryNamed = extractBeneficiaryEntityFromMessage(message);
  if (!issuedBy || !beneficiaryNamed) return false;
  if (valuesLikelySame(issuedBy, beneficiaryNamed)) return false;
  return valuesLikelySame(v, issuedBy) && !valuesLikelySame(v, beneficiaryNamed);
}

/**
 * Audience groups belong in `users` only when the message asserts a user relationship
 * and does not deny it. Indirect beneficiaries / non-users are not users.
 */
export function shouldMapAudienceToUsers(value: unknown, message: string): boolean {
  if (!isAudienceNotEntity(value)) return false;
  if (messageDeniesUserRole(message)) return false;
  return messageAssertsUserRole(message);
}
