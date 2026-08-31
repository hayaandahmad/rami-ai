'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  useRamiEngineStatus,
  type EngineState,
  type EngineStatusPayload,
} from '@/providers/RamiEngineStatusProvider';

const POS_KEY = 'rami-engine-panel-pos-v1';
const EXPANDED_KEY = 'rami-engine-panel-expanded-v1';
const DRAG_THRESHOLD_PX = 5;

const MODAL_OFF_MESSAGE =
  'Rami AI Engine is off. Your project and RFP are safely saved. Start Rami to continue AI-assisted work.';

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

export function RamiEngineControl() {
  const {
    status,
    displayTimers,
    state,
    isModalProvider,
    isModalStopped,
    isModalError,
    refresh,
    mergeStatus,
  } = useRamiEngineStatus();
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState({ x: 24, y: 24 });
  const [busyAction, setBusyAction] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const dragRef = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const movedRef = useRef(false);
  const posRef = useRef(pos);
  const expandedRef = useRef(expanded);
  const draggingRef = useRef(false);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  const persistExpanded = useCallback((value: boolean) => {
    try {
      localStorage.setItem(EXPANDED_KEY, value ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const collapsePanel = useCallback(() => {
    movedRef.current = false;
    draggingRef.current = false;
    setExpanded(false);
    persistExpanded(false);
  }, [persistExpanded]);

  const expandPanel = useCallback(() => {
    movedRef.current = false;
    setExpanded(true);
    persistExpanded(true);
  }, [persistExpanded]);

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
  }, []);

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

  useEffect(() => {
    if (!expanded) return;

    const onPointerDown = (event: PointerEvent) => {
      const el = panelRef.current;
      if (!el || el.contains(event.target as Node)) return;
      if (draggingRef.current) return;
      collapsePanel();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') collapsePanel();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [expanded, collapsePanel]);

  const beginDrag = (clientX: number, clientY: number) => {
    movedRef.current = false;
    draggingRef.current = false;
    dragRef.current = { ox: clientX, oy: clientY, px: posRef.current.x, py: posRef.current.y };
  };

  const moveDrag = (clientX: number, clientY: number) => {
    if (!dragRef.current) return;
    const dx = clientX - dragRef.current.ox;
    const dy = clientY - dragRef.current.oy;
    if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD_PX) {
      movedRef.current = true;
      draggingRef.current = true;
    }
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
    window.setTimeout(() => {
      draggingRef.current = false;
    }, 0);
  };

  const onShellPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button,a,input,textarea,select')) return;
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
      expandPanel();
    }
    movedRef.current = false;
  };

  const applyActionResponse = useCallback(
    (data: EngineStatusPayload) => {
      mergeStatus(data);
    },
    [mergeStatus],
  );

  const start = async () => {
    setBusyAction(true);
    mergeStatus({ state: 'STARTING' });
    try {
      const res = await fetch('/api/ai/start', { method: 'POST' });
      const data = (await res.json()) as EngineStatusPayload;
      applyActionResponse(data);
    } catch (err) {
      mergeStatus({
        state: 'ERROR',
        lastError: err instanceof Error ? err.message : 'Start failed',
      });
    } finally {
      setBusyAction(false);
      void refresh();
    }
  };

  const stop = async () => {
    setBusyAction(true);
    mergeStatus({ state: 'SHUTTING_DOWN' });
    try {
      const res = await fetch('/api/ai/stop', { method: 'POST' });
      const data = (await res.json()) as EngineStatusPayload;
      applyActionResponse(data);
    } catch (err) {
      mergeStatus({
        state: 'ERROR',
        lastError: err instanceof Error ? err.message : 'Stop failed',
      });
    } finally {
      setBusyAction(false);
      void refresh();
    }
  };

  const extend = async () => {
    setBusyAction(true);
    try {
      const res = await fetch('/api/ai/extend', { method: 'POST' });
      const data = (await res.json()) as EngineStatusPayload;
      applyActionResponse(data);
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

  const hasPerformanceMetrics =
    status.lastColdStartSeconds != null ||
    status.lastTtftSeconds != null ||
    status.lastResponseSeconds != null ||
    status.lastTokensPerSec != null;

  const sessionDurationLabel = displayTimers.sessionDurationHms ?? '—';
  const idleRemainingLabel = displayTimers.idleRemainingHms ?? '—';
  const maxSessionRemainingLabel = displayTimers.maxSessionRemainingHms ?? '—';

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
        <div
          className="rami-engine-panel"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rami-engine-panel-head">
            <button
              type="button"
              className="rami-engine-panel-title"
              onClick={collapsePanel}
              aria-label="Collapse Rami AI Engine"
            >
              Rami AI Engine
            </button>
            <button
              type="button"
              className="rami-engine-icon-btn"
              onClick={collapsePanel}
              aria-label="Collapse Rami AI Engine"
            >
              <ChevronDown aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          <div className="rami-engine-panel--state">
            <span className={`rami-engine-dot rami-engine-dot--${state.toLowerCase()}`} aria-hidden />
            {stateLabel(state)}
          </div>

          {isModalStopped && <p className="rami-engine-off-note">{MODAL_OFF_MESSAGE}</p>}

          {isModalError && (
            <div className="rami-engine-error-note" role="alert">
              <strong>Engine error.</strong> Rami could not run as expected. Your project and RFP
              data remain safely saved.
              {status.lastError ? (
                <div className="mt-1 text-[0.68rem] opacity-90">{status.lastError}</div>
              ) : null}
            </div>
          )}

          {!isModalProvider && state === 'ERROR' && (
            <div className="rami-engine-error-note" role="alert">
              <strong>Ollama is not ready.</strong> Your project data is safely saved.
              {status.lastError ? (
                <div className="mt-1 text-[0.68rem] opacity-90">{status.lastError}</div>
              ) : null}
            </div>
          )}

          <div className="rami-engine-section">
            <p className="rami-engine-section-title">Engine</p>
            <dl className="rami-engine-meta">
              <div>
                <dt>Provider</dt>
                <dd>{isModalProvider ? 'Modal' : 'Local Ollama'}</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>{status.modelLabel || status.model || '—'}</dd>
              </div>
              <div>
                <dt>{isModalProvider ? 'GPU' : 'Runtime'}</dt>
                <dd>{isModalProvider ? status.gpu || '—' : 'Local'}</dd>
              </div>
              {!isModalProvider && (
                <div>
                  <dt>Ollama</dt>
                  <dd>{status.endpointReachable ? 'Reachable' : 'Unreachable'}</dd>
                </div>
              )}
            </dl>
          </div>

          {isModalProvider && isWarm && (
            <div className="rami-engine-section">
              <p className="rami-engine-section-title">Session</p>
              <dl className="rami-engine-meta">
                <div>
                  <dt>Duration</dt>
                  <dd>{sessionDurationLabel}</dd>
                </div>
                <div>
                  <dt>Idle remaining</dt>
                  <dd>{idleRemainingLabel}</dd>
                </div>
                {maxSessionRemainingLabel !== '—' && (
                  <div>
                    <dt>Max remaining</dt>
                    <dd>{maxSessionRemainingLabel}</dd>
                  </div>
                )}
                <div>
                  <dt>Last activity</dt>
                  <dd>{displayTimers.lastActivityLabel}</dd>
                </div>
              </dl>
              {status.session?.estimatedCostUsd != null && (
                <p className="rami-engine-est-note">
                  Estimated session cost ({status.session.estimatedLabel ?? 'estimated'}):{' '}
                  {formatUsd(status.session.estimatedCostUsd)}
                  {status.requestCountSession != null ? ` · ${status.requestCountSession} requests` : ''}
                </p>
              )}
            </div>
          )}

          {isModalProvider && status.billingNote && (
            <p className="rami-engine-est-note">{status.billingNote}</p>
          )}

          {!isModalProvider && status.runtimeNote && state !== 'ERROR' && (
            <p className="rami-engine-est-note">{status.runtimeNote}</p>
          )}

          {hasPerformanceMetrics && (
            <div className="rami-engine-disclosure">
              <button
                type="button"
                className="rami-engine-disclosure-toggle"
                onClick={() => setShowPerformance((v) => !v)}
                aria-expanded={showPerformance}
              >
                <ChevronDown
                  aria-hidden="true"
                  className={`h-3.5 w-3.5 transition-transform ${showPerformance ? 'rotate-180' : ''}`}
                  strokeWidth={2}
                />
                Performance
              </button>
              {showPerformance && (
                <div className="rami-engine-perf">
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
            </div>
          )}

          <div className="rami-engine-actions">
            {isModalProvider && (isModalStopped || isModalError) && (
              <button
                type="button"
                className="rami-engine-btn-primary"
                onClick={() => void start()}
                disabled={busyAction}
              >
                {isModalError ? 'Retry start' : 'Start Rami'}
              </button>
            )}
            {isModalProvider && isWarm && (
              <button
                type="button"
                className="rami-engine-btn-danger"
                onClick={() => void stop()}
                disabled={busyAction || state === 'SHUTTING_DOWN'}
              >
                Stop Rami
              </button>
            )}
            {isModalProvider && (state === 'READY' || state === 'BUSY') && (
              <button type="button" onClick={() => void extend()} disabled={busyAction}>
                Extend +1 hour
              </button>
            )}
            {!isModalProvider && (
              <button type="button" onClick={() => void refresh()} disabled={busyAction}>
                Refresh status
              </button>
            )}
            {(isModalError || (!isModalProvider && state === 'ERROR')) && (
              <button type="button" onClick={() => setShowErrorDetails((v) => !v)}>
                {showErrorDetails ? 'Hide details' : 'Details'}
              </button>
            )}
          </div>

          {showErrorDetails && status.lastError && (isModalError || state === 'ERROR') && (
            <pre className="rami-engine-error mt-1 max-h-24 overflow-auto text-[0.65rem]">
              {status.lastError}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
