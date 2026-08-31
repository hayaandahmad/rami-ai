/**
 * Modal engine control plane — local session state + remote Modal facts.
 * Idle / max-session / lease enforced server-side on every status/start/chat touch.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { runModalBridge } from './modalBridge';
import {
  getConfiguredProviderKind,
  getExtendSessionSec,
  getIdleTimeoutSec,
  getMaxSessionSec,
  getT4UsdPerSec,
  MODAL_GPU_LABEL,
  MODAL_MODEL_LABEL,
  MODAL_MODEL_TAG,
} from './providerConfig';

export type EngineState =
  | 'OFF'
  | 'STARTING'
  | 'LOADING'
  | 'WARMING_UP'
  | 'READY'
  | 'BUSY'
  | 'SHUTTING_DOWN'
  | 'ERROR';

export type ShutdownReason = 'manual' | 'idle_timeout' | 'max_session' | 'lease_expired' | 'health_failed' | null;

interface EngineStateFile {
  localState: EngineState;
  sessionStartedAt: string | null;
  lastInferenceAt: string | null;
  leaseExpiresAt: string | null;
  maxSessionExpiresAt: string | null;
  lastError: string | null;
  lastShutdownReason: ShutdownReason;
  lastColdStartSeconds: number | null;
  lastTtftSeconds: number | null;
  lastResponseSeconds: number | null;
  lastTokensPerSec: number | null;
  requestCountSession: number;
  startInFlight: boolean;
  remoteMinContainers: number | null;
}

interface UsageFile {
  t4UsdPerSec: number;
  /** Sum of completed warm session durations only (no double-count). */
  totalWarmGpuSeconds: number;
  lifetimeRequestCount: number;
  coldStartCount: number;
  sessions: Array<{ startedAt: string; stoppedAt?: string; durationSec?: number; coldStartSeconds?: number }>;
  updatedAt: string;
}

const DATA_DIR = join(process.cwd(), 'infra', 'modal-poc', '.usage');
const STATE_PATH = join(process.cwd(), 'infra', 'modal-poc', '.session-state.json');
const USAGE_PATH = join(DATA_DIR, 'engine-usage.json');

function nowMs(): number {
  return Date.now();
}

function iso(ms = nowMs()): string {
  return new Date(ms).toISOString();
}

function ensureDir(): void {
  mkdirSync(DATA_DIR, { recursive: true });
}

function defaultState(): EngineStateFile {
  return {
    localState: 'OFF',
    sessionStartedAt: null,
    lastInferenceAt: null,
    leaseExpiresAt: null,
    maxSessionExpiresAt: null,
    lastError: null,
    lastShutdownReason: null,
    lastColdStartSeconds: null,
    lastTtftSeconds: null,
    lastResponseSeconds: null,
    lastTokensPerSec: null,
    requestCountSession: 0,
    startInFlight: false,
    remoteMinContainers: null,
  };
}

function loadState(): EngineStateFile {
  try {
    if (!existsSync(STATE_PATH)) return defaultState();
    return { ...defaultState(), ...JSON.parse(readFileSync(STATE_PATH, 'utf8')) };
  } catch {
    return defaultState();
  }
}

function saveState(s: EngineStateFile): void {
  ensureDir();
  writeFileSync(STATE_PATH, JSON.stringify({ ...s, updatedAt: iso() }, null, 2), 'utf8');
}

function loadUsage(): UsageFile {
  ensureDir();
  const base: UsageFile = {
    t4UsdPerSec: getT4UsdPerSec(),
    totalWarmGpuSeconds: 0,
    lifetimeRequestCount: 0,
    coldStartCount: 0,
    sessions: [],
    updatedAt: iso(),
  };
  try {
    if (!existsSync(USAGE_PATH)) return base;
    return { ...base, ...JSON.parse(readFileSync(USAGE_PATH, 'utf8')) };
  } catch {
    return base;
  }
}

function saveUsage(u: UsageFile): void {
  ensureDir();
  u.t4UsdPerSec = getT4UsdPerSec();
  u.updatedAt = iso();
  writeFileSync(USAGE_PATH, JSON.stringify(u, null, 2), 'utf8');
}

function refreshLease(s: EngineStateFile): void {
  const idle = getIdleTimeoutSec();
  s.leaseExpiresAt = iso(nowMs() + idle * 1000);
}

/** Enforce idle / max / lease; may transition to OFF. */
export async function enforceTimeouts(s: EngineStateFile = loadState()): Promise<EngineStateFile> {
  if (s.localState !== 'READY' && s.localState !== 'BUSY') return s;
  const now = nowMs();

  if (s.leaseExpiresAt && now > Date.parse(s.leaseExpiresAt)) {
    return stopEngine('lease_expired');
  }
  if (s.lastInferenceAt || s.sessionStartedAt) {
    const last = Date.parse(s.lastInferenceAt || s.sessionStartedAt!);
    if (now - last >= getIdleTimeoutSec() * 1000) {
      return stopEngine('idle_timeout');
    }
  }
  if (s.maxSessionExpiresAt && now > Date.parse(s.maxSessionExpiresAt)) {
    return stopEngine('max_session');
  }
  return s;
}

export function markInferenceActivity(metrics?: {
  ttftSeconds?: number | null;
  responseSeconds?: number | null;
  tokensPerSec?: number | null;
}): void {
  const s = loadState();
  if (s.localState === 'READY' || s.localState === 'BUSY') {
    s.lastInferenceAt = iso();
    s.requestCountSession += 1;
    refreshLease(s);
    if (metrics?.ttftSeconds != null) s.lastTtftSeconds = metrics.ttftSeconds;
    if (metrics?.responseSeconds != null) s.lastResponseSeconds = metrics.responseSeconds;
    if (metrics?.tokensPerSec != null) s.lastTokensPerSec = metrics.tokensPerSec;
    saveState(s);
    const u = loadUsage();
    u.lifetimeRequestCount += 1;
    saveUsage(u);
  }
}

export function setBusy(busy: boolean): void {
  const s = loadState();
  if (s.localState === 'READY' && busy) {
    s.localState = 'BUSY';
    saveState(s);
  } else if (s.localState === 'BUSY' && !busy) {
    s.localState = 'READY';
    saveState(s);
  }
}

export async function startEngine(): Promise<Record<string, unknown>> {
  let s = loadState();
  s = await enforceTimeouts(s);

  if (s.localState === 'READY' || s.localState === 'BUSY') {
    return buildStatusPayload(s, { note: 'already_ready' });
  }
  if (s.startInFlight || s.localState === 'STARTING' || s.localState === 'WARMING_UP' || s.localState === 'LOADING') {
    return buildStatusPayload(s, { note: 'start_in_flight' });
  }

  s.localState = 'STARTING';
  s.startInFlight = true;
  s.lastError = null;
  s.lastShutdownReason = null;
  saveState(s);

  try {
    s.localState = 'LOADING';
    saveState(s);
    s.localState = 'WARMING_UP';
    saveState(s);

    const result = await runModalBridge<{
      ok: boolean;
      state?: string;
      error?: string;
      health?: Record<string, unknown>;
      cold_start_seconds?: number;
      remote?: Record<string, unknown>;
    }>({ op: 'start' }, 600_000);

    if (!result.ok) {
      s.localState = 'ERROR';
      s.startInFlight = false;
      s.lastError = result.error || 'health_failed';
      s.lastShutdownReason = 'health_failed';
      s.remoteMinContainers = 0;
      saveState(s);
      return buildStatusPayload(s, { remote: result.remote, health: result.health });
    }

    s.localState = 'READY';
    s.startInFlight = false;
    s.sessionStartedAt = iso();
    s.lastInferenceAt = s.sessionStartedAt;
    s.requestCountSession = 0;
    s.lastColdStartSeconds = result.cold_start_seconds ?? null;
    s.remoteMinContainers = 1;
    refreshLease(s);
    s.maxSessionExpiresAt = iso(nowMs() + getMaxSessionSec() * 1000);
    saveState(s);

    const u = loadUsage();
    u.coldStartCount += 1;
    u.sessions.push({
      startedAt: s.sessionStartedAt,
      coldStartSeconds: result.cold_start_seconds,
    });
    saveUsage(u);

    return buildStatusPayload(s, { remote: result.remote, health: result.health });
  } catch (err) {
    s.localState = 'ERROR';
    s.startInFlight = false;
    s.lastError = err instanceof Error ? err.message : String(err);
    saveState(s);
    try {
      await runModalBridge({ op: 'stop' }, 120_000);
    } catch {
      /* best-effort */
    }
    return buildStatusPayload(s);
  }
}

export async function stopEngine(reason: ShutdownReason = 'manual'): Promise<EngineStateFile> {
  const s = loadState();
  if (s.localState === 'OFF' && !s.startInFlight) {
    s.lastShutdownReason = reason ?? s.lastShutdownReason;
    saveState(s);
    return s;
  }

  s.localState = 'SHUTTING_DOWN';
  s.startInFlight = false;
  saveState(s);

  try {
    await runModalBridge({ op: 'stop' }, 120_000);
  } catch (err) {
    s.lastError = err instanceof Error ? err.message : String(err);
  }

  const started = s.sessionStartedAt ? Date.parse(s.sessionStartedAt) : null;
  const durationSec = started ? Math.max(0, (nowMs() - started) / 1000) : 0;

  if (started && durationSec > 0) {
    const u = loadUsage();
    u.totalWarmGpuSeconds += durationSec;
    const last = u.sessions[u.sessions.length - 1];
    if (last && !last.stoppedAt) {
      last.stoppedAt = iso();
      last.durationSec = durationSec;
    }
    saveUsage(u);
  }

  s.localState = 'OFF';
  s.remoteMinContainers = 0;
  s.sessionStartedAt = null;
  s.lastInferenceAt = null;
  s.leaseExpiresAt = null;
  s.maxSessionExpiresAt = null;
  s.requestCountSession = 0;
  s.lastShutdownReason = reason;
  saveState(s);
  return s;
}

export function extendSession(): Record<string, unknown> {
  const s = loadState();
  if (s.localState !== 'READY' && s.localState !== 'BUSY') {
    return buildStatusPayload(s, { note: 'not_ready_cannot_extend' });
  }
  const extendMs = getExtendSessionSec() * 1000;
  const base = s.maxSessionExpiresAt ? Date.parse(s.maxSessionExpiresAt) : nowMs();
  s.maxSessionExpiresAt = iso(Math.max(base, nowMs()) + extendMs);
  refreshLease(s);
  saveState(s);
  return buildStatusPayload(s, { note: 'extended' });
}

function formatHms(totalSec: number | null): string | null {
  if (totalSec == null || !Number.isFinite(totalSec) || totalSec < 0) return null;
  const s = Math.floor(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

export function buildStatusPayload(
  s: EngineStateFile = loadState(),
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const rate = getT4UsdPerSec();
  const now = nowMs();

  let sessionDurationSec: number | null = null;
  if (s.sessionStartedAt && (s.localState === 'READY' || s.localState === 'BUSY' || s.localState === 'STARTING')) {
    sessionDurationSec = (now - Date.parse(s.sessionStartedAt)) / 1000;
  }

  let idleSec: number | null = null;
  if (s.lastInferenceAt && (s.localState === 'READY' || s.localState === 'BUSY')) {
    idleSec = (now - Date.parse(s.lastInferenceAt)) / 1000;
  }

  let idleRemainingSec: number | null = null;
  if (s.leaseExpiresAt && (s.localState === 'READY' || s.localState === 'BUSY')) {
    idleRemainingSec = Math.max(0, (Date.parse(s.leaseExpiresAt) - now) / 1000);
  }

  let maxRemainingSec: number | null = null;
  if (s.maxSessionExpiresAt && (s.localState === 'READY' || s.localState === 'BUSY')) {
    maxRemainingSec = Math.max(0, (Date.parse(s.maxSessionExpiresAt) - now) / 1000);
  }

  const liveWarm = sessionDurationSec ?? 0;
  const sessionEstimatedUsd = liveWarm * rate;

  return {
    LOCAL_TRACKED_STATE: s.localState,
    state: s.localState,
    provider: getConfiguredProviderKind(),
    model: MODAL_MODEL_TAG,
    modelLabel: MODAL_MODEL_LABEL,
    gpu: s.localState === 'OFF' || s.localState === 'ERROR' ? null : MODAL_GPU_LABEL,
    sessionStartedAt: s.sessionStartedAt,
    sessionDurationSec,
    sessionDurationHms: formatHms(sessionDurationSec),
    lastInferenceAt: s.lastInferenceAt,
    idleSec,
    idleRemainingSec,
    idleRemainingHms: formatHms(idleRemainingSec),
    idleTimeoutSec: getIdleTimeoutSec(),
    maxSessionExpiresAt: s.maxSessionExpiresAt,
    maxSessionRemainingSec: maxRemainingSec,
    maxSessionRemainingHms: formatHms(maxRemainingSec),
    leaseExpiresAt: s.leaseExpiresAt,
    requestCountSession: s.requestCountSession,
    lastColdStartSeconds: s.lastColdStartSeconds,
    lastTtftSeconds: s.lastTtftSeconds,
    lastResponseSeconds: s.lastResponseSeconds,
    lastTokensPerSec: s.lastTokensPerSec,
    lastError: s.lastError,
    lastShutdownReason: s.lastShutdownReason,
    remoteMinContainersTracked: s.remoteMinContainers,
    session: {
      durationHms: formatHms(sessionDurationSec),
      requestCount: s.requestCountSession,
      estimatedCostUsd:
        sessionEstimatedUsd > 0 ? Number(sessionEstimatedUsd.toFixed(6)) : null,
      estimatedLabel: 'estimated session GPU time',
    },
    billingNote:
      'Account credits and workspace limits are managed by Modal and are not exposed through the current RAMI integration.',
    ...extra,
  };
}

export async function getEngineStatus(): Promise<Record<string, unknown>> {
  const s = await enforceTimeouts(loadState());
  let remote: Record<string, unknown> | undefined;
  try {
    if (getConfiguredProviderKind() === 'modal') {
      const st = await runModalBridge<{ remote?: Record<string, unknown> }>({ op: 'status' }, 60_000);
      remote = st.remote;
    }
  } catch (err) {
    remote = { remote_stats_error: err instanceof Error ? err.message : String(err) };
  }
  return buildStatusPayload(s, { REMOTE_FACT: remote });
}

export function isModalReadyForChat(): boolean {
  const s = loadState();
  return s.localState === 'READY' || s.localState === 'BUSY';
}

export function getEngineState(): EngineState {
  return loadState().localState;
}
