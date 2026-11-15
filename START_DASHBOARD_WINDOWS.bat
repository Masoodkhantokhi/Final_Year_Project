@echo off
cd /d "%~dp0"
title Student Wellbeing Assessment Platform
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js from https://nodejs.org/ and rerun this launcher.
  pause
  exit /b 1
)
node start.js
if errorlevel 1 (
  echo Application failed. Review the error above.
  pause
  exit /b 1
)
