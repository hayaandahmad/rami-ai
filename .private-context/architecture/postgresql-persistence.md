# PostgreSQL persistence architecture

Status: **Implemented and live-validated** (primary Windows laptop, local `rami_ai`). PostgreSQL is the authoritative store for current project state.  
Do not implement RAG or training in this layer. Generated RFP prose is stored separately in `project_section_contents` (see `rfp-generation-architecture.md`).

## Runtime vs persistence

| Concept | Role after this phase |
|---|---|
| PostgreSQL | Authoritative project truth |
| `ProjectMemory` | Hydrated runtime business model (59-field types; missing new Fields stay unresolved) |
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

Git does **not** contain a live PostgreSQL server. Each machine runs its own. `.env.local` and passwords stay machine-local.

Git **does** contain a portable **development** snapshot of `rami_ai` (not the production backup strategy):

```text
dev/database/rami_ai_shared.dump
dev/database/rami_ai_shared.metadata.json
```

Format: `pg_dump -Fc --no-owner --no-privileges`. Refresh only when you intend to replace the shared development state:

```text
npm run db:dump-shared -- --write-repo-snapshot
npm run db:write-shared-metadata
npm run validate:shared-dump
npm run db:verify-shared-restore
```

Then commit the dump + metadata. Private backups remain `npm run db:backup` → `.rami-db-backups/` (gitignored).

Second machine (same development data; do not recreate projects by hand):

```text
1. Install PostgreSQL 18 and ensure a local role can create databases.
2. Copy .env.example → .env.local. Set RAMI_DB_* (no NEXT_PUBLIC_ DB vars).
   RAMI_DB_NAME must be rami_ai. Host must be loopback (127.0.0.1 / localhost / ::1).
   Port may differ. Password stays only in .env.local.
3. npm run db:restore-shared -- --confirm-replace-local-rami-ai
4. npm run db:check
```

`db:restore-shared` refuses non-loopback hosts and requires the confirmation flag. It replaces local `rami_ai`.

Empty-schema path (not the handoff default):

```text
1. Install PostgreSQL and create an empty database named rami_ai.
2. Copy .env.example → .env.local and set RAMI_DB_* (no NEXT_PUBLIC_ DB vars).
3. npm run db:migrate
4. npm run db:seed
5. npm run db:check
```

Private dump restore (gitignored files):

```text
npm run db:restore -- path\to\file.dump rami_ai_restore_test
(never restore onto the live database unless you pass --overwrite-live)
```

Chat and `/api/rami/session` require a configured database. They will not silently treat the Map or localStorage as saved project truth.

## Tooling

- Driver: `pg` (node-postgres). No ORM.
- Migrations: versioned SQL in `src/server/db/migrations/` + `scripts/db-migrate.ts`
- Seed: TypeScript from `RFP_SECTIONS`, `PROJECT_MEMORY_FIELDS`, question-bank map
- Shared snapshot: `npm run db:dump-shared` / `db:write-shared-metadata` / `db:restore-shared` / `db:verify-shared-restore` / `validate:shared-dump`

## Historical / generation-reference tables (separate from ProjectFacts)

| Table | Purpose |
|---|---|
| `historical_rfp_documents` / `historical_question_answers` | Imported historical Q&A (REFERENCE) |
| `historical_knowledge_chunks` / `historical_chunk_embeddings` | Offline RAG (`REAL[]`; pgvector deferred) |
| `historical_field_proposals` | Use-as-suggestion → possible ProjectFact |
| `project_generation_references` | Use-as-drafting-reference — **never** writes `project_facts` |

Historical chunk ≠ current ProjectFact. Generation loads only BA-approved ACTIVE drafting references for that Section.

## Future eval / training (not implemented)

Today’s Messages + ProjectFacts + (later) approved ProjectSections are the raw material. Do not add training tables now.
