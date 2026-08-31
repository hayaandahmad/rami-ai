# Live generation-RAG quality validation

Generated: 2026-08-31T00:43:21.331Z
Finalized: 2026-08-31T01:05:25.552Z

- **Provider:** ollama-local / qwen3:8b
- **Project:** `rami-rag-live-eval`
- **Cases run:** 4/4
- **Decision gate:** B — SAFE BUT QUALITY BENEFIT UNCLEAR

## Distinction

- **Mock safety:** `npm run validate:generation-rag` (deterministic / mock provider)
- **Live quality:** `npm run validate:generation-rag-live` (real Qwen — this artifact)

## Safety vs quality

- **Safety:** ProjectFact/readiness isolation passed; zero deterministic leakage; TBC preserved; high-risk weights not filled from history.
- **Quality:** Inconsistent — 0 CLEAR_IMPROVEMENT, 2 MIXED, 2 WORSE. Do **not** claim historical references generally improve drafting.

## Case verdicts

- **A_DELIVERABLES** (deliverables): WORSE — Assisted lost 1 table(s) vs baseline
- **B_SCOPE** (scopeOfWork): MIXED — Similar structure to baseline
- **C_ACCEPTANCE** (background): MIXED — Similar structure to baseline
- **D_EVAL_HIGH_RISK** (evaluationCriteria): WORSE — Assisted has fewer headings (-2)

## Semantic leakage

- **A_DELIVERABLES:** no semantic leaks detected
- **B_SCOPE:** no semantic leaks detected
- **C_ACCEPTANCE:** no semantic leaks detected
- **D_EVAL_HIGH_RISK:** no semantic leaks detected

## UI validation

- **Status:** NEEDS_MANUAL_BROWSER_VERIFICATION

## Isolation

- ProjectFacts unchanged: yes
- Readiness unchanged: yes

Full artifact: `C:\Projects\rami-ai\resources\historical-rfps\derived\generation-rag-live-eval.json`
