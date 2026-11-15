@echo off
cd /d "%~dp0"
title Student Wellbeing Dashboard
echo ==========================================
echo   Student Wellbeing Dashboard (local)
echo ==========================================

where python >nul 2>nul
if errorlevel 1 (
  echo.
  echo Python is NOT installed.
  echo 1. Go to https://www.python.org/downloads/ and install Python 3.12
  echo 2. On the first installer screen TICK "Add python.exe to PATH"
  echo 3. Then double-click this file again.
  echo.
  pause
  exit /b 1
)

python -c "import sys; sys.exit(0 if sys.version_info>=(3,11) else 1)"
if errorlevel 1 (
  echo.
  echo Your Python is too old. Please install Python 3.12 from https://www.python.org/downloads/
  echo ^(tick "Add python.exe to PATH"^) and double-click this file again.
  echo.
  pause
  exit /b 1
)

if not exist "venv\Scripts\activate.bat" (
  echo.
  echo First-time setup: this takes 3-8 minutes and needs internet. Please wait...
  python -m venv venv
  call venv\Scripts\activate.bat
  python -m pip install --upgrade pip
  pip install -r requirements.txt
  if errorlevel 1 (
    echo.
    echo Installation failed. Check your internet connection and double-click this file again.
    rmdir /s /q venv
    pause
    exit /b 1
  )
) else (
  call venv\Scripts\activate.bat
)

if not exist "%USERPROFILE%\.streamlit" mkdir "%USERPROFILE%\.streamlit"
if not exist "%USERPROFILE%\.streamlit\credentials.toml" (
  >"%USERPROFILE%\.streamlit\credentials.toml" echo [general]
  >>"%USERPROFILE%\.streamlit\credentials.toml" echo email = ""
)

echo.
echo Starting the dashboard. Your browser will open at http://localhost:8501
echo To STOP it, close this window.
echo.
streamlit run app.py
pause
