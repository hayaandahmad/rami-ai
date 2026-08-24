# Local AI Deployment Architecture

Status: **Phase 1 implementation complete (Aug 2026).** Hardware verified, Ollama installed, models pulled, manifest and scripts created.

## 1. Hard constraint (unchanged, non-negotiable for current stage)

> **Zero paid AI API cost.** No OpenAI, Azure OpenAI, Anthropic, or any other paid inference API may be a required dependency. All LLM inference, embeddings, and retrieval must run locally/self-hosted. See `handoff/DECISIONS.md` for how this supersedes earlier research (`research/04-tools-and-stack.txt`, `research/05-azure-costs.txt`).

## 2. Runtime choice: Ollama

Ollama is the local inference runtime for Phase 1–3, for these reasons:

- Simple local install and model management (`ollama pull`, `ollama run`) on Windows, macOS, and Linux — matters for the "second developer / ministry machine" portability goal (§4).
- Exposes an OpenAI-compatible REST API, minimizing the surface `LocalModelProvider` needs to implement.
- Built-in JSON-schema-constrained structured output, which is exactly what the LLM-extraction responsibility needs to reliably populate the 52 canonical fields without brittle prompt-only JSON parsing.
- No GPU vendor lock-in assumption — runs on CPU (slow) or GPU (fast) depending on developer/ministry hardware, without code changes.

This is a **default recommendation for the current stage, not a permanent architectural lock-in** — the `RamiModelProvider` abstraction exists precisely so the runtime can change later without touching agent logic.

## 3. Verified hardware and model selection (Phase 1 — Aug 2026)

### Primary development machine (verified)

| Component | Detected value |
|---|---|
| GPU | NVIDIA GeForce RTX 4060 Laptop GPU |
| GPU VRAM | 8,188 MiB (~8 GB) |
| CPU | Intel Core i9-14900HX |
| System RAM | 15.6 GB |
| OS | Windows 11 64-bit |

### Model selection rationale

| Role | Selected model | VRAM estimate | Decision |
|---|---|---|---|
| Default (extraction + drafting) | **qwen3:8b** | ~4.7 GB q4_K_M | Fits RTX 4060 8GB comfortably; leaves ~3GB headroom |
| Lightweight fallback | **qwen3:4b** | ~2.5 GB q4_K_M | For lower-VRAM machines or fast extraction-only calls |
| Higher-quality drafting | **qwen3:14b** | ~8–10 GB Q4 | **NOT pulled automatically** — borderline for 8GB VRAM; pull manually with `npm run ai:setup:quality` only after testing confirms it fits |
| Embeddings | **nomic-embed-text** | ~270 MB | Phase 3 only — not pulled in Phase 1 |

**qwen3:8b is the Phase 1 default.** qwen3:4b is pulled as the lightweight fallback. qwen3:14b is documented but not auto-pulled — it is borderline for 8GB VRAM laptop and should be validated before enabling.

### Models actually downloaded (Phase 1)

- `qwen3:4b` — pulled ✓
- `qwen3:8b` — pulled ✓
- `qwen3:14b` — NOT pulled (optional, manual only)
- `nomic-embed-text` — NOT pulled (Phase 3)

## 4. Deployment topologies

### Developer machine (Phase 1–3 target)

```text
Rami (Next.js app)
  +
Ollama v0.32.15 (local service at http://localhost:11434)
  +
local model (per config/model-manifest.json)
  +
local knowledge index (flat file/SQLite, per rfp-knowledge-architecture.md §4 — Phase 3)
```

### Second developer / ministry pilot machine (future, Phase 6-adjacent)

```text
git clone / git pull
  ↓
npm install
  ↓
npm run ai:setup        (runs scripts/setup-local-ai.ps1)
  ↓
ollama pull <models>    (driven by config/model-manifest.json)
  ↓
build local knowledge index  (Phase 3 — parse + chunk + embed knowledge/ sources)
  ↓
npm run ai:check        (runs scripts/check-local-ai.ps1)
  ↓
npm run dev
```

This topology is why the `RamiModelProvider`/`LocalModelProvider` boundary and a declarative model manifest matter: a second machine should be able to reach a working state from a clean clone without any manual code edits.

## 5. Created artifacts (Phase 1)

### `config/model-manifest.json`

Declares model roles (default, lightweight, quality, embeddings), the Ollama base URL, and notes on hardware rationale. Model tags/configuration are in Git; model weights are not.

### `src/server/ai/RamiModelProvider.ts`

Provider-independent interface: `complete()`, `extractStructured()`, `embed()`, `healthCheck()`. Business logic never imports Ollama specifics directly.

### `src/server/ai/LocalModelProvider.ts`

Ollama-backed implementation. Reads manifest via `modelManifest.ts`. Handles connection failures, timeouts, and response parsing. Uses Ollama's native `format` field for schema-constrained JSON output.

### `src/server/ai/modelManifest.ts`

Reads and caches `config/model-manifest.json`. Throws a descriptive error if the manifest is missing (guides the user to run `npm run ai:setup`).

### `scripts/setup-local-ai.ps1`

Idempotent Windows PowerShell setup: checks/installs Ollama (via winget), starts service, reads manifest, pulls configured models, verifies availability. Does not re-pull already-installed models.

### `scripts/check-local-ai.ps1`

Health-check script: verifies manifest, Ollama executable, service reachability, model availability, and a structured-output inference round-trip.

## 6. Portability and secrecy guarantees

- **No model weights are stored in Git.** Ollama manages model storage in its own local data directory outside the repository.
- **No paid external LLM is required** for the system to function at any point in the currently planned phases.
- **A local inference HTTP API (Ollama's) is acceptable** as the integration point — this is a loopback call to a service on the same machine.
- **No secrets are required** for the local-AI path itself (no API keys). Google Sheets credentials remain a separate, existing concern.
- **Approved RFP source files are now versioned** (`.private-context/knowledge/`) — see `handoff/DECISIONS.md` #14-updated.

## 7. Ollama installation details (Phase 1)

- **Installed via:** `winget install Ollama.Ollama`
- **Version:** 0.32.15
- **Service URL:** `http://localhost:11434`
- **Installation date:** Aug 2026 (Phase 1 implementation)
