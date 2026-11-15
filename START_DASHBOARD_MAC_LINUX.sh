#!/bin/bash
cd "$(dirname "$0")"
echo "=== Student Wellbeing Dashboard (local) ==="

PY=$(command -v python3 || command -v python)
if [ -z "$PY" ]; then
  echo "Python is not installed. Install Python 3.12 from https://www.python.org/downloads/ and run this again."
  exit 1
fi
if ! $PY -c "import sys; sys.exit(0 if sys.version_info>=(3,11) else 1)"; then
  echo "Your Python is too old. Install Python 3.12 from https://www.python.org/downloads/ and run this again."
  exit 1
fi

if [ ! -f venv/bin/activate ]; then
  echo "First-time setup: 3-8 minutes, needs internet..."
  $PY -m venv venv || exit 1
  source venv/bin/activate
  python -m pip install --upgrade pip
  pip install -r requirements.txt || { echo "Install failed. Check internet and run again."; rm -rf venv; exit 1; }
else
  source venv/bin/activate
fi

mkdir -p ~/.streamlit
[ -f ~/.streamlit/credentials.toml ] || printf '[general]\nemail = ""\n' > ~/.streamlit/credentials.toml

echo "Starting... your browser opens at http://localhost:8501  (press Ctrl+C to stop)"
streamlit run app.py
