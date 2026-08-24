# Canonical RFP Schema (Final, Normalized)

Status: **Final for current architecture pass.** Supersedes the informal 20-section list as stated inline in prior chat analysis — this file is now the authoritative machine-readable reference.

Source authority order (unchanged):

1. **PRIMARY:** `.private-context/knowledge/02-rfp-master-structure.txt`
2. **SUPPORTING / CROSS-CHECK:** `GeneralTemplate.docx`, `RFP-document17egovt2026.pdf`, `OFA-Internet-Services-MPLS-5G-Satellite-VPN-RFP-v4.pdf`, `MoDEE-Stage3-RFP-Vol2B-ITAS-vF.pdf`

This document is sufficient on its own for an implementation agent to build a machine-readable schema (e.g. a TypeScript const or JSON file) **without re-reading any of the source PDFs/DOCX**.

---

## 1. Result of revalidation against `GeneralTemplate.docx`

`GeneralTemplate.docx` was read via local, read-only XML extraction (the docx zip was expanded to a temp directory outside the repo, `word/document.xml` and `word/styles.xml` were parsed for paragraph styles, numbering, and table structure, and the temp directory was deleted afterward — the original file was never modified, moved, or copied into the repo).

**Key finding: the template contains its own embedded "IN SHORT: Mandatory vs Conditional Sections" table** (24 rows) at the end of the document. This is strong independent corroboration of the master structure:

| Template's own classification | Matches master structure? |
|---|---|
| Cover Page, TOC, Introduction, Background/Business Need, Engagement Definition, Scope of Work, Deliverables, Administrative Procedures, Evaluation Criteria, Financial Proposal Requirements, Legal Terms, Annexes → **Mandatory** | Yes, exact match |
| Abbreviations, Functional Requirements, Manpower Requirements → **Conditional** | Yes, exact match |
| Support and Maintenance, SLA → **Conditional** | Matches (SLA is treated as a sub-topic of Support and Maintenance in the master structure, not a separate top-level section — no change made) |
| Infrastructure/Hosting, Security Requirements, Data Migration, Training → **Conditional**, listed as if standalone | These are **subsections of Technical and Non-Functional Requirements** in the master structure and in the document body itself (they appear as sub-headings under "Technical and Non-Functional Requirements", not as independent numbered sections). Per instruction, a section is not added merely because a self-summary table lists it at the same indentation as top-level sections. **No new top-level section created** — these become documented representative subsections instead (see §3). |
| POC Requirements → **Conditional** | Already covered by the master structure's conditional list ("PoC requirements") |

**Two internal inconsistencies found in the template itself** (documented, not silently resolved):

1. The template's own "IN SHORT" summary table **omits "Implementation Requirements" and "Project Management and Governance"** even though both exist as real, numbered sections in the document body (`9. Implementation Requirements`, and a section titled "Project Management and Governance" — see finding 2 below). This looks like an oversight in the template author's own summary, not a deliberate declassification. The master structure's classification (both **Conditional**) is preserved as authoritative.
2. The body section that should be numbered "**11.** Project Management and Governance" is literally typed as "**1.** Project Management and Governance" in the source file (sequence in the document is `9 → 10 → 1 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19`). This is a numbering typo in the original template, not a structural signal. Documented here; the original file was not edited.

**No section was added or removed from the master structure as a result of this review.** The 20-section master structure is **confirmed final**.

---

## 2. Structural nuance found in `GeneralTemplate.docx`: two levels of grouping

The template's own "RFP Organization" narrative (near the top) groups the document into **10 umbrella "Sections"**:

```text
Section 1: Introduction
Section 2: Background and Engagement Definition
Section 3: Scope of Work
Section 4: Requirements                        (bundles Functional + Technical/Non-Functional)
Section 5: Deliverables
Section 6: Administrative Procedures and Requirements
Section 7: Evaluation Criteria
Section 8: Financial Proposal Requirements
Section 9: Legal and Contractual Terms
Section 10: Annexes
```

...while the actual document **body** uses ~19 finer-grained numbered headings (Background, Engagement Definition, Scope, Functional Requirements, Technical Requirements, Implementation Requirements, Deliverables, Project Management and Governance, Acceptance Criteria and Go-Live, Support and Maintenance, Manpower, Administrative Procedures, Evaluation Criteria, Financial Proposal Requirements, Legal and Contractual Terms, Annexes).

This confirms, independently of the ITAS multi-volume finding from the prior pass, that **real RFPs present the canonical structure at more than one level of granularity simultaneously**: a small number of umbrella chapters for the table of contents, and a larger number of canonical sections underneath. The schema below models the **fine-grained canonical level** (20 sections); an optional `chapterGroup` field is included so a future document-generation step can roll sections up into umbrella chapters for a table of contents, without changing section identity.

**Parsing implication (for RAG/generation, Phase 3):** `GeneralTemplate.docx` does **not** use Word's semantic heading styles (`Heading1`, `Heading2`, etc.) — every section title is a plain "Normal" or "List Paragraph" styled paragraph with manually typed numbering. Automated section detection for future DOCX parsing/generation cannot rely on paragraph style alone; it must also match on numbering patterns and known section-title text.

---

## 3. Final Canonical Schema (20 sections)

| sectionId | Title | Order | Class | Applicable-when | Representative subsections / data tables | Source support |
|---|---|---|---|---|---|---|
| `coverPage` | Cover Page | 1 | Mandatory | Always | Title, beneficiary entity, RFP no., deadline, version, date | All 3 PDFs; template |
| `tableOfContents` | Table of Contents | 2 | Mandatory | Always | May show umbrella chapters (§2) or full section list | All 3 PDFs; template |
| `abbreviations` | Abbreviations and Definitions | 3 | Conditional | Technical/complex RFPs (system implementation, technical connectivity) | Glossary table | ITAS (full table); template (listed conditional); absent in the 2 smaller PDFs |
| `introduction` | Introduction | 4 | Mandatory | Always | RFP Purpose; RFP Organization | All 3 PDFs; template |
| `background` | Background and Business Need | 5 | Mandatory | Always | Current situation; problem statement; objectives | All 3 PDFs (ITAS folds it into Introduction — content still present); template |
| `engagementDefinition` | Engagement Definition | 6 | Mandatory | Always | Engagement type; phases; duration | Performance-Assessment PDF (explicit); OFA PDF ("Framework Agreement and Purchasing Mechanism" variant); template (checkbox-style engagement type selector) |
| `scopeOfWork` | Scope of Work | 7 | Mandatory | Always | In-scope / out-of-scope; bidder responsibilities; MODEE/entity responsibilities; assumptions/dependencies/constraints | All 3 PDFs; template |
| `functionalRequirements` | Functional Requirements | 8 | Conditional | `documentType` involves software/system delivery | Modules table (Module / Description / Required? / Notes); workflows; reporting needs | ITAS (dense workstream tables); template (sample table); absent in connectivity/assessment PDFs |
| `technicalRequirements` | Technical and Non-Functional Requirements | 9 | Conditional | `documentType` involves a technical/hosted solution | Solution architecture; **Infrastructure/Hosting**; **Integration Requirements**; **Information Security**; **Performance Requirements**; **Data Migration**; Reporting/Analytics; Bilingual/Accessibility | ITAS (heaviest, incl. SLA/severity tables); OFA (per-service spec tables); template (all subsections present as sub-headings, confirming they are subsections, not top-level sections) |
| `implementationRequirements` | Implementation Requirements | 10 | Conditional | Multi-stage engagements (system implementation, large services) | Requirement gathering; design; development/configuration; testing/QA; deployment/go-live; training | ITAS ("Scope of Work" 4.1–4.9, functionally equivalent); template (9.1–9.6, near-identical stage breakdown) |
| `deliverables` | Deliverables | 11 | Mandatory | Always | Deliverables table (No. / Deliverable / Description / Format / Approval Required) | Performance-Assessment PDF (explicit); template (7-row sample table); embedded in Scope for OFA/ITAS |
| `projectManagementGovernance` | Project Management and Governance | 12 | Conditional | Larger/longer engagements | PM approach; project plan; communication/reporting; risk/issue management; change control | ITAS (§7, full PMO section); template (11.1–11.5, near-identical structure) |
| `acceptanceCriteria` | Acceptance Criteria and Go-Live | 13 | Conditional | Engagements with a delivery/go-live milestone | Acceptance conditions; UAT; go-live requirements | ITAS (§6); template (12.1–12.3) |
| `supportMaintenance` | Support and Maintenance | 14 | Conditional | Engagements with a post-delivery support period | Support period/hours; **SLA severity/response/resolution table**; support reporting | ITAS (§3.3, severity + liquidated-damages tables); OFA (per-service SLA tables); Performance-Assessment PDF (SLA clause); template (5-row severity table) |
| `manpowerRequirements` | Manpower / Resource Requirements | 15 | Conditional | Engagements requiring named on-site/dedicated roles | Roles table (Role / Min. Experience / Qualification / Notes) | ITAS (§5, detailed); template (4-row sample table) |
| `administrativeProcedures` | Administrative Procedures and Requirements | 16 | Mandatory | Always | Response procedures; response format; submission; late-submission rule | All 3 PDFs (near-identical boilerplate); template |
| `evaluationCriteria` | Proposal Evaluation Criteria | 17 | Mandatory | Always | Technical evaluation weights table; minimum passing score; disqualification conditions; PoC scoring (conditional) | All 3 PDFs; template (weights table + rules) |
| `financialProposal` | Financial Proposal Requirements | 18 | Mandatory | Always | Pricing model; **cost breakdown table**; optional items; taxes | All 3 PDFs; template (12-row cost breakdown table) |
| `legalContractualTerms` | Legal and Contractual Terms | 19 | Mandatory | Always | Applicable law; conflict of interest; confidentiality; IP; JV/subcontracting; bonds/guarantees | All 3 PDFs (near-identical boilerplate, high reuse potential — see `historical-rfp-findings.md`); template |
| `annexes` | Annexes | 20 | Mandatory | Always | List of applicable annex forms (compliance sheet, financial/technical proposal forms, confidentiality undertaking, security questionnaire, standards, JV agreement, requirement matrices, etc.) | All 3 PDFs; template lists 12 candidate annexes |

### Notes on classification decisions

- **Deliverables is Mandatory**, matching both the master structure and the template's own summary — not downgraded to conditional despite being embedded inline in two of the three historical PDFs rather than given its own heading. Physical placement in a specific historical document does not change canonical classification.
- **SLA is not a top-level section.** It is documented as the primary representative subsection of `supportMaintenance` (and, for connectivity-type engagements, appears per-service inside `technicalRequirements` too — see `historical-rfp-findings.md`).
- **PoC Requirements is not a top-level section.** It is a conditional content pattern inside `engagementDefinition` and/or `evaluationCriteria`, exactly as the master structure's conditional list already implies.

---

## 4. Physical grouping / multi-volume and multi-chapter behavior

Two independent pieces of evidence (ITAS being "Volume 2B" of a multi-volume tender; `GeneralTemplate.docx`'s umbrella-chapter table of contents) confirm the same principle:

> **The 20-section canonical schema describes the complete conceptual RFP. A specific engagement may physically split, merge, or reorder these sections into volumes or umbrella chapters for presentation. This is a `physicalGrouping` concern layered on top of the schema, not a change to section identity, order, or classification.**

Recommended schema field for implementation: each section carries an optional `chapterGroup` label (e.g. `functionalRequirements` and `technicalRequirements` both roll up into chapter "Requirements" per the template's own grouping) and an optional `volumeHint` (e.g. ITAS's Evaluation/Financial/Legal sections would carry a `volumeHint` of "commercial volume" when generating a large multi-volume RFP). Neither field is required for the MVP; both are documented here so Phase 4/5 generation logic doesn't have to rediscover this.

---

## 5. What did NOT change from the prior pass

- Section count: **20** (unchanged).
- Section identities, order, and mandatory/conditional split: **unchanged**, now independently corroborated by a fourth source (`GeneralTemplate.docx`) in addition to the 3 PDFs.
- Authority hierarchy: **unchanged** — `02-rfp-master-structure.txt` remains primary; nothing in `GeneralTemplate.docx` overrode it.
