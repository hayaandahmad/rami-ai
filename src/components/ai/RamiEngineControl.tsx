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
  estimated?: {
    label?: string;
    budgetUsd?: number;
    usedUsd?: number;
    remainingUsd?: number;
    t4TimeRemainingHms?: string | null;
  };
  REMOTE_FACT?: { num_total_runners?: number };
}

const POS_KEY = 'rami-engine-panel-pos-v1';
const EXPANDED_KEY = 'rami-engine-panel-expanded-v1';

function stateLabel(s: EngineState | undefined): string {
  switch (s) {
    case 'STARTING':
      return 'STARTING GPU';
    case 'LOADING':
      return 'LOADING MODEL';
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
    const s = Math.floor(idleSec);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  }
  if (!iso) return '—';
  const sec = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

function clampPos(x: number, y: number, w: number, h: number) {
  const maxX = Math.max(8, window.innerWidth - w - 8);
  const maxY = Math.max(8, window.innerHeight - h - 8);
  return {
    x: Math.min(maxX, Math.max(8, x)),
    y: Math.min(maxY, Math.max(8, y)),
  };
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

  const state = (status.state || status.LOCAL_TRACKED_STATE || 'OFF') as EngineState;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/status', { cache: 'no-store' });
      const data = (await res.json()) as EngineStatus;
      setStatus(data);
    } catch {
      setStatus((prev) => ({ ...prev, state: prev.state ?? 'ERROR', lastError: 'Status unavailable' }));
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

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button,a,input')) return;
    movedRef.current = false;
    dragRef.current = { ox: e.clientX, oy: e.clientY, px: pos.x, py: pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.ox;
    const dy = e.clientY - dragRef.current.oy;
    if (Math.abs(dx) + Math.abs(dy) > 4) movedRef.current = true;
    const el = panelRef.current;
    const w = el?.offsetWidth ?? 220;
    const h = el?.offsetHeight ?? 48;
    const next = clampPos(dragRef.current.px + dx, dragRef.current.py + dy, w, h);
    setPos(next);
  };

  const onPointerUp = () => {
    if (dragRef.current) {
      localStorage.setItem(POS_KEY, JSON.stringify(pos));
    }
    dragRef.current = null;
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
    }
  };

  const isWarm =
    state === 'READY' ||
    state === 'BUSY' ||
    state === 'STARTING' ||
    state === 'LOADING' ||
    state === 'WARMING_UP' ||
    state === 'SHUTTING_DOWN';

  return (
    <div
      ref={panelRef}
      className="rami-engine-control"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="region"
      aria-label="Rami AI engine control"
    >
      {!expanded ? (
        <button
          type="button"
          className="rami-engine-pill"
          onClick={toggleExpand}
          aria-expanded={false}
        >
          <span className={`rami-engine-dot rami-engine-dot--${state.toLowerCase()}`} aria-hidden />
          <span className="rami-engine-pill-text">
            Rami · {stateLabel(state)}
          </span>
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
              <dd>{status.provider === 'modal' ? 'Modal' : 'Local Ollama'}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>{status.modelLabel || status.model || 'Qwen3 8B'}</dd>
            </div>
            <div>
              <dt>GPU</dt>
              <dd>{status.gpu || (status.provider === 'modal' ? '— (off)' : 'Local')}</dd>
            </div>
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

          {status.estimated && (
            <div className="rami-engine-est">
              <div className="rami-engine-est-title">Estimated usage</div>
              <div>This session / total used: ${status.estimated.usedUsd?.toFixed(2) ?? '0.00'}</div>
              <div>
                Remaining of ${status.estimated.budgetUsd?.toFixed(2) ?? '1.00'} budget:{' '}
                ${status.estimated.remainingUsd?.toFixed(2) ?? '—'}
              </div>
              <div>T4 time remaining: {status.estimated.t4TimeRemainingHms || '—'}</div>
              <div className="rami-engine-est-note">{status.estimated.label}</div>
            </div>
          )}

          <div className="rami-engine-perf">
            <div>Cold start: {status.lastColdStartSeconds != null ? `${status.lastColdStartSeconds.toFixed(1)}s` : '—'}</div>
            <div>
              TTFT:{' '}
              {status.lastTtftSeconds != null ? `${status.lastTtftSeconds.toFixed(2)}s` : 'N/A'}
            </div>
            <div>
              Last response:{' '}
              {status.lastResponseSeconds != null ? `${status.lastResponseSeconds.toFixed(2)}s` : '—'}
            </div>
            <div>
              Tokens/sec:{' '}
              {status.lastTokensPerSec != null ? status.lastTokensPerSec.toFixed(1) : '—'}
            </div>
          </div>

          {state === 'ERROR' && (
            <div className="rami-engine-error">
              <div>Rami failed to start</div>
              {showDetails && status.lastError && <pre>{status.lastError}</pre>}
              <div className="rami-engine-actions">
                <button type="button" onClick={() => void start()} disabled={busyAction}>
                  Retry
                </button>
                <button type="button" onClick={() => setShowDetails((v) => !v)}>
                  Details
                </button>
              </div>
            </div>
          )}

          <div className="rami-engine-actions">
            {(state === 'OFF' || state === 'ERROR') && status.provider === 'modal' && (
              <button
                type="button"
                className="rami-engine-btn-primary"
                onClick={() => void start()}
                disabled={busyAction}
              >
                Start Rami
              </button>
            )}
            {isWarm && status.provider === 'modal' && (
              <button
                type="button"
                className="rami-engine-btn-danger"
                onClick={() => void stop()}
                disabled={busyAction || state === 'SHUTTING_DOWN'}
              >
                Stop Rami
              </button>
            )}
            {(state === 'READY' || state === 'BUSY') && (
              <button type="button" onClick={() => void extend()} disabled={busyAction}>
                Extend +1 hour
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
