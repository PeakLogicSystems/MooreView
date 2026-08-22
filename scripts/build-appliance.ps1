# Unified MooreVIEW appliance builder — Windows PC and IoT-Link (Linux) profiles.
param(
  [ValidateSet('mvp-suite', 'iot-link-generic')]
  [string]$Profile = 'mvp-suite',
  [ValidateSet('pc', 'linux', 'all')]
  [string]$Target = 'pc',
  [string]$EstRoot = (Split-Path $PSScriptRoot -Parent),
  [string]$OutputRoot = (Join-Path (Split-Path $PSScriptRoot -Parent) 'dist'),
  [switch]$SkipNpmInstall
)

$ErrorActionPreference = 'Stop'

$ProfilePath = Join-Path $EstRoot "deploy\appliance\profiles\$Profile.json"
if (-not (Test-Path $ProfilePath)) { throw "Profile not found: $ProfilePath" }
$Prof = Get-Content $ProfilePath -Raw | ConvertFrom-Json

function Get-ExcludeDirs {
  @('node_modules', '.git', 'dist', 'product-templates', 'fork-manifests', 'data\.cache', 'azure', 'native', 'cellular-opta-gateway')
}

function New-CleanPortableData {
  param([string]$AppDir, [object]$ProfileObj)
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

  $settings = @{
    scanMs = 100
    project = @{ name = $ProfileObj.startup.projectName }
    startup = @{
      mode = $ProfileObj.startup.mode
      projectId = $ProfileObj.startup.projectId
    }
    mqttParc = @{
      enabled = $true
      brokerUrl = 'mqtt://127.0.0.1:1883'
      topicPrefix = 'mooreview/v1'
    }
  } | ConvertTo-Json -Depth 6
  Set-Content -Path (Join-Path $dataDest 'settings.json') -Value $settings -Encoding UTF8
  Set-Content -Path (Join-Path $dataDest 'tags.json') -Value '[]' -Encoding UTF8
  Set-Content -Path (Join-Path $dataDest 'drivers.json') -Value '[]' -Encoding UTF8
  return $dataDest
}

function Write-PcBundle {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmm'
  $BundleName = "mooreview-appliance-$Profile-$stamp"
  $BundleDir = Join-Path $OutputRoot $BundleName
  $AppDir = Join-Path $BundleDir 'mooreview-mvp-suite'

  if (Test-Path $BundleDir) { Remove-Item $BundleDir -Recurse -Force }
  New-Item -ItemType Directory -Path $BundleDir -Force | Out-Null

  Write-Host "Ensuring bundled .est.zip projects..." -ForegroundColor Cyan
  Push-Location $EstRoot
  try {
    node scripts/ensure-bundled-projects.js
    if ($LASTEXITCODE -ne 0) { throw 'ensure-bundled-projects failed' }
  } finally { Pop-Location }

  Write-Host "Copying app to $AppDir..." -ForegroundColor Cyan
  robocopy $EstRoot $AppDir /MIR /XD (Get-ExcludeDirs) /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" }

  $dataDest = New-CleanPortableData -AppDir $AppDir -ProfileObj $Prof
  $sampleDir = Join-Path $BundleDir 'sample-projects'
  New-Item -ItemType Directory -Path $sampleDir -Force | Out-Null
  Get-ChildItem (Join-Path $dataDest 'projects') -Filter '*.est.zip' -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $sampleDir $_.Name) -Force
  }

  $envSrc = Join-Path $EstRoot ($Prof.envTemplate -replace '/', '\')
  if (Test-Path $envSrc) {
    Copy-Item $envSrc (Join-Path $AppDir '.env') -Force
    Copy-Item $envSrc (Join-Path $AppDir '.env.example') -Force
  }

  $installBat = @"
@echo off
title MooreVIEW Appliance — Install
cd /d "%~dp0mooreview-mvp-suite"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 18+ required: https://nodejs.org/
  pause
  exit /b 1
)
if not exist ".env" copy /Y ".env.example" ".env" >nul
echo Installing dependencies...
call npm install --omit=dev
if errorlevel 1 ( echo npm install failed. & pause & exit /b 1 )
echo.
echo  Install complete. Run "Start MooreVIEW.bat"
echo  Login: admin@local / ChangeMeAdmin!
pause
"@
  $startBat = @"
@echo off
title MooreVIEW MVP Suite
cd /d "%~dp0mooreview-mvp-suite"
if not exist "node_modules\" (
  echo Run Install MooreVIEW.bat first.
  pause
  exit /b 1
)
set MOOREVIEW_DATA=%~dp0mooreview-mvp-suite\data
echo http://127.0.0.1:3090/login
node scripts\start-with-dashboard.js
"@
  Set-Content (Join-Path $BundleDir 'Install MooreVIEW.bat') $installBat -Encoding ASCII
  Set-Content (Join-Path $BundleDir 'Start MooreVIEW.bat') $startBat -Encoding ASCII

  $readme = @"
MooreVIEW Appliance — $($Prof.label)
Profile: $Profile
Built: $(Get-Date -Format o)

Requirements: Node.js 18+  (MongoDB optional for historian)

Setup
-----
1. Install MooreVIEW.bat
2. Start MooreVIEW.bat  ->  http://127.0.0.1:3090/login
3. Sign in: admin@local / ChangeMeAdmin!  (change in System setup -> Features)

Default project: $($Prof.startup.projectId) (.est.zip in data/projects/)

User access: Project -> System setup -> Features (checkbox matrix)

Docs: deploy/appliance/README.md
"@
  Set-Content (Join-Path $BundleDir 'README-APPLIANCE.txt') $readme -Encoding UTF8
  Copy-Item (Join-Path $EstRoot 'deploy\appliance\README.md') (Join-Path $BundleDir 'deploy-appliance-README.md') -Force -ErrorAction SilentlyContinue

  if (-not $SkipNpmInstall) {
    Push-Location $AppDir
    try { npm install --omit=dev; if ($LASTEXITCODE -ne 0) { throw 'npm install failed' } }
    finally { Pop-Location }
  }

  $zipCount = (Get-ChildItem (Join-Path $dataDest 'projects') -Filter '*.est.zip' -EA SilentlyContinue).Count
  $sizeMb = [math]::Round((Get-ChildItem $BundleDir -Recurse -File | Measure-Object Length -Sum).Sum / 1MB, 1)
  Write-Host "`nPC appliance ready (${sizeMb} MB):" -ForegroundColor Green
  Write-Host "  $BundleDir"
  Write-Host "  Projects: $zipCount .est.zip"
  return $BundleDir
}

function Write-LinuxBundle {
  $stamp = Get-Date -Format 'yyyyMMdd'
  $ArchiveName = "mooreview-appliance-$Profile-$stamp.tgz"
  $ArchivePath = Join-Path $OutputRoot $ArchiveName
  $ManifestPath = [System.IO.Path]::ChangeExtension($ArchivePath, '.txt')

  $stageParent = Join-Path $env:TEMP "mv-appliance-$([Guid]::NewGuid().ToString('N').Substring(0,8))"
  $stageRoot = Join-Path $stageParent 'mooreview'
  New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null

  robocopy $EstRoot $stageRoot /MIR /XD (Get-ExcludeDirs) /XF '.env' 'saas.env' /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy staging failed" }

  Get-ChildItem (Join-Path $stageRoot 'deploy') -Recurse -Include '*.sh','*.service' -ErrorAction SilentlyContinue | ForEach-Object {
    $raw = [System.IO.File]::ReadAllText($_.FullName)
    if ($raw -match "`r") {
      [System.IO.File]::WriteAllText($_.FullName, ($raw -replace "`r`n", "`n" -replace "`r", "`n"))
    }
  }

  $installTxt = @"
MooreVIEW Appliance — $($Prof.label)
Profile: $Profile
Built: $(Get-Date -Format o)
Archive: $ArchiveName

Install (Debian / IoT-Link):
  scp $ArchiveName root@<host>:/tmp/
  ssh root@<host>
  mkdir -p $($Prof.installDirLinux)
  tar xzf /tmp/$ArchiveName -C $($Prof.installDirLinux) --strip-components=1
  bash $($Prof.linuxInstall)

Update (preserve data + env):
  bash $($Prof.linuxUpdate)

Health: curl -s http://127.0.0.1:$($Prof.port)/health
Login:  http://<host>:$($Prof.port)/login  (admin@local / ChangeMeAdmin!)

Env template: $($Prof.envTemplate)
Docs: deploy/appliance/README.md
"@
  Set-Content (Join-Path $stageRoot 'INSTALL-APPLIANCE.txt') $installTxt -Encoding UTF8

  if (Test-Path $ArchivePath) { Remove-Item $ArchivePath -Force }
  Push-Location $stageParent
  try {
    & tar -czf $ArchivePath mooreview
    if ($LASTEXITCODE -ne 0) { throw 'tar failed' }
  } finally {
    Pop-Location
    Remove-Item $stageParent -Recurse -Force -ErrorAction SilentlyContinue
  }

  $sizeMb = [math]::Round((Get-Item $ArchivePath).Length / 1MB, 1)
  Set-Content $ManifestPath @"
MooreVIEW appliance Linux bundle
Profile: $Profile
Size: $sizeMb MB
Install: $($Prof.linuxInstall)
"@ -Encoding UTF8

  Write-Host "`nLinux appliance bundle ready (${sizeMb} MB):" -ForegroundColor Green
  Write-Host "  $ArchivePath"
  Write-Host "  $ManifestPath"
  return $ArchivePath
}

Write-Host "Building appliance profile: $Profile (target: $Target)" -ForegroundColor Cyan

if ($Target -eq 'all') {
  & $PSCommandPath -Profile 'mvp-suite' -Target 'pc' -EstRoot $EstRoot -OutputRoot $OutputRoot @(if ($SkipNpmInstall) { '-SkipNpmInstall' })
  & $PSCommandPath -Profile 'iot-link-generic' -Target 'linux' -EstRoot $EstRoot -OutputRoot $OutputRoot
  Write-Host "All appliance builds done." -ForegroundColor Green
  exit 0
}

if ($Target -eq 'pc' -or $Target -eq 'all') {
  if ($Profile -ne 'mvp-suite') {
    Write-Host "PC target only supports mvp-suite profile; skipping PC build." -ForegroundColor Yellow
  } else {
    Write-PcBundle | Out-Null
  }
}

if ($Target -eq 'linux' -or $Target -eq 'all') {
  Write-LinuxBundle | Out-Null
}

Write-Host "Done." -ForegroundColor Green
