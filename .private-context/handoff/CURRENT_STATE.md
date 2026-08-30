# Rami — Current Implementation State
Last updated: 2026-08-30 (RFP document experience UI on second device)

Authoritative HEAD: `origin/main` (`git log -1`).  
Backend feature: `d8e7f67`. Document UI: this handoff commit.

## Runtime truth

### Document experience (UI)
- `RfpDocumentPanel` replaces placeholder preview in `RamiChatWorkspace`
- `GeneratedSectionBlocks` renders all block types from persisted `GeneratedSection`
- Section nav shows **information readiness** and **document status** separately
- Actions call generation APIs only (Generate / Regenerate / Approve / Edit)
- Full RFP view uses `assembleRfpDocument` / `GET .../generation/document`
- Opening a document with existing generated content auto-opens the document pane

### Demo project
- `documentKey=rami-gen-core-demo`
- Multiple generated applicable sections (cover, ToC, introduction, background, engagement, scope, admin, annexes; deliverables may still be missing if inference timed out)
- Background APPROVED; others DRAFT
- Remaining NOT_READY by design: evaluationCriteria, financialProposal, legalContractualTerms (require real BA facts / TBC — not invented)

### Generation / persistence
Unchanged architecture: readiness gates, `project_section_contents`, Local/Modal provider, PostgreSQL authority.

### Manual edit
- `POST /api/rami/generation/edit` → new DRAFT version
- APPROVED requires `reopenApproved=true`
- Does not modify ProjectFacts

## Phase status
- RFP Generation Core: ✅
- Document experience / A4 UI: ✅
- DOCX: ⏳ Next
- RAG / Phase 2.3 / training: ⏳ Later

## Next
DOCX export from AssembledRfp / GeneratedSection. Optional: finish remaining draftable sections + approve for manager demo.
