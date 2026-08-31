import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer, request } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(import.meta.dirname, '..');
const site = resolve(root, 'frontend/dist-public');
const base = '/axonllm-blueprint/';
const types = { '.css': 'text/css', '.drawio': 'application/xml', '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml' };

function chromePath() {
  const candidates = [
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
  ].filter(Boolean);
  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium']) {
    const found = spawnSync('which', [name], { encoding: 'utf8' });
    if (found.status === 0) return found.stdout.trim();
  }
  throw new Error('Chrome or Chromium is required.');
}

async function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (!url.pathname.startsWith(base)) throw new Error('outside base');
      const relative = url.pathname.slice(base.length) || 'index.html';
      const file = resolve(site, relative);
      if (file !== site && !file.startsWith(`${site}${sep}`)) throw new Error('invalid path');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': `${types[extname(file)] || 'application/octet-stream'}; charset=utf-8`, 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
  await new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', done);
  });
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

function getJson(url, method = 'GET') {
  return new Promise((done, fail) => {
    const req = request(url, { method }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => done(JSON.parse(body)));
    });
    req.once('error', fail);
    req.end();
  });
}

class CDP {
  constructor(socket) {
    this.socket = socket;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(String(data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result || {});
      } else {
        for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
      }
    });
  }
  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((done, fail) => {
      socket.addEventListener('open', done, { once: true });
      socket.addEventListener('error', fail, { once: true });
    });
    return new CDP(socket);
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolvePromise, reject) => this.pending.set(id, { resolve: resolvePromise, reject }));
  }
  on(method, listener) {
    const list = this.listeners.get(method) || [];
    list.push(listener);
    this.listeners.set(method, list);
  }
  close() { this.socket.close(); }
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result?.value;
}

async function waitFor(cdp, expression, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate(cdp, `Boolean(${expression})`)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function navigate(cdp, url) {
  await cdp.send('Page.navigate', { url });
  await waitFor(cdp, 'document.readyState === "complete"', url);
}

async function click(cdp, selector) {
  await evaluate(cdp, `document.querySelector(${JSON.stringify(selector)}).click()`);
}

async function waitChrome(chrome, output, profile) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const match = output().match(/DevTools listening on (ws:\/\/\S+)/);
    if (match) return match[1];
    try {
      const [port, path] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/, 2);
      if (port && path) return `ws://127.0.0.1:${port}${path}`;
    } catch {}
    if (chrome.exitCode !== null) throw new Error(`Chrome exited ${chrome.exitCode}: ${output()}`);
    await delay(100);
  }
  throw new Error(`Chrome startup timed out: ${output()}`);
}

assert.ok(existsSync(join(site, 'index.html')), 'Run npm run build:public first.');
const { server, origin } = await startServer();
const profile = await mkdtemp(join(tmpdir(), 'axonllm-blueprint-chrome-'));
let output = '';
const chrome = spawn(chromePath(), [
  ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
  '--headless', '--disable-background-networking', '--disable-component-update',
  '--disable-dev-shm-usage', '--disable-extensions', '--disable-gpu', '--no-first-run',
  '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, '--window-size=1440,1000', 'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });
for (const stream of [chrome.stdout, chrome.stderr]) {
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => { output = `${output}${chunk}`.slice(-12_000); });
}

let cdp;
const requests = [];
const websockets = [];
const failures = [];
const errors = [];
try {
  const ws = await waitChrome(chrome, () => output, profile);
  const devtools = `http://${new URL(ws).host}`;
  const target = await getJson(`${devtools}/json/new?${encodeURIComponent('about:blank')}`, 'PUT');
  cdp = await CDP.connect(target.webSocketDebuggerUrl);
  await Promise.all([cdp.send('Page.enable'), cdp.send('Runtime.enable'), cdp.send('Network.enable')]);
  cdp.on('Network.requestWillBeSent', ({ request: networkRequest }) => requests.push(networkRequest.url));
  cdp.on('Network.webSocketCreated', ({ url }) => websockets.push(url));
  cdp.on('Network.loadingFailed', (failure) => failures.push(failure));
  cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => errors.push(exceptionDetails.text));

  await navigate(cdp, `${origin}${base}#/`);
  await waitFor(cdp, 'document.documentElement.dataset.publicSite === "true" && document.querySelector("[data-public-route=landing]")', 'landing');
  assert.match(await evaluate(cdp, 'document.body.innerText'), /Published synthetic preview/);
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(join(tmpdir(), 'axonllm-blueprint-public-site.png'), Buffer.from(screenshot.data, 'base64'));
  await click(cdp, 'a[href="#/workspace"]');
  await waitFor(cdp, 'document.querySelector("[data-public-workspace=true]") && document.body.innerText.includes("Synthetic preview")', 'workspace');
  await click(cdp, '.quick-start');
  await click(cdp, 'button[aria-label="Send message"]');
  await waitFor(cdp, 'document.body.innerText.includes("Synthetic browser-local response") && document.body.innerText.includes("No model call")', 'synthetic response');
  await click(cdp, 'a[href="#/architecture"]');
  await waitFor(cdp, 'document.querySelector("[data-public-route=architecture]") && [...document.images].every((image) => image.complete && image.naturalWidth > 1000)', 'architecture');
  await click(cdp, '[data-flow-scenario="safety"]');
  await click(cdp, '[data-flow-play]');
  await delay(1100);
  assert.match(await evaluate(cdp, 'document.querySelector(".flow-detail span").innerText'), /step (2|3)/i);
  const downloads = await evaluate(cdp, '[...document.querySelectorAll(".diagram-grid a[download]")].map((link) => link.href)');
  assert.equal(downloads.length, 4);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate(cdp, `${origin}${base}#/`);
  assert.ok((await evaluate(cdp, 'document.documentElement.scrollWidth - document.documentElement.clientWidth')) <= 1);

  const bad = requests.filter((raw) => {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) && (url.origin !== origin || !url.pathname.startsWith(base));
  });
  assert.deepEqual(bad, []);
  assert.deepEqual(requests.filter((url) => new URL(url).pathname.startsWith('/api/')), []);
  assert.deepEqual(websockets, []);
  assert.deepEqual(failures, []);
  assert.deepEqual(errors, []);
  const files = await readdir(resolve(site, 'assets'));
  assert.ok(files.some((name) => name.endsWith('.js')) && files.some((name) => name.endsWith('.css')));
  console.log('Public landing, synthetic workbench, architecture animation, mobile layout, and no-network boundary passed.');
} finally {
  cdp?.close();
  server.close();
  if (chrome.exitCode === null) chrome.kill('SIGTERM');
  await delay(250);
  if (chrome.exitCode === null) chrome.kill('SIGKILL');
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
