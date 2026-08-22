@echo off
title MV-workstation - cursaves sync setup
cd /d "%~dp0"
echo.
echo  MV-workstation cursaves sync
echo  GitHub login: mooreview account (browser or token)
echo  Windows roy/yell is ONLY for file copy from home PC - not used here.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0mv-workstation-cursaves-sync.ps1" %*
if errorlevel 1 (
  echo.
  echo FAILED - see errors above.
  pause
  exit /b 1
)
echo.
pause
