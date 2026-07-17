# Build MooreVIEW MVP Suite Windows setup.exe (Inno Setup 6).
param(
  [switch]$SkipFork,
  [switch]$SkipNpmInstall,
  [string]$InnoSetupCompiler = ''
)

$ErrorActionPreference = 'Stop'
$EstRoot = Split-Path $PSScriptRoot -Parent
$ParentDir = Split-Path $EstRoot -Parent
$ProductName = 'mooreview-mvp-suite'
$ProductRoot = Join-Path $ParentDir $ProductName
$DistRoot = Join-Path $EstRoot 'dist\windows-installer'
$Staging = Join-Path $DistRoot 'staging'
$DeployWin = Join-Path $EstRoot 'deploy\windows'
$IssFile = Join-Path $DeployWin 'mooreview-setup.iss'

function Find-InnoCompiler {
  param([string]$Override)
  if ($Override -and (Test-Path $Override)) { return $Override }
  foreach ($p in @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles}\Inno Setup 6\ISCC.exe"
  )) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

if (-not $SkipFork) {
  Write-Host 'Generating mooreview-mvp-suite from est-pc...' -ForegroundColor Cyan
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'create-product-forks.ps1') -Products mvp-suite -Clean
}

if (-not (Test-Path $ProductRoot)) {
  throw "Missing $ProductRoot - run create-product-forks.ps1 first"
}

$pkg = Get-Content (Join-Path $ProductRoot 'package.json') -Raw | ConvertFrom-Json
$version = [string]$pkg.version

if (Test-Path $Staging) {
  Write-Host "Clearing staging: $Staging" -ForegroundColor Yellow
  Remove-Item $Staging -Recurse -Force
}
New-Item -ItemType Directory -Path $Staging -Force | Out-Null

Write-Host "Staging app to $Staging ..." -ForegroundColor Cyan
robocopy $ProductRoot $Staging /MIR /XD node_modules .git test data\.cache /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }

$dataDir = Join-Path $Staging 'data'
if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir -Force | Out-Null }

foreach ($launcher in @('MooreVIEW.cmd', 'MooreVIEW-Stop.cmd')) {
  Copy-Item (Join-Path $DeployWin $launcher) (Join-Path $Staging $launcher) -Force
}

$readme = @"
MooreVIEW MVP Suite v$version
=============================

Requirements: Node.js 18+ from https://nodejs.org/

Start: Start Menu -> MooreVIEW MVP Suite
       or run MooreVIEW.cmd in the install folder.

Stop:  Start Menu -> Stop MooreVIEW

Web UI: http://127.0.0.1:3090  (press F1 for help)

Data:  %LOCALAPPDATA%\MooreVIEW\data

Optional:
  - MongoDB for tag historian (set MONGODB_URI)
  - MQTT broker: npm run mqtt:start from install folder
"@
Set-Content -Path (Join-Path $Staging 'README.txt') -Value $readme -Encoding UTF8

if (-not $SkipNpmInstall) {
  Write-Host 'Running npm ci --omit=dev in staging (may take several minutes)...' -ForegroundColor Cyan
  Push-Location $Staging
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
  Write-Host 'SkipNpmInstall: end user must run npm install on first launch' -ForegroundColor Yellow
}

$iscc = Find-InnoCompiler -Override $InnoSetupCompiler
if (-not $iscc) {
  Write-Host ''
  Write-Host 'Inno Setup 6 not found. Staging folder is ready:' -ForegroundColor Yellow
  Write-Host "  $Staging"
  Write-Host ''
  Write-Host 'Install Inno Setup 6, then compile:' -ForegroundColor Cyan
  Write-Host "  `"${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe`" /DStagingDir=`"$Staging`" /DMyAppVersion=`"$version`" `"$IssFile`""
  Write-Host ''
  Write-Host 'Or re-run: powershell -File scripts\build-windows-installer.ps1' -ForegroundColor Cyan
  exit 0
}

if (-not (Test-Path $DistRoot)) { New-Item -ItemType Directory -Path $DistRoot -Force | Out-Null }

Write-Host "Compiling installer with $iscc ..." -ForegroundColor Cyan
& $iscc "/DStagingDir=$Staging" "/DMyAppVersion=$version" $IssFile
if ($LASTEXITCODE -ne 0) { throw "ISCC failed with exit $LASTEXITCODE" }

$setup = Get-ChildItem $DistRoot -Filter "MooreVIEW-MVP-Suite-${version}-setup.exe" | Select-Object -First 1
if ($setup) {
  $sizeMb = [math]::Round($setup.Length / 1MB, 2)
  Write-Host ''
  Write-Host "Installer ready: $($setup.FullName) (${sizeMb} MB)" -ForegroundColor Green
} else {
  Write-Host "Compile finished - check $DistRoot for setup.exe" -ForegroundColor Green
}
