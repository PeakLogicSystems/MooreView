# Build a complete MooreVIEW MVP laptop install: app + data/ + MongoDB dump + restore scripts.
param(
  [string]$OutputRoot = (Join-Path (Split-Path $PSScriptRoot -Parent) 'dist'),
  [string]$BundleName = '',
  [switch]$SkipFork,
  [switch]$SkipNpmInstall,
  [switch]$SkipMongoDump,
  [string]$MongoUri = 'mongodb://127.0.0.1:27017',
  [string]$MongoDb = 'mooreview'
)

$ErrorActionPreference = 'Stop'
$EstRoot = Split-Path $PSScriptRoot -Parent
$ParentDir = Split-Path $EstRoot -Parent
$ProductName = 'mooreview-mvp-suite'
$ProductSource = Join-Path $ParentDir $ProductName
$ToolsBin = Join-Path $EstRoot 'vendor\mongodb-database-tools\bin'
$Mongodump = Join-Path $ToolsBin 'mongodump.exe'
$Mongorestore = Join-Path $ToolsBin 'mongorestore.exe'

if (-not $BundleName) {
  $BundleName = "mooreview-laptop-$(Get-Date -Format 'yyyyMMdd-HHmm')"
}
$BundleDir = Join-Path $OutputRoot $BundleName
$AppDir = Join-Path $BundleDir $ProductName
$DumpDir = Join-Path $BundleDir 'mongodb-dump'

function Ensure-MongoTools {
  if ((Test-Path $Mongodump) -and (Test-Path $Mongorestore)) { return }
  $vendorRoot = Join-Path $EstRoot 'vendor'
  $zipPath = Join-Path $vendorRoot 'mongodb-database-tools.zip'
  $toolsDir = Join-Path $vendorRoot 'mongodb-database-tools'
  if (-not (Test-Path $vendorRoot)) { New-Item -ItemType Directory -Path $vendorRoot -Force | Out-Null }
  $url = 'https://fastdl.mongodb.org/tools/db/mongodb-database-tools-windows-x86_64-100.12.0.zip'
  Write-Host "Downloading MongoDB Database Tools..." -ForegroundColor Cyan
  Invoke-WebRequest -Uri $url -OutFile $zipPath
  Expand-Archive -Path $zipPath -DestinationPath $vendorRoot -Force
  $extracted = Get-ChildItem $vendorRoot -Directory | Where-Object { $_.Name -like 'mongodb-database-tools*' } | Select-Object -First 1
  if (-not $extracted) { throw 'MongoDB Database Tools extract failed' }
  if ($extracted.FullName -ne $toolsDir) {
    if (Test-Path $toolsDir) { Remove-Item $toolsDir -Recurse -Force }
    Rename-Item $extracted.FullName $toolsDir
  }
  Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
  if (-not (Test-Path $Mongodump)) { throw "mongodump not found at $Mongodump" }
}

function Write-BundleLaunchers {
  $installBat = @"
@echo off
title MooreVIEW MVP Suite — Laptop Install
cd /d "%~dp0$ProductName"
where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  Node.js 18+ is required: https://nodejs.org/
  echo.
  pause
  exit /b 1
)
echo Installing MooreVIEW dependencies...
call npm install --omit=dev
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)
echo.
echo  App install complete.
echo  Next: run "Restore MongoDB.bat" if this is a new laptop.
echo  Then: "Start MooreVIEW.bat"
echo.
pause
"@
  $restoreBat = @"
@echo off
title MooreVIEW — Restore MongoDB
set TOOLS=%~dp0mongodb-tools\bin
set DUMP=%~dp0mongodb-dump
if not exist "%TOOLS%\mongorestore.exe" (
  echo MongoDB tools missing in bundle.
  pause
  exit /b 1
)
where mongod >nul 2>&1
if errorlevel 1 (
  echo.
  echo  MongoDB Server is not installed or not on PATH.
  echo  Install MongoDB Community Server 7 or 8:
  echo    https://www.mongodb.com/try/download/community
  echo  Use default port 27017, then run this script again.
  echo.
  pause
  exit /b 1
)
echo Restoring database "$MongoDb" from:
echo   %DUMP%
"%TOOLS%\mongorestore.exe" --uri=$MongoUri --drop --db=$MongoDb "%DUMP%\$MongoDb"
if errorlevel 1 (
  echo mongorestore failed.
  pause
  exit /b 1
)
echo.
echo  MongoDB restore complete.
echo  Start MooreVIEW with "Start MooreVIEW.bat"
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
set MONGODB_URI=$MongoUri
start "" "http://127.0.0.1:3090"
echo MooreVIEW MVP Suite — http://127.0.0.1:3090
echo Press Ctrl+C to stop.
node server.js
"@
  $readme = @"
MooreVIEW MVP Suite — Laptop portable install
=============================================

Built: $(Get-Date -Format o)
Bundle: $BundleName

Requirements on the laptop
--------------------------
1. Node.js 18+     https://nodejs.org/
2. MongoDB 7/8     https://www.mongodb.com/try/download/community
   - Install as a Windows service (default port 27017)
   - App expects: $MongoUri / database "$MongoDb"

First-time setup
----------------
1. Copy this entire folder to the laptop (e.g. C:\MooreVIEW\$BundleName)
2. Double-click  Install MooreVIEW.bat
3. Double-click  Restore MongoDB.bat
4. Double-click  Start MooreVIEW.bat
5. Browser opens http://127.0.0.1:3090

What is included
----------------
- $ProductName\          MooreVIEW MVP app + your data\ projects/settings
- mongodb-dump\          Tag historian, camera snapshots (GridFS), project bundles
- mongodb-tools\         mongorestore for the laptop (no separate download)

Projects and JSON settings live in:
  $ProductName\data\

Optional: MQTT broker for Parc
  cd $ProductName
  npm run mqtt:start

Regenerate this bundle from the dev PC:
  cd est-pc
  powershell -File scripts\create-laptop-portable.ps1
"@
  Set-Content -Path (Join-Path $BundleDir 'Install MooreVIEW.bat') -Value $installBat -Encoding ASCII
  Set-Content -Path (Join-Path $BundleDir 'Restore MongoDB.bat') -Value $restoreBat -Encoding ASCII
  Set-Content -Path (Join-Path $BundleDir 'Start MooreVIEW.bat') -Value $startBat -Encoding ASCII
  Set-Content -Path (Join-Path $BundleDir 'README-LAPTOP.txt') -Value $readme -Encoding UTF8
}

Write-Host "Bundle target: $BundleDir" -ForegroundColor Cyan
if (Test-Path $BundleDir) {
  Write-Host "Removing previous bundle..." -ForegroundColor Yellow
  Remove-Item $BundleDir -Recurse -Force
}
New-Item -ItemType Directory -Path $BundleDir -Force | Out-Null

if (-not $SkipFork) {
  Write-Host "Refreshing $ProductName from est-pc..." -ForegroundColor Cyan
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'create-product-forks.ps1') -Products mvp-suite -Clean
}
if (-not (Test-Path $ProductSource)) {
  throw "Missing product folder: $ProductSource"
}

Write-Host "Copying app to bundle..." -ForegroundColor Cyan
$excludeDirs = @('node_modules', '.git', 'dist', 'test', 'product-templates', 'fork-manifests', 'data\.cache')
robocopy $ProductSource $AppDir /MIR /XD $excludeDirs /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy app failed with exit code $LASTEXITCODE" }

Write-Host "Merging live data\ from est-pc..." -ForegroundColor Cyan
$dataSrc = Join-Path $EstRoot 'data'
$dataDest = Join-Path $AppDir 'data'
robocopy $dataSrc $dataDest /MIR /XD '.cache' /XF '*.pid' /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy data failed with exit code $LASTEXITCODE" }

if (-not $SkipMongoDump) {
  Ensure-MongoTools
  Write-Host "Dumping MongoDB database '$MongoDb' (this may take several minutes)..." -ForegroundColor Cyan
  if (Test-Path $DumpDir) { Remove-Item $DumpDir -Recurse -Force }
  New-Item -ItemType Directory -Path $DumpDir -Force | Out-Null
  & $Mongodump --uri="$MongoUri" --db=$MongoDb --out=$DumpDir
  if ($LASTEXITCODE -ne 0) { throw "mongodump failed with exit code $LASTEXITCODE" }
  $toolsDest = Join-Path $BundleDir 'mongodb-tools'
  if (Test-Path $toolsDest) { Remove-Item $toolsDest -Recurse -Force }
  robocopy (Split-Path $ToolsBin -Parent) $toolsDest /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
}

Write-BundleLaunchers

if (-not $SkipNpmInstall) {
  Write-Host "Running npm install in bundle..." -ForegroundColor Cyan
  Push-Location $AppDir
  try {
    npm install --omit=dev
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
  } finally {
    Pop-Location
  }
}

$manifest = @"
MooreVIEW laptop portable bundle
Built: $(Get-Date -Format o)
Folder: $BundleDir
MongoDB: $MongoUri / $MongoDb
App: $AppDir
"@
Set-Content -Path (Join-Path $BundleDir 'MANIFEST.txt') -Value $manifest -Encoding UTF8

$sizeMb = [math]::Round((Get-ChildItem $BundleDir -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB, 1)
Write-Host "`nLaptop bundle ready ($sizeMb MB):" -ForegroundColor Green
Write-Host "  $BundleDir"
Write-Host "  Install MooreVIEW.bat"
Write-Host "  Restore MongoDB.bat"
Write-Host "  Start MooreVIEW.bat"
