/** Start both services, check readiness, and stop only the processes we own. */
const { spawn, execFile, spawnSync } = require('child_process');
const path = require('path');
const net = require('net');
const root = __dirname;
const isWin = process.platform === 'win32';
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null && child.pid) {
      if (isWin) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else child.kill('SIGTERM');
    }
  }
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

function portFree(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`Port ${port} is unavailable. Close the application using it or change backend/.env.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}
function launch(command, args, env) {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', windowsHide: true, env: { ...process.env, ...env } });
  children.push(child);
  child.once('error', error => { console.error(error.message); stop(1); });
  child.once('exit', (code, signal) => {
    if (!stopping) { console.error(`Service stopped unexpectedly (${signal || code}).`); stop(1); }
  });
  return child;
}
async function waitFor(url, expected) {
  const deadline = Date.now() + 60000;
  while (!stopping && Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok && (await response.json()).status === expected) return;
    } catch { /* Service is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`Service did not become healthy: ${url}`);
}
async function main() {
  require('./setup').main();
  require('./backend/node_modules/dotenv').config({ path: path.join(root, 'backend', '.env') });
  const port = Number(process.env.PORT || 3000);
  const mlUrl = new URL(process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001');
  const mlPort = Number(process.env.ML_PORT || mlUrl.port || 5001);
  if (![port, mlPort].every(value => Number.isInteger(value) && value > 0 && value < 65536) || port === mlPort) {
    throw new Error('PORT and ML_PORT must be different valid ports.');
  }
  if (!['localhost', '127.0.0.1'].includes(mlUrl.hostname) || mlUrl.protocol !== 'http:') {
    throw new Error('The combined launcher requires a local HTTP ML_SERVICE_URL.');
  }
  await Promise.all([portFree(port), portFree(mlPort)]);
  const mlAddress = `http://127.0.0.1:${mlPort}`;
  launch(path.join(root, '.venv', isWin ? 'Scripts/python.exe' : 'bin/python'), [path.join(root, 'ml-service', 'app.py')], { ML_PORT: String(mlPort), PYTHONUNBUFFERED: '1' });
  await waitFor(`${mlAddress}/health`, 'ok');
  launch(process.execPath, [path.join(root, 'backend', 'server.js')], { PORT: String(port), ML_SERVICE_URL: mlAddress });
  await waitFor(`http://127.0.0.1:${port}/api/health`, 'healthy');
  if (stopping) return;
  const url = `http://localhost:${port}`;
  console.log(`\nApplication ready: ${url}\nPress Ctrl+C to stop.\n`);
  if (process.env.NO_BROWSER !== '1') {
    const command = isWin ? 'rundll32' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = isWin ? ['url.dll,FileProtocolHandler', url] : [url];
    execFile(command, args, { windowsHide: true }, error => {
      if (error) console.log(`Open ${url} in your browser.`);
    });
  }
}
main().catch(error => { console.error(`[Startup failed] ${error.message}`); stop(1); });
