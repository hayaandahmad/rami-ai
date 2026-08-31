/**
 * Spawn isolated Modal Python bridge (no secrets in browser).
 */

import { spawn } from 'child_process';
import { join } from 'path';
import { getModalBridgeScript, getModalPythonPath } from './providerConfig';
import { buildModalBridgeEnv } from './utf8BridgeEnv';

export type BridgeRequest = Record<string, unknown> & { op: string };

function resolvePython(): string {
  const configured = getModalPythonPath();
  if (configured.includes('/') || configured.includes('\\') || configured.endsWith('.exe')) {
    return join(process.cwd(), configured);
  }
  return configured;
}

function resolveBridge(): string {
  return join(process.cwd(), getModalBridgeScript());
}

export async function runModalBridge<T = Record<string, unknown>>(
  request: BridgeRequest,
  timeoutMs = 600_000,
): Promise<T> {
  const python = resolvePython();
  const script = resolveBridge();
  const payload = JSON.stringify(request);

  return new Promise<T>((resolve, reject) => {
    const child = spawn(python, [script], {
      cwd: process.cwd(),
      env: buildModalBridgeEnv(),
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`modal bridge timeout after ${timeoutMs}ms (op=${request.op})`));
    }, timeoutMs);

    child.stdout.on('data', (buf: Buffer) => {
      stdout += buf.toString('utf8');
    });
    child.stderr.on('data', (buf: Buffer) => {
      stderr += buf.toString('utf8');
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const line = stdout
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .pop();
      if (!line) {
        reject(
          new Error(
            `modal bridge empty output (code=${code}) stderr=${stderr.slice(0, 400)}`,
          ),
        );
        return;
      }
      try {
        resolve(JSON.parse(line) as T);
      } catch (err) {
        reject(
          new Error(
            `modal bridge JSON parse failed: ${String(err)} raw=${line.slice(0, 200)}`,
          ),
        );
      }
    });

    child.stdin.write(Buffer.from(payload, 'utf8'));
    child.stdin.end();
  });
}

/**
 * Streaming bridge: yields parsed NDJSON objects from chat_stream.
 */
export async function* runModalBridgeStream(
  request: BridgeRequest,
  timeoutMs = 600_000,
): AsyncGenerator<Record<string, unknown>> {
  const python = resolvePython();
  const script = resolveBridge();
  const payload = JSON.stringify(request);

  const child = spawn(python, [script], {
    cwd: process.cwd(),
    env: buildModalBridgeEnv(),
    windowsHide: true,
  });

  const timer = setTimeout(() => {
    child.kill();
  }, timeoutMs);

  child.stdin.write(Buffer.from(payload, 'utf8'));
  child.stdin.end();

  const decoder = new TextDecoder('utf-8');
  let lineBuffer = '';
  try {
    for await (const chunk of child.stdout) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      lineBuffer += decoder.decode(buf, { stream: true });
      const parts = lineBuffer.split('\n');
      lineBuffer = parts.pop() ?? '';
      for (const line of parts) {
        if (!line.trim()) continue;
        yield JSON.parse(line) as Record<string, unknown>;
      }
    }
    lineBuffer += decoder.decode();
    if (lineBuffer.trim()) {
      yield JSON.parse(lineBuffer) as Record<string, unknown>;
    }
  } finally {
    clearTimeout(timer);
  }

  const code: number | null = await new Promise((resolve) => {
    if (child.exitCode !== null) resolve(child.exitCode);
    else child.on('close', (c) => resolve(c));
  });
  if (code && code !== 0) {
    // Errors should already have been yielded as {type:error}
  }
}
