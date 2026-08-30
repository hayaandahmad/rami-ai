# Rami — Current Implementation State
Last updated: 2026-08-31 (historical RFP resource library + audit)

Authoritative HEAD: `origin/main` (`git log -1`).

## Runtime truth

### Demo project `rami-gen-core-demo`
- **12 / 12** applicable sections generated; **1** APPROVED (`background`)
- DOCX export available; commercial/legal use explicit TBC
- Unchanged by historical resource work (no ProjectFacts imports)

### Historical RFP Resource Library
- Path: `resources/historical-rfps/`
- **7** Excel Question Bank extractions + **4** PDFs under `source/`
- `manifest.json` + `derived/AUDIT_SUMMARY.md` (readiness audit complete)
- **Not** ProjectFacts · **Not** RAG-ingested · **Not** training data
- Canonical Q&A sheet schema consistent; 62/62 Question IDs matched per dataset
- Confirmed information-model gaps: procurement admin, named personnel, call-off/SOW, clarification/submission, governance cadence (see audit)

### Document / generation
Unchanged architecture: readiness gates, `GeneratedSection`, Local/Modal providers, DOCX from AssembledRfp.

## Phase status
- RFP Generation Core / Document UI / DOCX: ✅
- Historical resource library + dataset audit: ✅
- Historical DB ingestion / evaluation harness: ⏳ Next
- pgvector / RAG retrieval / training: ⏳ Later

## Next
Ingestion design + golden evaluation against the library — no embeddings until provenance model is fixed.
