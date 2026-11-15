@echo off
cd /d "%~dp0"
title Student Wellbeing Assessment Platform
echo ========================================================
echo   Student Wellbeing Assessment & Recommendation System
echo ========================================================
echo.

:: 1. Check Python
where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python is NOT installed.
  echo Please install Python 3.12 from https://www.python.org/downloads/
  echo (Make sure to tick "Add python.exe to PATH")
  pause
  exit /b 1
)

:: 2. Check Node.js
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is NOT installed.
  echo Please install Node.js (v18 or higher) from https://nodejs.org/
  pause
  exit /b 1
)

:: 3. Setup Python venv if not present
if not exist "venv\Scripts\activate.bat" (
  echo [SETUP] Creating Python virtual environment...
  python -m venv venv
  call venv\Scripts\activate.bat
  python -m pip install --upgrade pip
  pip install -r requirements.txt
)

:: 4. Ensure backend node_modules exist
if not exist "backend\node_modules" (
  echo [SETUP] Installing Node.js backend dependencies...
  cd backend
  call npm install
  cd ..
)

:: 5. Launch Full Application (ML Service + Express API Gateway + Browser)
echo [START] Launching application services...
node start.js
pause
