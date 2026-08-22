@echo off
title Fix cursaves remote sync (GitHub login)
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0fix-cursaves-remote.ps1"
pause
