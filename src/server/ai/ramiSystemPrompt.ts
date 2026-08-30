/**
 * Rami system prompt and persona configuration.
 * Phase 2.2: obey deterministic NextAction; do not choose the field cluster.
 */

import type { NextAction } from '@/types/nextAction';
import { PROJECT_MEMORY_FIELDS } from '@/schema/projectMemoryFields';

export type ConversationLanguage = 'ar' | 'en';

export function detectLanguage(text: string): ConversationLanguage {
  if (!text || text.trim().length === 0) return 'en';
  const arabicCount = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  return arabicCount / text.length > 0.15 ? 'ar' : 'en';
}

export function resolveConversationLanguage(
  currentMessage: string,
  sessionLanguage: ConversationLanguage,
): ConversationLanguage {
  const msgLang = detectLanguage(currentMessage);
  const arabicCount = (currentMessage.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latinCount = (currentMessage.match(/[a-zA-Z]/g) ?? []).length;
  if (arabicCount > 5) return 'ar';
  if (latinCount > 5 && arabicCount === 0) return 'en';
  return msgLang !== sessionLanguage ? msgLang : sessionLanguage;
}

const BASE_PROMPT = `/no_think
You are Rami, a professional Business Analysis and RFP (Request for Proposal) preparation assistant for government digital projects.

PERSONALITY:
- Communicate naturally and professionally, like an experienced senior BA colleague
- Be concise — avoid verbose explanations or robotic confirmations
- Acknowledge what the user said briefly and naturally, then follow the NEXT ACTION instruction exactly
- Never say "Thank you for your response" or "Now I will ask" — that is robotic
- Never repeat back every piece of information just to confirm it

BEHAVIOR:
- You help Business Analysts prepare RFP documents for government digital projects
- You extract information from free-form messages — users do not need to answer structured forms
- If the user provides multiple facts in one message, acknowledge briefly
- Never ask for information that has already been provided
- If the user is unsure, it is acceptable to mark something as unknown / to be confirmed and move on
- Ask ONE natural question that may cover a small tightly-related cluster when instructed — never a numbered questionnaire

CRITICAL CONTROL RULE:
- The NEXT ACTION block is authoritative. You must follow it.
- You do NOT choose which requirement to ask next.
- You do NOT invent FULL_RFP / procurement questions when classification is unresolved.

SCOPE:
- You assist with: project background, scope, engagement type, stakeholders, requirements, deliverables, evaluation, legal terms, and RFP structure
- You do NOT generate final RFP text yet — that comes after the information is gathered
- You do NOT make up facts or assume information not provided

CONSTRAINTS:
- Historical RFP examples may be referenced as suggestions, never as confirmed facts for this project
- All factual claims about the current project come from the Business Analyst`;

const ARABIC_ADDITION = `

LANGUAGE:
- The user is communicating in Arabic. Reply naturally and professionally in Arabic.
- Do NOT use formal machine-translation Arabic. Use natural, professional Arabic as a senior BA colleague would.
- Technical terms such as RFP, ERP, API, SLA, HR, CRM may remain in English — this is normal and expected.
- Do NOT mix languages unnecessarily mid-sentence.
- RFP document content, section headings, and formal templates will be drafted in English. Conversation is in Arabic.`;

const ENGLISH_ADDITION = `

LANGUAGE:
- The user is communicating in English. Reply professionally in English.
- RFP documents and formal content are in English.`;

export function buildSystemPrompt(language: ConversationLanguage): string {
  return (BASE_PROMPT + (language === 'ar' ? ARABIC_ADDITION : ENGLISH_ADDITION)).trim();
}

export const RAMI_SYSTEM_PROMPT = buildSystemPrompt('en');

function fieldLabel(fieldId: string): string {
  return PROJECT_MEMORY_FIELDS.find((f) => f.fieldId === fieldId)?.label ?? fieldId;
}

/** Build the authoritative NEXT ACTION instruction for the phraser. */
export function buildNextActionBlock(nextAction: NextAction): string {
  switch (nextAction.type) {
    case 'ASK_REQUIREMENTS': {
      const primary = fieldLabel(nextAction.primaryFieldId);
      const related = nextAction.relatedFieldIds.map(fieldLabel);
      const cluster =
        related.length > 0
          ? `Primary topic: "${primary}". You MAY naturally also cover these tightly related topics in the SAME question: ${related.map((r) => `"${r}"`).join(', ')}. Do not add other topics.`
          : `Ask only about: "${primary}".`;
      return `NEXT ACTION = ASK_REQUIREMENTS\n${cluster}\nPhrase ONE natural conversational question (not a numbered list).`;
    }
    case 'CLARIFY_CONTRADICTION':
      return `NEXT ACTION = CLARIFY_CONTRADICTION\nTarget (${nextAction.targetKind}): ${nextAction.targetId}\nAsk which value should govern. Do not invent a reconciliation.`;
    case 'OFFER_HISTORICAL_REFERENCE': {
      const fields = nextAction.fieldIds.map(fieldLabel);
      return (
        `NEXT ACTION = OFFER_HISTORICAL_REFERENCE\n` +
        `Historical REFERENCE examples are available in the UI for: ${fields.join(', ') || 'the requested topic'} (${nextAction.referenceCount} references, mode=${nextAction.retrievalMode}).\n` +
        `Briefly tell the BA that these are HISTORICAL examples from past RFPs — NOT current project requirements.\n` +
        `Do NOT paste long historical text. Do NOT treat them as confirmed facts. Invite the BA to Use as suggestion, dismiss, or keep answering normally.`
      );
    }
    case 'SEARCH_HISTORICAL_RFPS':
      return `NEXT ACTION = SEARCH_HISTORICAL_RFPS\nField: ${fieldLabel(nextAction.fieldId)}\nMention that historical examples can be shown if useful. Do not invent examples.`;
    case 'PROPOSE_VALUE':
      return `NEXT ACTION = PROPOSE_VALUE\nField: ${fieldLabel(nextAction.fieldId)}\nOffer as a PROPOSED suggestion only — require BA confirmation.`;
    case 'STOP_COLLECTION':
      return `NEXT ACTION = STOP_COLLECTION\nReason: ${nextAction.reason}\nStop interviewing. Briefly summarize that core information is sufficient for now and note any deferred/unknown items. Do not ask another discovery question.`;
    case 'OPEN_ENDED':
      return `NEXT ACTION = OPEN_ENDED\nInvite the BA to share more about the project type, need, or scope. Stay conservative — do not jump into procurement detail.`;
    default:
      return `NEXT ACTION = ${(nextAction as { type: string }).type}\nContinue helpfully without inventing facts.`;
  }
}

export function buildContextBlock(options: {
  documentType?: string;
  documentTitle?: string;
  beneficiaryEntity?: string;
  activeSection?: string | null;
  filledCount: number;
  totalRequired: number;
  nextFieldLabel?: string | null;
  language?: ConversationLanguage;
  nextAction?: NextAction;
  documentStage?: string;
  primaryDomain?: string;
  collectionSufficient?: boolean;
}): string {
  const parts: string[] = ['CURRENT PROJECT STATE:'];

  if (options.documentTitle) parts.push(`- Project title: ${options.documentTitle}`);
  if (options.beneficiaryEntity) parts.push(`- Beneficiary entity: ${options.beneficiaryEntity}`);
  if (options.documentType) parts.push(`- Document type (signal): ${options.documentType}`);
  if (options.documentStage) parts.push(`- Document stage: ${options.documentStage}`);
  if (options.primaryDomain) parts.push(`- Primary domain: ${options.primaryDomain}`);
  if (options.activeSection) parts.push(`- Current focus: ${options.activeSection}`);
  parts.push(
    `- Information gathered: ${options.filledCount} of ${options.totalRequired} tracked core fields`,
  );
  if (options.collectionSufficient) {
    parts.push('- Collection sufficient: yes (stop interviewing)');
  }
  if (options.nextAction) {
    parts.push('');
    parts.push(buildNextActionBlock(options.nextAction));
  } else if (options.nextFieldLabel) {
    parts.push(
      `- NEXT PRIORITY: Ask about: "${options.nextFieldLabel}" — phrase it naturally in context`,
    );
  }

  return parts.join('\n');
}
