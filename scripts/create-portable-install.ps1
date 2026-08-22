# Build a MooreVIEW MVP portable install bundle for .est.zip project portability testing.
# Output: est-pc/dist/mooreview-portable-YYYYMMDD-HHmm/
param(
  [string]$OutputRoot = (Join-Path (Split-Path $PSScriptRoot -Parent) 'dist'),
  [string]$BundleName = '',
  [switch]$SkipNpmInstall,
  [switch]$IncludeMongoDump,
  [string]$MongoUri = 'mongodb://127.0.0.1:27017',
  [string]$MongoDb = 'mooreview'
)

$ErrorActionPreference = 'Stop'
$EstRoot = Split-Path $PSScriptRoot -Parent
$ProductName = 'mooreview-mvp-suite'

if (-not $BundleName) {
  $BundleName = "mooreview-portable-$(Get-Date -Format 'yyyyMMdd-HHmm')"
}
$BundleDir = Join-Path $OutputRoot $BundleName
$AppDir = Join-Path $BundleDir $ProductName
$ProjectsDir = Join-Path $AppDir 'data\projects'
$SampleProjectsDir = Join-Path $BundleDir 'sample-projects'

function Write-BundleLaunchers {
  $installBat = @"
@echo off
title MooreVIEW — Portable Install
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
echo  Install complete.
echo  Run "Start MooreVIEW.bat" then test portability per README-PORTABLE.txt
echo.
pause
"@
  $startBat = @"
@echo off
title MooreVIEW MVP Suite
cd /d "%~dp0$ProductName"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 18+ required. Run "Install MooreVIEW.bat" first.
  pause
  exit /b 1
)
if not exist "node_modules\" (
  echo node_modules missing — run "Install MooreVIEW.bat" first.
  pause
  exit /b 1
)
set MOOREVIEW_DATA=%~dp0$ProductName\data
echo MooreVIEW — http://127.0.0.1:3090
echo Projects: %MOOREVIEW_DATA%\projects\*.est.zip
echo Opening dashboard after server is ready...
echo Press Ctrl+C to stop.
node scripts\start-with-dashboard.js
"@
  $testBat = @"
@echo off
title MooreVIEW — Portability smoke test
cd /d "%~dp0$ProductName"
if not exist "node_modules\" (
  echo Run Install MooreVIEW.bat first.
  pause
  exit /b 1
)
echo Running archive round-trip test...
node --test test\projectArchive.test.js
if errorlevel 1 (
  echo Test failed.
  pause
  exit /b 1
)
echo.
echo OK - project archive module works in this install.
echo Next: start the app, Project - Import file, pick sample-projects folder
pause
"@
  $readme = @"
MooreVIEW portable install (v1.0 - est.zip projects)
====================================================

Built: $(Get-Date -Format o)
Bundle: $BundleName

Requirements
------------
- Node.js 18+  https://nodejs.org/
- MongoDB optional (historian only - NOT required for project portability)

First-time setup (this PC or another Windows machine)
-----------------------------------------------------
1. Copy this entire folder anywhere (e.g. C:\MooreVIEW\$BundleName)
2. Install MooreVIEW.bat
3. Start MooreVIEW.bat  ->  dashboard opens after /health (duplex lift station loads automatically)
4. Optional: Test portability.bat (archive unit tests)

Portability test checklist
--------------------------
[ ] Project - Import file - select sample-projects\duplex-lift-station.est.zip
[ ] Tags, drivers, and ST program load; serial ports remap for this host
[ ] Project - Export project file - save MyTest.est.zip
[ ] Copy MyTest.est.zip to another machine (or Linux droplet)
[ ] Import MyTest.est.zip on target - project opens without Mongo project data

Project library on disk
-----------------------
  $ProductName\data\projects\  (est.zip files)

Sample projects (extra copies for handoff tests)
------------------------------------------------
  sample-projects\

MongoDB (optional)
------------------
Historian and camera snapshots only. Projects do NOT live in Mongo.
Set MONGODB_URI before Start MooreVIEW.bat if Mongo is installed locally.

Linux / IoT-Link / DO droplet
-----------------------------
Copy the $ProductName folder, then:
  cd mooreview-mvp-suite
  npm install --omit=dev
  MOOREVIEW_DATA=./data node server.js

Regenerate this bundle:
  cd est-pc
  powershell -File scripts\create-portable-install.ps1
"@
  Set-Content -Path (Join-Path $BundleDir 'Install MooreVIEW.bat') -Value $installBat -Encoding ASCII
  Set-Content -Path (Join-Path $BundleDir 'Start MooreVIEW.bat') -Value $startBat -Encoding ASCII
  Set-Content -Path (Join-Path $BundleDir 'Test portability.bat') -Value $testBat -Encoding ASCII
  Set-Content -Path (Join-Path $BundleDir 'README-PORTABLE.txt') -Value $readme -Encoding UTF8
}

Write-Host "Portable install target: $BundleDir" -ForegroundColor Cyan
if (Test-Path $BundleDir) {
  Write-Host "Removing previous bundle..." -ForegroundColor Yellow
  Remove-Item $BundleDir -Recurse -Force
}
New-Item -ItemType Directory -Path $BundleDir -Force | Out-Null

Write-Host "Ensuring bundled .est.zip projects..." -ForegroundColor Cyan
Push-Location $EstRoot
try {
  node scripts/ensure-bundled-projects.js
  if ($LASTEXITCODE -ne 0) { throw 'ensure-bundled-projects failed' }
} finally {
  Pop-Location
}

Write-Host "Copying app..." -ForegroundColor Cyan
$excludeDirs = @('node_modules', '.git', 'dist', 'product-templates', 'fork-manifests', 'data\.cache')
robocopy $EstRoot $AppDir /MIR /XD $excludeDirs /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy app failed with exit code $LASTEXITCODE" }

Write-Host "Preparing clean portable data/..." -ForegroundColor Cyan
$dataDest = Join-Path $AppDir 'data'
if (Test-Path $dataDest) { Remove-Item $dataDest -Recurse -Force }
New-Item -ItemType Directory -Path (Join-Path $dataDest 'projects') -Force | Out-Null

$srcProjects = Join-Path $EstRoot 'data\projects'
if (Test-Path $srcProjects) {
  Get-ChildItem $srcProjects -Filter '*.est.zip' | ForEach-Object {
    $destFile = Join-Path (Join-Path $dataDest 'projects') $_.Name
    Copy-Item $_.FullName $destFile -Force
  }
}

New-Item -ItemType Directory -Path $SampleProjectsDir -Force | Out-Null
Get-ChildItem (Join-Path $dataDest 'projects') -Filter '*.est.zip' -ErrorAction SilentlyContinue | ForEach-Object {
  Copy-Item $_.FullName (Join-Path $SampleProjectsDir $_.Name) -Force
}

$defaultSettings = @{
  scanMs = 100
  project = @{ name = 'duplex-lift-station' }
  startup = @{
    mode = 'saved_project'
    projectId = 'duplex-lift-station'
  }
  mqttParc = @{
    enabled = $true
    brokerUrl = 'mqtt://127.0.0.1:1883'
    topicPrefix = 'mooreview/v1'
  }
} | ConvertTo-Json -Depth 6
Set-Content -Path (Join-Path $dataDest 'settings.json') -Value $defaultSettings -Encoding UTF8
Set-Content -Path (Join-Path $dataDest 'tags.json') -Value '[]' -Encoding UTF8
Set-Content -Path (Join-Path $dataDest 'drivers.json') -Value '[]' -Encoding UTF8

if ($IncludeMongoDump) {
  $ToolsBin = Join-Path $EstRoot 'vendor\mongodb-database-tools\bin'
  $Mongodump = Join-Path $ToolsBin 'mongodump.exe'
  if (Test-Path $Mongodump) {
    $DumpDir = Join-Path $BundleDir 'mongodb-dump-optional'
    New-Item -ItemType Directory -Path $DumpDir -Force | Out-Null
    Write-Host "Optional Mongo dump (historian only)..." -ForegroundColor Cyan
    & $Mongodump --uri="$MongoUri" --db=$MongoDb --out=$DumpDir
  } else {
    Write-Host "Skip Mongo dump - mongodump not found (optional)" -ForegroundColor Yellow
  }
}

Write-BundleLaunchers

if (-not $SkipNpmInstall) {
  Write-Host "npm install in bundle..." -ForegroundColor Cyan
  Push-Location $AppDir
  try {
    npm install --omit=dev
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
  } finally {
    Pop-Location
  }
}

$zipCount = (Get-ChildItem (Join-Path $dataDest 'projects') -Filter '*.est.zip' -ErrorAction SilentlyContinue).Count
$manifest = @"
MooreVIEW portable install bundle
Built: $(Get-Date -Format o)
App: $AppDir
Project zips in library: $zipCount
Format: mooreview-est-archive (.est.zip)
"@
Set-Content -Path (Join-Path $BundleDir 'MANIFEST.txt') -Value $manifest -Encoding UTF8

$sizeMb = [math]::Round((Get-ChildItem $BundleDir -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB, 1)
Write-Host "Portable install ready (${sizeMb} MB):" -ForegroundColor Green
Write-Host "  $BundleDir"
Write-Host "  Install MooreVIEW.bat"
Write-Host "  Start MooreVIEW.bat"
Write-Host "  sample-projects ($zipCount zip files)"
if ($zipCount -eq 0) {
  Write-Host "  WARNING: no est.zip in library - run generate-est then ensure-bundled-projects" -ForegroundColor Yellow
}
