# Historical RFP & Template Findings (Normalized)

Status: **Final for current architecture pass.** Captures reusable structural findings from all 4 supporting sources without reproducing confidential content. Reference original filenames in `.private-context/knowledge/` for full text — none of it is reproduced here beyond minimal illustrative fragments.

Authority: these are **supporting/cross-check sources**. See `canonical-rfp-schema.md` for the primary-source-derived schema; this file only records patterns useful for RAG chunking, boilerplate reuse, and generation design.

---

## 1. Source inventory

| File | Type / domain | Size | Role in this analysis |
|---|---|---|---|
| `RFP-document17egovt2026.pdf` | Small e-government framework RFP | Read in full | Baseline "simple RFP" structural example |
| `OFA-Internet-Services-MPLS-5G-Satellite-VPN-RFP-v4.pdf` | Connectivity/telecom framework agreement (MPLS/5G/Satellite/VPN) | Read in full | Per-service technical spec + SLA pattern; framework "Purchasing Mechanism" pattern |
| `MoDEE-Stage3-RFP-Vol2B-ITAS-vF.pdf` | Large system-implementation RFP, Volume 2B of a multi-volume tender | 124 pages; TOC + sampled sections read | Dense table-driven requirements; multi-volume physical structure; tiered SLA/penalty tables |
| `GeneralTemplate.docx` | MODEE's own general-purpose RFP template/skeleton | Read in full via local XML extraction | Authoritative internal view of "what a complete RFP looks like," including the template's own mandatory/conditional self-summary |

---

## 2. Structural patterns confirmed across sources

- **Every source** includes, in some form: Cover Page, Introduction, Background, Scope of Work, Deliverables, Administrative Procedures, Evaluation Criteria, Financial Proposal Requirements, Legal Terms, Annexes. These are the strongest candidates for the "always mandatory" tier and match the master structure exactly.
- **Functional/Technical Requirements content is always table-driven when present**, never plain prose. ITAS and `GeneralTemplate.docx` both use `Module/Requirement | Description | Required? | Notes`-style tables. This directly shaped the RAG chunking rule below.
- **SLA content is always a severity/tier table**, never prose, across ITAS, OFA, and the template (`Severity | Description | Response Time | Resolution Time` in the template; comparable tiered structures with liquidated-damages formulas in ITAS and per-service SLA tables in OFA).
- **Legal/administrative boilerplate is highly repetitive across sources** — applicable law (Hashemite Kingdom of Jordan), confidentiality, conflict of interest, IP ownership, and late-submission rules appear in near-identical wording in all sources examined. This is the strongest candidate for a reusable clause library (PROPOSE-then-confirm pattern, see `question-information-mapping.md` §11.1/11.2).
- **Evaluation criteria are always weighted-percentage tables** with a minimum passing score gate before financial evaluation — consistent across all sources.
- **Cost/financial breakdown is always presented as a component/amount table**, with a "Total" row — consistent across the template and both larger PDFs.

## 3. Significant differences

- **Framework agreements (OFA, and partially the small e-gov RFP) restructure "Scope of Work" around a "Purchasing Mechanism"** (how individual call-offs/orders are issued under the framework) rather than a single fixed deliverable list. This is a content variant *within* `scopeOfWork` and `engagementDefinition`, not a new section — the canonical schema's `applicable-when` logic for these sections already accommodates it.
- **ITAS (large system implementation) is the only source with a dedicated Project Management and Governance section and a fully separated Manpower/Resource Requirements section with named-role tables.** Smaller RFPs (the e-gov PDF, OFA) fold PM concerns into Scope of Work and do not include a manpower table at all. This confirms these two sections' **Conditional** classification (present for larger/longer engagements, reasonably omitted for small ones) rather than making them mandatory.
- **`GeneralTemplate.docx` is the only source with an explicit engagement-type checkbox list** (`Software/System Implementation`, `Framework Agreement`, `Consulting Service`, `Technical Assessment`, `Support and Maintenance`, `Proof of Concept`, `Other`) — this maps directly onto the `documentType`/`engagementType` field's expected value set (`question-information-mapping.md` §0.1/§2.1) and should be used as the canonical enum for that field.

## 4. `GeneralTemplate.docx`-specific findings

(Full structural detail is in `canonical-rfp-schema.md` §1–2; this section lists findings not already covered there.)

- **Placeholder convention:** all fill-in points use `[bracketed placeholder text]` (e.g. `[Entity Name]`, `[Objective 1]`) or an unchecked box `[ ]` for multiple-choice selections. This is a clean, consistent signal for identifying "must be filled with project-specific information" content, distinct from surrounding boilerplate sentences that require no per-project edit. Recommendation: any future automated DOCX-generation step should treat bracketed placeholders as the canonical "slot" markers.
- **No semantic Word heading styles are used.** Every heading-like paragraph (including numbered section titles like "9. Implementation Requirements") carries the "Normal" or "List Paragraph" style, not "Heading 1/2/3". Section structure is conveyed entirely through manually typed numbering and (presumably) manual bold character formatting, not paragraph styles. **Parsing implication:** any future tool that needs to detect section boundaries in a `.docx` (for ingestion or for validating a generated draft) must match on numbering-pattern + known-title-text, not on `w:pStyle`.
- **Self-inconsistency in the template's own summary table:** its "IN SHORT: Mandatory vs Conditional Sections" table omits "Implementation Requirements" and "Project Management and Governance" even though both exist as real numbered sections in the body. Documented as a source quality issue; master structure's classification (both Conditional) is authoritative regardless.
- **Numbering typo:** the section that should be "11. Project Management and Governance" is literally typed "1. Project Management and Governance" in the body (breaks the otherwise clean 9→10→11→12… sequence). Documented, not corrected in the source file.
- **Reusable table skeletons found** (useful as PROPOSED starting structures during section generation, see `rfp-generation-architecture.md`):
  - Functional Requirements: `Module | Description | Required? | Notes`
  - Deliverables: `No. | Deliverable | Description | Format | Approval Required` (6 example rows: Project Plan, Requirements Document, Solution Design, Test Reports, Training Materials, Final Report)
  - Support SLA: `Severity | Description | Response Time | Resolution Time` (4 tiers)
  - Manpower: `Role | Minimum Experience | Required Qualification | Notes` (Project Manager, Technical Lead, Business Analyst, QA Engineer)
  - Technical Evaluation: `Criteria | Weight` (Company experience/references, Methodology, Team qualifications, Technical compliance, PoC/demonstration)
  - Cost Breakdown: `Component | Amount` (System/Service Delivery, Licenses, Infrastructure, Implementation, Security, Training and Change Management, Support and Maintenance, Project Management, Quality Management, Optional Components, Total)
  - Annex checklist: 12 candidate annexes (Compliance Sheet, Financial/Technical Proposal Forms, Confidentiality Undertaking, Security Questionnaire, Standards/Policies, Performance Test Checklist, Bidder Information Form, Letter of Acceptance, Joint Venture Agreement, Functional/Technical Requirements Matrices)

## 5. Retrieval / chunking implications for local RAG (see `rfp-knowledge-architecture.md` for the full pipeline)

1. **Tables must be chunked as atomic units**, never split row-by-row or merged with surrounding prose. A table's header row must always travel with its data rows in the same chunk (or be repeated in each chunk if a table must be split for length reasons).
2. **Section/subsection headings must be captured as chunk metadata** even where the source `.docx`/PDF does not use semantic heading styles — chunk boundaries should be detected via numbering-pattern and known-title matching (see §4 above), and each chunk should carry a `sectionPath` (e.g. `"Technical Requirements > Infrastructure / Hosting"`) for source attribution.
3. **Boilerplate clause clusters (legal terms, administrative procedures, standard responsibilities lists) are good candidates for smaller, semantically dense chunks** since they are frequently retrieved verbatim as PROPOSED defaults, whereas narrative background/scope content benefits from slightly larger chunks to preserve context.
4. **Every chunk must retain provenance metadata**: source filename, section path, and — once the trust lifecycle is implemented (see `rfp-knowledge-architecture.md`) — a trust tier (`approved-historical` for all 4 sources analyzed here at this stage; future Rami-generated documents get a different tier until explicitly promoted).

## 6. Explicit non-findings (things NOT to over-generalize)

- No source in this corpus is a pure consulting-only or pure assessment-only RFP — the "consulting service" and "technical assessment" `documentType` values are attested in `GeneralTemplate.docx`'s checkbox list but not exemplified by a full document in the current corpus. Treat their exact section-applicability rules as provisional until a real example is analyzed.
- Only one framework-agreement example (OFA) exists in the corpus; the "Purchasing Mechanism" pattern should be treated as a documented variant, not yet a fully generalized sub-schema.
