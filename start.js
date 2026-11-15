/**
 * start.js
 * Cross-platform unified application orchestrator.
 * Spawns both the Python ML Microservice and the Node.js Express Backend,
 * waits for readiness, opens the browser, and handles graceful shutdown.
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const http = require('http');

const isWin = process.platform === 'win32';
const pythonCmd = isWin
  ? path.join(__dirname, 'venv', 'Scripts', 'python.exe')
  : path.join(__dirname, 'venv', 'bin', 'python');

console.log('========================================================');
console.log(' Starting Student Wellbeing Assessment System...');
console.log('========================================================');

// 1. Launch Python ML Microservice
console.log('[1/3] Launching Python ML Microservice on port 5001...');
const mlProcess = spawn(pythonCmd, [path.join(__dirname, 'ml-service', 'app.py')], {
  stdio: 'inherit',
  shell: true,
});

mlProcess.on('error', (err) => {
  console.error('Failed to start Python ML Service:', err.message);
  process.exit(1);
});

// Wait for ML Service to be ready
function waitForMl(retries = 20) {
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get('http://127.0.0.1:5001/health', (res) => {
        if (res.statusCode === 200) {
          console.log('[2/3] ML Microservice is ready!');
          resolve();
        } else {
          retry();
        }
      });

      req.on('error', retry);
      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (retries <= 0) {
        reject(new Error('ML Microservice did not start in time.'));
      } else {
        retries--;
        setTimeout(check, 500);
      }
    };

    check();
  });
}

waitForMl()
  .then(() => {
    // 2. Launch Node.js Backend Gateway
    console.log('[3/3] Starting Express Backend on port 3000...');
    const backendProcess = spawn('node', [path.join(__dirname, 'backend', 'server.js')], {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, PORT: '3000', ML_SERVICE_URL: 'http://127.0.0.1:5001' },
    });

    backendProcess.on('error', (err) => {
      console.error('Failed to start Express backend:', err.message);
      mlProcess.kill();
      process.exit(1);
    });

    // 3. Open browser after 1 second
    setTimeout(() => {
      const url = 'http://localhost:3000';
      console.log(`\n>>> Application running at: ${url} <<<\n`);
      const startCmd = isWin ? `start ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
      exec(startCmd);
    }, 1200);

    // Graceful shutdown
    const cleanup = () => {
      console.log('\nShutting down application services...');
      try {
        if (isWin) {
          exec('taskkill /pid ' + mlProcess.pid + ' /T /F');
          exec('taskkill /pid ' + backendProcess.pid + ' /T /F');
        } else {
          mlProcess.kill('SIGTERM');
          backendProcess.kill('SIGTERM');
        }
      } catch (e) {}
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  })
  .catch((err) => {
    console.error('Startup failed:', err.message);
    mlProcess.kill();
    process.exit(1);
  });
