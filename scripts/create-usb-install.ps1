# Build mooreview-mvp-suite on a USB/removable drive (Windows).
param(
  [string]$DriveLetter = 'E',
  [switch]$SkipFork,
  [switch]$SkipNpmInstall
)

$ErrorActionPreference = 'Stop'
$BaseRoot = Split-Path $PSScriptRoot -Parent
$ParentDir = Split-Path $BaseRoot -Parent
$ProductName = 'mooreview-mvp-suite'
$UsbRoot = "${DriveLetter}:\"
$Target = Join-Path $UsbRoot $ProductName

if (-not (Test-Path $UsbRoot)) {
  throw "Drive ${DriveLetter}: not found. Insert the USB stick and retry."
}

function Write-UsbLaunchers([string]$InstallDir) {
  $installBat = @"
@echo off
title MooreVIEW MVP Suite — Install
cd /d "%~dp0$ProductName"
where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  Node.js 18+ is required. Install from https://nodejs.org/
  echo  Then run this script again.
  echo.
  pause
  exit /b 1
)
echo Installing MooreVIEW MVP Suite dependencies...
call npm install --omit=dev
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)
echo.
echo  Install complete. Double-click "Start MooreVIEW.bat" on the USB drive.
echo.
pause
"@
  $startBat = @"
@echo off
title MooreVIEW MVP Suite
cd /d "%~dp0$ProductName"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 18+ is required. Run "Install MooreVIEW.bat" first.
  pause
  exit /b 1
)
if not exist "node_modules\" (
  echo node_modules missing — run "Install MooreVIEW.bat" first.
  pause
  exit /b 1
)
start "" "http://127.0.0.1:3090"
echo MooreVIEW MVP Suite — http://127.0.0.1:3090
echo Press Ctrl+C to stop.
node server.js
"@
  $readme = @"
MooreVIEW MVP Suite — USB install
=================================

Requirements: Node.js 18 or newer (https://nodejs.org/)

First time on this PC:
  1. Double-click  Install MooreVIEW.bat
  2. Double-click  Start MooreVIEW.bat
  3. Browser opens http://127.0.0.1:3090 — press F1 for help

Projects and settings are stored in:
  $ProductName\data\

Optional: set MONGODB_URI before Start for tag historian.

Regenerate this USB copy from dev tree:
  cd est-pc
  powershell -File scripts\create-usb-install.ps1 -DriveLetter $DriveLetter
"@
  Set-Content -Path (Join-Path $UsbRoot 'Install MooreVIEW.bat') -Value $installBat -Encoding ASCII
  Set-Content -Path (Join-Path $UsbRoot 'Start MooreVIEW.bat') -Value $startBat -Encoding ASCII
  Set-Content -Path (Join-Path $UsbRoot 'README.txt') -Value $readme -Encoding UTF8
}

Write-Host "USB target: $Target" -ForegroundColor Cyan

if (-not $SkipFork) {
  Write-Host "Regenerating $ProductName from est-pc..." -ForegroundColor Cyan
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'create-product-forks.ps1') -Products mvp-suite -Clean
}

$Source = Join-Path $ParentDir $ProductName
if (-not (Test-Path $Source)) {
  throw "Missing product folder: $Source"
}

if (Test-Path $Target) {
  Write-Host "Removing previous USB copy..." -ForegroundColor Yellow
  Remove-Item $Target -Recurse -Force
}

Write-Host "Copying to USB (this may take a few minutes)..." -ForegroundColor Cyan
robocopy $Source $Target /MIR /XD node_modules .git data\.cache /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }

Write-UsbLaunchers -InstallDir $Target

if (-not $SkipNpmInstall) {
  Write-Host "Running npm install on USB..." -ForegroundColor Cyan
  Push-Location $Target
  try {
    npm install --omit=dev
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
  } finally {
    Pop-Location
  }
}

Write-Host "`nUSB install ready:" -ForegroundColor Green
Write-Host "  ${DriveLetter}:\Install MooreVIEW.bat"
Write-Host "  ${DriveLetter}:\Start MooreVIEW.bat"
Write-Host "  $Target"
