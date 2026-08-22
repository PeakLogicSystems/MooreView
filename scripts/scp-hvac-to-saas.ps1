# scp HVAC demo projects (+ ST) to mooreview.io SaaS droplet, then seed tenant libraries.
param(
  [string]$HostAlias = 'mv-saas',
  [string]$Remote = '/home/mooreview',
  [string]$Key = "$env:USERPROFILE\.ssh\id_ed25519_mooreview"
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$sshConfig = Join-Path $Root '.ssh\config'
if (-not (Test-Path $Key)) { $Key = Join-Path $Root '.ssh\id_ed25519_mooreview' }
if (-not (Test-Path $Key)) { throw "SSH key not found: $Key" }

Push-Location $Root
try { node scripts/ensure-bundled-projects.js | Out-Null } finally { Pop-Location }

$scpArgs = @('-F', $sshConfig, '-i', $Key, '-o', 'ConnectTimeout=30')
$sshArgs = @('-F', $sshConfig, '-i', $Key, '-o', 'ConnectTimeout=30')

$hvacZips = @(
  'opta-split-hvac.est.zip',
  'opta-double-split-hvac.est.zip'
) | ForEach-Object {
  $p = Join-Path $Root "data\projects\$_"
  if (-not (Test-Path $p)) { throw "Missing $p (run ensure-bundled-projects.js)" }
  $p
}

$stFiles = @(
  'st\logic\opta_split_hvac.st',
  'st\logic\opta_double_split_hvac.st'
) | ForEach-Object {
  $p = Join-Path $Root $_
  if (-not (Test-Path $p)) { throw "Missing $p" }
  $p
}

$srcFiles = @(
  'src\hmi\hvacSplitScreen.js',
  'src\hmi\duplexlsScreen.js',
  'src\project\estFile.js'
) | ForEach-Object {
  $p = Join-Path $Root $_
  if (-not (Test-Path $p)) { throw "Missing $p" }
  $p
}

$assetDirs = @(
  'public\hmi\svg\demos\opta-split-hvac',
  'public\hmi\svg\demos\opta-double-split-hvac'
) | ForEach-Object {
  $p = Join-Path $Root $_
  if (-not (Test-Path $p)) { throw "Missing $p" }
  $p
}

$html3d = @(
  'public\samples\opta-split-hvac-ortho-3d.html',
  'public\samples\opta-double-split-hvac-ortho-3d.html'
) | ForEach-Object {
  $p = Join-Path $Root $_
  if (-not (Test-Path $p)) { throw "Missing $p" }
  $p
}

Write-Host "scp -> ${HostAlias}:${Remote}/data/projects/" -ForegroundColor Cyan
& scp @scpArgs $hvacZips "${HostAlias}:${Remote}/data/projects/"
if ($LASTEXITCODE -ne 0) { throw "scp projects failed ($LASTEXITCODE)" }

Write-Host "scp -> ${HostAlias}:${Remote}/data/boilerplate/projects/" -ForegroundColor Cyan
& scp @scpArgs $hvacZips "${HostAlias}:${Remote}/data/boilerplate/projects/"
if ($LASTEXITCODE -ne 0) { throw "scp boilerplate failed ($LASTEXITCODE)" }

Write-Host "scp -> ${HostAlias}:${Remote}/st/logic/" -ForegroundColor Cyan
& scp @scpArgs $stFiles "${HostAlias}:${Remote}/st/logic/"
if ($LASTEXITCODE -ne 0) { throw "scp ST failed ($LASTEXITCODE)" }

Write-Host "scp -> ${HostAlias}:${Remote}/src (HMI repair)" -ForegroundColor Cyan
& scp @scpArgs (Join-Path $Root 'src\hmi\hvacSplitScreen.js') (Join-Path $Root 'src\hmi\duplexlsScreen.js') "${HostAlias}:${Remote}/src/hmi/"
if ($LASTEXITCODE -ne 0) { throw "scp src/hmi failed ($LASTEXITCODE)" }
& scp @scpArgs (Join-Path $Root 'src\project\estFile.js') "${HostAlias}:${Remote}/src/project/"
if ($LASTEXITCODE -ne 0) { throw "scp src/project failed ($LASTEXITCODE)" }

Write-Host "scp -> ${HostAlias}:${Remote}/public/hmi/svg/demos/" -ForegroundColor Cyan
& scp @scpArgs -r $assetDirs "${HostAlias}:${Remote}/public/hmi/svg/demos/"
if ($LASTEXITCODE -ne 0) { throw "scp SVG demos failed ($LASTEXITCODE)" }

Write-Host "scp -> ${HostAlias}:${Remote}/public/samples/" -ForegroundColor Cyan
& scp @scpArgs $html3d "${HostAlias}:${Remote}/public/samples/"
if ($LASTEXITCODE -ne 0) { throw "scp 3D HTML failed ($LASTEXITCODE)" }

$seed = 'set -euo pipefail; chown mooreview:mooreview ' +
  "$Remote/data/projects/opta-split-hvac.est.zip " +
  "$Remote/data/boilerplate/projects/opta-split-hvac.est.zip " +
  "$Remote/data/projects/opta-double-split-hvac.est.zip " +
  "$Remote/data/boilerplate/projects/opta-double-split-hvac.est.zip " +
  "$Remote/st/logic/opta_split_hvac.st " +
  "$Remote/st/logic/opta_double_split_hvac.st " +
  "$Remote/src/hmi/hvacSplitScreen.js " +
  "$Remote/src/hmi/duplexlsScreen.js " +
  "$Remote/src/project/estFile.js; " +
  "sudo systemctl restart mooreview-saas; " +
  "sudo -u mooreview env HOME=/var/lib/mooreview MOOREVIEW_DEPLOYMENT=cloud bash -lc `"cd $Remote && node scripts/seed-tenant-projects.js`"; " +
  "ls $Remote/data/tenants/219c5c35-8415-4409-a13c-9059d698c998/projects/*hvac*.est.zip"

Write-Host 'ssh seed tenant libraries...' -ForegroundColor Cyan
& ssh @sshArgs $HostAlias $seed
if ($LASTEXITCODE -ne 0) { throw "remote seed failed ($LASTEXITCODE)" }

Write-Host 'Done. Refresh https://mooreview.io then Project -> Open project.' -ForegroundColor Green
