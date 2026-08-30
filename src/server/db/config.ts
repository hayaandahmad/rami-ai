/**
 * Server-only PostgreSQL configuration.
 * Never import this from a Client Component.
 */

function env(name: string, fallback = ''): string {
  return (process.env[name] ?? fallback).trim();
}

export function isDatabaseConfigured(): boolean {
  if (env('RAMI_DB_URL')) return true;
  return Boolean(env('RAMI_DB_HOST') && env('RAMI_DB_NAME') && env('RAMI_DB_USER'));
}

export function getDatabaseName(): string {
  const url = env('RAMI_DB_URL');
  if (url) {
    try {
      return decodeURIComponent(new URL(url).pathname.replace(/^\//, '')) || 'rami';
    } catch {
      return 'rami';
    }
  }
  return env('RAMI_DB_NAME', 'rami');
}

export function getDatabaseUrl(): string {
  return getDatabaseUrlForName(getDatabaseName());
}

export function getDatabaseUrlForName(databaseName: string): string {
  const url = env('RAMI_DB_URL');
  if (url) {
    const u = new URL(url);
    u.pathname = `/${databaseName}`;
    return u.toString();
  }
  const host = env('RAMI_DB_HOST', '127.0.0.1');
  const port = env('RAMI_DB_PORT', '5432');
  const user = encodeURIComponent(env('RAMI_DB_USER', 'rami'));
  const password = encodeURIComponent(env('RAMI_DB_PASSWORD'));
  const auth = password ? `${user}:${password}` : user;
  return `postgres://${auth}@${host}:${port}/${encodeURIComponent(databaseName)}`;
}

export function getSslEnabled(): boolean {
  return env('RAMI_DB_SSL').toLowerCase() === 'true';
}

export function getBackupDir(): string {
  return env('RAMI_DB_BACKUP_DIR', '.rami-db-backups');
}

export function getFxRateToJod(currency: string): number | null {
  const c = currency.trim().toUpperCase();
  if (c === 'JOD' || c === 'JD') return 1;
  const overrides: Record<string, string> = {
    USD: env('RAMI_FX_USD_JOD', '0.71'),
    EUR: env('RAMI_FX_EUR_JOD', '0.78'),
    GBP: env('RAMI_FX_GBP_JOD', '0.90'),
  };
  const raw = overrides[c];
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}
