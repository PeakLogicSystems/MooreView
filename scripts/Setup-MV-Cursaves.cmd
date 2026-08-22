@echo off
title MooreVIEW - setup cursaves on MV-workstation
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-mv-workstation-cursaves.ps1"
if errorlevel 1 (
  echo.
  echo Setup failed. See errors above.
  pause
  exit /b 1
)
echo.
pause
