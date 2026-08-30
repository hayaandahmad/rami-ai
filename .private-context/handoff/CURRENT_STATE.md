# Rami — Current Implementation State
Last updated: 2026-08-31 (canonical information-model expansion)

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

### Controlled RAG (live chat)
- Policy: `historicalRetrievalPolicy.ts` — no retrieval on ordinary turns
- Routing: structured-first when Field/Section IDs known; hybrid for free-text; vector-only not default
- Chat SSE: `historical_references` + `retrievalDebug`
- UI: `HistoricalReferenceCard` (REFERENCE label, Use as suggestion / Accept / Reject / View source)
- Proposals table: `historical_field_proposals` (PENDING | ACCEPTED | REJECTED)
- PENDING never writes `project_facts`
- Accept → ProjectFact `CONFIRMED` + `sourceType=historical-retrieval` + PROPOSED lineage in history
- Reject → no fact; blocks re-propose of same chunk+field
- Readiness: PROPOSED/REFERENCE provenance counts as unresolved
- Extraction uses BA message only (historical text not auto-extracted)
- Generation RAG: **not wired**

### Offline RAG foundation
- 732 chunks · nomic-embed-text 768-d · REAL[] storage · pgvector not installed
- Promoted Field IDs may be merged onto existing chunk metadata without re-embedding

## Next
Generation-time historical assist (explicit only). Do not start another Field expansion.
