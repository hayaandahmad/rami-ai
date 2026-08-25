# Rami — Second-Machine Prompt 2 (copy/paste)

Use this file **only after** Prompt 1 has succeeded:

1. The second laptop has cloned or pulled `https://github.com/hayaandahmad/rami-ai.git` on branch `main`.
2. `.private-context/handoff/SECOND_MACHINE_HANDOFF.md` has been read.
3. The human operator has confirmed this is a **reproduce-and-run** task, not development.

**Do not run the block below as part of Prompt 1.**

---

## Copy everything between the markers

Paste the following into Cursor as a **new** prompt. Include the entire block.

```text
======= BEGIN SECOND-MACHINE PROMPT 2 =======

ROLE
You are the unattended setup operator for Rami on this second Windows laptop.

This is NOT a development task.
Reproduce and run the CURRENT approved Rami Agent with a FRESH demo session.

Read first, before doing anything else:
  .private-context/handoff/SECOND_MACHINE_HANDOFF.md
  config/model-manifest.json
  package.json

Treat SECOND_MACHINE_HANDOFF.md as the highest-authority instructions for this laptop.
Do NOT treat README.md as authoritative (it is stale).

ABSOLUTE FORBIDDEN ACTIONS
- Do not modify any application source, UI, prompts, schemas, Agent logic, or configs (including model-manifest.json).
- Do not refactor, restyle, optimize, or “improve” Rami.
- Do not start Phase 3, RAG, embeddings, PDF ingestion, or vector indexes.
- Do not pull qwen3:14b.
- Do not pull nomic-embed-text.
- Do not run npm run ai:setup:quality.
- Do not introduce paid APIs (OpenAI, Azure, Anthropic, or any cloud LLM).
- Do not create or invent .env.local.
- Do not git commit, git push, force-push, amend, rebase, or rewrite history.
- Do not silently replace qwen3:8b with qwen3:4b or any other model.
- Do not copy sessions, localStorage, or ProjectMemory from another machine.

TARGET
  SAME RAMI AGENT + FRESH DEMO SESSION

================================================================
STEP 0 — CONFIRM GIT IS CLEAN AND THIS IS THE RIGHT REPO
================================================================
Run:
  git remote -v
  git branch --show-current
  git log -1 --format="%H %s"
  git status

Confirm remote is https://github.com/hayaandahmad/rami-ai.git
Confirm branch is main.
Confirm working tree is clean.

If the tree is dirty, STOP and report. Do not discard unrelated local work.
If HEAD differs from origin/main, pull only if the human has not made local commits; do not rebase.

Record HEAD.

================================================================
STEP 1 — DETECT HARDWARE FIRST (READ-ONLY)
================================================================
Detect and record:
  CPU
  RAM
  GPU name
  exact VRAM
  NVIDIA driver if present

Use read-only Windows/NVIDIA commands, for example:
  nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
  Get-CimInstance Win32_Processor | Select-Object Name
  Get-CimInstance Win32_ComputerSystem | Select-Object TotalPhysicalMemory

VRAM GATE (mandatory):
  If VRAM is approximately 7 GB or more:
      continue with qwen3:8b as the demo model.
  If VRAM is below approximately 7 GB:
      STOP immediately.
      Do not pull models.
      Do not switch to qwen3:4b.
      Do not continue setup.
      Report CPU, RAM, GPU, VRAM and wait for a human.
  If nvidia-smi fails or there is no NVIDIA GPU:
      STOP and report. CPU-only is not an approved unattended demo path.

An RTX 3060 Laptop with 6 GB VRAM is a known latency risk. Treat that as a STOP, not a silent fallback.

================================================================
STEP 2 — NODE / NPM
================================================================
Check node -v and npm -v.

Supported: Node 20 or 22 LTS, or Node 24 if already installed (primary verified Node v24.15.0).
If Node is missing or older than 18.18: install a current Node 20 or 22 LTS using the official Windows installer or winget. Do not change package.json.

Then, from the repository root:
  npm ci

Do NOT run npm update.
Do NOT use npm install in a way that rewrites the lockfile. If npm ci fails, STOP and report.

================================================================
STEP 3 — OLLAMA
================================================================
Check whether ollama is on PATH and whether http://localhost:11434 responds.

If Ollama is missing, install it with the existing project script (preferred):
  npm run ai:setup

That script is scripts/setup-local-ai.ps1. It may use winget. After a fresh install, PATH may require a new terminal; restart the shell in-place if needed and re-run the script. Do not edit the script.

If Ollama is already installed, still run:
  npm run ai:setup
It is idempotent and will skip already-installed models.

NEVER run:
  npm run ai:setup:quality

Record:
  ollama --version
  ollama list

Primary known-good: Ollama 0.32.15
A different Ollama version is a reportable difference. Continue only if health checks later pass, and include the version mismatch in the final report.

================================================================
STEP 4 — MODELS (MANIFEST IS AUTHORITY)
================================================================
config/model-manifest.json is the only model authority.

Pull ONLY if missing:
  qwen3:8b     (default — required)
  qwen3:4b     (lightweight — install for parity; do NOT switch the app to it)

Do NOT pull:
  qwen3:14b
  nomic-embed-text
  any other model

After pull, run ollama list and compare IDs to the known-good primary IDs:
  qwen3:8b  500a1f067a9f  (~5.2 GB, Q4_K_M)
  qwen3:4b  359d7dd4bcda  (~2.5 GB, Q4_K_M)

If tags exist but IDs differ: report the difference. Do not pull other models to “fix” it. Continue only if qwen3:8b is installed and usable; flag the ID mismatch in the final report.

Confirm the running app will use qwen3:8b (manifest models.default). Do not change the manifest.

================================================================
STEP 5 — START OLLAMA AND VALIDATE
================================================================
Ensure Ollama is running at http://localhost:11434 (ollama serve if needed).

From the repository root run, in order:
  npm run ai:check
  npm run validate:phase1
  npm run ai:smoke
  npm run validate:users-norm

If ai:check or ai:smoke fails, STOP and report. Do not start the app as a demo if the local model is unhealthy.

Do not run lint/build unless a validation above fails in a way that suggests a broken checkout — and even then, do not fix source; report.

================================================================
STEP 6 — START RAMI AND KEEP IT RUNNING
================================================================
Start:
  npm run dev

Wait until Next.js prints the actual URL.
Default is often http://localhost:3000. If 3000 is taken, Next may use 3001 or another port.
Record the EXACT localhost URL including port.

Leave this process running. Do not stop it.

Confirm Ollama is still running.

================================================================
STEP 7 — UI SMOKE TESTS (TWO FRESH SESSIONS)
================================================================
Use the browser against the actual localhost URL from Step 6.

Home redirects to /workspace.

Open two DIFFERENT interview sessions (different document IDs). The interview route is:
  /documents/<documentId>/interview
Any new documentId is a fresh server session. Do not reuse one session for both tests.

--- Test A: Arabic, system implementation ---
Open a new interview URL, for example:
  <base>/documents/demo-second-machine-ar/interview

Send:
مرحبا رامي، بدي أعمل RFP لنظام موارد بشرية جديد للوزارة. النظام الحالي معتمد على Excel والموافقات اليدوية.

Verify:
- Rami replies naturally in Arabic
- Arabic message text is RTL (dir=rtl on the message, not the whole app)
- Extraction appears to populate facts (progress / facts UI moves; not a dead reply)
- Split workspace / RFP mode activates (chat + document preview)
- Do not require section titles to be translated; they stay English

--- Test B: English, consulting ---
Open a DIFFERENT interview URL, for example:
  <base>/documents/demo-second-machine-en/interview

Send:
Hello Rami, I need an RFP for a simple professional consulting engagement to review our procurement process. This is advisory services only, not a software or system implementation.

Verify:
- Professional English reply
- LTR for English messages
- Split workspace activates
- Do not expect software-heavy conditional sections to auto-activate for a consulting engagement

The Arabic turn also warms qwen3:8b for the demo. After both tests, leave the server and Ollama running.

If the UI cannot be driven, as a fallback POST to /api/rami/chat with JSON
  { "sessionId": "...", "documentId": "...", "message": "..." }
and report that the API path was used instead of the browser. Prefer the real UI.

================================================================
STEP 8 — FINAL REPORT (REQUIRED FORMAT)
================================================================
Report ONLY:

1. Repository path
2. HEAD commit
3. CPU
4. RAM
5. GPU
6. VRAM
7. Node / npm versions
8. Ollama version and whether the service is running
9. Installed Qwen model IDs (from ollama list), vs known-good 500a1f067a9f / 359d7dd4bcda
10. npm run ai:check result
11. validate:phase1, ai:smoke, validate:users-norm results
12. Arabic smoke-test result
13. English smoke-test result
14. Actual localhost URL
15. Whether Ollama and the Rami dev server were left running
16. Any blocker or difference from the primary machine

Then STOP.
Do not begin Phase 3.
Do not modify the repository.
Do not commit or push.

======= END SECOND-MACHINE PROMPT 2 =======
```
