# RFP Knowledge Architecture — Structured Memory, Provenance, and Local RAG

Status: **Final design for current architecture pass. Not implemented yet.**

This document covers everything about *what Rami knows and how it knows it is trustworthy*: structured project memory, provenance, and the local retrieval pipeline over historical RFPs. Section-by-section drafting logic lives in `rfp-generation-architecture.md`.

---

## 1. Structured Project Memory

Structured project memory is the canonical, queryable store of facts about **the current engagement**, keyed by the 52 canonical fields in `analysis/question-information-mapping.md`. Conceptually:

```ts
interface ProjectMemoryEntry {
  fieldId: string;            // e.g. "hostingModel" — one of the 52 canonical fields
  value: unknown;             // shape depends on field (string, string[], structured object)
  status: ProvenanceStatus;   // see §2
  sourceType: "ba-message" | "historical-retrieval" | "template-default" | "system";
  sourceRef?: string;         // e.g. chat message id, or "OFA-Internet-Services-...pdf#SLA-table"
  confirmedBy?: string;       // BA identity/session, once promoted to CONFIRMED
  lastUpdatedAt: string;
  history: ProjectMemoryEntry[]; // prior versions retained, never overwritten silently
}
```

- One entry per field per project. `history[]` retains every prior version so a later change (e.g. BA revises `hostingModel` after a section was already approved) is auditable and can trigger the reopening flow (`rfp-generation-architecture.md` §State Machine).
- Fields with list/table shapes (e.g. `slaTiers[]`, `costBreakdown[]`) store structured sub-objects, not flattened strings, so section drafting can render them as real tables rather than re-parsing prose.
- Group-12 agent heuristics and the `draftLanguage` system default are **not** stored here — see `question-information-mapping.md` for the exclusion rationale. Only `riskNotes[]` (the one legitimate Group-12 aggregate field) lives in project memory.

## 2. Provenance model (unchanged core, finalized states)

```text
CONFIRMED   — BA explicitly stated or explicitly approved this value.
EXTRACTED   — LLM extracted this from a BA message; not yet explicitly confirmed.
REFERENCE   — sourced from historical-RFP retrieval; describes a *different* past engagement.
PROPOSED    — a REFERENCE or template-default value offered to the BA as a starting point for *this* engagement, awaiting a decision.
TBC         — explicitly deferred ("to be confirmed"); drafting may proceed with this gap flagged.
```

### Hard rule (preserved, non-negotiable)

> **`REFERENCE` cannot silently become a current project fact.** A historical reference must first become `PROPOSED`, and `PROPOSED` can only become `CONFIRMED` through an explicit BA action (an accept/edit/reject decision surfaced in the conversation or the RFP preview UI). There is no code path that writes a `REFERENCE` value directly into a field's active value as if it were a project fact.

### Allowed transitions

```text
(none) → EXTRACTED        (LLM parses a BA message)
(none) → PROPOSED         (retrieval/template default offered to BA)
(none) → TBC              (BA says "I don't know" / defers)
EXTRACTED → CONFIRMED     (BA confirms during section review, or explicitly restates)
EXTRACTED → TBC           (BA defers despite a tentative extraction)
PROPOSED  → CONFIRMED     (BA accepts the proposal, verbatim or edited)
PROPOSED  → TBC           (BA defers the proposal)
TBC       → EXTRACTED/PROPOSED/CONFIRMED  (later resolved, any of these paths)
CONFIRMED → EXTRACTED*    (*only via the reopening flow — an upstream change invalidates a previously confirmed value; it re-enters the pipeline, it does not silently overwrite)
REFERENCE → PROPOSED      (the only legal exit from REFERENCE)
```

`REFERENCE` never appears as a live field value — it only exists as an *evidence item* attached to a retrieval result, until promoted to `PROPOSED`.

## 3. Local RAG pipeline

```text
Approved RFP sources (historical PDFs/DOCX under .private-context/knowledge/)
  ↓
local parsing            (PDF/DOCX text + table extraction, no cloud OCR/parsing service)
  ↓
section/subsection/table-aware chunking   (see rules below)
  ↓
local embeddings          (e.g. nomic-embed-text or EmbeddingGemma via Ollama)
  ↓
small local index          (see §4 — no dedicated vector DB at current corpus size)
  ↓
similarity retrieval       (top-k, filtered by trust tier + optional section-path filter)
  ↓
source-attributed evidence  (every result carries filename + sectionPath + trust tier)
  ↓
local LLM                  (uses evidence to answer, propose, or draft — never bypasses attribution)
```

### Chunking rules (derived from `analysis/historical-rfp-findings.md` §5)

1. Tables are atomic chunks; a table's header row always travels with its data rows.
2. Chunk boundaries follow detected section/subsection headings (numbering-pattern + title matching, since not all sources use semantic heading styles — see the `GeneralTemplate.docx` finding).
3. Every chunk carries metadata: `sourceFile`, `sectionPath` (e.g. `"Technical Requirements > Infrastructure / Hosting"`), `chunkType` (`prose` | `table` | `clause`), and `trustTier` (§5).
4. Boilerplate/clause clusters (legal, administrative) are chunked smaller and denser; narrative background/scope content is chunked slightly larger to preserve context.

### §4 — Index choice: no dedicated vector database yet

For the current corpus (4 documents), a dedicated vector database is **not justified**. The recommended approach is the simplest replaceable local index:

- Store chunk text + metadata + embedding vectors in a flat local file (e.g. JSON/SQLite with a BLOB/array column, or a simple on-disk array format loaded into memory at startup).
- Compute cosine similarity in-process for retrieval (a few hundred to a few thousand chunks is trivially fast without a specialized ANN index).
- Design the retrieval interface (`search(query, filters) → RankedChunk[]`) so that if the corpus grows enough to need approximate nearest-neighbor search or persistence at scale, the storage/index implementation can be swapped (e.g. for SQLite-vss, LanceDB, or a similar embedded vector store) **without changing any caller**.
- Do not introduce a vector database dependency in Phase 3 unless the completed retrieval-quality/performance evaluation demonstrates an actual need.

## 5. Trust tiers and the knowledge lifecycle

Every piece of retrievable knowledge carries a `trustTier`:

| Tier | Meaning | Current members |
|---|---|---|
| `approved-historical` | A real, previously-issued RFP or the ministry's own general template, manually placed in `.private-context/knowledge/` by a human | The 3 historical PDFs + `GeneralTemplate.docx` |
| `approved-generated` | A Rami-generated RFP that has completed BA review and been explicitly approved and promoted | None yet — this tier is empty until Phase 5 |
| *(no tier / not indexed)* | Draft or in-progress Rami output | Never indexed; not retrievable by RAG |

### Lifecycle for historical documents (already-trusted at ingestion)

```text
historical approved source (placed by a human in .private-context/knowledge/)
  → parsed, chunked, embedded
  → reference knowledge (trustTier = approved-historical)
```

### Lifecycle for future Rami-generated documents (must earn trust)

```text
generated draft
  ↓
BA review
  ↓
approved final document
  ↓
explicit trust promotion   (a deliberate human action — e.g. an "index this as reference" step; never automatic on approval alone)
  ↓
knowledge indexing          (parsed/chunked/embedded exactly like a historical source)
  ↓
available to future Rami retrieval  (trustTier = approved-generated)
```

**Hard rule:** approving a document for delivery to a client/ministry (`APPROVED` section state) is **not** the same action as promoting it to trusted knowledge. These are two distinct, explicit steps. An approved-but-not-yet-promoted document must never automatically become retrievable reference material — this prevents silent knowledge-quality drift and keeps a human accountable for what enters the trusted corpus.

## 6. Relationship to Google Sheets

Google Sheets remains the current structured-persistence boundary for project memory (answers/sessions) — see `handoff/CURRENT_STATE.md` for its exact current state and gaps. **Google Sheets must never become the RAG/vector store.** Embeddings, chunk text, and the local index live in a separate local storage mechanism (flat file/SQLite as described in §4), never in a spreadsheet.
