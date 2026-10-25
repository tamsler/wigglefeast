// Minimal Chrome DevTools Protocol client for the browser tests. No dependencies:
// uses Node's built-in fetch and WebSocket (Node 22+).
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

// Runs before the game's scripts on every page load: exposes the running game and
// player as window.__game / window.__player so tests can inspect and steer state.
// Covers new worlds, worlds restored from saves, and players spawned later.
const HOOK = `(() => {
  let engine;
  Object.defineProperty(window, 'WormEngine', {
    configurable: true,
    get() { return engine; },
    set(v) {
      const Base = v.Game;
      class Game extends Base {
        constructor(...args) {
          super(...args);
          window.__game = this;
          window.__player = this.player;
        }
        spawnPlayer(...args) {
          const p = super.spawnPlayer(...args);
          window.__game = this;
          window.__player = p;
          return p;
        }
      }
      engine = { ...v, Game };
    },
  });
})();`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Chrome's helper processes can still write to the profile just after Chrome exits, so
// deleting it can hit ENOTEMPTY (#105). Retry, and never fail a test over a leftover temp folder.
function removeProfile(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* left in the temp folder */ }
}
const REPO = path.resolve(__dirname, '..', '..');
const gameUrl = () => 'file://' + path.join(REPO, 'index.html');

async function launch({ width = 1280, height = 800, mobile = false, profile } = {}) {
  const chrome = CHROME_CANDIDATES.find((p) => p && fs.existsSync(p));
  if (!chrome) throw new Error('Chrome not found; set CHROME_PATH');
  const ownProfile = !profile;
  const userDataDir = profile || fs.mkdtempSync(path.join(os.tmpdir(), 'wigglefeast-chrome-'));
  const args = ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${userDataDir}`,
    `--window-size=${width},${height}`, '--no-first-run', '--no-default-browser-check'];
  if (process.env.CI) args.push('--no-sandbox', '--disable-dev-shm-usage');
  args.push('about:blank');
  // Where a launch spends its time (#134): always logged when it is slow, every launch with CHROME_TIMING=1.
  const t0 = Date.now(), lines = [];
  const proc = spawn(chrome, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  proc.stderr.on('data', (d) => { for (const l of String(d).split('\n')) if (l.trim()) lines.push(`+${Date.now() - t0}ms ${l.slice(0, 200)}`); });

  const wsUrl = await new Promise((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error('Chrome did not start')), 30000);
    proc.stderr.on('data', (d) => {
      out += d;
      const m = out.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    proc.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Chrome exited (${code})`)); });
  });
  const port = new URL(wsUrl).port;
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* not ready */ }
    if (!target) await sleep(100);
  }
  const tTarget = Date.now() - t0;
  const page = await attach(target.webSocketDebuggerUrl, { width, height, mobile });
  page.port = port;
  const launched = Date.now() - t0;
  if (process.env.CHROME_TIMING || launched > 5000) {
    process.stderr.write(`[chrome] launch ${launched}ms (page target at ${tTarget}ms)\n`);
    if (launched > 2000) process.stderr.write(lines.map((l) => `[chrome]   ${l}\n`).join(''));
  }
  if (process.env.CHROME_TIMING) page.timing = { launched };
  page.close = async () => {
    try { page.ws.close(); } catch { /* already closed */ }
    proc.kill();
    // A Chrome that ignores SIGTERM is killed after 5 s, so a failed test can't hang the run (#112).
    const force = setTimeout(() => proc.kill('SIGKILL'), 5000);
    await new Promise((r) => (proc.exitCode !== null || proc.signalCode !== null ? r() : proc.once('exit', r)));
    clearTimeout(force);
    if (ownProfile) removeProfile(userDataDir);
  };
  return page;
}

// Connects to a tab and sets it up the same way for every test.
async function attach(wsUrl, opts) {
  const { width, height, mobile } = opts;
  const page = new Page(new WebSocket(wsUrl));
  page.opts = opts;
  await page.ready;
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('DOM.enable');
  await page.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  // Exact viewport size, so layout results don't depend on the machine's window chrome.
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: mobile || width < 1000 ? 2 : 1, mobile: mobile || width < 1000 });
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK });
  return page;
}

class Page {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.dialogs = [];
    this.exceptions = [];
    this.loadWaiters = [];
    this.ready = new Promise((r) => (ws.onopen = r));
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      }
      if (m.method === 'Page.javascriptDialogOpening') {
        this.dialogs.push(m.params.message);
        this.send('Page.handleJavaScriptDialog', { accept: true });
      }
      if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails;
        this.exceptions.push((d.exception && d.exception.description) || d.text);
      }
      if (m.method === 'Page.loadEventFired') this.loadWaiters.splice(0).forEach((r) => r());
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('Page eval failed: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  }

  async goto(url) {
    const t = Date.now();
    const loaded = new Promise((r) => this.loadWaiters.push(r));
    await this.send('Page.navigate', { url });
    await loaded;
    if (this.timing) process.stderr.write(`[chrome] goto ${Date.now() - t}ms\n`);
    await sleep(300);
  }

  async reload() {
    const loaded = new Promise((r) => this.loadWaiters.push(r));
    await this.send('Page.reload');
    await loaded;
    await sleep(300);
  }

  // Polls an expression until it is truthy; returns its value or throws with `what`
  // (and the last page error, if the expression itself kept failing).
  async waitFor(expression, what = expression, timeout = 15000) {
    const t0 = Date.now();
    let lastError = null;
    for (;;) {
      let v;
      try { v = await this.eval(expression); lastError = null; } catch (err) { lastError = err; }
      if (v) return v;
      if (Date.now() - t0 > timeout) throw new Error('Timed out waiting for: ' + what + (lastError ? ` (last error: ${lastError.message})` : ''));
      await sleep(100);
    }
  }

  // Waits for n rendered frames: the game applies input once per frame, so this is
  // a deterministic "let the game catch up" instead of a fixed delay.
  frames(n = 10) {
    return this.eval(`new Promise((r) => { let i = 0; const f = () => (++i >= ${n} ? r(i) : requestAnimationFrame(f)); requestAnimationFrame(f); })`);
  }

  // Waits for a dialog (alert/confirm) whose text matches re; returns all dialogs seen.
  async waitForDialog(re, timeout = 10000) {
    const t0 = Date.now();
    while (!this.dialogs.some((m) => re.test(m))) {
      if (Date.now() - t0 > timeout) throw new Error(`No dialog matching ${re}; saw ${JSON.stringify(this.dialogs)}`);
      await sleep(50);
    }
    return [...this.dialogs];
  }

  click(selector) { return this.eval(`document.querySelector(${JSON.stringify(selector)}).click()`); }

  key(type, code) {
    const keys = { Space: [' ', 32], KeyW: ['w', 87], KeyA: ['a', 65], KeyP: ['p', 80], KeyM: ['m', 77], ArrowLeft: ['ArrowLeft', 37], ArrowUp: ['ArrowUp', 38] };
    const [key, vk] = keys[code];
    return this.send('Input.dispatchKeyEvent', { type, code, key, windowsVirtualKeyCode: vk });
  }

  async press(code) { await this.key('keyDown', code); await this.key('keyUp', code); }

  mouse(type, x, y, buttons) {
    return this.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 });
  }

  // Makes the page report a touch screen as its main pointer, so `(pointer: coarse)` matches.
  coarsePointer(on = true) {
    return this.send('Emulation.setTouchEmulationEnabled', on ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
  }

  // Centre of an element in viewport coordinates, for touching or clicking it.
  center(selector) {
    return this.eval(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  }

  touch(type, points) {
    return this.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([id, x, y]) => ({ id, x, y })) });
  }

  async setFile(selector, file) {
    const { root } = await this.send('DOM.getDocument');
    const { nodeId } = await this.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    await this.send('DOM.setFileInputFiles', { files: [file], nodeId });
  }

  // Opens another tab in the same browser (same profile and storage), set up like this one.
  // Close it with tab.close(); the browser itself is closed by the first page's close().
  async newTab() {
    const base = `http://127.0.0.1:${this.port}`;
    const target = await (await fetch(`${base}/json/new?about:blank`, { method: 'PUT' })).json();
    const tab = await attach(target.webSocketDebuggerUrl, this.opts);
    tab.port = this.port;
    tab.close = async () => {
      try { await fetch(`${base}/json/close/${target.id}`, { signal: AbortSignal.timeout(3000) }); } catch { /* already gone */ }
      try { tab.ws.close(); } catch { /* already closed */ }
    };
    return tab;
  }

  // Starts a run from the main menu and waits for the player to exist.
  async startRun(name = 'Tester') {
    const t = Date.now();
    await this.eval(`document.getElementById('name').value = ${JSON.stringify(name)}`);
    await this.click('#play');
    await this.waitFor(`window.__player && !window.__player.dead && document.getElementById('paused').classList.contains('hidden')`, 'run to start');
    if (this.timing) process.stderr.write(`[chrome] startRun ${Date.now() - t}ms\n`);
  }
}

module.exports = { launch, gameUrl, sleep, removeProfile, REPO };
