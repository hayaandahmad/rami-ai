# Historical coverage & gap report

Generated: 2026-08-30T22:28:33.690Z  
Classification applied: 2026-08-31 (canonical information-model expansion)

Documents: **7** · Canonical QA: **434** (workbook 62 × 7) · Noncanonical Suggested Additions: **127**

PDF-backed: pq-15-egovt-2026-sanad-ai, rfp-17-egovt-2026-performance-assessment, rfp-22-egovt-2026-reengineering-ofa, rfp-itas-vol2b

PDF unavailable: rfp-connectivity-ofa, rfp-nur-v2-lakehouse, rfp-ssc-bpr

## Information-model gaps (from imported historical text)

| Candidate | Severity | Datasets | Hits | Partial overlap |
|---|---|---:|---:|---|
| procurementStage | CRITICAL | 1 | 46 | ProjectContext.documentStage |
| awardModelAndSupplierCount | CRITICAL | 7 | 22 | — |
| callOffOrSowProcess | CRITICAL | 4 | 66 | engagementType, engagementPhases |
| namedKeyPersonnelRequirements | CRITICAL | 7 | 16 | stakeholderRoles |
| clarificationContact | IMPORTANT | 7 | 18 | — |
| submissionChannel | IMPORTANT | 3 | 8 | — |
| governanceCadence | IMPORTANT | 6 | 44 | engagementPhases |
| knowledgeTransferRequirements | IMPORTANT | 3 | 17 | deliverableItems |

Frequency alone was **not** sufficient to promote. See evidence matrix below.

## Evidence matrix and classification

| Candidate | Decision | Why |
|---|---|---|
| procurementStage | **PROMOTE_TO_PROJECT_CONTEXT / DERIVED** — no Field | Already `ProjectContext.documentStage`. RAG leave-one-out was weak. BA/document signals only; never infer from RAG. |
| awardModelAndSupplierCount | **PROMOTE_TO_CANONICAL_FIELD** `awardModel` | 7/7 RFPs. Structured `{ model, supplierCount }`. Not a classifier. |
| callOffOrSowProcess | **PROMOTE_TO_CANONICAL_FIELD** | 4/7 framework datasets. FRAMEWORK / ASSIGNMENT / SOW only. N/A on one-off RFPs. |
| namedKeyPersonnelRequirements | **PROMOTE_TO_CANONICAL_FIELD** `namedKeyPersonnel` | 7/7. Distinct from `stakeholderRoles`. Array of roles + CV/experience. N/A if none required. |
| clarificationContact | **PROMOTE_TO_CANONICAL_FIELD** | 7/7. Admin supporting. PROCUREMENT / PQ only. TBC allowed. |
| submissionChannel | **PROMOTE_TO_CANONICAL_FIELD** | Distinct from `proposalDeadline` / general comms. TBC allowed. |
| governanceCadence | **PROMOTE_TO_CANONICAL_FIELD** | 6/7. Distinct from `engagementPhases`. Ask only when PMO/governance applies. |
| knowledgeTransferRequirements | **PROMOTE_TO_CANONICAL_FIELD** | 3/7 (ITAS / NUR / SANAD). Not a duplicate of `deliverableItems`. System/training packs. |
| bidBond / eligibility / proposal format-copies | **REJECT / REFERENCE_ONLY** | Fold into `legalTerms` / `requiredAnnexes` / `evaluationRules` or keep boilerplate. |
| implementation milestones | **DUPLICATE** | Covered by `engagementPhases`. |
| Domain-specific 13.x–17.x (AI, BPR, connectivity, lakehouse) | **REFERENCE_ONLY / adaptive** | Not global Fields. Historical IDs collide across RFPs. |

## 127 Suggested Additions (grouped)

Historical source IDs `13.x`–`17.x` **collide across RFPs**. New canonical Questions use **`18.x`**.

Recurring semantic categories (not unique question texts):

1. Award / supplier count / ranked panel  
2. Call-off / SOW / work-order process  
3. Named key personnel / CVs / manpower  
4. Clarification contact / enquiry channel  
5. Submission portal / JONEPS / e-procurement  
6. Governance / PMO / steering cadence  
7. Knowledge transfer / ToT / handover  
8. Bid bond / performance guarantee (rejected as Field)  
9. Eligibility / PQ criteria (rejected — stage + legal/annexes)  
10. Proposal format / copies / envelopes (boilerplate)  
11. Site visit / pre-bid conference (one-off / REFERENCE)  
12. Domain-specific packs (AI, BPR, connectivity, lakehouse) — adaptive / REFERENCE  

Workbook canonical Questions remain **62**. Promoted Questions: **7** (`18.1`–`18.7`). Canonical total: **69**.

Do **not** import the 127 Suggested Additions as a questionnaire.

## After expansion

| Item | Old | New |
|---|---:|---:|
| Canonical Fields | 52 | 59 |
| Canonical Questions | 62 | 69 |
| Canonical Sections | 20 | 20 |

Historical Excel workbooks are unchanged (still 7 × 62). Promoted Field associations are deterministic Question-text mappings only.

RAG / embeddings: foundation exists (732 chunks). Generation-time RAG: **not implemented**.
