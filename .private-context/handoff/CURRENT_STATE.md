# Rami — Current Implementation State
Last updated: 2026-08-31 (controlled RAG integration)

Authoritative HEAD: `origin/main` (`git log -1`).

## Runtime truth

### Live demo
- `rami-gen-core-demo` unchanged by historical proposals unless BA acts on that project

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

## Next
Generation-time historical assist (explicit only) — or Field-model decisions from gap evidence.
