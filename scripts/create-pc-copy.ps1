# MooreVIEW PC copy - full app + data + all projects for a target with Node + Mongo already installed.
param(
  [string]$OutputRoot = 'C:\Users\Public\data\MooreVIEW-pc-install',
  [string]$AppFolderName = 'est-pc',
  [string]$TargetInstallPath = 'C:\Users\Public\data\est-pc',
  [switch]$FlatInstall,
  [switch]$SkipNpmInstall,
  [switch]$SkipMongoDump = $true,
  [switch]$CopyNodeModules,
  [switch]$SkipAppCopy,
  [switch]$SkipDataCopy,
  [switch]$SkipPathRepair,
  [string]$MongoUri = 'mongodb://127.0.0.1:27017',
  [string]$MongoDb = 'mooreview'
)

$ErrorActionPreference = 'Stop'
$EstRoot = (Resolve-Path (Split-Path $PSScriptRoot -Parent)).Path
$BundleDir = $OutputRoot
if ($FlatInstall) {
  $AppDir = $BundleDir
} else {
  $AppDir = Join-Path $BundleDir $AppFolderName
}
$ToolsBin = Join-Path $EstRoot 'vendor\mongodb-database-tools\bin'
$Mongodump = Join-Path $ToolsBin 'mongodump.exe'

function Write-AppLaunchers {
  param([string]$Dir)
  $installBat = @"
@echo off
title MooreVIEW - Install dependencies
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 18+ required: https://nodejs.org/
  pause
  exit /b 1
)
echo Installing npm packages (omit dev)...
call npm install --omit=dev
if errorlevel 1 ( echo npm install failed. & pause & exit /b 1 )
echo Done. Run Start MooreVIEW.bat
pause
"@
  $startBat = @"
@echo off
title MooreVIEW MVP Suite
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 18+ required.
  pause
  exit /b 1
)
if not exist "node_modules\" (
  echo Run Install MooreVIEW.bat first.
  pause
  exit /b 1
)
set MOOREVIEW_DATA=%~dp0data
set MONGODB_URI=$MongoUri
set MONGODB_DB=$MongoDb
set MOOREVIEW_CONFIG_URI=$MongoUri
set MOOREVIEW_CONFIG_DB=mooreview_config
echo MooreVIEW - http://127.0.0.1:3090
echo Data: %MOOREVIEW_DATA%
echo Projects: %MOOREVIEW_DATA%\projects\
start "" "http://127.0.0.1:3090"
node server.js
"@
  Set-Content (Join-Path $Dir 'Install MooreVIEW.bat') $installBat -Encoding ASCII
  Set-Content (Join-Path $Dir 'Start MooreVIEW.bat') $startBat -Encoding ASCII
}

function Write-BundleLaunchers {
  $installBat = @"
@echo off
title MooreVIEW - Install dependencies
cd /d "%~dp0$AppFolderName"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 18+ required: https://nodejs.org/
  pause
  exit /b 1
)
echo Installing npm packages (omit dev)...
call npm install --omit=dev
if errorlevel 1 ( echo npm install failed. & pause & exit /b 1 )
echo Done. Run Start MooreVIEW.bat
pause
"@
  $restoreBat = @"
@echo off
title MooreVIEW - Restore MongoDB historian
set TOOLS=%~dp0mongodb-tools\bin
set DUMP=%~dp0mongodb-dump\mooreview
if not exist "%TOOLS%\mongorestore.exe" (
  echo No mongodb-tools in bundle - skip or install MongoDB Database Tools.
  pause
  exit /b 1
)
where mongod >nul 2>&1
if errorlevel 1 (
  echo MongoDB not on PATH. Start the MongoDB service first.
  pause
  exit /b 1
)
if not exist "%DUMP%" (
  echo No dump at %DUMP% - skip restore if fresh install.
  pause
  exit /b 0
)
"%TOOLS%\mongorestore.exe" --uri=$MongoUri --drop --db=$MongoDb "%DUMP%"
if errorlevel 1 ( echo mongorestore failed. & pause & exit /b 1 )
echo MongoDB restore complete.
pause
"@
  $startBat = @"
@echo off
title MooreVIEW MVP Suite
cd /d "%~dp0$AppFolderName"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 18+ required.
  pause
  exit /b 1
)
if not exist "node_modules\" (
  echo Run Install MooreVIEW.bat first.
  pause
  exit /b 1
)
set MOOREVIEW_DATA=%~dp0$AppFolderName\data
set MONGODB_URI=$MongoUri
set MONGODB_DB=$MongoDb
set MOOREVIEW_CONFIG_URI=$MongoUri
set MOOREVIEW_CONFIG_DB=mooreview_config
echo MooreVIEW - http://127.0.0.1:3090
echo Data: %MOOREVIEW_DATA%
echo Projects: %MOOREVIEW_DATA%\projects\
start "" "http://127.0.0.1:3090"
node server.js
"@
  $readme = @"
MooreVIEW PC install copy
=========================
Built: $(Get-Date -Format o)
Target: PC with Node.js 18+ and MongoDB already installed.

Recommended install path on target PC
-------------------------------------
  $TargetInstallPath

Setup on the new PC
-------------------
1. Copy the $AppFolderName folder to $TargetInstallPath
   (or copy this entire bundle and run Start MooreVIEW.bat from here)
2. Start MooreVIEW.bat  -> http://127.0.0.1:3090
   (node_modules included - run Install MooreVIEW.bat only if deps are missing)
3. Restore MongoDB.bat   (optional - only if mongodb-dump folder was included)
   Login: admin@local / ChangeMeAdmin!

Projects (all included)
-----------------------
  $AppFolderName\data\projects\*.est.json
  $AppFolderName\data\projects\*.est.zip

Open a project: Project menu -> Open project... or Import project file...

Live workspace (tags, drivers, HMI) is in data\ - portable paths repaired for install.

Regenerate from dev machine:
  cd est-pc
  npm run build:pc-copy
"@
  Set-Content (Join-Path $BundleDir 'Install MooreVIEW.bat') $installBat -Encoding ASCII
  Set-Content (Join-Path $BundleDir 'Restore MongoDB.bat') $restoreBat -Encoding ASCII
  Set-Content (Join-Path $BundleDir 'Start MooreVIEW.bat') $startBat -Encoding ASCII
  Set-Content (Join-Path $BundleDir 'README-INSTALL.txt') $readme -Encoding UTF8
}

function Repair-PortableDataPaths {
  param([string]$DataDir)
  if (-not (Test-Path $DataDir)) { return }
  Write-Host "Repairing absolute paths in data\..." -ForegroundColor Cyan
  Push-Location $EstRoot
  try {
    node scripts/repair-portable-data-paths.js $DataDir
    if ($LASTEXITCODE -ne 0) { throw 'repair-portable-data-paths failed' }
  } finally {
    Pop-Location
  }
}

$estNorm = $EstRoot.TrimEnd('\').ToLowerInvariant()
$appNorm = $AppDir.TrimEnd('\').ToLowerInvariant()
if ($appNorm -eq $estNorm) {
  throw "Refusing to overwrite live dev tree at $EstRoot. Use -OutputRoot for a staging folder or -FlatInstall with a different path."
}

Write-Host "Building PC install copy -> $BundleDir" -ForegroundColor Cyan
Write-Host "  App folder: $AppDir" -ForegroundColor Cyan
Write-Host "  Target install path: $TargetInstallPath" -ForegroundColor Cyan

if (-not ($SkipAppCopy -and $SkipDataCopy)) {
  if (Test-Path $BundleDir) {
    Write-Host "Removing previous bundle..." -ForegroundColor Yellow
    Remove-Item $BundleDir -Recurse -Force
  }
  New-Item -ItemType Directory -Path $AppDir -Force | Out-Null
}

if (-not $SkipAppCopy) {
  Write-Host "Ensuring bundled projects..." -ForegroundColor Cyan
  Push-Location $EstRoot
  try {
    node scripts/ensure-bundled-projects.js
    if ($LASTEXITCODE -ne 0) { throw 'ensure-bundled-projects failed' }
  } finally { Pop-Location }

  Write-Host "Copying application..." -ForegroundColor Cyan
  $excludeDirs = @('node_modules', '.git', 'dist', 'product-templates', 'fork-manifests')
  robocopy $EstRoot $AppDir /MIR /XD $excludeDirs /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy app failed $LASTEXITCODE" }
}

if (-not $SkipDataCopy) {
  Write-Host "Copying live data\ (projects, settings, tags, drivers)..." -ForegroundColor Cyan
  $dataSrc = Join-Path $EstRoot 'data'
  $dataDest = Join-Path $AppDir 'data'
  robocopy $dataSrc $dataDest /MIR /XD '.cache' /XF '*.pid' 'mosquitto-dev.pid' /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy data failed $LASTEXITCODE" }

  if (-not $SkipPathRepair) {
    Repair-PortableDataPaths -DataDir $dataDest
  }

  $zipCount = (Get-ChildItem (Join-Path $dataDest 'projects') -Filter '*.est.zip' -ErrorAction SilentlyContinue).Count
  $jsonCount = (Get-ChildItem (Join-Path $dataDest 'projects') -Filter '*.est.json' -ErrorAction SilentlyContinue).Count
  Write-Host "Projects: $zipCount est.zip, $jsonCount est.json" -ForegroundColor Cyan
} elseif (Test-Path (Join-Path $AppDir 'data\projects')) {
  $dataDest = Join-Path $AppDir 'data'
  if (-not $SkipPathRepair) {
    Repair-PortableDataPaths -DataDir $dataDest
  }
  $zipCount = (Get-ChildItem (Join-Path $dataDest 'projects') -Filter '*.est.zip' -ErrorAction SilentlyContinue).Count
  $jsonCount = (Get-ChildItem (Join-Path $dataDest 'projects') -Filter '*.est.json' -ErrorAction SilentlyContinue).Count
  Write-Host "Projects (existing): $zipCount est.zip, $jsonCount est.json" -ForegroundColor Cyan
}

if (-not $SkipMongoDump) {
  if (Test-Path $Mongodump) {
    $DumpRoot = Join-Path $BundleDir 'mongodb-dump'
    if (Test-Path $DumpRoot) { Remove-Item $DumpRoot -Recurse -Force }
    New-Item -ItemType Directory -Path $DumpRoot -Force | Out-Null
    Write-Host "Dumping MongoDB $MongoDb..." -ForegroundColor Cyan
    & $Mongodump --uri="$MongoUri" --db=$MongoDb --out=$DumpRoot
    if ($LASTEXITCODE -ne 0) { Write-Host "mongodump failed - bundle continues without dump" -ForegroundColor Yellow }
    else {
      $toolsDest = Join-Path $BundleDir 'mongodb-tools'
      if (Test-Path $toolsDest) { Remove-Item $toolsDest -Recurse -Force }
      robocopy (Split-Path $ToolsBin -Parent) $toolsDest /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    }
  } else {
    Write-Host "Skip Mongo dump - mongodump not in vendor/" -ForegroundColor Yellow
  }
}

if ($FlatInstall) {
  Write-AppLaunchers -Dir $AppDir
} else {
  Write-BundleLaunchers
  Write-AppLaunchers -Dir $AppDir
}

if (-not $SkipNpmInstall) {
  if ($CopyNodeModules) {
    Write-Host "Copying node_modules from source..." -ForegroundColor Cyan
    $srcModules = Join-Path $EstRoot 'node_modules'
    $destModules = Join-Path $AppDir 'node_modules'
    if (-not (Test-Path $srcModules)) { throw 'Source node_modules missing - run npm install in est-pc first' }
    if (Test-Path $destModules) { Remove-Item $destModules -Recurse -Force }
    robocopy $srcModules $destModules /E /XD '.cache' /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy node_modules failed $LASTEXITCODE" }
  } else {
    Write-Host "npm install in bundle (may take a few minutes)..." -ForegroundColor Cyan
    Push-Location $AppDir
    try {
      npm install --omit=dev
      if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
    } finally { Pop-Location }
  }
}

$sizeMb = [math]::Round((Get-ChildItem $BundleDir -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB, 1)
Write-Host "`nPC install copy ready ($sizeMb MB):" -ForegroundColor Green
Write-Host "  $BundleDir"
if ($FlatInstall) {
  Write-Host "  Install MooreVIEW.bat | Start MooreVIEW.bat (in app folder)"
} else {
  Write-Host "  $AppFolderName\  +  Start MooreVIEW.bat (bundle root)"
}
Write-Host "  Deploy $AppFolderName to $TargetInstallPath on target PC"
