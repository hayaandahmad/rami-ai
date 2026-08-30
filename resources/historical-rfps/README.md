# Historical RFP Resource Library

Location: `resources/historical-rfps/`

## What these files are

Excel workbooks that map **RAMI’s current 62-question Question Bank** to answers extracted from **real historical MoDEE / government RFPs** (and pre-qualification documents), including **Status** and **Source (RFP)** page references where available.

Optional **original RFP PDFs** live beside the Excel files when supplied.

## Why RAMI keeps them

- **REFERENCE** — examples of how real RFPs answer RAMI questions  
- **EVALUATION** — future golden sets for extraction / coverage / generation checks  
- **RAG_CANDIDATE** — later retrieval of patterns and section language  

They are **not** live project state.

## Hard rules

| These are | These are NOT |
|---|---|
| Historical / reference resources | Current `ProjectFacts` |
| Source artifacts under `source/` | Model training data (yet) |
| Candidates for later RAG | RAG embeddings (yet) |
| Evaluation material | Something that silently updates a live project |

**Historical answer ≠ current project truth.**

Retrieval may later yield `REFERENCE` or BA-approved `PROPOSED` facts — never automatic promotion into current ProjectFacts.

## Layout

```text
resources/historical-rfps/
  README.md                 ← this file
  manifest.json             ← machine-readable inventory
  source/
    excel/                  ← immutable Question Bank answer workbooks
    pdf/                    ← immutable original RFP/PQ PDFs (when available)
  derived/                  ← audits / future normalized exports only
```

- **`source/`** — do not rewrite, rename columns, or overwrite originals  
- **`derived/`** — safe place for machine-generated normalized datasets later  

## Relation to the Question Bank

Primary sheet **`Rami Q&A`** uses:

`Section | Question ID | Exact Rami Question | Answer Based on RFP | Status | Source (RFP)`

Question IDs align with canonical IDs (`0.1` … `12.8`).

Additional sheets (not canonical bank):

- **Suggested Additions** — conditional `13.x`–`17.x` procurement / domain questions  
- **Adaptive Depth** — when to deepen questioning  
- **Final Rami Architecture** (some workbooks) — stage / granularity design notes  

## How to add another historical RFP

1. Place the Excel under `source/excel/` (keep original content).  
2. Place the PDF under `source/pdf/` if available (stable kebab-case filename OK).  
3. Run `python scripts/audit-historical-rfp-resources.py resources/historical-rfps`.  
4. Update `scripts/build-historical-rfp-manifest.py` dataset list and regenerate `manifest.json`.  
5. Commit source + manifest + derived audit — never import into `project_facts`.

## Manifest

See `manifest.json` for IDs, hashes, coverage, and intended-use tags.

Audit details: `derived/AUDIT_SUMMARY.md` and `derived/audit-raw.json`.
