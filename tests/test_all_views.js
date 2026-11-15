/** Browser regression tests using an isolated Chromium profile (Node 22+). */
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { startStack, freePort, waitUntil, delay } = require('./helpers');

async function main() {
  if (typeof WebSocket === 'undefined') throw new Error('Browser tests need Node.js 22 or newer.');
  const browserPath = [process.env.BROWSER_BIN,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/chromium', '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find(file => file && fs.existsSync(file));
  if (!browserPath) throw new Error('Set BROWSER_BIN to your Chrome, Edge or Chromium executable.');
  const stack = await startStack();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wellbeing-browser-'));
  const debugPort = await freePort();
  let browser, socket;
  try {
    browser = spawn(browserPath, ['--headless=new', `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${temp}`, '--no-first-run', '--no-default-browser-check', 'about:blank'],
      { windowsHide: true, stdio: 'ignore' });
    browser.on('error', error => console.error(error.message));
    let pages;
    await waitUntil(async () => {
      try { pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json(); return pages.some(p => p.type === 'page'); }
      catch { return false; }
    }, 15000);
    socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let id = 0;
    const pending = new Map();
    const errors = [];
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
      const request = pending.get(message.id);
      if (request) {
        pending.delete(message.id); clearTimeout(request.timer);
        if (message.error) request.reject(new Error(JSON.stringify(message.error)));
        else request.resolve(message.result);
      }
    };
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const next = ++id;
        const timer = setTimeout(() => { pending.delete(next); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
        pending.set(next, { resolve, reject, timer });
        socket.send(JSON.stringify({ id: next, method, params }));
      });
    }
    async function evaluate(expression) {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    }
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('schedule_checks', '{broken');" });
    await send('Page.navigate', { url: stack.url });
    await waitUntil(() => evaluate("document.querySelector('#schedule-checklist')?.children.length === 7"));
    assert.equal(await evaluate('typeof window.Chart'), 'function', 'Chart.js must load');
    const viewports = [[320,568], [375,667], [430,932], [768,1024], [1024,768], [1100,768], [1366,768], [1440,900], [1920,1080], [2560,1440]];
    const views = ['dashboard', 'assessment', 'insights', 'recommendations', 'simulator', 'plan', 'resources', 'about'];
    for (const [width, height] of viewports) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
      for (const view of views) {
        await evaluate(`document.querySelector('[data-view="view-${view}"]').click()`);
        await delay(80);
        const overflow = await evaluate(`(() => {
          const bad = [];
          document.querySelectorAll('.view-section.active, .view-section.active *').forEach(el => {
            if (!el.getClientRects().length) return;
            let parent = el.parentElement;
            while (parent && parent !== document.body) {
              if (['auto','scroll'].includes(getComputedStyle(parent).overflowX)) return;
              parent = parent.parentElement;
            }
            const rect = el.getBoundingClientRect();
            if (rect.right > innerWidth + 1 || rect.left < -1) bad.push(el.className || el.tagName);
          });
          return bad;
        })()`);
        assert.deepEqual(overflow, [], `${width}px ${view} overflow`);
      }
      console.log(`PASS: all 8 views at ${width}x${height}`);
    }
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 1, mobile: true });
    await evaluate("document.getElementById('mobile-menu-btn').click()");
    assert.equal(await evaluate("document.getElementById('sidebar').classList.contains('open')"), true);
    await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))");
    assert.equal(await evaluate("document.getElementById('sidebar').classList.contains('open')"), false);
    await evaluate("document.getElementById('theme-toggle-btn').click()");
    assert.equal(await evaluate("document.documentElement.dataset.theme"), 'dark');
    await evaluate("document.querySelector('[data-preset=balanced]').click()");
    await waitUntil(() => evaluate("document.getElementById('sim-sleep').value === '8'"));
    await evaluate("document.getElementById('reset-simulation-btn').click()");
    assert.equal(await evaluate("document.getElementById('sim-sleep').value"), '8', 'Reset must use the selected preset');
    await evaluate(`(async () => {
      const {api} = await import('/js/api.js');
      window.originalAssess = api.assess;
      api.assess = async () => { throw new Error('Test service outage'); };
      document.querySelector('[data-view="view-assessment"]').click();
      document.getElementById('assessment-form').requestSubmit();
    })()`);
    await waitUntil(() => evaluate("document.querySelector('.toast-error')?.textContent.includes('Test service outage')"));
    assert.equal(await evaluate("document.querySelector('.view-section.active').id"), 'view-assessment');
    assert.equal(await evaluate("document.getElementById('submit-assessment-btn').disabled"), false);
    assert.equal(await evaluate("document.getElementById('toast-container').textContent.includes('Assessment updated successfully')"), false);
    await evaluate(`(async () => {
      const {api} = await import('/js/api.js'); api.assess = window.originalAssess;
      window.resolveSimulation = null;
      api.simulate = () => new Promise(resolve => { window.resolveSimulation = resolve; });
      const slider = document.getElementById('sim-sleep'); slider.value = 7;
      slider.dispatchEvent(new Event('input'));
    })()`);
    await waitUntil(() => evaluate('typeof window.resolveSimulation === "function"'));
    await evaluate("document.getElementById('reset-simulation-btn').click(); window.resolveSimulation({simulated_score:1, score_diff:-5})");
    await delay(100);
    assert.equal(await evaluate("document.getElementById('sim-target-score').textContent === document.getElementById('sim-base-score').textContent"), true, 'Reset must invalidate pending simulations');
    assert.deepEqual(errors, [], 'No uncaught browser errors');
    console.log('PASS: theme, drawer, corrupt storage, preset/reset, failed assessment and stale simulation regressions.');
    if (process.env.SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
      await evaluate("document.querySelector('[data-view=\"view-dashboard\"]').click()");
      for (const [width, height] of [[375,812], [1440,900]]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
        await delay(1000);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(process.env.SCREENSHOT_DIR, `dashboard-${width}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
    await send('Browser.close').catch(() => {});
  } finally {
    socket?.close(); browser?.kill(); await stack.stop();
    // The isolated browser profile is left in the OS temp folder for normal cleanup.
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
