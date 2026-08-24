<#
.SYNOPSIS
    Rami local AI health-check script.
.DESCRIPTION
    Verifies Ollama is running, configured models are installed,
    and a minimal structured-output inference round-trip succeeds.
    Exit code 0 = all checks pass. Exit code 1 = one or more checks failed.
    Compatible with PowerShell 5.1+.
.EXAMPLE
    .\scripts\check-local-ai.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'SilentlyContinue'

$ManifestPath = Join-Path $PSScriptRoot '..\config\model-manifest.json'

$allPassed = $true

function Write-Check {
    param([string]$label, [bool]$ok, [string]$detail)
    if ($ok) {
        Write-Host "  [PASS] $label" -ForegroundColor Green
        if ($detail) { Write-Host "         $detail" -ForegroundColor DarkGray }
    } else {
        Write-Host "  [FAIL] $label" -ForegroundColor Red
        if ($detail) { Write-Host "         $detail" -ForegroundColor Yellow }
        $script:allPassed = $false
    }
}

Write-Host ""
Write-Host "=== Rami Local AI Health Check ===" -ForegroundColor Cyan

# ── 1. Manifest ──────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[1] Model manifest" -ForegroundColor Cyan
$manifest = $null

if (Test-Path $ManifestPath) {
    $parseOk = $false
    try {
        $manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
        $parseOk = $true
    } catch {
        Write-Check "Manifest file readable" $false "Parse error: $_"
    }
    if ($parseOk) {
        Write-Check "Manifest file readable" $true $ManifestPath
        Write-Check "provider = ollama" ($manifest.provider -eq 'ollama') "$($manifest.provider)"
        $urlSet = -not [string]::IsNullOrEmpty($manifest.inferenceBaseUrl)
        Write-Check "inferenceBaseUrl set" $urlSet "$($manifest.inferenceBaseUrl)"
        $defaultSet = -not [string]::IsNullOrEmpty($manifest.models.default)
        Write-Check "models.default set" $defaultSet "$($manifest.models.default)"
        $lightSet = -not [string]::IsNullOrEmpty($manifest.models.lightweight)
        Write-Check "models.lightweight set" $lightSet "$($manifest.models.lightweight)"
    }
} else {
    Write-Check "Manifest file exists" $false "Not found at $ManifestPath -- run setup-local-ai.ps1"
}

$ollamaUrl = if ($null -ne $manifest -and -not [string]::IsNullOrEmpty($manifest.inferenceBaseUrl)) {
    $manifest.inferenceBaseUrl
} else {
    'http://localhost:11434'
}
$defaultModel = if ($null -ne $manifest -and -not [string]::IsNullOrEmpty($manifest.models.default)) {
    $manifest.models.default
} else {
    'qwen3:8b'
}
$lightweightModel = if ($null -ne $manifest -and -not [string]::IsNullOrEmpty($manifest.models.lightweight)) {
    $manifest.models.lightweight
} else {
    'qwen3:4b'
}

# ── 2. Ollama executable ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "[2] Ollama executable" -ForegroundColor Cyan
$ollamaExe = Get-Command ollama -ErrorAction SilentlyContinue
$ollamaFound = $null -ne $ollamaExe
$ollamaSource = if ($ollamaFound) { $ollamaExe.Source } else { '' }
Write-Check "ollama in PATH" $ollamaFound $ollamaSource

if ($ollamaFound) {
    $version = (& ollama --version 2>&1) -join ''
    Write-Check "ollama version reported" ($version -ne '') $version
}

# ── 3. Service reachability ──────────────────────────────────────────────────
Write-Host ""
Write-Host "[3] Ollama service ($ollamaUrl)" -ForegroundColor Cyan
$tagsJson = $null
$endpointOk = $false
try {
    $resp = Invoke-WebRequest -Uri "$ollamaUrl/api/tags" -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
    if ($resp.StatusCode -eq 200) {
        $endpointOk = $true
        $tagsJson = $resp.Content | ConvertFrom-Json
    }
    Write-Check "Endpoint reachable" $endpointOk "HTTP $($resp.StatusCode)"
} catch {
    Write-Check "Endpoint reachable" $false "Cannot connect to $ollamaUrl -- is Ollama running? (ollama serve)"
}

# ── 4. Model availability ────────────────────────────────────────────────────
Write-Host ""
Write-Host "[4] Model availability" -ForegroundColor Cyan
$installedNames = @()
if ($null -ne $tagsJson) {
    $installedNames = @($tagsJson.models | ForEach-Object { $_.name })
}

function Test-ModelInstalled {
    param([string]$tag)
    if ($installedNames -contains $tag) { return $true }
    if (-not $tag.Contains(':')) {
        if ($installedNames -contains "$tag:latest") { return $true }
    }
    return $false
}

$defaultOk = Test-ModelInstalled $defaultModel
$defaultMsg = if (-not $defaultOk) { "Run: ollama pull $defaultModel" } else { '' }
Write-Check "Default model installed: $defaultModel" $defaultOk $defaultMsg

$lightweightOk = Test-ModelInstalled $lightweightModel
$lightMsg = if (-not $lightweightOk) { "Run: ollama pull $lightweightModel (optional fallback)" } else { '' }
Write-Check "Lightweight model installed: $lightweightModel" $lightweightOk $lightMsg

# ── 5. Structured inference smoke test ───────────────────────────────────────
Write-Host ""
Write-Host "[5] Structured inference smoke test" -ForegroundColor Cyan

$canSmoke = $endpointOk -and $defaultOk
if (-not $canSmoke) {
    Write-Check "Smoke test" $false "Skipped -- service or model unavailable (see above)"
} else {
    $schemaObj = @{
        type = "object"
        properties = @{
            intent  = @{ type = "string" }
            summary = @{ type = "string" }
        }
        required = @("intent", "summary")
    }
    $bodyObj = @{
        model   = $defaultModel
        stream  = $false
        format  = $schemaObj
        options = @{ temperature = 0 }
        messages = @(
            @{
                role    = "user"
                content = "We need to prepare an RFP for a new digital service."
            }
        )
    }
    $bodyStr = $bodyObj | ConvertTo-Json -Depth 6

    $smokeOk = $false
    $smokeDetail = ''
    try {
        $smokeResp = Invoke-WebRequest -Uri "$ollamaUrl/api/chat" `
            -Method POST -Body $bodyStr -ContentType "application/json" `
            -UseBasicParsing -TimeoutSec 120 -ErrorAction Stop

        if ($smokeResp.StatusCode -eq 200) {
            $smokeJson = $smokeResp.Content | ConvertFrom-Json
            $content = $smokeJson.message.content
            $parsedOk = $false
            try {
                $parsed = $content | ConvertFrom-Json -ErrorAction Stop
                $parsedOk = $true
            } catch {
                $smokeDetail = "JSON parse error: $content"
            }
            if ($parsedOk) {
                $hasIntent  = [bool]($parsed.PSObject.Properties.Name -contains 'intent')
                $hasSummary = [bool]($parsed.PSObject.Properties.Name -contains 'summary')
                $smokeOk = $hasIntent -and $hasSummary
                if ($smokeOk) {
                    $maxLen = [Math]::Min(60, $parsed.intent.Length)
                    $intentPreview = $parsed.intent.Substring(0, $maxLen)
                    $smokeDetail = "intent='${intentPreview}...'"
                } else {
                    $smokeDetail = "Missing required fields - got: $content"
                }
            }
        } else {
            $smokeDetail = "HTTP $($smokeResp.StatusCode)"
        }
    } catch {
        $smokeDetail = "Error: $_"
    }
    Write-Check "Schema-valid structured output returned" $smokeOk $smokeDetail
}

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host ('─' * 50) -ForegroundColor DarkGray
if ($allPassed) {
    Write-Host "  ALL CHECKS PASSED -- local AI stack is healthy." -ForegroundColor Green
    exit 0
} else {
    Write-Host "  SOME CHECKS FAILED -- see above for details." -ForegroundColor Red
    exit 1
}
