# Question Bank → Canonical Information Mapping (Final, Authoritative)

Status: **Final for current architecture pass.** Future Cursor agents should be able to build the structured project-memory schema and Rami's gap-detection logic from this document alone, **without re-reading `01-question-bank.txt`**.

Source: `.private-context/knowledge/01-question-bank.txt` (62 numbered question lines across groups 0–12, plus a 12-item "Minimum Starter Set" shortlist).

> **Correction to prior-pass estimate:** the earlier chat analysis estimated "57 source question lines / ~42–45 canonical requirements." A full line-by-line recount of `01-question-bank.txt` for this pass found **62 source lines**, not 57 (arithmetic error in the earlier estimate). The canonical field count below (52) is derived from this corrected line count and is the authoritative number going forward.

---

## 1. Headline counts

| Metric | Count |
|---|---|
| Total source question lines (`01-question-bank.txt`, groups 0–12) | **62** |
| → Duplicate/overlap lines (merged into another field, not counted separately) | 4 |
| → System-default lines (Phase-1 config, not asked as a per-project question) | 2 |
| → Agent-rule / heuristic lines (drive Rami's own reasoning, not stored project facts) | 6 |
| → Lines that split into 2 independent canonical fields | 1 (produces +1 field) |
| → Aggregate field not tied to one specific line (captures volunteered risk notes) | 1 (produces +1 field) |
| **Final canonical information-requirement count (original derivation)** | **52** |
| **After 2026-08 evidence-driven expansion** | **59 Fields / 69 Questions** (see DECISIONS #43). This file remains the original 52-field derivation. |
| "Minimum Starter Set" shortlist items | 12 (all map onto fields already listed below — no new fields) |

Category legend used below:

- **PROJECT_INFORMATION** — a fact about the specific engagement, stored in structured project memory with provenance.
- **AGENT_RULE / HEURISTIC** — governs how Rami behaves (what to check, how to prioritize) — never stored as a project fact.
- **SYSTEM_DEFAULT** — a Phase-1 configuration assumption, not asked per project unless a future phase changes the default.
- **DUPLICATE** — this line asks for information already captured by another canonical field; cross-referenced, not double-counted.

Field-split rule applied consistently: *a question line becomes more than one canonical field only when its sub-facts target different downstream RFP sections or have different confirmation profiles; otherwise sub-facts are kept together as one field with internal structure.*

---

## 2. Full mapping, group by group

### Group 0 — Document Setup

| # | Source wording | Canonical field | Target section(s) | Req/Cond | Category | Notes |
|---|---|---|---|---|---|---|
| 0.1 | What type of RFP/document is this? | `documentType` | Cover Page; drives all conditional-section applicability | Required | PROJECT_INFORMATION | The single most important field — gates §5/§6/§9/§10/§13/§14/§15 applicability. Ask first. No historical-retrieval support (this is a BA decision). BA confirmation required. |
| 0.2 | What is the document/RFP title? | `documentTitle` | Cover Page | Required | PROJECT_INFORMATION | Usually volunteered in the opening BA message. |
| 0.3 | What is the beneficiary entity / ministry? | `beneficiaryEntity` | Cover Page; Introduction | Required | PROJECT_INFORMATION | Same field as 3.1 — see duplicate note below. |
| 0.4 | What is the RFP or tender number (if any)? | `tenderNumber` | Cover Page | Conditional | PROJECT_INFORMATION | Often not yet assigned; TBC-eligible without blocking drafting. |
| 0.5 | What is the deadline? | `proposalDeadline` | Cover Page; Administrative Procedures | Conditional | PROJECT_INFORMATION | TBC-eligible; low drafting risk if deferred. |
| 0.6 | Language is English only for now... | — | — | — | **SYSTEM_DEFAULT** | Phase-1 config assumption (`draftLanguage = "en"`). Not asked. Revisit only if a future phase adds bilingual drafting. |
| 0.7 | Which approved template or reference RFP should be followed? | `referenceTemplateId` | Meta / drives RAG retrieval scope | Conditional | PROJECT_INFORMATION | Functions as a retrieval hint as much as a fact — historical retrieval directly supports this (Rami can propose a likely template based on `documentType` if BA has no preference). BA confirmation required since it scopes evidence retrieval. |

**Duplicate found:** 0.3 and 3.1 ask for the same fact (`beneficiaryEntity`) from two angles (document setup vs. stakeholders). Kept as **one field**, asked once, referenced in both the Cover Page and Stakeholders sections.

### Group 1 — Background and Business Need

| # | Source wording | Canonical field | Target section(s) | Req/Cond | Category | Notes |
|---|---|---|---|---|---|---|
| 1.1 | What is the current situation? | `currentSituation` | Background and Business Need | Required | PROJECT_INFORMATION | Often satisfied implicitly by the BA's opening message; explicit ask only if missing. Historical retrieval can suggest phrasing patterns (not content). |
| 1.2 | What pain points exist today? | `painPoints[]` | Background and Business Need | Required | PROJECT_INFORMATION | Distinct from 1.1 (symptom vs. situation) — kept separate. |
| 1.3 | Why is this project needed now? | `businessNeedRationale` | Background and Business Need | Required | PROJECT_INFORMATION | Distinct rationale/urgency field, not merged with 1.2. |
| 1.4 | What are the objectives and expected impact? | `businessObjectives[]` | Background and Business Need | Required | PROJECT_INFORMATION | |
| 1.5 | Are there previous phases, systems, or contracts to consider? | `previousPhases` | Background and Business Need | Conditional | PROJECT_INFORMATION | Strong historical-retrieval relevance (continuity with a prior contract). BA confirmation required — continuity claims are consequential. |

### Group 2 — Engagement Type

| # | Source wording | Canonical field | Target section(s) | Req/Cond | Category | Notes |
|---|---|---|---|---|---|---|
| 2.1 | One-time / framework / implementation / consulting / assessment / support / PoC / mixed? | `engagementType` | Engagement Definition | Required | PROJECT_INFORMATION | Closely related to `documentType` (0.1) but distinct: 0.1 is the broad RFP category used for section gating; 2.1 is the finer engagement-type statement written into the Engagement Definition section text. Cross-referenced, not merged, since they can diverge (e.g. `documentType = connectivity-telecom`, `engagementType = framework agreement`). |
| 2.2 | Are there phases? If yes, list them. | `engagementPhases[]` | Engagement Definition; reused in Implementation Requirements | Conditional | PROJECT_INFORMATION | Absorbs 8.1's "stages" aspect — see duplicate note below. |
| 2.3 | What is the expected duration? | `engagementDuration` | Engagement Definition | Required | PROJECT_INFORMATION | Absorbs 8.1's "timeline" aspect. |

### Group 3 — Stakeholders and Users

| # | Source wording | Canonical field | Target section(s) | Req/Cond | Category | Notes |
|---|---|---|---|---|---|---|
| 3.1 | Who is the beneficiary / system owner? | — | — | — | **DUPLICATE** of `beneficiaryEntity` (0.3) | Not a new field. |
| 3.2 | Who are internal users? External users? | `users` (`{internal[], external[]}`) | Stakeholders and Users | Required | PROJECT_INFORMATION | Both sub-asks target the same section with the same confirmation profile — kept as one structured field. |
| 3.3 | What roles are required? | `stakeholderRoles[]` | Stakeholders and Users | Conditional | PROJECT_INFORMATION | |
| 3.4 | Who approves? Who does UAT? | `approvers[]` **and** `uatOwners` | Stakeholders and Users; `approvers` also feeds Deliverables approval defaults; `uatOwners` also feeds Acceptance Criteria and Go-Live | Conditional | PROJECT_INFORMATION | **Split into 2 fields** — the only split in the mapping — because the two facts feed different downstream sections. |
| 3.5 | Who owns the system after go-live? | `postGoLiveOwner` | Stakeholders and Users | Conditional | PROJECT_INFORMATION | Rarely detailed in historical RFPs; BA confirmation required when present. |

### Group 4 — Scope of Work

| # | Source wording | Canonical field | Target section(s) | Req/Cond | Category | Notes |
|---|---|---|---|---|---|---|
| 4.1 | What is in scope? | `inScope[]` | Scope of Work | Required | PROJECT_INFORMATION | High-impact/contractual — BA confirmation required before drafting. |
| 4.2 | What is out of scope? | `outOfScope[]` | Scope of Work | Required | PROJECT_INFORMATION | Same as above. |
| 4.3 | What are bidder responsibilities? | `bidderResponsibilities[]` | Scope of Work | Conditional | PROJECT_INFORMATION | Near-boilerplate — `GeneralTemplate.docx` provides a strong default list; Rami can PROPOSE from the template default, BA edits/confirms rather than dictating from scratch. |
| 4.4 | What are MODEE / entity responsibilities? | `entityResponsibilities[]` | Scope of Work | Conditional | PROJECT_INFORMATION | Same PROPOSED-from-template pattern as 4.3. |
| 4.5 | Assumptions, dependencies, constraints? | `assumptions[]`, `dependencies[]`, `constraints[]` (one compound field) | Scope of Work | Conditional | PROJECT_INFORMATION | Kept as one field with three sub-lists — same section, same confirmation profile. |

### Group 5 — Functional Requirements (conditional block)

*Applicable when `documentType`/`engagementType` implies software or a system-like deliverable.*

| # | Source wording | Canonical field | Target section(s) | Req/Cond | Category | Notes |
|---|---|---|---|---|---|---|
| 5.1 | Main modules / services? | `functionalModules[]` | Functional Requirements | Conditional | PROJECT_INFORMATION | Historical retrieval strongly supported (ITAS workstream tables). |
| 5.2 | Key workflows / approvals? | `keyWorkflows[]` | Functional Requirements | Conditional | PROJECT_INFORMATION | |
| 5.3 | Reports / dashboards / notifications needed? | `reportingNeeds[]` | Functional Requirements | Conditional | PROJECT_INFORMATION | |
| 5.4 | Document management / case / ticketing needs? | `caseManagementNeeds[]` | Functional Requirements | Conditional | PROJECT_INFORMATION | |
| 5.5 | Any AI or advanced features required/optional? | `aiFeatures[]` | Functional Requirements | Conditional (optional) | PROJECT_INFORMATION | No historical precedent found in the 3 PDFs/template — genuinely new territory per engagement. |

### Group 6 — Technical / Non-Functional Requirements (conditional block)

| # | Source wording | Canonical field | Target section(s) | Req/Cond | Category | Notes |
|---|---|---|---|---|---|---|
| 6.1 | Hosting / infrastructure model? | `hostingModel` | Technical and Non-Functional Requirements | Conditional | PROJECT_INFORMATION | Strong historical support (ITAS §4.5). Cost/architecture impact — BA confirmation required. |
| 6.2 | Integrations / APIs? | `integrations[]` | Technical and Non-Functional Requirements | Conditional | PROJECT_INFORMATION | Strong historical support (ITAS §3.7–3.8). |
| 6.3 | Security / data residency requirements? | `securityRequirements[]` | Technical and Non-Functional Requirements | Conditional | PROJECT_INFORMATION | Near-boilerplate MODEE/government cybersecurity clause; often PROPOSED from a reference clause, BA confirms deviations. |
| 6.4 | Performance / availability / backup / DR? | `performanceAvailabilityTargets` | Technical and Non-Functional Requirements | Conditional | PROJECT_INFORMATION | Strong historical support (SLA-adjacent tables). |
| 6.5 | Data migration needs? | `dataMigrationNeeds` | Technical and Non-Functional Requirements | Conditional | PROJECT_INFORMATION | |
| 6.6 | Accessibility requirements? (English drafting only in Phase 1) | — | — | — | **SYSTEM_DEFAULT** | Explicitly deferred by the source text itself ("English drafting only in Phase 1"). Becomes a real PROJECT_INFORMATION field only when a future phase enables bilingual/accessibility drafting. |

### Group 7 — Deliverables

| # | Source wording | Canonical field | Target section(s) | Req/Cond | Category | Notes |
|---|---|---|---|---|---|---|
| 7.1 | What documents/reports/designs/tests/training materials are required? | `deliverableItems[]` | Deliverables | Required | PROJECT_INFORMATION | `GeneralTemplate.docx` supplies a strong default table (Project Plan, Requirements Doc, Solution Design, Test Reports, Training Materials, Final Report) — Rami can PROPOSE this list, BA edits. |
| 7.2 | Required formats? | `deliverableFormats[]` | Deliverables | Conditional | PROJECT_INFORMATION | |
| 7.3 | Who approves each deliverable? | `deliverableApprovers[]` | Deliverables | Conditional | PROJECT_INFORMATION | Template default is "Yes" (approval required) for every deliverable row — usable as a PROPOSED default. |

### Group 8 — Implementation and Acceptance

| # | Source wording | Canonical field | Target section(s) | Req/Cond | Category | Notes |
|---|---|---|---|---|---|---|
| 8.1 | Stages, timeline, milestones? | — | — | — | **DUPLICATE** of `engagementPhases` (2.2) + `engagementDuration` (2.3) | Same underlying schedule data, redisplayed in Implementation Requirements. Not a new field. |
| 8.2 | Testing / UAT rounds? | `uatRounds` | Implementation Requirements | Conditional | PROJECT_INFORMATION | |
| 8.3 | Acceptance criteria and go-live conditions? | `acceptanceCriteria[]` | Acceptance Criteria and Go-Live | Required (when section applicable) | PROJECT_INFORMATION | Strong historical support; BA confirmation required. |
| 8.4 | Rollback plan needed? | `rollbackPlanNeeded` | Acceptance Criteria and Go-Live | Conditional | PROJECT_INFORMATION | Rare in historical sources; ask, default to TBC if BA has no answer. |

### Group 9 — Support and SLA (conditional block)

| # | Source wording | Canonical field | Target section(s) | Req/Cond | Category | Notes |
|---|---|---|---|---|---|---|
| 9.1 | Support period and hours? | `supportPeriodAndHours` | Support and Maintenance | Conditional | PROJECT_INFORMATION | Strong historical + template support. |
| 9.2 | Severity levels / response / resolution times? | `slaTiers[]` | Support and Maintenance | Conditional | PROJECT_INFORMATION | Strong historical + template support (concrete severity tables reusable as PROPOSED defaults, e.g. `GeneralTemplate.docx` Severity 1–4 table). BA confirmation required. |
| 9.3 | Resident engineer / ticketing / reports? | `supportOperatingModel` | Support and Maintenance | Conditional | PROJECT_INFORMATION | |
| 9.4 | Penalties? | `supportPenalties[]` | Support and Maintenance; may also inform Legal and Contractual Terms | Conditional | PROJECT_INFORMATION | Financial exposure — BA confirmation required. Historical retrieval strong (OFA/ITAS have concrete penalty formulas usable as PROPOSED starting points). |

### Group 10 — Evaluation and Financials

| # | Source wording | Canonical field | Target section(s) | Req/Cond | Category | Notes |
|---|---|---|---|---|---|---|
| 10.1 | Technical vs financial weights? | `evaluationWeights` | Proposal Evaluation Criteria | Required | PROJECT_INFORMATION | Often PROPOSED from a historical/template default (e.g. 70/30) and confirmed by BA. |
| 10.2 | Minimum score / PoC scoring / disqualification rules? | `evaluationRules` | Proposal Evaluation Criteria | Conditional | PROJECT_INFORMATION | |
| 10.3 | Pricing model and cost breakdown requirements? | `pricingModel`, `costBreakdown[]` (one compound field) | Financial Proposal Requirements | Required | PROJECT_INFORMATION | Template supplies a strong default 12-row cost-breakdown table structure. |
| 10.4 | Optional priced items? Taxes? | `optionalPricedItems[]`, `taxesNote` (one compound field) | Financial Proposal Requirements | Conditional | PROJECT_INFORMATION | Absorbs the duplicate 12.5 (see below). |

### Group 11 — Legal and Annexes

| # | Source wording | Canonical field | Target section(s) | Req/Cond | Category | Notes |
|---|---|---|---|---|---|---|
| 11.1 | Applicable laws / confidentiality / IP? | `legalTerms` | Legal and Contractual Terms | Mandatory content, mostly boilerplate | PROJECT_INFORMATION | All 3 historical PDFs use near-identical Jordanian-law/confidentiality/IP language. Rami should PROPOSE the standard clause set and ask the BA to confirm only deviations, not dictate from scratch every time. |
| 11.2 | Joint venture / subcontracting rules? | `jvSubcontractingRules` | Legal and Contractual Terms | Conditional | PROJECT_INFORMATION | Same PROPOSE-then-confirm-deviations pattern as 11.1. |
| 11.3 | Required forms, compliance sheets, questionnaires, annexes? | `requiredAnnexes[]` | Annexes | Required | PROJECT_INFORMATION | Template lists 12 candidate annexes usable as a PROPOSED checklist; BA selects which apply. Absorbs the duplicate 12.8 (see below). |

### Group 12 — Quality / Gap Questions (agent heuristics, not stored project facts)

This entire group was reclassified in the prior pass and is **confirmed unchanged** here after the DOCX review — none of these are stored `projectMemory` fields.

| # | Source wording | Category | Disposition |
|---|---|---|---|
| 12.1 | What must not be missed in this RFP? | **AGENT_RULE / HEURISTIC** | Drives Rami's own completeness-check reasoning against the canonical schema. If the BA volunteers a specific concrete answer, it is captured as a free-text entry in the `riskNotes[]` aggregate field (see below) — it is never itself a schema field. |
| 12.2 | What mistakes happened in previous similar RFPs? | **AGENT_RULE / HEURISTIC** | Informs historical-retrieval framing and RAG evidence selection. Volunteered answers → `riskNotes[]`. |
| 12.3 | Which parts usually cause vendor questions or scope disputes? | **AGENT_RULE / HEURISTIC** | Same pattern as 12.2. Volunteered answers → `riskNotes[]`. |
| 12.4 | Which requirements are mandatory, optional, excluded, or pending approval? | **AGENT_RULE / HEURISTIC** | This is literally the requirement/conditional-classification mechanism Rami applies to every other field (see canonical schema §3) — not a separate question or stored fact. |
| 12.5 | What should be priced separately as optional? | **DUPLICATE** of `optionalPricedItems` (10.4) | Not a new field. |
| 12.6 | What is still unknown and should be [To be confirmed]? | **AGENT_RULE / HEURISTIC** | This line *is* the TBC provenance mechanism itself (see `rfp-knowledge-architecture.md` §Provenance) — not a new field. |
| 12.7 | Should Rami generate a risk/ambiguity list before final drafting? | **AGENT_RULE / HEURISTIC** | A process/config toggle for section drafting behavior, not a project fact. |
| 12.8 | What standards, policies, or annexes must be referenced? | **DUPLICATE** of `requiredAnnexes` (11.3) | Not a new field. |

**One genuine new field emerges from Group 12 as an aggregate, not from any single line:**

| Field | Source | Target section(s) | Req/Cond | Category | Notes |
|---|---|---|---|---|---|---|
| `riskNotes[]` | Aggregates any concrete, volunteered BA answers to 12.1–12.3 | Cross-cutting (surfaced during section drafting as caution flags, not its own RFP section) | Optional | PROJECT_INFORMATION | Never explicitly asked as a standalone question; only populated when the BA volunteers a specific risk/lesson-learned. |

---

## 3. Major dependency findings

1. **`documentType` (0.1) is the master gate.** It determines whether Groups 5, 6, 9 (Functional, Technical, Support/SLA) are even asked, and influences the applicability of Manpower Requirements, Implementation Requirements, and PoC-related evaluation rules.
2. **Schedule data is asked three times across the source Question Bank (2.2, 2.3, 8.1) but stored once** (`engagementPhases`, `engagementDuration`), then redisplayed in both Engagement Definition and Implementation Requirements.
3. **Optional-pricing and annex/standards information are each asked twice** (10.4/12.5 and 11.3/12.8) — both duplicates resolve to a single field.
4. **Boilerplate-heavy fields (`bidderResponsibilities`, `entityResponsibilities`, `legalTerms`, `jvSubcontractingRules`, parts of `securityRequirements`) are strong PROPOSE-then-confirm candidates**, not blank-slate questions — `GeneralTemplate.docx` and the 3 historical PDFs supply reusable defaults for all of them (see `historical-rfp-findings.md`).
5. **Group 12 contributes zero new mandatory questions** to the BA — it exists entirely to shape *how* Rami evaluates the other 51 fields (gap detection, risk flagging, TBC handling), confirming the prior pass's decision that agent heuristics must never be smuggled into `projectMemory`.

## 4. Minimum Starter Set cross-check

The Question Bank's own "Minimum Starter Set (Short Path)" (12 items) was checked against the field list above — every item maps onto an already-classified field (`documentType`, `documentTitle`, `beneficiaryEntity`, the `draftLanguage` system default, `currentSituation`/`businessObjectives`, `inScope`/`outOfScope`, `users`, a subset of the Group 5/6 fields as "key requirements", `deliverableItems`, `engagementPhases`/`engagementDuration`, `evaluationWeights`, `requiredAnnexes`). **No new fields were introduced by the starter set** — it is a prioritized subset view, useful for defining Rami's first-pass "fast path" conversation, not a separate schema.
