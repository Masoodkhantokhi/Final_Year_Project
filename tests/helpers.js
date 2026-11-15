const { spawn } = require('child_process');
const path = require('path');
const net = require('net');
const root = path.resolve(__dirname, '..');
const sample = {
  Avg_Daily_Usage_Hours: 5, Daily_Unlocks: 170, Study_Hours: 3,
  Physical_Activity_Hours: 1.7, Sleep_Hours_Per_Night: 6.6,
  Academic_Level: 'Undergraduate', Purpose_Of_Use: 'Entertainment',
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function waitUntil(check, timeout = 60000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await delay(100);
  }
  throw new Error('Timed out waiting for test readiness');
}
async function startStack() {
  const children = [];
  let logs = '';
  const mlPort = await freePort();
  const port = await freePort();
  const mlUrl = `http://127.0.0.1:${mlPort}`;
  const url = `http://127.0.0.1:${port}`;
  const stop = async () => {
    await Promise.all(children.map(child => new Promise(resolve => {
      if (child.exitCode !== null || !child.pid) return resolve();
      child.once('exit', resolve);
      child.kill();
    })));
  };
  function launch(command, args, env) {
    const child = spawn(command, args, { cwd: root, windowsHide: true, env: { ...process.env, ...env } });
    children.push(child);
    child.on('error', error => { logs += error.message; });
    child.stdout.on('data', data => { logs = (logs + data).slice(-8000); });
    child.stderr.on('data', data => { logs = (logs + data).slice(-8000); });
  }
  try {
    launch(path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'), ['ml-service/app.py'], { ML_PORT: String(mlPort), PYTHONUNBUFFERED: '1' });
    launch(process.execPath, ['backend/server.js'], { PORT: String(port), ML_SERVICE_URL: mlUrl, NODE_ENV: 'test' });
    await waitUntil(async () => {
      if (children.some(child => child.exitCode !== null)) throw new Error(logs);
      try { return (await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1000) })).ok; }
      catch { return false; }
    });
    return { url, mlUrl, stop };
  } catch (error) { await stop(); throw new Error(`${error.message}\n${logs}`); }
}
module.exports = { startStack, sample, delay, freePort, waitUntil, root };
