@echo off
title MooreVIEW MVP Suite
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  Node.js 18 or newer is required.
  echo  Download: https://nodejs.org/
  echo.
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)

if not defined MOOREVIEW_DATA set "MOOREVIEW_DATA=%LOCALAPPDATA%\MooreVIEW\data"
if not exist "%MOOREVIEW_DATA%" mkdir "%MOOREVIEW_DATA%" 2>nul

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install --omit=dev
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

start "" "http://127.0.0.1:3090"
echo MooreVIEW MVP Suite — http://127.0.0.1:3090
echo Data: %MOOREVIEW_DATA%
echo Press Ctrl+C to stop.
node server.js
