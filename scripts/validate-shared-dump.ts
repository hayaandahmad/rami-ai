#!/usr/bin/env npx tsx
/**
 * Offline checks for the committed shared development dump (no live restore).
 */
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import { existsSync, readFileSync, statSync } from 'fs';
import { spawnSync } from 'child_process';
import { join } from 'path';
import { getSharedDumpPath, SHARED_DUMP_REQUIRED_TABLES } from '../src/server/db/sharedSnapshot';
import { isLoopbackHost, assertSafeDatabaseName } from '../src/server/db/localSafety';
import { resolvePgTool } from '../src/server/db/pgTools';

let passed = 0;
let failed = 0;

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    failed++;
  }
}

console.log('\n=== Shared development dump checks ===\n');

run('dump file exists and is non-empty', () => {
  const p = getSharedDumpPath();
  assert.equal(existsSync(p), true, `missing ${p}`);
  const size = statSync(p).size;
  assert.ok(size > 1024, `dump too small (${size} bytes)`);
  assert.ok(size < 50 * 1024 * 1024, `dump too large for GitHub (${size} bytes)`);
});

run('pg_restore --list contains required RAMI tables', () => {
  const pgRestore = resolvePgTool('pg_restore');
  const result = spawnSync(pgRestore, ['--list', getSharedDumpPath()], {
    encoding: 'utf8',
    shell: false,
  });
  assert.equal(result.status, 0, result.stderr || 'pg_restore --list failed');
  const list = `${result.stdout}\n${result.stderr}`;
  for (const table of SHARED_DUMP_REQUIRED_TABLES) {
    assert.ok(
      list.includes(`TABLE DATA public ${table}`) || list.includes(`TABLE public ${table}`),
      `dump TOC missing table ${table}`,
    );
  }
});

run('shared metadata matches dump SHA-256', () => {
  const metaPath = join(process.cwd(), 'dev', 'database', 'rami_ai_shared.metadata.json');
  assert.equal(existsSync(metaPath), true, `missing ${metaPath}`);
  const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as {
    snapshotSha256?: string;
    snapshotBytes?: number;
    latestMigration?: string;
  };
  const dump = readFileSync(getSharedDumpPath());
  const sha = createHash('sha256').update(dump).digest('hex');
  assert.equal(meta.snapshotSha256?.toLowerCase(), sha.toLowerCase());
  assert.equal(meta.snapshotBytes, dump.length);
  assert.equal(meta.latestMigration, '007_project_generation_references.sql');
});

run('loopback host helper', () => {
  assert.equal(isLoopbackHost('127.0.0.1'), true);
  assert.equal(isLoopbackHost('localhost'), true);
  assert.equal(isLoopbackHost('db.example.com'), false);
  assert.equal(isLoopbackHost('10.0.0.5'), false);
});

run('safe database name helper', () => {
  assertSafeDatabaseName('rami_ai');
  assert.throws(() => assertSafeDatabaseName('rami-ai'));
  assert.throws(() => assertSafeDatabaseName('postgres;drop'));
});

console.log(`\nPassed: ${passed}  Failed: ${failed}`);
if (failed) process.exit(1);
console.log('\n✅ Shared dump unit checks passed.\n');
