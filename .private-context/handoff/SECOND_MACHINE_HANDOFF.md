# Rami — Second-Machine Handoff

**Superseded as the session entrypoint.** Read `.private-context/handoff/START_HERE.md` first. This file is reproduce-and-run history for an earlier demo setup; it is **not** the current development handoff. Shared DB restore is `npm run db:restore-shared -- --confirm-replace-local-rami-ai`.

---

**Audience (historical):** a fresh Cursor instance on a second Windows laptop that has none of the original development conversation.

**Purpose:** reproduce and run the **current approved Rami Agent** for a ministry demo. This is **not** a development task.

**Authority order (highest first):**

1. This file
2. `.private-context/handoff/CURRENT_STATE.md`
3. `.private-context/handoff/DECISIONS.md`
4. `.private-context/handoff/NEXT_STEPS.md`
5. `.private-context/architecture/local-ai-deployment.md`
6. `config/model-manifest.json`

**Do not treat `README.md` as authoritative.** It is stale and still describes an earlier mock frontend with no AI.

---

## A. What Rami is

Rami is an AI-assisted Business Analyst / RFP workspace for government digital projects (MODEE).

Current interaction is **conversational**, not a rigid questionnaire. A BA speaks in Arabic or English. Rami extracts structured facts, updates project memory, and asks the next useful question.

**Local AI architecture:**

- No paid cloud LLM API is required for current conversational Rami.
- **Ollama** is the local inference runtime (`http://localhost:11434`).
- **Qwen** (`qwen3:8b`) is the actual LLM.
- The **Rami Agent** is application code around that model: extraction, memory, gaps, intent, applicability, and streaming chat.

**Hard split of responsibility:**

| Layer | Owner |
|---|---|
| Language (chat wording, extraction JSON) | Local Qwen via Ollama |
| Workflow, gaps, next question, section applicability, provenance, intent | Deterministic TypeScript |

The LLM must not control workflow. See `DECISIONS.md` #2.

**Cursor is not part of the Rami runtime.** Cursor is only a developer/setup assistant used to get this laptop running. After setup, Rami runs in a browser against Next.js + Ollama.

---

## B. Current development status

| Phase | Status | What it delivered |
|---|---|---|
| **Phase 1** | **Complete** | Local AI foundations: Ollama provider, model manifest, setup/health scripts, canonical 20-section schema, 52-field information model |
| **Phase 2** | **Complete** | Conversational workspace: SSE chat, extraction → memory → gap → response, intent detection, split chat/document UI |
| **Phase 2.1** | **Complete** | Bilingual Arabic/English, RTL, conditional section applicability, separated progress UI, next-question priority, users-value normalization |
| **Phase 3 RAG** | **NOT STARTED** | Historical RFP ingestion, embeddings, vector index — do **not** begin this |
| **Phase 4** | Pending | Live section drafting in the right pane |
| **Phase 5** | Pending | Final RFP assembly / DOCX export |

**Stop here.** The second machine must reproduce Phase 2.1 as it exists. Do not implement Phase 3, RAG, embeddings, PDF ingestion, or drafting.

Known-good Git commit on primary when this handoff was written:

```text
38d31732627450c1a37233d7f919fb4666958117
Polish Rami bilingual conversation and RFP guidance
```

Confirm `HEAD` on the second machine matches `origin/main` after clone/pull. If it differs, report the actual hash; do not rewrite history.

---

## C. Current capabilities

What exists today:

- ChatGPT-style conversation workspace (hero → split chat + document preview)
- Arabic and English conversation
- Reply language follows the user’s dominant language (deterministic Arabic-character heuristic; no extra LLM call)
- Arabic messages render `dir="rtl"` **per message**; the app chrome stays LTR
- RFP **document** language remains English by default (section titles stay English)
- Multi-fact extraction from one BA message
- Structured `ProjectMemory` with provenance
- Canonical **52** information requirements (`src/schema/projectMemoryFields.ts`)
- Canonical **20-section** RFP structure (`src/schema/rfpSchema.ts`): 12 mandatory + 8 conditional
- System-implementation projects can activate conditional technical/system sections (typically 18–19 applicable)
- Consulting / professional-services projects may remain mandatory-only (12)
- Deterministic next-best-question priority (business-critical fields before title/tender/deadline)
- Correction handling and duplicate-question prevention
- Provenance model (`EXTRACTED` / `CONFIRMED` / `REFERENCE` / etc.)
- RFP intent detection (`NONE` → `POSSIBLE` → `CREATE_RFP`)
- Progress UI: section count vs information completeness, shown separately
- Local Qwen streaming (`completeStream()`), with Qwen3 `<think>` blocks stripped
- Current split chat / A4 document-preview workspace

Honest limitations:

- Server `ProjectMemory` is **in-memory** (process Map). Restarting Next.js **loses structured memory**.
- Browser `localStorage` (`rami-chat-v1:{sessionId}`) restores **chat messages** only, not ProjectMemory.
- Section drafting / live document generation is **not** implemented. The right pane is a placeholder shell.
- Historical RFP RAG is **not** implemented. Source PDFs/DOCX are in Git for Phase 3; they are not retrieved at runtime.
- Existing chats on the primary laptop **do not** need to transfer.
- The second laptop **must start a fresh demo session**.

---

## D. Current architecture

Runtime flow:

```text
Browser
  → Next.js Rami application
  → POST /api/rami/chat
  → Qwen structured extraction (temperature 0)
  → ProjectMemory update (TypeScript)
  → deterministic gap / intent / applicability logic
  → Qwen conversational response (temperature 0.65, streamed)
  → SSE events to the UI
```

Inference path:

```text
Next.js (npm run dev)
  → Ollama at http://localhost:11434
  → qwen3:8b  (manifest default; chat route always uses this unless a human changes the manifest)
```

Entry for a live conversation:

```text
http://localhost:<port>/workspace
  → create a document
  → /documents/<documentId>/interview
```

The interview route renders `RamiChatWorkspace`. `documentId` is also the server session id. Any new id is a fresh session.

**Cursor is not in this diagram.** After setup, Cursor can be closed.

---

## E. What is stored in Git

GitHub (`https://github.com/hayaandahmad/rami-ai.git`, branch `main`) contains the current:

- Application / UI / API code
- Rami Agent / orchestration (`src/server/rami/`, `src/app/api/rami/chat/`)
- System prompts (`src/server/ai/ramiSystemPrompt.ts`)
- Extraction schema (`src/server/ai/extractionSchema.ts`)
- `ProjectMemory` types and provenance
- 52-field information model
- 20-section RFP schema and applicability rules
- Intent, gap, and bilingual behavior
- Validation scripts (`validate:phase1`, `ai:check`, `ai:smoke`, `validate:users-norm`)
- Model **tags** in `config/model-manifest.json`
- `package-lock.json`
- Source historical RFP files under `.private-context/knowledge/` (unused at runtime until Phase 3)
- Handoff and architecture documentation

No model weights, no `node_modules`, no `.next`, no secrets.

---

## F. What is machine-local

Recreated on each laptop. **Not** expected in Git. **Do not copy the primary disk.**

- Node / npm installation
- `node_modules`
- Ollama installation
- Qwen model weights / Ollama cache (`~/.ollama`)
- `.next`
- Running processes and ports
- Browser `localStorage` conversations
- In-memory `ProjectMemory`
- NVIDIA GPU drivers

`.env.local` is **not required** for conversational Rami. The primary machine does not use one. Google Sheets is legacy interview-save only. **Do not invent `.env.local`.**

---

## G. Known-good primary environment

Verified on the primary development laptop:

| Item | Value |
|---|---|
| OS | Windows 11 |
| CPU | Intel i9-14900HX |
| GPU | NVIDIA GeForce RTX 4060 Laptop GPU |
| VRAM | ~8 GB (8188 MiB) |
| Node | v24.15.0 |
| npm | 11.12.1 |
| Ollama | 0.32.15 |
| Default model | `qwen3:8b` |
| `qwen3:8b` ID | `500a1f067a9f` |
| `qwen3:8b` size / quant | ~5.2 GB, **Q4_K_M** |
| Lightweight model | `qwen3:4b` |
| `qwen3:4b` ID | `359d7dd4bcda` |
| `qwen3:4b` size / quant | ~2.5 GB, **Q4_K_M** |

`qwen3:8b` is the **application default**. The chat route always uses `config/model-manifest.json` → `models.default`.

`qwen3:4b` is pulled as a documented lighter fallback. **The app does not silently switch to it.** Do not change the default without human approval.

Manifest quality/embedding tags exist but **must not be pulled** on the second machine:

- `qwen3:14b` — do not pull
- `nomic-embed-text` — Phase 3 only; do not pull

---

## H. Second-machine purpose

Tomorrow’s second laptop is for **reproducing and demonstrating the current approved Rami**.

Target:

```text
SAME RAMI AGENT
+
FRESH DEMO SESSION
```

Not:

```text
COPY THE EXISTING CHAT SESSION
```

It is **not** a development task. Do not “improve” Rami while setting it up.

---

## I. Second-machine safety rules

- Do not modify application source
- Do not modify prompts
- Do not modify schemas
- Do not refactor, restyle, or “clean up”
- Do not start Phase 3
- Do not build RAG / embeddings / a vector index
- Do not pull `qwen3:14b`
- Do not pull `nomic-embed-text`
- Do not introduce paid APIs (OpenAI, Azure, Anthropic, etc.)
- Do not invent `.env.local`
- Do not commit or push
- Do not force-push
- Do not silently replace `qwen3:8b` with another model
- Do not treat `README.md` as more authoritative than this handoff
- Use `npm ci` (lockfile), not an unconstrained `npm update`
- Run `npm run ai:setup` if Ollama/models are missing — **never** `npm run ai:setup:quality`

---

## J. Hardware gate

The second laptop is **believed** to have an Intel i7 and an RTX 3060 or RTX 3070. **This is not confirmed.** Detect hardware with read-only commands. Do not assume.

Example (PowerShell):

```powershell
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
Get-CimInstance Win32_Processor | Select-Object Name
Get-CimInstance Win32_ComputerSystem | Select-Object @{N='RAM_GB';E={[math]::Round($_.TotalPhysicalMemory/1GB,1)}}
```

**VRAM rule:**

| Detected VRAM | Action |
|---|---|
| **~7 GB or more** | `qwen3:8b` is the expected demo model. Continue setup. |
| **Below ~7 GB** | **STOP.** Report CPU / RAM / GPU / VRAM. Do **not** automatically switch to `qwen3:4b`. Changing the model changes quality and behavior. Wait for a human. |

An **RTX 3060 Laptop with 6 GB VRAM** is a realistic latency risk: `qwen3:8b` is ~5.2 GB on disk and may partially offload to CPU/RAM, which can make live conversation too slow. That is a reportable blocker, not a silent fallback.

If there is no NVIDIA GPU or `nvidia-smi` fails, **STOP** and report. CPU-only inference is not acceptable for the ministry demo without human approval.

---

## K. Model reproducibility

The same Ollama **tags** (`qwen3:8b`, `qwen3:4b`) can be downloaded on the second machine via the setup script / `ollama pull`.

Tags are **not** full digest-pinned. Exact bit-identical artifacts are not guaranteed indefinitely if the Ollama library retags a model later.

For tomorrow’s setup:

1. Pull only the default and lightweight tags.
2. Run `ollama list`.
3. Compare IDs to the known-good values above (`500a1f067a9f` / `359d7dd4bcda`) where possible.
4. If the tag exists but the ID differs, **report it**. Do not “fix” it by pulling other models. Continue only if a human accepts the difference, or if the IDs match.

**Same Rami** means:

- same application code
- same Agent rules / prompts / schemas
- same model family and configuration (`qwen3:8b` Q4_K_M via Ollama)

Generated **wording is not verbatim identical**. Chat temperature is 0.65 and no seed is set. Extraction (temperature 0) is more stable but still not bit-identical across GPUs.

Ollama version on the primary is **0.32.15**. `scripts/setup-local-ai.ps1` may install whatever current `winget` package is. After install, record the actual version. A wildly different Ollama is a reportable difference, not an automatic abort unless health checks fail.

---

## L. Demo behavior (smoke expectations)

Use **two fresh sessions** (two different `documentId` values). Do not reuse one session for both scenarios.

### Arabic — system implementation

Open a new interview (new document id). Send:

```text
مرحبا رامي، بدي أعمل RFP لنظام موارد بشرية جديد للوزارة. النظام الحالي معتمد على Excel والموافقات اليدوية.
```

Expect:

- Natural professional Arabic reply
- User/assistant Arabic bubbles `dir="rtl"`
- Facts extracted into English canonical field IDs
- RFP mode / split workspace activates
- Conditional system sections can become applicable (more than the mandatory 12) once `documentType` is `system-implementation`

### English — consulting / services

Open a **different** new interview. Send:

```text
Hello Rami, I need an RFP for a simple professional consulting engagement to review our procurement process. This is advisory services only, not a software or system implementation.
```

Expect:

- Professional English reply
- LTR message direction
- Irrelevant software-heavy conditional sections should **not** automatically activate (consulting typically stays at the 12 mandatory sections)

RFP section **titles** in the preview remain English in both cases.

---

## M. Demo latency

First inference is slower: Ollama must load ~5.2 GB into VRAM.

Before the meeting:

1. Start Ollama
2. Start Rami (`npm run dev`)
3. Run `npm run ai:check`
4. Send one warm-up conversation (the Arabic smoke test is enough)
5. **Leave Ollama and the Next.js server running**

Do not shut them down after a green health check.

---

## N. Prompt 2 — do not run it during Prompt 1

This file is **Prompt 1 context** (synchronize, understand, stop).

After Step 1 synchronization and review succeeds, the **human operator** must open:

```text
.private-context/handoff/SECOND_MACHINE_PROMPT_2.md
```

Copy the complete prompt from that file and paste it into Cursor as the **second** prompt.

**Do not execute Prompt 2 automatically during Prompt 1.**
**Do not install Node, Ollama, models, or npm packages during Prompt 1.**
**Do not start Phase 3.**
