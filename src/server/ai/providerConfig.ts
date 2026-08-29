/**
 * AI provider selection — server-only env.
 * RAMI_MODEL_PROVIDER=local|modal (default local for safety)
 */

export type RamiProviderKind = 'local' | 'modal';

export function getConfiguredProviderKind(): RamiProviderKind {
  const raw = (process.env.RAMI_MODEL_PROVIDER ?? 'local').trim().toLowerCase();
  return raw === 'modal' ? 'modal' : 'local';
}

export function getModalPythonPath(): string {
  return (
    process.env.RAMI_MODAL_PYTHON?.trim() ||
    // Windows default for this repo's isolated venv
    (process.platform === 'win32'
      ? '.venv-modal\\Scripts\\python.exe'
      : '.venv-modal/bin/python')
  );
}

export function getModalBridgeScript(): string {
  return process.env.RAMI_MODAL_BRIDGE?.trim() || 'infra/modal-poc/bridge.py';
}

/** Official Modal T4 rate used for ESTIMATES only. */
export function getT4UsdPerSec(): number {
  const n = Number(process.env.MODAL_T4_USD_PER_SEC ?? '0.000164');
  return Number.isFinite(n) && n > 0 ? n : 0.000164;
}

export function getDevCreditBudgetUsd(): number {
  const n = Number(process.env.MODAL_DEV_CREDIT_BUDGET ?? '1.00');
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

/** Idle auto-stop while READY (development default 15 minutes). */
export function getIdleTimeoutSec(): number {
  const n = Number(process.env.RAMI_MODAL_IDLE_SEC ?? '900');
  return Number.isFinite(n) && n > 0 ? n : 900;
}

/** Max warm session before forced stop unless extended (default 2 hours). */
export function getMaxSessionSec(): number {
  const n = Number(process.env.RAMI_MODAL_MAX_SESSION_SEC ?? '7200');
  return Number.isFinite(n) && n > 0 ? n : 7200;
}

export function getExtendSessionSec(): number {
  const n = Number(process.env.RAMI_MODAL_EXTEND_SEC ?? '3600');
  return Number.isFinite(n) && n > 0 ? n : 3600;
}

export const MODAL_MODEL_LABEL = 'Qwen3 8B Q4_K_M';
export const MODAL_GPU_LABEL = 'NVIDIA T4 16 GB';
export const MODAL_MODEL_TAG = 'qwen3:8b';
