<#
.SYNOPSIS
    Rami local AI setup script. Installs Ollama, pulls configured models.
.DESCRIPTION
    Idempotent — safe to run multiple times. Does not re-pull models already
    installed. Does not pull the optional large quality model unless -PullQuality
    is specified. Does not modify application code.
.PARAMETER PullQuality
    If specified, also pulls the quality (large) model. Omit unless hardware
    and disk space have been verified.
.EXAMPLE
    .\scripts\setup-local-ai.ps1
    .\scripts\setup-local-ai.ps1 -PullQuality
#>
param(
    [switch]$PullQuality
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ManifestPath = Join-Path $PSScriptRoot '..\config\model-manifest.json'

function Write-Step([string]$msg) { Write-Host "`n[SETUP] $msg" -ForegroundColor Cyan }
function Write-OK([string]$msg)   { Write-Host "  OK: $msg" -ForegroundColor Green }
function Write-Warn([string]$msg) { Write-Host "  WARN: $msg" -ForegroundColor Yellow }
function Write-Fail([string]$msg) { Write-Host "  FAIL: $msg" -ForegroundColor Red }

# ── 1. Verify Windows ────────────────────────────────────────────────────────
Write-Step "Checking environment"
if ($env:OS -ne 'Windows_NT' -and -not $IsWindows) {
    Write-Warn "Not detected as Windows. Script is designed for Windows/PowerShell."
}
Write-OK "Running on PowerShell $($PSVersionTable.PSVersion)"

# ── 2. Read model manifest ───────────────────────────────────────────────────
Write-Step "Reading model manifest"
if (-not (Test-Path $ManifestPath)) {
    Write-Fail "config/model-manifest.json not found at $ManifestPath"
    exit 1
}
$manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$defaultModel    = $manifest.models.default
$lightweightModel = $manifest.models.lightweight
$qualityModel    = $manifest.models.quality
$embeddingModel  = $manifest.embeddings.model
$ollamaUrl       = $manifest.inferenceBaseUrl
Write-OK "Default model: $defaultModel"
Write-OK "Lightweight model: $lightweightModel"
Write-OK "Quality model: $qualityModel (not pulled unless -PullQuality)"
Write-OK "Embedding model: $embeddingModel (Phase 3 — not pulled now)"
Write-OK "Ollama URL: $ollamaUrl"

# ── 3. Check / install Ollama ────────────────────────────────────────────────
Write-Step "Checking Ollama installation"
$ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue
if ($null -eq $ollamaCmd) {
    Write-Warn "Ollama not found in PATH."
    Write-Host "  Installing Ollama via winget..." -ForegroundColor Yellow
    try {
        winget install Ollama.Ollama --silent --accept-source-agreements --accept-package-agreements
        # Refresh PATH in current session
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" +
                    [System.Environment]::GetEnvironmentVariable("PATH", "User")
        $ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue
    } catch {
        Write-Fail "winget install failed: $_"
        Write-Host "  Please install Ollama manually from https://ollama.com/download" -ForegroundColor Red
        exit 1
    }
    if ($null -eq $ollamaCmd) {
        Write-Warn "Ollama installed but not yet in PATH. You may need to restart your terminal."
        Write-Host "  After restarting, re-run this script." -ForegroundColor Yellow
        exit 0
    }
}
$ollamaVersion = & ollama version 2>&1
Write-OK "Ollama found: $ollamaVersion"

# ── 4. Verify Ollama service is running ──────────────────────────────────────
Write-Step "Verifying Ollama service"
$serviceRunning = $false
try {
    $resp = Invoke-WebRequest -Uri "$ollamaUrl/api/tags" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    if ($resp.StatusCode -eq 200) { $serviceRunning = $true }
} catch { }

if (-not $serviceRunning) {
    Write-Warn "Ollama service not responding at $ollamaUrl. Attempting to start..."
    Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 5
    try {
        $resp = Invoke-WebRequest -Uri "$ollamaUrl/api/tags" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        if ($resp.StatusCode -eq 200) { $serviceRunning = $true }
    } catch { }
}

if ($serviceRunning) {
    Write-OK "Ollama service is running at $ollamaUrl"
} else {
    Write-Fail "Could not reach Ollama at $ollamaUrl after start attempt."
    Write-Host "  Try running 'ollama serve' in a separate terminal, then re-run this script." -ForegroundColor Red
    exit 1
}

# ── 5. Get installed models ──────────────────────────────────────────────────
Write-Step "Checking installed models"
$tagsResp = Invoke-WebRequest -Uri "$ollamaUrl/api/tags" -UseBasicParsing
$tagsJson = $tagsResp.Content | ConvertFrom-Json
$installedNames = @($tagsJson.models | ForEach-Object { $_.name })
Write-Host "  Installed: $($installedNames -join ', ')"

function Test-ModelInstalled([string]$tag) {
    if ($installedNames -contains $tag) { return $true }
    if (-not $tag.Contains(':') -and $installedNames -contains "$tag`:latest") { return $true }
    return $false
}

# ── 6. Pull default model ────────────────────────────────────────────────────
Write-Step "Pulling default model: $defaultModel"
if (Test-ModelInstalled $defaultModel) {
    Write-OK "$defaultModel already installed — skipping pull"
} else {
    Write-Host "  Pulling $defaultModel (this may take several minutes)..." -ForegroundColor Yellow
    & ollama pull $defaultModel
    if ($LASTEXITCODE -ne 0) { Write-Fail "Failed to pull $defaultModel"; exit 1 }
    Write-OK "$defaultModel pulled successfully"
}

# ── 7. Pull lightweight model ────────────────────────────────────────────────
Write-Step "Pulling lightweight model: $lightweightModel"
if (Test-ModelInstalled $lightweightModel) {
    Write-OK "$lightweightModel already installed — skipping pull"
} else {
    Write-Host "  Pulling $lightweightModel..." -ForegroundColor Yellow
    & ollama pull $lightweightModel
    if ($LASTEXITCODE -ne 0) { Write-Fail "Failed to pull $lightweightModel"; exit 1 }
    Write-OK "$lightweightModel pulled successfully"
}

# ── 8. Optional: pull quality model ─────────────────────────────────────────
if ($PullQuality) {
    Write-Step "Pulling quality model: $qualityModel (requested via -PullQuality)"
    if (Test-ModelInstalled $qualityModel) {
        Write-OK "$qualityModel already installed — skipping pull"
    } else {
        Write-Host "  Pulling $qualityModel (LARGE — may take a long time)..." -ForegroundColor Yellow
        & ollama pull $qualityModel
        if ($LASTEXITCODE -ne 0) { Write-Fail "Failed to pull $qualityModel"; exit 1 }
        Write-OK "$qualityModel pulled successfully"
    }
} else {
    Write-Host "`n  [SETUP] Quality model ($qualityModel) NOT pulled (use -PullQuality to pull it)." -ForegroundColor DarkGray
}

# ── 9. Verify model availability ─────────────────────────────────────────────
Write-Step "Verifying model availability"
$tagsResp2 = Invoke-WebRequest -Uri "$ollamaUrl/api/tags" -UseBasicParsing
$tagsJson2 = $tagsResp2.Content | ConvertFrom-Json
$installedNames2 = @($tagsJson2.models | ForEach-Object { $_.name })

if (Test-ModelInstalled $defaultModel) {
    Write-OK "$defaultModel: available"
} else {
    Write-Fail "$defaultModel: NOT found after pull"
    exit 1
}

if (Test-ModelInstalled $lightweightModel) {
    Write-OK "$lightweightModel: available"
} else {
    Write-Warn "$lightweightModel: not found (lightweight fallback unavailable)"
}

# ── 10. Summary ───────────────────────────────────────────────────────────────
Write-Host "`n$('─' * 60)" -ForegroundColor DarkGray
Write-Host "  LOCAL AI SETUP COMPLETE" -ForegroundColor Green
Write-Host "  Run '.\scripts\check-local-ai.ps1' to verify full stack health." -ForegroundColor Green
Write-Host "$('─' * 60)`n" -ForegroundColor DarkGray
