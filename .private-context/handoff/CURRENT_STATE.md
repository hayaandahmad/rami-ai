# Rami — Current Implementation State
Last updated: 2026-08-31 (BA-approved generation-time RAG)

Authoritative HEAD: `origin/main` (`git log -1`).

## Runtime truth

### Information model
- Canonical Fields: **59** (legacy 52 + 7 promoted)
- Canonical Questions: **69** (workbook 62 + `18.1`–`18.7`)
- Canonical Sections: **20** (no 21st section)
- `procurementStage` → `ProjectContext.documentStage` only (not a ProjectFact)

Promoted ProjectMemory Fields: `awardModel`, `callOffOrSowProcess`, `namedKeyPersonnel`, `clarificationContact`, `submissionChannel`, `governanceCadence`, `knowledgeTransferRequirements`.

### Live demo
- `rami-gen-core-demo` hydrates with new Fields unresolved
- `rami-model-expansion-demo` is the safe conversational proof project
- `rami-gen-rag-demo` is the safe generation-reference proof project (Deliverables)

### Controlled RAG (live chat)
- Policy: `historicalRetrievalPolicy.ts` — no retrieval on ordinary turns
- Routing: structured-first when Field/Section IDs known; hybrid for free-text; vector-only not default
- Chat SSE: `historical_references` + `retrievalDebug`
- UI: `HistoricalReferenceCard` (REFERENCE label)
  - **Use as suggestion** → PENDING `historical_field_proposals`
  - **Accept** → CONFIRMED ProjectFact
  - **Use as drafting reference** → `project_generation_references` (ACTIVE, section-scoped)
  - **Remove** → REVOKED (does not delete ProjectFacts)
- PENDING never writes `project_facts`
- Accept → ProjectFact `CONFIRMED` + `sourceType=historical-retrieval` + PROPOSED lineage in history
- Reject → no fact; blocks re-propose of same chunk+field
- Readiness: PROPOSED/REFERENCE provenance counts as unresolved
- Extraction uses BA message only (historical text not auto-extracted)

### Generation-time RAG (BA-approved only)
- Table: `project_generation_references` (migration `007`)
- Status: `ACTIVE` | `REVOKED`
- Scope: `STRUCTURE_AND_LANGUAGE` only
- Default: **section-scoped** (max 3 ACTIVE refs per section)
- `SectionGenerationContext` keeps two areas: ProjectFacts vs `approvedHistoricalReferences`
- Prompt hierarchy: CURRENT PROJECT FACTS > APPROVED HISTORICAL REFERENCES > UNRESOLVED/TBC
- Generation loads **pre-approved** refs only — **no silent retrieve on Generate / assemble / DOCX**
- Lineage on `GeneratedSection`: `historicalReferenceIds`, `generationReferenceIds`, `draftingReferencesUsed`
- Deterministic leakage sanitizer strips historical numbers/names not present in current facts
- Adding/removing a reference does **not** regenerate APPROVED sections
- Regeneration uses current ACTIVE refs; previous versions keep their old lineage
- UI drafting lineage is metadata, not official RFP citation / not in DOCX
- High-risk sections (`financialProposal`, `legalContractualTerms`, `evaluationCriteria`, `supportMaintenance`) use shorter excerpts

### Offline RAG foundation
- 732 chunks · nomic-embed-text 768-d · REAL[] storage · pgvector not installed
- Promoted Field IDs may be merged onto existing chunk metadata without re-embedding

## Next
Optional pgvector when the corpus grows. Do not start productionization or training.
