// End-to-end check against a real browser and the actual served files —
// manifest, service worker, and offline fallback included. The node --test
// suite stubs out the DOM enough that it can't exercise any of that, or a
// real click, or the bootstrap itself; several real bugs this project hit
// (a stuck "Loading...", a layout regression, a mid-render crash) were only
// ever caught by hand-rolling a script exactly like this one and looking at
// what came back. This keeps that check around instead of re-inventing it
// every time something needs a real-browser look.
//
// Requires a local Chrome/Chromium. Set CHROME_PATH to override the guess.
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.png': 'image/png' };

const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); };

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p));
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createNetServer();
    s.listen(0, () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', reject);
  });
}

function waitForCdp(port, tries = 40) {
  return (async () => {
    for (let i = 0; i < tries; i++) {
      try { await fetch(`http://localhost:${port}/json/version`); return; } catch { /* retry */ }
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error('Chrome never came up on the DevTools port');
  })();
}

async function main() {
  process.stdout.write('Smoke test: launching a real browser against the real files.\n');

  const chromePath = findChrome();
  if (!chromePath) {
    console.error('No Chrome/Chromium found. Set CHROME_PATH or install one.');
    process.exit(1);
  }

  const httpServer = createHttpServer(async (req, res) => {
    const path = decodeURIComponent(req.url.split('?')[0]);
    const file = join(root, path === '/' ? 'index.html' : path.slice(1));
    try {
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404); res.end('not found');
    }
  });
  const httpPort = await new Promise((resolve) => {
    httpServer.listen(0, () => resolve(httpServer.address().port));
  });

  const cdpPort = await freePort();
  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${cdpPort}`,
    '--no-first-run', '--no-default-browser-check', 'about:blank'
  ], { stdio: 'ignore' });

  try {
    await waitForCdp(cdpPort);
    const tabs = await (await fetch(`http://localhost:${cdpPort}/json/list`)).json();
    const target = tabs.find((t) => t.type === 'page') || tabs[0];
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

    let id = 0;
    const pending = new Map();
    const exceptions = [];
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
      else if (m.method === 'Runtime.exceptionThrown') exceptions.push(m.params.exceptionDetails.text);
    };
    const send = (method, params = {}) => new Promise((r) => {
      const myId = ++id; pending.set(myId, r); ws.send(JSON.stringify({ id: myId, method, params }));
    });
    const evalJs = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text);
      return r.result?.result?.value;
    };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const base = `http://localhost:${httpPort}`;

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');

    // --- fresh load ---
    await evalJs('localStorage.clear()').catch(() => {});
    await send('Page.navigate', { url: `${base}/?nocache=${Date.now()}` });
    await sleep(1200);
    const initial = await evalJs("document.getElementById('view')?.innerText || ''");
    check(initial.length > 0, 'fresh load: view is empty');
    check(!/NaN|undefined/.test(initial), 'fresh load: view contains NaN/undefined');

    // --- every tab renders, no exceptions ---
    for (const tab of ['sight', 'reading', 'learn', 'progress']) {
      await evalJs(`document.querySelector('nav button[data-tab="${tab}"]')?.click()`);
      await sleep(300);
      const html = await evalJs("document.getElementById('view')?.innerText || ''");
      check(html.length > 0, `${tab} tab: view is empty`);
      check(!/NaN|undefined/.test(html), `${tab} tab: view contains NaN/undefined`);
    }

    // --- practice session: persistent strip works from another tab ---
    await evalJs(`document.querySelector('nav button[data-tab="progress"]')?.click()`);
    await sleep(300);
    await evalJs(`document.querySelector('#sesspane [data-mins="10"]')?.click()`);
    await sleep(300);
    await evalJs(`document.querySelector('nav button[data-tab="sight"]')?.click()`);
    await sleep(300);
    const sightViewBefore = await evalJs("document.getElementById('view')?.innerText || ''");
    const stripWithSession = await evalJs("document.getElementById('now')?.innerText || ''");
    check(/Session running/.test(stripWithSession), 'strip does not show live session controls on another tab');
    await evalJs(`document.querySelector('#now [data-nowtoggle]')?.click()`);
    await sleep(300);
    const sightViewAfter = await evalJs("document.getElementById('view')?.innerText || ''");
    check(sightViewAfter === sightViewBefore, 'toggling a session slot from the strip re-rendered the active tab');
    await evalJs(`document.querySelector('#now [data-nowdone]')?.click()`);
    await evalJs(`document.querySelector('#now [data-nowdone]')?.click()`);
    await sleep(300);
    const stripAfterDone = await evalJs("document.getElementById('now')?.innerText || ''");
    check(/Finish the slots/.test(stripAfterDone), 'strip did not fall back to the plain directive once every slot was done');
    await evalJs(`document.querySelector('nav button[data-tab="progress"]')?.click()`);
    await sleep(300);
    await evalJs(`document.getElementById('endsess')?.click()`);
    await sleep(300);

    // --- backup export / restore round trip ---
    await evalJs(`
      const details = Array.from(document.querySelectorAll('details')).find(d => d.textContent.includes('Back up or move your progress'));
      if (details) details.open = true;
      document.getElementById('importtoggle')?.click();
    `);
    const rejectMsg = await evalJs(`
      document.getElementById('importtext').value = JSON.stringify({ nope: true });
      document.getElementById('importgo').click();
      document.getElementById('importmsg')?.textContent;
    `);
    check(/Could not restore/.test(rejectMsg || ''), 'restore accepted a JSON object with none of the real shape');

    const legacyBackup = { app: 'piano-practice', version: 1, state: {
      sight: { step: 3, passed: { 0: true, 1: true, 2: true }, history: {} },
      session: { mins: 10, slots: [{ id: 'tech', total: 180, left: 60, running: true, startedAt: Date.now() - 2000, done: false }] }
    } };
    const restoreMsg = await evalJs(`
      document.getElementById('importtext').value = ${JSON.stringify(JSON.stringify(legacyBackup))};
      document.getElementById('importgo').click();
      document.getElementById('importmsg')?.textContent;
    `);
    check(!/Could not restore/.test(restoreMsg || ''), `restore rejected a real (if old-shaped) backup: ${restoreMsg}`);
    await sleep(300);
    const stripAfterRestore = await evalJs("document.getElementById('now')?.innerText || ''");
    check(!/NaN|undefined/.test(stripAfterRestore), 'strip shows NaN/undefined after restoring a legacy session shape');

    const exportOk = await evalJs(`
      (() => { try { document.getElementById('exportbtn').click(); return true; } catch (e) { return false; } })()
    `);
    check(exportOk === true, 'clicking the export button threw');

    // --- PWA: manifest, service worker, offline fallback ---
    const manifest = await send('Page.getAppManifest');
    check((manifest.result?.errors || []).length === 0, `manifest has validation errors: ${JSON.stringify(manifest.result?.errors)}`);

    await sleep(1000); // give the load-event SW registration time to fire
    const swActive = await evalJs(`
      (async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return !!(reg && reg.active);
      })()
    `);
    check(swActive === true, 'service worker did not register/activate');

    await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await send('Page.navigate', { url: `${base}/?nocache=offline` });
    await sleep(1200);
    const offlineView = await evalJs("document.getElementById('view')?.innerText || ''").catch(() => '');
    check(offlineView.length > 0, 'app did not render from cache while offline');
    await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

    check(exceptions.length === 0, `uncaught exceptions during the run:\n${exceptions.join('\n')}`);

    ws.close();
  } finally {
    chrome.kill();
    httpServer.close();
  }

  if (failures.length) {
    console.error(`\n${failures.length} smoke check(s) failed:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exit(1);
  }
  console.log('\nAll smoke checks passed.');
}

main().catch((e) => { console.error('Smoke test crashed:', e); process.exit(1); });
