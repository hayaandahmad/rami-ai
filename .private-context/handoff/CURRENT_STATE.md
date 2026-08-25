# Rami — Current Implementation State
Last updated: 2026-08-25 (Phase 2.1 complete)

## Phase status
- **Phase 1**: ✅ Complete — local AI foundations (commit `dbf362a`)
- **Phase 2**: ✅ Complete — conversational AI workspace
- **Phase 2.1**: ✅ Complete — bilingual polish, section applicability, progress semantics, question priority, users normalization
- **Phase 3**: ⏳ Next — historical RAG, embeddings, PDF ingestion
- **Phase 4**: ⏳ Pending — live section drafting in right pane
- **Phase 5**: ⏳ Pending — final RFP assembly

---

## Local AI stack (verified working)
- **Ollama 0.32.15** on Windows, local HTTP at `http://localhost:11434`
- **qwen3:8b** — default model (chat + extraction)
- **qwen3:4b** — lightweight fallback
- **Hardware**: RTX 4060 Laptop GPU (8 GB VRAM), i9-14900HX, 15.6 GB RAM
- **Health check**: `npm run ai:check` — all passes

---

## Phase 2 files created

### Types
- `src/types/conversation.ts` — `ConversationMessage`, `RfpIntent`, `ExtractedFact`, `GapAnalysis`, `StreamEvent`

### Server-side AI
- `src/server/ai/ramiSystemPrompt.ts` — Rami persona prompt + context builder
- `src/server/ai/extractionSchema.ts` — JSON schema + validation for structured extraction

### Server-side logic (no LLM calls)
- `src/server/rami/sessionStore.ts` — in-memory session store (global singleton, HMR-safe)
- `src/server/rami/gapEngine.ts` — deterministic gap analysis and active section detection
- `src/server/rami/memoryUpdater.ts` — `applyExtractedFacts()` with provenance rules
- `src/server/rami/intentDetector.ts` — RFP intent state machine

### API route
- `src/app/api/rami/chat/route.ts` — SSE streaming endpoint, full pipeline

### LocalModelProvider extensions
- `src/server/ai/LocalModelProvider.ts` — added `completeStream()` (AsyncGenerator) + `ThinkStripper`

### Client hooks
- `src/hooks/useRamiChat.ts` — SSE reader, streaming state, localStorage backup

### UI components
- `src/components/chat/ThinkingIndicator.tsx` — animated thinking dots
- `src/components/chat/RamiMessage.tsx` — assistant message with Markdown support
- `src/components/chat/UserMessage.tsx` — user message
- `src/components/chat/ChatMessages.tsx` — scrollable list with auto-scroll
- `src/components/chat/ChatComposer.tsx` — premium auto-grow composer
- `src/components/rfp/SectionProgress.tsx` — compact dynamic progress control
- `src/components/rfp/DocumentPreviewShell.tsx` — A4 document preview shell

### Layouts and views
- `src/layouts/ChatLayout.tsx` — full-height sidebar layout (no padding main)
- `src/views/RamiChat/RamiChatWorkspace.tsx` — main workspace view (initial → split)

### CSS additions
- `src/styles/globals.css` — Rami message body styles, streaming cursor, cursor blink animation

### Routes modified
- `src/app/documents/[documentId]/interview/page.tsx` — now renders RamiChatWorkspace

---

## Phase 2 persistence decision
- **Server**: in-memory Map (global singleton, HMR-safe, reset on process restart)
- **Client**: localStorage backup (key: `rami-chat-v1:{sessionId}`)
- **Google Sheets**: NOT used for conversational state (non-blocking async conversation requirement)
- **Decision**: documented in DECISIONS.md. Full Sheets integration for ProjectMemory deferred to Phase 3/milestone.

---

## What is working (Phase 2 + 2.1)
- Full conversational loop: message → extraction → memory → gap → response
- Real Ollama streaming for responses (`completeStream()` AsyncGenerator)
- `<think>...</think>` blocks stripped automatically from Qwen3 output
- Multi-fact extraction from one BA message (verified: 10 fields in one turn)
- `ProjectMemory` updated via `applyExtractedFacts()` with provenance (EXTRACTED)
- Duplicate question prevention (gap engine skips filled fields)
- RFP intent detection: NONE → POSSIBLE → CREATE_RFP
- Smooth transition to split workspace on `CREATE_RFP`
- Premium initial state (centered hero)
- Streaming thinking indicator (three dots)
- Streaming text cursor (blinking bar)
- Auto-scroll with "jump to latest" override
- Mobile tab switcher (Chat / Document)
- Tablet collapsed sidebar
- Section progress control (dynamic from `getApplicableSections()`)
- A4 document preview shell
- Polished error experience (Ollama unavailable message, retry)
- localStorage persistence (conversation survives page refresh)
- **Phase 2.1 additions:**
  - Bilingual Arabic/English conversation (replies in user's language)
  - RTL rendering for Arabic messages (`dir="rtl"` per message, not app-wide)
  - Language detection: deterministic Arabic-character ratio (no LLM call)
  - Language tracked in session + returned in SSE `done` event
  - Conditional RFP sections correctly activated (HR system → 19/20, consulting → 12)
  - `applicableSectionCount` returned in SSE events; synced to client
  - Progress UI separated: "Sections X/Y approved" + "Information Z% gathered"
  - Next-best-question priority: business-critical fields first, admin details last
  - `users` field normalized to `UsersValue` shape regardless of LLM output format
  - Arabic line-height CSS increased for readability

---

## What is NOT implemented yet
- **RAG**: No embedding, PDF ingestion, vector retrieval (Phase 3)
- **Real section drafting**: Right pane shows placeholder shell only (Phase 4)
- **Google Sheets** for ProjectMemory persistence (deferred to Phase 3)
- **Section state transitions**: Sections always start NOT_STARTED (Phase 4)
- **BA confirmation flow**: EXTRACTED → CONFIRMED promotion (Phase 3/4)

---

## Legacy interview code
`src/views/GuidedDocumentInterview/GuidedDocumentInterviewPage.tsx` and related files remain in place but are NOT linked from any route. The interview route now renders the new `RamiChatWorkspace`. The legacy components are clearly namespaced under `/interview/` and can be retired in Phase 4.

---

## Files a future agent must read first
```
.private-context/handoff/CURRENT_STATE.md   ← this file
.private-context/handoff/DECISIONS.md
.private-context/handoff/NEXT_STEPS.md
.private-context/architecture/rami-agent-architecture.md
.private-context/architecture/local-ai-deployment.md
.private-context/product/conversational-rfp-workflow.md
src/types/conversation.ts
src/app/api/rami/chat/route.ts
src/server/rami/gapEngine.ts
src/server/rami/memoryUpdater.ts
src/views/RamiChat/RamiChatWorkspace.tsx
```
