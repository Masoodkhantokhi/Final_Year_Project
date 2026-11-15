@echo off
cd /d "%~dp0"
title Student Wellbeing - Setup
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js from https://nodejs.org/ and rerun setup.
  pause
  exit /b 1
)
node setup.js
if errorlevel 1 (
  echo Setup failed. Review the error above.
  pause
  exit /b 1
)
pause
