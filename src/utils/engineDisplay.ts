/** Format seconds as HH:MM:SS for engine panel display. */
export function formatEngineHms(totalSec: number | null | undefined): string | null {
  if (totalSec == null || !Number.isFinite(totalSec) || totalSec < 0) return null;
  const s = Math.floor(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

export function formatActivityAgo(idleSec: number | null | undefined): string {
  if (idleSec == null || !Number.isFinite(idleSec)) return '—';
  const sec = Math.max(0, Math.floor(idleSec));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}
