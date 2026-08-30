# Rami — Current Implementation State
Last updated: 2026-08-30 (handoff: RFP Generation Core backend complete)

Authoritative HEAD: `origin/main` after this handoff (`git log -1`).  
Last feature milestone: RFP Generation Core backend.

## New session
Start at `.private-context/handoff/START_HERE.md` only.

Next implementation is **RFP UI / A4 preview / document experience** (first developer).

---

## Runtime truth (must match code)

### PostgreSQL — live-validated
- PostgreSQL **18.6**, loopback host, database `rami_ai` (this machine: `127.0.0.1:5432`).
- Driver: `pg`. No ORM. Migrations: `001_init.sql` + `002_section_fields.sql` + **`003_project_section_contents.sql`**.
- Seed: Sections **20**, Fields **52**, Questions **62**, QuestionFields **59**, `section_fields` **68**.
- Authority: PostgreSQL. Server `Map` = cache. `localStorage` = UI cache.
- Shared snapshot: `dev/database/rami_ai_shared.dump` (refreshed with generation demo).

### Generated document persistence
- Table `project_section_contents`: versioned `GeneratedSection` JSON, `approval_status` DRAFT|APPROVED, `is_current`, history via superseded rows.
- `project_section_states`: lifecycle only (NOT_STARTED … APPROVED).
- ProjectFacts unchanged by generation.

### Generation services
- `buildSectionGenerationContext(projectId, sectionId, …)` — scoped facts only
- `generateRfpSection` / `regenerateRfpSection` / `approveRfpSection` / `assembleRfpDocument`
- Readiness gate: only `READY_TO_DRAFT` | `DRAFTABLE_WITH_TBC`
- Provider: `getDefaultProvider()` (`local` preferred; Modal unchanged)
- APIs under `/api/rami/generation/*`

### Proven vertical slice
- Document key: **`rami-gen-core-demo`**
- Sections generated with live `qwen3:8b`: **`background`** (DRAFTABLE_WITH_TBC + TBC painPoints), **`scopeOfWork`** (READY_TO_DRAFT)
- Persist + cache-clear reload proven; approve protect + versioned regenerate proven

### Local / Modal
- `RamiModelProvider` with Local (default) and Modal. Chat must not auto-start GPU.

### Section Readiness
- Unchanged engine. Generation consumes it; Qwen does not override it.

---

## Phase status
- **Phase 1–2.2**: ✅ Complete
- **Persistence**: ✅ PostgreSQL authoritative
- **Section Readiness**: ✅
- **RFP Generation Core**: ✅ Backend complete (this handoff)
- **Document preview / UI**: ⏳ **Next** — first developer
- **Phase 2.3 / RAG / DOCX / training**: ⏳ Later

---

## What is NOT implemented yet
- A4 real prose rendering (`DocumentPreviewShell` still placeholder)
- Generate / Regenerate / Approve **UI**
- DOCX export
- Generating every applicable section for a complete approved RFP
- Phase 2.3 / RAG / fine-tuning

---

## Files a future agent must read first
```
.private-context/handoff/START_HERE.md
.private-context/handoff/CURRENT_STATE.md
.private-context/handoff/DECISIONS.md
.private-context/handoff/NEXT_STEPS.md
.private-context/architecture/rfp-generation-architecture.md
.private-context/architecture/rfp-section-readiness.md
src/types/generatedSection.ts
src/server/rami/sectionGeneration.ts
src/server/rami/sectionGenerationContext.ts
src/app/api/rami/generation/
```
