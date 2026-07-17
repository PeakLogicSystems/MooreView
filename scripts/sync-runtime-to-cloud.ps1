# Sync est-pc full Studio into mooreview-cloud for SaaS droplet (port 3100).
# Full ST / projects / HMI / drivers + cloud sites/cameras APIs.
param(
  [string]$CloudRoot = (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'mooreview-cloud')
)

$ErrorActionPreference = 'Stop'
$RepoParent = Split-Path $CloudRoot -Parent
$EstRoot = Join-Path $RepoParent 'est-pc'

if (-not (Test-Path $EstRoot)) { throw "est-pc not found at $EstRoot" }
if (-not (Test-Path $CloudRoot)) {
  New-Item -ItemType Directory -Path $CloudRoot -Force | Out-Null
}

Write-Host "Sync full Studio -> mooreview-cloud (SaaS on :3100)" -ForegroundColor Cyan
Write-Host "  from: $EstRoot"
Write-Host "  to:   $CloudRoot"

function Sync-Tree {
  param([string]$Rel)
  $src = Join-Path $EstRoot $Rel
  if (-not (Test-Path $src)) {
    Write-Warning "Skip missing: $Rel"
    return
  }
  $dest = Join-Path $CloudRoot $Rel
  $parent = Split-Path $dest -Parent
  if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  robocopy $src $dest /MIR /R:1 /W:2 /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy $Rel failed with exit code $LASTEXITCODE" }
  Write-Host "  sync: $Rel/" -ForegroundColor Green
}

foreach ($dir in @('src', 'public', 'views', 'st', 'firmware', 'config', 'docs')) {
  Sync-Tree $dir
}

# Bundled Studio project snapshots (seeded into Mongo via npm run seed:bundled-projects)
$estProjects = Join-Path $EstRoot 'data/projects'
$cloudProjects = Join-Path $CloudRoot 'data/projects'
if (Test-Path $estProjects) {
  if (-not (Test-Path $cloudProjects)) { New-Item -ItemType Directory -Path $cloudProjects -Force | Out-Null }
  Copy-Item (Join-Path $estProjects '*.est.json') $cloudProjects -Force
  $n = (Get-ChildItem $cloudProjects -Filter '*.est.json' -ErrorAction SilentlyContinue).Count
  Write-Host "  sync: data/projects/ ($n snapshots)" -ForegroundColor Green
}

$estMvDraw = Join-Path $EstRoot 'mv-draw'
$cloudMvDraw = Join-Path $CloudRoot 'mv-draw'
if (Test-Path $estMvDraw) {
  if (Test-Path $cloudMvDraw) { Remove-Item $cloudMvDraw -Recurse -Force }
  Copy-Item $estMvDraw $cloudMvDraw -Recurse -Force
  Write-Host '  sync: mv-draw/' -ForegroundColor Green
}

foreach ($file in @('server.js', 'package.json', 'package-lock.json', 'README.md')) {
  $src = Join-Path $EstRoot $file
  if (Test-Path $src) {
    Copy-Item $src (Join-Path $CloudRoot $file) -Force
    Write-Host "  sync: $file" -ForegroundColor Green
  }
}

$estScripts = Join-Path $EstRoot 'scripts'
$cloudScripts = Join-Path $CloudRoot 'scripts'
if (Test-Path $estScripts) {
  if (-not (Test-Path $cloudScripts)) { New-Item -ItemType Directory -Path $cloudScripts -Force | Out-Null }
  Get-ChildItem $estScripts -File | ForEach-Object {
    if ($_.Name -eq 'seed.js') { return }
    Copy-Item $_.FullName (Join-Path $cloudScripts $_.Name) -Force
  }
  $estMvDrawScripts = Join-Path $estScripts 'mv-draw'
  if (Test-Path $estMvDrawScripts) {
    $dest = Join-Path $cloudScripts 'mv-draw'
    if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
    Copy-Item $estMvDrawScripts $dest -Recurse -Force
  }
  Write-Host '  sync: scripts/' -ForegroundColor Green
}

$estDeploy = Join-Path $EstRoot 'deploy'
$cloudDeploy = Join-Path $CloudRoot 'deploy'
if (Test-Path $estDeploy) {
  if (-not (Test-Path $cloudDeploy)) { New-Item -ItemType Directory -Path $cloudDeploy -Force | Out-Null }
  robocopy $estDeploy $cloudDeploy /E /XF /R:1 /W:2 /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy deploy failed with exit code $LASTEXITCODE" }
  Write-Host '  sync: deploy/' -ForegroundColor Green
}

# Updater / install detect SaaS: src/server.js + cloudApp.js + package name
$srcServer = @'
'use strict';
process.env.MOOREVIEW_DEPLOYMENT = process.env.MOOREVIEW_DEPLOYMENT || 'cloud';
process.env.MOOREVIEW_PRODUCT = process.env.MOOREVIEW_PRODUCT || 'mvp-suite';
if (!process.env.PORT && !process.env.MOOREVIEW_PORT) { process.env.PORT = '3100'; }
require('../server.js');
'@
Set-Content -Path (Join-Path $CloudRoot 'src\server.js') -Value $srcServer -Encoding UTF8

# Package identity
$pkgPath = Join-Path $CloudRoot 'package.json'
if (Test-Path $pkgPath) {
  $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
  $pkg.name = 'mooreview-cloud'
  $pkg.description = 'MooreVIEW Cloud Studio — full Studio (ST, projects, HMI) + sites/cameras SaaS (port 3100)'
  if (-not $pkg.dependencies.ejs) {
    if (-not $pkg.dependencies) { $pkg | Add-Member -NotePropertyName dependencies -NotePropertyValue (@{}) }
  }
  $pkg | ConvertTo-Json -Depth 10 | Set-Content $pkgPath -Encoding UTF8
  Write-Host '  patch: package.json -> mooreview-cloud' -ForegroundColor Green
}

Write-Host "`nSync complete. Cloud Studio = full GUI + remote sites/cameras on :3100" -ForegroundColor Green
