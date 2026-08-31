'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type EngineState =
  | 'OFF'
  | 'STARTING'
  | 'LOADING'
  | 'WARMING_UP'
  | 'READY'
  | 'BUSY'
  | 'SHUTTING_DOWN'
  | 'ERROR';

interface EngineStatus {
  state?: EngineState;
  LOCAL_TRACKED_STATE?: EngineState;
  provider?: string;
  modelLabel?: string;
  model?: string;
  gpu?: string | null;
  sessionDurationHms?: string | null;
  idleRemainingHms?: string | null;
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

const POS_KEY = 'rami-engine-panel-pos-v1';
const EXPANDED_KEY = 'rami-engine-panel-expanded-v1';
const DRAG_THRESHOLD_PX = 5;

function stateLabel(s: EngineState | undefined): string {
  switch (s) {
    case 'STARTING':
      return 'STARTING';
    case 'LOADING':
      return 'LOADING';
    case 'WARMING_UP':
      return 'WARMING UP';
    case 'SHUTTING_DOWN':
      return 'SHUTTING DOWN';
    default:
      return s ?? 'OFF';
  }
}

function formatAgo(iso: string | null | undefined, idleSec?: number | null): string {
  if (idleSec != null && Number.isFinite(idleSec)) {
    const sec = Math.floor(idleSec);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    return `${Math.floor(sec / 3600)}h ago`;
  }
  if (!iso) return '—';
  const sec = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `$${value.toFixed(4)}`;
}

function clampPos(x: number, y: number, w: number, h: number) {
  const maxX = Math.max(8, window.innerWidth - w - 8);
  const maxY = Math.max(8, window.innerHeight - h - 8);
  return {
    x: Math.min(maxX, Math.max(8, x)),
    y: Math.min(maxY, Math.max(8, y)),
  };
}

function isModalProvider(provider?: string): boolean {
  return provider === 'modal';
}

export function RamiEngineControl() {
  const [status, setStatus] = useState<EngineStatus>({ state: 'OFF' });
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState({ x: 24, y: 24 });
  const [busyAction, setBusyAction] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const dragRef = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const movedRef = useRef(false);
  const posRef = useRef(pos);

  const state = (status.state || status.LOCAL_TRACKED_STATE || 'OFF') as EngineState;
  const modal = isModalProvider(status.provider);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/status', { cache: 'no-store' });
      const data = (await res.json()) as EngineStatus;
      setStatus(data);
    } catch {
      setStatus((prev) => ({
        ...prev,
        state: prev.state ?? 'ERROR',
        lastError: 'Status unavailable',
      }));
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { x: number; y: number };
        if (typeof p.x === 'number' && typeof p.y === 'number') setPos(p);
      }
      const ex = localStorage.getItem(EXPANDED_KEY);
      if (ex === '1') setExpanded(true);
    } catch {
      /* ignore */
    }
    void refresh();
    const id = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const onResize = () => {
      const el = panelRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos((p) => {
        const next = clampPos(p.x, p.y, rect.width || 220, rect.height || 48);
        localStorage.setItem(POS_KEY, JSON.stringify(next));
        return next;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const beginDrag = (clientX: number, clientY: number) => {
    movedRef.current = false;
    dragRef.current = { ox: clientX, oy: clientY, px: posRef.current.x, py: posRef.current.y };
  };

  const moveDrag = (clientX: number, clientY: number) => {
    if (!dragRef.current) return;
    const dx = clientX - dragRef.current.ox;
    const dy = clientY - dragRef.current.oy;
    if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD_PX) movedRef.current = true;
    const el = panelRef.current;
    const w = el?.offsetWidth ?? 220;
    const h = el?.offsetHeight ?? 48;
    const next = clampPos(dragRef.current.px + dx, dragRef.current.py + dy, w, h);
    setPos(next);
  };

  const endDrag = () => {
    if (dragRef.current) {
      localStorage.setItem(POS_KEY, JSON.stringify(posRef.current));
    }
    dragRef.current = null;
  };

  const onShellPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button,a,input')) return;
    beginDrag(e.clientX, e.clientY);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onShellPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    moveDrag(e.clientX, e.clientY);
  };

  const onShellPointerUp = () => {
    endDrag();
  };

  const onPillPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    beginDrag(e.clientX, e.clientY);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPillPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    moveDrag(e.clientX, e.clientY);
  };

  const onPillPointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    endDrag();
    if (!movedRef.current) {
      setExpanded((v) => {
        const next = !v;
        localStorage.setItem(EXPANDED_KEY, next ? '1' : '0');
        return next;
      });
    }
  };

  const toggleExpand = () => {
    if (movedRef.current) return;
    setExpanded((v) => {
      const next = !v;
      localStorage.setItem(EXPANDED_KEY, next ? '1' : '0');
      return next;
    });
  };

  const start = async () => {
    setBusyAction(true);
    setStatus((s) => ({ ...s, state: 'STARTING' }));
    try {
      const res = await fetch('/api/ai/start', { method: 'POST' });
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      setStatus((s) => ({
        ...s,
        state: 'ERROR',
        lastError: err instanceof Error ? err.message : 'Start failed',
      }));
    } finally {
      setBusyAction(false);
      void refresh();
    }
  };

  const stop = async () => {
    setBusyAction(true);
    setStatus((s) => ({ ...s, state: 'SHUTTING_DOWN' }));
    try {
      const res = await fetch('/api/ai/stop', { method: 'POST' });
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      setStatus((s) => ({
        ...s,
        state: 'ERROR',
        lastError: err instanceof Error ? err.message : 'Stop failed',
      }));
    } finally {
      setBusyAction(false);
      void refresh();
    }
  };

  const extend = async () => {
    setBusyAction(true);
    try {
      const res = await fetch('/api/ai/extend', { method: 'POST' });
      const data = await res.json();
      setStatus(data);
    } finally {
      setBusyAction(false);
      void refresh();
    }
  };

  const isWarm =
    state === 'READY' ||
    state === 'BUSY' ||
    state === 'STARTING' ||
    state === 'LOADING' ||
    state === 'WARMING_UP' ||
    state === 'SHUTTING_DOWN';

  const showPerformance =
    status.lastColdStartSeconds != null ||
    status.lastTtftSeconds != null ||
    status.lastResponseSeconds != null ||
    status.lastTokensPerSec != null;

  const showModalSession =
    modal &&
    (status.sessionDurationHms ||
      status.requestCountSession != null ||
      status.session?.estimatedCostUsd != null);

  const showLocalRuntime = !modal;

  return (
    <div
      ref={panelRef}
      className="rami-engine-control"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={expanded ? onShellPointerDown : undefined}
      onPointerMove={expanded ? onShellPointerMove : undefined}
      onPointerUp={expanded ? onShellPointerUp : undefined}
      onPointerCancel={expanded ? onShellPointerUp : undefined}
      role="region"
      aria-label="Rami AI engine control"
    >
      {!expanded ? (
        <button
          type="button"
          className="rami-engine-pill"
          onPointerDown={onPillPointerDown}
          onPointerMove={onPillPointerMove}
          onPointerUp={onPillPointerUp}
          onPointerCancel={onPillPointerUp}
          aria-expanded={false}
        >
          <span className={`rami-engine-dot rami-engine-dot--${state.toLowerCase()}`} aria-hidden />
          <span className="rami-engine-pill-text">Rami · {stateLabel(state)}</span>
        </button>
      ) : (
        <div className="rami-engine-panel">
          <div className="rami-engine-panel-head">
            <button type="button" className="rami-engine-panel-title" onClick={toggleExpand}>
              <span className={`rami-engine-dot rami-engine-dot--${state.toLowerCase()}`} aria-hidden />
              Rami AI Engine
            </button>
            <button type="button" className="rami-engine-icon-btn" onClick={toggleExpand} aria-label="Collapse">
              −
            </button>
          </div>

          <dl className="rami-engine-meta">
            <div>
              <dt>State</dt>
              <dd>{stateLabel(state)}</dd>
            </div>
            <div>
              <dt>Provider</dt>
              <dd>{modal ? 'Modal' : 'Local Ollama'}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>{status.modelLabel || status.model || '—'}</dd>
            </div>
            <div>
              <dt>{modal ? 'GPU' : 'Runtime'}</dt>
              <dd>{modal ? status.gpu || '—' : 'Local'}</dd>
            </div>
          </dl>

          {showLocalRuntime && (
            <dl className="rami-engine-meta">
              <div>
                <dt>Ollama reachable</dt>
                <dd>{status.endpointReachable ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt>Model installed</dt>
                <dd>{status.defaultModelAvailable ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          )}

          {modal && (
            <dl className="rami-engine-meta">
              <div>
                <dt>Session</dt>
                <dd>{status.sessionDurationHms || '—'}</dd>
              </div>
              <div>
                <dt>Last activity</dt>
                <dd>{formatAgo(status.lastInferenceAt, status.idleSec)}</dd>
              </div>
              <div>
                <dt>Idle auto-shutdown</dt>
                <dd>{status.idleRemainingHms || '—'}</dd>
              </div>
            </dl>
          )}

          {showModalSession && (
            <div className="rami-engine-est">
              <div className="rami-engine-est-title">Current RAMI session</div>
              {status.sessionDurationHms && <div>Duration: {status.sessionDurationHms}</div>}
              {status.requestCountSession != null && (
                <div>Requests: {status.requestCountSession}</div>
              )}
              {status.session?.estimatedCostUsd != null && (
                <div>
                  Session cost ({status.session.estimatedLabel ?? 'estimated'}):{' '}
                  {formatUsd(status.session.estimatedCostUsd)}
                </div>
              )}
            </div>
          )}

          {modal && status.billingNote && (
            <p className="rami-engine-est-note">{status.billingNote}</p>
          )}

          {showPerformance && (
            <div className="rami-engine-perf">
              <div className="rami-engine-est-title">Performance</div>
              <div>
                Cold start:{' '}
                {status.lastColdStartSeconds != null
                  ? `${status.lastColdStartSeconds.toFixed(1)}s`
                  : '—'}
              </div>
              <div>
                TTFT:{' '}
                {status.lastTtftSeconds != null ? `${status.lastTtftSeconds.toFixed(2)}s` : '—'}
              </div>
              <div>
                Last response:{' '}
                {status.lastResponseSeconds != null
                  ? `${status.lastResponseSeconds.toFixed(2)}s`
                  : '—'}
              </div>
              <div>
                Tokens/sec:{' '}
                {status.lastTokensPerSec != null ? status.lastTokensPerSec.toFixed(1) : '—'}
              </div>
            </div>
          )}

          {state === 'ERROR' && (
            <div className="rami-engine-error">
              <div>{modal ? 'Rami failed to start' : 'Ollama is not ready'}</div>
              {showDetails && status.lastError && <pre>{status.lastError}</pre>}
              <div className="rami-engine-actions">
                {modal ? (
                  <button type="button" onClick={() => void start()} disabled={busyAction}>
                    Retry
                  </button>
                ) : (
                  <button type="button" onClick={() => void refresh()} disabled={busyAction}>
                    Refresh
                  </button>
                )}
                <button type="button" onClick={() => setShowDetails((v) => !v)}>
                  Details
                </button>
              </div>
            </div>
          )}

          {!modal && status.runtimeNote && state !== 'ERROR' && (
            <p className="rami-engine-est-note">{status.runtimeNote}</p>
          )}

          <div className="rami-engine-actions">
            {modal && (state === 'OFF' || state === 'ERROR') && (
              <button
                type="button"
                className="rami-engine-btn-primary"
                onClick={() => void start()}
                disabled={busyAction}
              >
                Start Rami
              </button>
            )}
            {modal && isWarm && (
              <button
                type="button"
                className="rami-engine-btn-danger"
                onClick={() => void stop()}
                disabled={busyAction || state === 'SHUTTING_DOWN'}
              >
                Stop Rami
              </button>
            )}
            {modal && (state === 'READY' || state === 'BUSY') && (
              <button type="button" onClick={() => void extend()} disabled={busyAction}>
                Extend +1 hour
              </button>
            )}
            {!modal && (
              <button type="button" onClick={() => void refresh()} disabled={busyAction}>
                Refresh status
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
