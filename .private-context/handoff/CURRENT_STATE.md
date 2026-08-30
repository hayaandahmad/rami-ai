# Rami — Current Implementation State
Last updated: 2026-08-31 (final RFP draft + DOCX on second device)

Authoritative HEAD: `origin/main` (`git log -1`).

## Runtime truth

### Demo project `rami-gen-core-demo`
- **12 / 12** applicable sections generated
- **1** APPROVED (`background`); others DRAFT
- Evaluation / financial / legal drafted with **explicit TBC** after BA TBC facts via `applyExtractedFacts`
- Deliverables: model once returned headings-only → facts-backed manual edit (v3) from `deliverableItems` / `deliverableFormats`
- Consistency review: no duplicate H1 / empty / order issues; **12** TBC blocks

### DOCX export
- `src/server/rami/docxExport.ts` — `buildRfpDocxBuffer` / `safeDocxFilename`
- `GET /api/rami/generation/document/docx?documentKey=`
- UI: **Word** download in `RfpDocumentPanel`
- Renders heading, paragraph, lists, table, tbc; page breaks between sections; header/footer page numbers
- **No model calls** during export — persisted AssembledRfp only
- Validator: `npm run validate:docx-export`

### Document experience (UI)
- Unchanged architecture; timeout UX hardened (busy banner + clearer failure message; drafts not overwritten on failure)

### Inference note
- Local Ollama smoke/generation timed out on this device for Deliverables
- Remaining sections generated via existing **ModalModelProvider** (start → generate → stop)
- Default `.env.local` remains `RAMI_MODEL_PROVIDER=local`

## Phase status
- RFP Generation Core: ✅
- Document experience / A4 UI: ✅
- Remaining applicable sections + TBC path: ✅
- DOCX: ✅
- RAG / Phase 2.3 / training: ⏳ Post-demo

## Next
Manager demo. Then RAG — do not start training/fine-tuning.
