# Rami Modal GPU PoC (isolated)

Thin Qwen3-8B inference on Modal **T4** for infrastructure proof only.

- Does **not** change Rami prompts, schemas, gap engine, or chat route.
- Does **not** implement RAG or fine-tuning.
- Uses Ollama + `qwen3:8b` (same tag family as local; Q4_K_M) on a Modal Volume.
- Default `min_containers=0`, `max_containers=1`.

## Setup (Windows)

```powershell
# from rami-ai/
.\.venv-modal\Scripts\python.exe -m modal setup   # browser auth once
.\.venv-modal\Scripts\python.exe infra\modal-poc\control.py auth-check
.\.venv-modal\Scripts\python.exe infra\modal-poc\control.py deploy
.\.venv-modal\Scripts\python.exe infra\modal-poc\control.py ensure-model   # CPU download
```

## Session controls

```powershell
.\.venv-modal\Scripts\python.exe infra\modal-poc\control.py start
.\.venv-modal\Scripts\python.exe infra\modal-poc\control.py status
.\.venv-modal\Scripts\python.exe infra\modal-poc\control.py test "Say hello in one short sentence."
.\.venv-modal\Scripts\python.exe infra\modal-poc\control.py local-compare
.\.venv-modal\Scripts\python.exe infra\modal-poc\control.py stop
.\.venv-modal\Scripts\python.exe infra\modal-poc\control.py usage
```

## Cost safety

- Official Modal T4: **$0.000164 / sec** (~$0.59 / hr) — see https://modal.com/pricing
- PoC idle auto-stop: **120s** (product default later 15–20 min)
- PoC max session: **600s**
- Always `stop` when finished

Usage file `infra/modal-poc/.usage/poc-usage.json` is **ESTIMATED** and gitignored.
