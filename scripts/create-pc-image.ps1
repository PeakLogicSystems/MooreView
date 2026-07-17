# Build a complete MooreVIEW PC install image (Node + MongoDB ready).
# Output: ..\mooreview-mvp-suite\  (and optional zip under dist\pc-image\)
param(
  [switch]$SkipFork,
  [switch]$SkipNpmInstall,
  [switch]$SkipZip,
  [string]$OutDir = ''
)

$ErrorActionPreference = 'Stop'
$EstRoot = Split-Path $PSScriptRoot -Parent
$ParentDir = Split-Path $EstRoot -Parent
$ProductName = 'mooreview-mvp-suite'
$ProductRoot = if ($OutDir) { $OutDir } else { Join-Path $ParentDir $ProductName }
$DistRoot = Join-Path $EstRoot 'dist\pc-image'
$DeployWin = Join-Path $EstRoot 'deploy\windows'

function Write-PcEnv([string]$Dir) {
  $example = @"
# MooreVIEW MVP Suite - PC install
# Copy to .env (already done for this image). Requires MongoDB on this PC.

PORT=3090
MOOREVIEW_PRODUCT=mvp-suite
MOOREVIEW_DEPLOYMENT=appliance
MOOREVIEW_DATA=./data

# MongoDB - config + historian (install MongoDB Community and start the service)
MOOREVIEW_CONFIG_URI=mongodb://127.0.0.1:27017
MOOREVIEW_CONFIG_DB=mooreview_config
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=mooreview
MONGODB_COLLECTION=tag_logs
"@
  $envFile = @"
# MooreVIEW MVP Suite - PC appliance (generated for Node + Mongo install)
PORT=3090
MOOREVIEW_PRODUCT=mvp-suite
MOOREVIEW_DEPLOYMENT=appliance
MOOREVIEW_DATA=./data
MOOREVIEW_CONFIG_URI=mongodb://127.0.0.1:27017
MOOREVIEW_CONFIG_DB=mooreview_config
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=mooreview
MONGODB_COLLECTION=tag_logs
"@
  Set-Content -Path (Join-Path $Dir '.env.example') -Value $example -Encoding UTF8
  Set-Content -Path (Join-Path $Dir '.env') -Value $envFile -Encoding UTF8
}

function Write-PcLaunchers([string]$Dir) {
  $installBat = @"
@echo off
title MooreVIEW MVP Suite - Install
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  Node.js 18+ is required. Install from https://nodejs.org/
  echo  Then run this script again.
  echo.
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)
echo Checking MongoDB...
sc query MongoDB >nul 2>&1
if errorlevel 1 (
  echo.
  echo  WARNING: MongoDB Windows service not found.
  echo  Install MongoDB Community Server and ensure it listens on 127.0.0.1:27017
  echo  https://www.mongodb.com/try/download/community
  echo.
) else (
  net start MongoDB >nul 2>&1
  echo  MongoDB service is available.
)
echo.
echo Installing MooreVIEW dependencies...
call npm install --omit=dev
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)
if not exist ".env" (
  copy /Y ".env.example" ".env" >nul
)
echo.
echo Importing bundled projects into MongoDB...
set "MOOREVIEW_DATA=%~dp0data"
node scripts\seed-bundled-projects.js
if errorlevel 1 (
  echo WARNING: project seed failed - ensure MongoDB is running, then run:
  echo   set MOOREVIEW_DATA=%~dp0data
  echo   node scripts\seed-bundled-projects.js
)
echo.
echo  Install complete.
echo  Next: double-click "Start MooreVIEW.bat"
echo  UI:    http://127.0.0.1:3090
echo.
pause
"@

  $startBat = @"
@echo off
title MooreVIEW MVP Suite
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 18+ is required. Run "Install MooreVIEW.bat" first.
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)
if not exist "node_modules\" (
  echo node_modules missing - run "Install MooreVIEW.bat" first.
  pause
  exit /b 1
)
if not exist ".env" copy /Y ".env.example" ".env" >nul
set "MOOREVIEW_DATA=%~dp0data"
sc query MongoDB >nul 2>&1
if not errorlevel 1 net start MongoDB >nul 2>&1
start "" "http://127.0.0.1:3090"
echo MooreVIEW MVP Suite - http://127.0.0.1:3090
echo MongoDB: mongodb://127.0.0.1:27017
echo Data:    %MOOREVIEW_DATA%
echo Projects: %MOOREVIEW_DATA%\projects
echo Press Ctrl+C to stop.
node server.js
"@

  $stopBat = @"
@echo off
title Stop MooreVIEW
cd /d "%~dp0"
node scripts\stop-server.js 2>nul
if errorlevel 1 (
  echo Unable to stop via stop-server.js - closing node processes for this folder if any.
)
echo Done.
timeout /t 2 >nul
"@

  Set-Content -Path (Join-Path $Dir 'Install MooreVIEW.bat') -Value $installBat -Encoding ASCII
  Set-Content -Path (Join-Path $Dir 'Start MooreVIEW.bat') -Value $startBat -Encoding ASCII
  Set-Content -Path (Join-Path $Dir 'Stop MooreVIEW.bat') -Value $stopBat -Encoding ASCII

  $pcCmd = @"
@echo off
title MooreVIEW MVP Suite
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 18+ is required.
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)
set "MOOREVIEW_DATA=%~dp0data"
if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install --omit=dev
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)
if not exist ".env" copy /Y ".env.example" ".env" >nul
sc query MongoDB >nul 2>&1
if not errorlevel 1 net start MongoDB >nul 2>&1
start "" "http://127.0.0.1:3090"
echo MooreVIEW MVP Suite - http://127.0.0.1:3090
echo Data: %MOOREVIEW_DATA%
echo Press Ctrl+C to stop.
node server.js
"@
  Set-Content -Path (Join-Path $Dir 'MooreVIEW.cmd') -Value $pcCmd -Encoding ASCII

  $stopCmd = Join-Path $DeployWin 'MooreVIEW-Stop.cmd'
  if (Test-Path $stopCmd) {
    Copy-Item $stopCmd (Join-Path $Dir 'MooreVIEW-Stop.cmd') -Force
  }
}

function Write-PcReadme([string]$Dir, [string]$Version) {
  $readme = @"
MooreVIEW MVP Suite v$Version - PC install image
================================================

This folder is a complete copy of MooreVIEW for a Windows/Linux PC with:

  • Node.js 18+   https://nodejs.org/
  • MongoDB        local service on 127.0.0.1:27017
                   https://www.mongodb.com/try/download/community

Quick start (Windows)
---------------------
1. Install Node.js 18+ and MongoDB Community (keep MongoDB service running).
2. Double-click  Install MooreVIEW.bat   (once)
3. Double-click  Start MooreVIEW.bat
4. Browser opens http://127.0.0.1:3090 - press F1 for help

Stop: double-click  Stop MooreVIEW.bat

Configuration
-------------
File .env is preconfigured for localhost MongoDB:

  MOOREVIEW_CONFIG_URI=mongodb://127.0.0.1:27017
  MONGODB_URI=mongodb://127.0.0.1:27017
  PORT=3090
  MOOREVIEW_DATA=./data

Projects and settings live under .\data\

Command line
------------
  npm install --omit=dev
  npm start

Regenerate this image from the est-pc development tree
------------------------------------------------------
  cd est-pc
  powershell -File scripts\create-pc-image.ps1
"@
  Set-Content -Path (Join-Path $Dir 'PC-INSTALL.txt') -Value $readme -Encoding UTF8

  $md = @"
# MooreVIEW MVP Suite - PC install image

Complete appliance copy for a PC with **Node.js 18+** and **MongoDB** (localhost).

## Prerequisites

1. [Node.js 18+](https://nodejs.org/)
2. [MongoDB Community Server](https://www.mongodb.com/try/download/community) listening on ``127.0.0.1:27017``

## Install (Windows)

1. Run ``Install MooreVIEW.bat``
2. Run ``Start MooreVIEW.bat``
3. Open **http://127.0.0.1:3090** (F1 for in-app help)

Stop with ``Stop MooreVIEW.bat``.

## Install (any OS)

``````bash
npm install --omit=dev
npm start
``````

``.env`` points config and historian at local MongoDB. Copy from ``.env.example`` if missing.

## Regenerate

From ``est-pc``:

``````powershell
powershell -File scripts\create-pc-image.ps1
``````
"@
  Set-Content -Path (Join-Path $Dir 'PC-INSTALL.md') -Value $md -Encoding UTF8
}

Write-Host "PC image target: $ProductRoot" -ForegroundColor Cyan

if (-not $SkipFork) {
  Write-Host "Regenerating $ProductName from est-pc..." -ForegroundColor Cyan
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'create-product-forks.ps1') -Products mvp-suite -Clean
}

if (-not (Test-Path $ProductRoot)) {
  throw "Missing product folder: $ProductRoot - run without -SkipFork first"
}

$pkg = Get-Content (Join-Path $ProductRoot 'package.json') -Raw | ConvertFrom-Json
$version = [string]$pkg.version

Write-Host "Adding PC install assets (v$version)..." -ForegroundColor Cyan
Write-PcEnv -Dir $ProductRoot
Write-PcLaunchers -Dir $ProductRoot
Write-PcReadme -Dir $ProductRoot -Version $version

# Ensure data dir exists for first run
$dataDir = Join-Path $ProductRoot 'data'
if (-not (Test-Path $dataDir)) {
  New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
}

if (-not $SkipNpmInstall) {
  Write-Host "Running npm install --omit=dev (may take several minutes)..." -ForegroundColor Cyan
  Push-Location $ProductRoot
  try {
    if (Test-Path 'package-lock.json') {
      npm ci --omit=dev
    } else {
      npm install --omit=dev
    }
    if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit $LASTEXITCODE" }
  } finally {
    Pop-Location
  }
} else {
  Write-Host 'SkipNpmInstall: run Install MooreVIEW.bat (or npm install) on the target PC' -ForegroundColor Yellow
}

$zipPath = $null
if (-not $SkipZip) {
  if (-not (Test-Path $DistRoot)) { New-Item -ItemType Directory -Path $DistRoot -Force | Out-Null }
  $stamp = Get-Date -Format 'yyyyMMdd'
  $zipPath = Join-Path $DistRoot "mooreview-mvp-suite-pc-${version}-${stamp}.zip"
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  Write-Host "Creating zip: $zipPath" -ForegroundColor Cyan
  # Exclude bulky cache if present; include node_modules for offline-ready image
  Compress-Archive -Path (Join-Path $ProductRoot '*') -DestinationPath $zipPath -CompressionLevel Optimal
  $sizeMb = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
  Write-Host "Zip size: ${sizeMb} MB" -ForegroundColor Green
}

Write-Host ''
Write-Host 'PC install image ready:' -ForegroundColor Green
Write-Host "  Folder: $ProductRoot"
Write-Host '  Install MooreVIEW.bat / Start MooreVIEW.bat / Stop MooreVIEW.bat'
Write-Host '  .env configured for mongodb://127.0.0.1:27017'
if ($zipPath) { Write-Host "  Zip:    $zipPath" }
Write-Host '  UI:     http://127.0.0.1:3090'
