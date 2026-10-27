#!/usr/bin/env node
/**
 * Dev-only visual capture helper (not used by the shipped app).
 *
 * Launches headless Google Chrome with remote debugging, opens the local dev
 * URL, prints console/exception output, and writes screenshots to
 * `screenshots/`. It talks raw Chrome DevTools Protocol over Node's built-in
 * WebSocket, so it needs no extra npm dependencies.
 *
 * Usage:
 *   npm run dev              # in another terminal
 *   node scripts/capture.mjs [url] [--enter-xr] [--out screenshots/scene.png]
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const url = args.find((arg) => arg.startsWith('http')) ?? 'https://localhost:5173/';
const enterXr = args.includes('--enter-xr');
const lookDown = args.includes('--look-down');
const headDown = args.includes('--head-down');
const evalIndex = args.indexOf('--eval');
const evalScript = evalIndex >= 0 ? args[evalIndex + 1] : undefined;
const outIndex = args.indexOf('--out');
const outFile = outIndex >= 0 ? args[outIndex + 1] : 'screenshots/scene.png';
const waitMs = Number(
  args.find((arg) => arg.startsWith('--wait='))?.split('=')[1] ?? '9000',
);

const chromePath =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root = process.cwd();
const profile = path.join(root, '.chrome-profile');
const crash = path.join(root, '.chrome-crash');
mkdirSync(profile, { recursive: true });
mkdirSync(crash, { recursive: true });
const port = 9333 + Math.floor(Math.random() * 200);
const chromeArgs = [
  '--headless=new',
  '--no-sandbox',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--disable-gpu-sandbox',
  '--disable-breakpad',
  '--disable-crash-reporter',
  `--crash-dumps-dir=${crash}`,
  '--ignore-certificate-errors',
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-scrollbars',
  `--user-data-dir=${profile}`,
  '--window-size=1280,800',
  '--remote-debugging-port=' + String(port),
  'about:blank',
];

const chrome = spawn(chromePath, chromeArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
chrome.stdout.on('data', () => {});
chrome.stderr.on('data', () => {});

const endpoint = `http://127.0.0.1:${port}`;
const deadline = Date.now() + 15000;
let targets;
while (Date.now() < deadline) {
  try {
    const response = await fetch(`${endpoint}/json/list`);
    targets = await response.json();
    if (Array.isArray(targets) && targets.length > 0) {
      break;
    }
  } catch {
    // Chrome not up yet.
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
if (!Array.isArray(targets) || targets.length === 0) {
  console.error('Could not connect to headless Chrome.');
  chrome.kill('SIGKILL');
  process.exit(1);
}
const page = targets.find((target) => target.type === 'page') ?? targets[0];
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let callId = 0;
const pending = new Map();
const logs = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data.toString());
  if (message.id != null && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error != null) {
      reject(new Error(JSON.stringify(message.error)));
    } else {
      resolve(message.result);
    }
    return;
  }
  if (message.method === 'Runtime.consoleAPICalled') {
    const text = (message.params.args ?? [])
      .map((arg) => arg.value ?? arg.description ?? arg.type)
      .join(' ');
    logs.push(`[${message.params.type}] ${text}`);
  }
  if (message.method === 'Runtime.exceptionThrown') {
    const details = message.params.exceptionDetails;
    logs.push(
      `[exception] ${details.text} ${details.exception?.description ?? ''} @ ${details.url ?? ''}:${details.lineNumber ?? ''}`,
    );
  }
  if (message.method === 'Log.entryAdded') {
    logs.push(`[log:${message.params.entry.level}] ${message.params.entry.text}`);
  }
  if (message.method === 'Page.loadEventFired') {
    logs.push('[page] load event');
  }
});

function send(method, params = {}) {
  callId += 1;
  const id = callId;
  const promise = new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
  socket.send(JSON.stringify({ id, method, params }));
  return promise;
}

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Page.navigate', { url });
await new Promise((resolve) => setTimeout(resolve, waitMs));

if (enterXr) {
  const count = await send('Runtime.evaluate', {
    expression:
      "Array.from(document.querySelectorAll('button, [role=button]')).map((b) => (b.textContent || '').trim()).join('|')",
    returnByValue: true,
  });
  logs.push(`[buttons] ${count.result?.value ?? ''}`);
  const probe = await send('Runtime.evaluate', {
    expression: `(() => {
      const collect = (root, out) => {
        for (const el of Array.from(root.querySelectorAll('*'))) {
          out.push(el);
          if (el.shadowRoot) collect(el.shadowRoot, out);
        }
        return out;
      };
      const all = collect(document, []);
      const hits = all.filter((el) => /enter\s*xr/i.test(el.textContent || ''));
      return {
        title: document.title,
        total: all.length,
        shadowHosts: all.filter((el) => el.shadowRoot != null).map((el) => el.tagName + '.' + (el.className || '')).slice(0, 8),
        hits: hits.slice(0, 8).map((el) => (el.tagName + '#' + el.id + '.' + (el.className || '')).slice(0, 120)),
        buttons: all.filter((el) => el.tagName === 'BUTTON').slice(0, 10).map((el) => (el.textContent || '').trim().slice(0, 40)),
      };
    })()`,
    returnByValue: true,
  });
  logs.push(`[dom] ${JSON.stringify(probe.result?.value ?? null)}`);
  const clicked = await send('Runtime.evaluate', {
    expression: `(() => {
      const collect = (root, out) => {
        for (const el of Array.from(root.querySelectorAll('*'))) {
          out.push(el);
          if (el.shadowRoot) collect(el.shadowRoot, out);
        }
        return out;
      };
      const all = collect(document, []);
      const target = all.find((el) => (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') && /enter/i.test(el.textContent || ''));
      if (!target) return 'no-xr-button';
      target.click();
      return 'clicked:' + (target.textContent || '').trim();
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  logs.push(`[enter-xr] ${clicked.result?.value ?? ''}`);
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const globals = await send('Runtime.evaluate', {
    expression: `(() => {
      const keys = Object.keys(window).filter((key) => /iwer|xr/i.test(key));
      const useful = keys.map((key) => {
        const value = window[key];
        if (value == null) return key + ':null';
        const type = typeof value;
        const names = type === 'object' ? Object.keys(value).slice(0, 12) : [];
        return key + ':' + type + (names.length ? '(' + names.join(',') + ')' : '');
      });
      const device = window.IWER_DEVICE;
      const proto = device ? Object.getOwnPropertyNames(Object.getPrototypeOf(device)).slice(0, 30) : [];
      const nested = device ? Object.keys(device) : [];
      return { useful: useful.slice(0, 20), deviceProto: proto, deviceKeys: nested };
    })()`,
    returnByValue: true,
  });
  logs.push(`[xr-globals] ${JSON.stringify(globals.result?.value ?? null)}`);
  if (headDown) {
    const key = async (type, keyCode, code, keyName, modifiers = 0) => {
      await send('Input.dispatchKeyEvent', {
        type,
        windowsVirtualKeyCode: keyCode,
        nativeVirtualKeyCode: keyCode,
        code,
        key: keyName,
        modifiers,
      });
    };
    await key('keyDown', 16, 'ShiftLeft', 'Shift', 8);
    for (let step = 0; step < 12; step += 1) {
      await key('keyDown', 40, 'ArrowDown', 'ArrowDown', 8);
      await new Promise((resolve) => setTimeout(resolve, 60));
      await key('keyUp', 40, 'ArrowDown', 'ArrowDown', 8);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    await key('keyUp', 16, 'ShiftLeft', 'Shift', 0);
    logs.push('[head-down] dispatched Shift+ArrowDown x12');
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  if (lookDown) {
    const posed = await send('Runtime.evaluate', {
      expression: `(() => {
        const d = window.IWER_DEVICE;
        if (!d) return 'no-device';
        const setVec = (target, x, y, z) => {
          if (target == null) return;
          if (typeof target.set === 'function') target.set(x, y, z);
          else { target.x = x; target.y = y; target.z = z; }
        };
        setVec(d.position, 0, 1.28, 0.15);
        const theta = -0.62;
        const qx = Math.sin(theta / 2);
        const qw = Math.cos(theta / 2);
        const quat = d.quaternion;
        if (quat != null && typeof quat.set === 'function') quat.set(qx, 0, 0, qw);
        else if (quat != null) { quat.x = qx; quat.y = 0; quat.z = 0; quat.w = qw; }
        return JSON.stringify({ pos: d.position, quat: d.quaternion });
      })()`,
      returnByValue: true,
    });
    logs.push(`[look-down] ${posed.result?.value ?? ''}`);
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
}

if (evalScript != null) {
  const result = await send('Runtime.evaluate', {
    expression: evalScript,
    returnByValue: true,
    awaitPromise: true,
  });
  logs.push(`[eval] ${JSON.stringify(result.result?.value ?? null)}`);
  await new Promise((resolve) => setTimeout(resolve, 3000));
}

const evaluated = await send('Runtime.evaluate', {
  expression: `(() => {
    const room = window.__lanternRoom;
    if (!room) return { ready: false };
    return { ready: true, state: room.debugState(), xr: !!navigator.xr, session: !!room.scene };
  })()`,
  returnByValue: true,
});
logs.push(`[room] ${JSON.stringify(evaluated.result?.value ?? null)}`);

const shot = await send('Page.captureScreenshot', { format: 'png' });
const outPath = path.resolve(root, outFile);
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
console.log(logs.join('\n'));
console.log(`\nScreenshot written to ${outPath}`);

socket.close();
chrome.kill('SIGKILL');
await new Promise((resolve) => setTimeout(resolve, 300));
try {
  rmSync(profile, { recursive: true, force: true });
  rmSync(crash, { recursive: true, force: true });
} catch {
  // Best-effort cleanup.
}
