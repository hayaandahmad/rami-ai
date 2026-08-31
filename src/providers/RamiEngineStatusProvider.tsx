'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { formatActivityAgo, formatEngineHms } from '@/utils/engineDisplay';

export type EngineState =
  | 'OFF'
  | 'STARTING'
  | 'LOADING'
  | 'WARMING_UP'
  | 'READY'
  | 'BUSY'
  | 'SHUTTING_DOWN'
  | 'ERROR';

export interface EngineStatusPayload {
  state?: EngineState;
  LOCAL_TRACKED_STATE?: EngineState;
  provider?: string;
  modelLabel?: string;
  model?: string;
  gpu?: string | null;
  sessionDurationHms?: string | null;
  idleRemainingHms?: string | null;
  maxSessionRemainingHms?: string | null;
  sessionDurationSec?: number | null;
  idleRemainingSec?: number | null;
  maxSessionRemainingSec?: number | null;
  lastInferenceAt?: string | null;
  idleSec?: number | null;
  lastColdStartSeconds?: number | null;
  lastTtftSeconds?: number | null;
  lastResponseSeconds?: number | null;
  lastTokensPerSec?: number | null;
  lastError?: string | null;
  requestCountSession?: number;
  endpointReachable?: boolean;
  defaultModelAvailable?: boolean;
  runtimeNote?: string | null;
  session?: {
    durationHms?: string | null;
    requestCount?: number;
    estimatedCostUsd?: number | null;
    estimatedLabel?: string;
  };
  billingNote?: string | null;
}

export interface EngineDisplayTimers {
  sessionDurationHms: string | null;
  idleRemainingHms: string | null;
  maxSessionRemainingHms: string | null;
  lastActivityLabel: string;
}

interface SyncSnapshot {
  receivedAt: number;
  sessionDurationSec: number | null;
  idleRemainingSec: number | null;
  maxSessionRemainingSec: number | null;
  idleSec: number | null;
}

interface RamiEngineStatusContextValue {
  status: EngineStatusPayload;
  displayTimers: EngineDisplayTimers;
  state: EngineState;
  isModalProvider: boolean;
  /** Modal engine intentionally stopped (OFF). */
  isModalStopped: boolean;
  /** Modal engine runtime failure (ERROR). */
  isModalError: boolean;
  /** Modal engine not usable for AI work (OFF or ERROR). */
  isModalEngineUnavailable: boolean;
  /** @deprecated Use isModalStopped or isModalEngineUnavailable */
  isModalOff: boolean;
  isModalReady: boolean;
  refresh: () => Promise<void>;
  mergeStatus: (partial: EngineStatusPayload) => void;
}

const RamiEngineStatusContext = createContext<RamiEngineStatusContextValue | null>(null);

const POLL_MS = 5000;
const TICK_MS = 1000;

function resolveState(status: EngineStatusPayload): EngineState {
  return (status.state || status.LOCAL_TRACKED_STATE || 'OFF') as EngineState;
}

function snapshotFromStatus(status: EngineStatusPayload, receivedAt: number): SyncSnapshot {
  return {
    receivedAt,
    sessionDurationSec:
      typeof status.sessionDurationSec === 'number' ? status.sessionDurationSec : null,
    idleRemainingSec:
      typeof status.idleRemainingSec === 'number' ? status.idleRemainingSec : null,
    maxSessionRemainingSec:
      typeof status.maxSessionRemainingSec === 'number' ? status.maxSessionRemainingSec : null,
    idleSec: typeof status.idleSec === 'number' ? status.idleSec : null,
  };
}

function interpolateTimers(snapshot: SyncSnapshot, state: EngineState, now: number): EngineDisplayTimers {
  const elapsed = Math.max(0, (now - snapshot.receivedAt) / 1000);
  const sessionActive =
    state === 'READY' ||
    state === 'BUSY' ||
    state === 'STARTING' ||
    state === 'LOADING' ||
    state === 'WARMING_UP';
  const idleTickable = state === 'READY' || state === 'BUSY';

  let sessionDurationSec = snapshot.sessionDurationSec;
  if (sessionDurationSec != null && sessionActive) {
    sessionDurationSec += elapsed;
  }

  let idleRemainingSec = snapshot.idleRemainingSec;
  if (idleRemainingSec != null && idleTickable) {
    idleRemainingSec = Math.max(0, idleRemainingSec - elapsed);
  }

  let maxSessionRemainingSec = snapshot.maxSessionRemainingSec;
  if (maxSessionRemainingSec != null && idleTickable) {
    maxSessionRemainingSec = Math.max(0, maxSessionRemainingSec - elapsed);
  }

  let idleSec = snapshot.idleSec;
  if (idleSec != null && idleTickable) {
    idleSec += elapsed;
  }

  return {
    sessionDurationHms: formatEngineHms(sessionDurationSec),
    idleRemainingHms: formatEngineHms(idleRemainingSec),
    maxSessionRemainingHms: formatEngineHms(maxSessionRemainingSec),
    lastActivityLabel: formatActivityAgo(idleSec),
  };
}

export function RamiEngineStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<EngineStatusPayload>({ state: 'OFF' });
  const [tick, setTick] = useState(0);
  const syncRef = useRef<SyncSnapshot>(snapshotFromStatus({ state: 'OFF' }, Date.now()));

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/status', { cache: 'no-store' });
      const data = (await res.json()) as EngineStatusPayload;
      const receivedAt = Date.now();
      syncRef.current = snapshotFromStatus(data, receivedAt);
      setStatus(data);
    } catch {
      setStatus((prev) => ({
        ...prev,
        state: prev.state ?? 'ERROR',
        lastError: 'Status unavailable',
      }));
    }
  }, []);

  const mergeStatus = useCallback((partial: EngineStatusPayload) => {
    const receivedAt = Date.now();
    setStatus((prev) => {
      const next = { ...prev, ...partial };
      syncRef.current = snapshotFromStatus(next, receivedAt);
      return next;
    });
  }, []);

  useEffect(() => {
    void refresh();
    const pollId = window.setInterval(() => void refresh(), POLL_MS);
    const tickId = window.setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => {
      window.clearInterval(pollId);
      window.clearInterval(tickId);
    };
  }, [refresh]);

  const state = resolveState(status);
  const isModalProvider = status.provider === 'modal';
  const isModalStopped = isModalProvider && state === 'OFF';
  const isModalError = isModalProvider && state === 'ERROR';
  const isModalEngineUnavailable = isModalProvider && (state === 'OFF' || state === 'ERROR');
  const isModalOff = isModalStopped;
  const isModalReady = isModalProvider && (state === 'READY' || state === 'BUSY');

  const displayTimers = useMemo(() => {
    void tick;
    return interpolateTimers(syncRef.current, state, Date.now());
  }, [tick, state]);

  const value = useMemo(
    () => ({
      status,
      displayTimers,
      state,
      isModalProvider,
      isModalStopped,
      isModalError,
      isModalEngineUnavailable,
      isModalOff,
      isModalReady,
      refresh,
      mergeStatus,
    }),
    [
      status,
      displayTimers,
      state,
      isModalProvider,
      isModalStopped,
      isModalError,
      isModalEngineUnavailable,
      isModalOff,
      isModalReady,
      refresh,
      mergeStatus,
    ],
  );

  return (
    <RamiEngineStatusContext.Provider value={value}>{children}</RamiEngineStatusContext.Provider>
  );
}

export function useRamiEngineStatus(): RamiEngineStatusContextValue {
  const ctx = useContext(RamiEngineStatusContext);
  if (!ctx) {
    throw new Error('useRamiEngineStatus must be used within RamiEngineStatusProvider');
  }
  return ctx;
}
