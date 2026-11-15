/** Portable setup. Run again to repair dependencies or verify a copied project. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const root = __dirname;
const backend = path.join(root, 'backend');
const isWin = process.platform === 'win32';
const python = path.join(root, '.venv', isWin ? 'Scripts/python.exe' : 'bin/python');
const requirements = path.join(root, 'ml-service', 'requirements.txt');
const marker = path.join(root, '.venv', '.installed_requirements_hash');
const nodeMarker = path.join(backend, 'node_modules', '.installed_package_hash');
const probe = 'import sys,struct; assert sys.version_info[:2] in [(3,11),(3,12)] and struct.calcsize("P")==8; print(sys.executable)';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, windowsHide: true, ...options });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr?.toString().trim() || `${command} failed (exit ${result.status}).`);
  }
  return result.stdout?.toString().trim();
}
function hash(files) {
  const digest = crypto.createHash('sha256');
  for (const file of files) digest.update(fs.readFileSync(file));
  return digest.digest('hex');
}
function cached(file, expected) {
  return fs.existsSync(file) && fs.readFileSync(file, 'utf8').trim() === expected;
}
function main() {
  if (Number(process.versions.node.split('.')[0]) < 18) throw new Error('Node.js 18 or newer is required.');
  for (const file of ['Mental_Health_Model.pkl', 'resources.csv', 'mh_engine.py']) {
    if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing required file: ${file}`);
  }
  if (fs.existsSync(python)) {
    try { run(python, ['-c', probe], { encoding: 'utf8' }); }
    catch { throw new Error('The .venv interpreter is unusable or unsupported. Remove the project .venv folder and rerun node setup.js. Do not copy virtual environments between computers.'); }
  } else {
    const candidates = isWin
      ? [['py', '-3.12'], ['py', '-3.11'], ['python'], ['python3']]
      : [['python3.12'], ['python3.11'], ['python3'], ['python']];
    let executable;
    for (const [command, ...args] of candidates) {
      try { executable = run(command, [...args, '-c', probe], { encoding: 'utf8', timeout: 10000 }); break; }
      catch { /* Try the next installed interpreter. */ }
    }
    if (!executable) throw new Error('Install 64-bit Python 3.11 or 3.12 and add it to PATH, then rerun setup.');
    console.log('[Setup] Creating a project-local Python environment...');
    run(executable, ['-m', 'venv', path.join(root, '.venv')], { stdio: 'inherit' });
  }

  const pythonHash = hash([requirements]);
  let pythonReady = cached(marker, pythonHash);
  if (pythonReady) {
    try { run(python, ['-m', 'pip', 'check'], { encoding: 'utf8' }); }
    catch { pythonReady = false; }
    try { run(python, ['-c', 'import flask, numpy, pandas, sklearn, shap, joblib; assert sklearn.__version__ == "1.9.1"'], { encoding: 'utf8' }); }
    catch { pythonReady = false; }
  }
  if (!pythonReady) {
    console.log('[Setup] Installing Python dependencies...');
    run(python, ['-m', 'pip', 'install', '-r', requirements], { stdio: 'inherit' });
    run(python, ['-m', 'pip', 'check'], { stdio: 'inherit' });
  }

  const nodeHash = hash([path.join(backend, 'package.json'), path.join(backend, 'package-lock.json')]);
  let nodeReady = cached(nodeMarker, nodeHash);
  // Accept an existing complete install only when every locked package matches.
  if (!fs.existsSync(nodeMarker)) {
    try {
      const lock = JSON.parse(fs.readFileSync(path.join(backend, 'package-lock.json'), 'utf8'));
      nodeReady = Object.entries(lock.packages).filter(([name]) => name).every(([name, info]) =>
        JSON.parse(fs.readFileSync(path.join(backend, name, 'package.json'), 'utf8')).version === info.version);
    } catch { nodeReady = false; }
  }
  if (nodeReady) {
    try { run(process.execPath, ['-e', "for (const name of Object.keys(require('./package.json').dependencies)) require.resolve(name)"], { cwd: backend, encoding: 'utf8' }); }
    catch { nodeReady = false; }
  }
  if (!nodeReady) {
    console.log('[Setup] Installing locked Node dependencies...');
    run(isWin ? 'npm.cmd' : 'npm', ['ci', '--no-audit', '--no-fund'], { cwd: backend, stdio: 'inherit', shell: isWin });
  }
  fs.writeFileSync(nodeMarker, nodeHash);

  const envFile = path.join(backend, '.env');
  if (!fs.existsSync(envFile)) fs.copyFileSync(path.join(backend, '.env.example'), envFile);
  console.log('[Setup] Verifying the saved model and SHAP assessment...');
  run(python, ['-c', [
    'import joblib, pandas as pd, mh_engine as eng',
    'm=joblib.load("Mental_Health_Model.pkl")',
    'row={k:(lo+hi)/2 for k,(lo,hi) in eng.VALID_RANGES.items()}',
    'row.update({k:v[0] for k,v in eng.CHOICES.items()})',
    'result=eng.assess(m,row,pd.read_csv("resources.csv"))',
    'assert 0 <= result["score"] <= 10',
    'print("[OK] Model, explanation, plan and resources verified.")',
  ].join('; ')], { stdio: 'inherit' });
  fs.writeFileSync(marker, pythonHash);
  console.log('[OK] Setup complete. Run node start.js to launch.');
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(`[Setup failed] ${error.message}`); process.exitCode = 1; }
}
module.exports = { main };
