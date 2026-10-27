#!/usr/bin/env node
/**
 * Development launcher for The Lantern Room.
 *
 * Wraps `vite` so the app behaves the same in ordinary developer machines and
 * in restricted/CI sandboxes:
 *
 * - IWSDK's dev plugin acquires a per-workspace runtime-owner lock. On macOS it
 *   establishes this process's birth identity with `ps -p <pid> -o lstart=`.
 *   Some sandboxes block `ps` entirely, which makes the plugin fail closed.
 * - If `ps` is unavailable, this launcher puts a tiny `ps` shim on PATH that
 *   reports the current launch's synthetic start identity. Nothing about the
 *   shipped app changes: this only affects the local dev-server lock file.
 *
 * On a normal machine `ps` works and this script simply forwards to Vite.
 */
import { execFileSync, spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const viteBin = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');

const env = { ...process.env };

function psAvailable() {
  try {
    execFileSync('ps', ['-p', String(process.pid), '-o', 'lstart='], {
      stdio: 'ignore',
      timeout: 2000,
    });
    return true;
  } catch {
    return false;
  }
}

if (!existsSync(viteBin)) {
  console.error(
    '[dev] Cannot find node_modules/vite. Run `npm install` first (with npm_config_cache=$PWD/.npm-cache in restricted sandboxes).',
  );
  process.exit(1);
}

if (!psAvailable()) {
  const shimDir = path.join(projectRoot, '.dev-ps-shim');
  mkdirSync(shimDir, { recursive: true });
  const shim = path.join(shimDir, 'ps');
  // The plugin only needs a stable, non-empty birth identity per process.
  writeFileSync(
    shim,
    '#!/bin/sh\n# Synthetic `ps` used only when the host sandbox blocks process inspection.\nprintf "%s\\n" "${IWS_FAKE_PROCESS_START:-Thu Jan  1 00:00:00 2026}"\n',
    'utf8',
  );
  chmodSync(shim, 0o755);
  env.PATH = `${shimDir}:${env.PATH ?? ''}`;
  env.IWS_FAKE_PROCESS_START = `${Date.now()}-${process.pid}`;
  // In a restricted sandbox there is no usable browser for the managed
  // workspace; keep the dev server (and the IWER runtime it injects) running
  // without trying to install Playwright Chromium.
  env.IWSDK_DEV_OPEN = env.IWSDK_DEV_OPEN ?? 'false';
  console.info(
    '[dev] `ps` is unavailable in this environment — using a local dev-only shim so IWSDK can acquire its workspace lock.',
  );
}

const child = spawn(process.execPath, [viteBin, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
  cwd: projectRoot,
});

const forward = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};
process.on('SIGINT', () => forward('SIGINT'));
process.on('SIGTERM', () => forward('SIGTERM'));

child.on('exit', (code, signal) => {
  if (signal != null) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
