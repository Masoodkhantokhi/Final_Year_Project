#!/bin/bash
cd "$(dirname "$0")"
echo "========================================================"
echo "  Student Wellbeing Assessment & Recommendation System"
echo "========================================================"
echo ""

# 1. Check Python
PY=$(command -v python3 || command -v python)
if [ -z "$PY" ]; then
  echo "[ERROR] Python is not installed. Install Python 3.12 and try again."
  exit 1
fi

# 2. Check Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js is not installed. Install Node.js from https://nodejs.org/ and try again."
  exit 1
fi

# 3. Setup venv if needed
if [ ! -f venv/bin/activate ]; then
  echo "[SETUP] Creating Python virtual environment..."
  $PY -m venv venv || exit 1
  source venv/bin/activate
  python -m pip install --upgrade pip
  pip install -r requirements.txt
else
  source venv/bin/activate
fi

# 4. Setup node dependencies if needed
if [ ! -d "backend/node_modules" ]; then
  echo "[SETUP] Installing Node.js backend dependencies..."
  (cd backend && npm install)
fi

# 5. Launch full application
echo "[START] Launching application services..."
node start.js
