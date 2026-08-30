# Adaptive Question Architecture (Phase 2.2)

Status: **Implemented** (control plane only). Authority for classifiers, packs, GapStatus, NextAction, stop, and correction vs contradiction.

Phase 2.3 domain catalogs, RAG, generation, confirm UI, and DOCX are **out of scope** here.

---

## Separation of stores

| Store | Owns |
|-------|------|
| **ProjectMemory** | Canonical 59 field facts + provenance (52 + 7 promoted 2026-08) |
| **ProjectContext** | `documentStage`, `contractingGranularity`, `primaryDomain`, `secondaryDomains`, `complexity`, `activePacks`, `collectionSufficient` |

Do **not** duplicate classifiers into ProjectMemory. Keep `documentType` / `engagementType` as compatibility + classification signals only.

---

## Classifiers (start UNDETERMINED)

- `documentStage`, `contractingGranularity`, `primaryDomain`, and each complexity dim start as **UNDETERMINED**
- TypeScript promotes on evidence; LLM emits signals only
- While stage / granularity / primaryDomain is UNDETERMINED → **activePacks = CORE only** (unless evidence explicitly supports another pack)
- Preview outline may stay visible; **visibility ≠ required**

### Complexity (six dims)

`technical` · `process` · `stakeholder` · `securityRegulatory` · `operationalSla` · `procurement`  
Each: `UNDETERMINED | LOW | MEDIUM | HIGH`  
`securityRegulatory` is independent of `technical`. LOW complexity ≠ NOT_APPLICABLE.

---

## PackId freeze (metadata tags, not modules)

```
CORE
PROCUREMENT
PRE_QUALIFICATION
FRAMEWORK
BPR
DOWNSTREAM_DT_RFP
SYSTEM_IMPLEMENTATION
DATA_PLATFORM
CONNECTIVITY
AI_AGENTIC
SECURITY
PMO
TRAINING_CHANGE
SLA_SUPPORT
ASSESSMENT_TESTING
```

Phase 2.2 tagged the original 52 fields. The 2026-08 evidence pass added 7 Fields (`18.x` Questions). Phase 2.3 domain catalogs remain unimplemented.

---

## Five axes (keep separate)

1. **Applicability** — does this requirement belong?
2. **Materiality** — CRITICAL | HIGH | STANDARD | LOW
3. **Depth** — SHORT | STANDARD | DETAILED
4. **GapStatus** — KNOWN | MISSING | DEFERRED | NOT_APPLICABLE | CONTRADICTORY | UNKNOWN
5. **ProvenanceStatus** — EXTRACTED | REFERENCE | PROPOSED | CONFIRMED | TBC (@deprecated)

Long-term “I don’t know” lives on **GapStatus UNKNOWN**, not provenance. Provenance TBC maps → GapStatus UNKNOWN for gap logic.

---

## NextAction

- `ASK_REQUIREMENTS` — `primaryFieldId` + `relatedFieldIds` (0–2); hard cap **3** field IDs
- `CLARIFY_CONTRADICTION` — `targetKind: 'memory_field' | 'project_context'` + `targetId`
- `STOP_COLLECTION` — materiality-based sufficiency
- `OPEN_ENDED`
- Placeholders only: `SEARCH_HISTORICAL_RFPS` / `PROPOSE_VALUE` / `READY_TO_DRAFT`

LLM phrases; TypeScript chooses the action.

---

## Stop / collectionSufficient

Stop when all of:

- no CRITICAL applicable CORE gaps in MISSING
- no HIGH-materiality active-pack gaps in MISSING
- no blocking CONTRADICTORY
- remaining are DEFERRED | NOT_APPLICABLE | LOW materiality | **safe UNKNOWN**
- do not stop “complete” while stage/domain UNDETERMINED if CORE classification asks are still needed

**No field-count thresholds** (never “stop at 12–18”).

### Safe UNKNOWN

UNKNOWN is non-blocking only when:

- materiality is STANDARD or LOW
- it does not block a CRITICAL/HIGH dependency
- it is not necessary to resolve scope, acceptance, legal/commercial structure, or another blocking requirement

---

## Correction vs contradiction

| Signal | Outcome |
|--------|---------|
| `updateKind=correction` OR explicit superseding language | Replace current; keep history; GapStatus KNOWN; **not** CONTRADICTORY |
| `updateKind=conflict` OR competing-source language OR two values without clear supersession | CONTRADICTORY + CLARIFY |
| Ambiguous HIGH/CRITICAL conflict without supersession | Prefer CLARIFY (do not silent-overwrite) |

Do **not** treat “same field + two ba-messages” alone as correction.

---

## Pipeline order (chat route)

```text
extract → applyExtractedFacts → classifyProject → withActivePacks → analyzeGaps → inject NextAction into prompt → SSE (completionPercent, collectionSufficient, nextActionType)
```

Key files: `projectClassifier.ts`, `questionPackEngine.ts`, `gapEngine.ts`, `memoryUpdater.ts`, `route.ts`.
