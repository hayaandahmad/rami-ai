# PostgreSQL persistence architecture

Status: **Implemented and live-validated** (primary Windows laptop, `rami_ai` on port 5433). PostgreSQL is the authoritative store for current project state.  
Do not implement RAG, training, or RFP generation in this layer.

## Runtime vs persistence

| Concept | Role after this phase |
|---|---|
| PostgreSQL | Authoritative project truth |
| `ProjectMemory` | Hydrated runtime business model (same 52-field types) |
| `ProjectContext` classifiers | **Persisted snapshot** (not fully re-derivable) |
| `activePacks` / `collectionSufficient` / gaps | Deterministically recomputed after hydrate |
| Server `Map` | Optional process cache only |
| `localStorage` | Optional UI cache; PostgreSQL wins |

## Why ProjectContext classifiers are persisted

`classifyProject()` uses:

1. current `ProjectMemory`
2. **previous** `ProjectContext` (hysteresis — does not downgrade determined values)
3. **per-turn LLM signals** (`documentStageSignal`, `domainSignals`, …)
4. the latest BA message text

Restarting and re-classifying from memory alone can lose a determined stage/domain that arrived only via a prior signal. Persisting the classifier snapshot guarantees:

```text
restart → same functional RAMI project state
```

Recomputed after hydrate (not stored as authority):

- `activePacks` ← `activatePacks()`
- `collectionSufficient` / `NextAction` / `completionPercent` ← `analyzeGaps()`

## ProjectMemory → ProjectFacts

Each non-null memory field persists:

| Runtime property | Column |
|---|---|
| canonical value (string / array / object / boolean) | `value_json` JSONB |
| provenance `EXTRACTED` / `CONFIRMED` / `TBC` / … | `provenance_status` |
| `sourceType`, `sourceRef`, `confirmedBy`, `updatedAt` | columns |
| append-only `history[]` | `history_json` JSONB |
| `gapStatus` (KNOWN / DEFERRED / CONTRADICTORY / UNKNOWN / NOT_APPLICABLE) | `gap_status` |
| `deferredTo` | `deferred_to` |
| `contradiction` | `contradiction_json` JSONB |
| coarse collection state | `collection_state` (`ANSWERED` / `TBC` / `NOT_APPLICABLE`) |

Missing `ProjectFacts` row = field still unresolved.

## Local setup

```text
1. Install PostgreSQL and create an empty database (e.g. rami).
2. Copy .env.example → .env.local and set RAMI_DB_* (no NEXT_PUBLIC_ DB vars).
3. npm run db:migrate
4. npm run db:seed
5. npm run db:check
6. npm run db:backup     # writes .rami-db-backups/*.dump (gitignored)
7. npm run db:restore -- path\to\file.dump rami_ai_restore_test
   (never restore onto the live database unless you pass --overwrite-live)
```

Chat and `/api/rami/session` require a configured database. They will not silently treat the Map or localStorage as saved project truth.

## Tooling

- Driver: `pg` (node-postgres). No ORM.
- Migrations: versioned SQL in `src/server/db/migrations/` + `scripts/db-migrate.ts`
- Seed: TypeScript from `RFP_SECTIONS`, `PROJECT_MEMORY_FIELDS`, question-bank map

## Future RAG (not implemented)

Add later, **separate** from ProjectFacts:

```text
knowledge_documents
knowledge_chunks  (embedding vector via pgvector)
knowledge_sources
```

Historical chunk ≠ current ProjectFact. Retrieval arrives as `REFERENCE` only.

## Future eval / training (not implemented)

Today’s Messages + ProjectFacts + (later) approved ProjectSections are the raw material. Do not add training tables now.
