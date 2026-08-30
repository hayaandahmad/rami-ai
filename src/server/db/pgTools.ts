import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Resolve pg_dump / pg_restore. Windows installs often omit the bin dir from PATH.
 * Optional override: RAMI_PG_BIN=C:\Program Files\PostgreSQL\18\bin
 */
export function resolvePgTool(name: 'pg_dump' | 'pg_restore'): string {
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  const fromEnv = (process.env.RAMI_PG_BIN ?? '').trim();
  if (fromEnv) {
    const p = join(fromEnv, exe);
    if (existsSync(p)) return p;
  }

  for (const p of windowsPgBinCandidates(exe)) {
    if (existsSync(p)) return p;
  }

  return name;
}

function windowsPgBinCandidates(exe: string): string[] {
  if (process.platform !== 'win32') return [];
  const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(
    (r): r is string => Boolean(r),
  );
  const found: string[] = [];
  for (const root of roots) {
    const pgRoot = join(root, 'PostgreSQL');
    if (!existsSync(pgRoot)) continue;
    for (const ver of readdirSync(pgRoot)) {
      const p = join(pgRoot, ver, 'bin', exe);
      if (existsSync(p)) found.push(p);
    }
  }
  return found.sort().reverse();
}
