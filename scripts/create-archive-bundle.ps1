# Build MooreVIEW Phase 1 archive droplet bundle (cloud 2).
param(
  [string]$EstRoot = (Split-Path $PSScriptRoot -Parent),
  [string]$OutputDir = (Join-Path (Split-Path $PSScriptRoot -Parent) 'dist'),
  [string]$BundleName = ''
)

$ErrorActionPreference = 'Stop'

$ArchiveServer = Join-Path $EstRoot 'deploy\cloud\archive-server\server.js'
if (-not (Test-Path $ArchiveServer)) {
  throw "archive server not found at $ArchiveServer"
}

if (-not $BundleName) {
  $BundleName = "mooreview-archive-$(Get-Date -Format 'yyyyMMdd').tgz"
}
$BundlePath = Join-Path $OutputDir $BundleName
$ManifestPath = [System.IO.Path]::ChangeExtension($BundlePath, '.txt')

if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null }

$stageParent = Join-Path $env:TEMP "mooreview-archive-$([Guid]::NewGuid().ToString('N').Substring(0, 8))"
$stageRoot = Join-Path $stageParent 'mooreview-archive'
New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null

Copy-Item $ArchiveServer (Join-Path $stageRoot 'server.js')

$copyPaths = @(
  'deploy\cloud\debian\install-archive.sh',
  'deploy\cloud\debian\mooreview-archive.service',
  'deploy\cloud\phase1\droplet-archive\archive.env.template',
  'deploy\cloud\phase1\droplet-archive\INSTALL.txt',
  'deploy\cloud\phase1\README.md'
)
foreach ($rel in $copyPaths) {
  $src = Join-Path $EstRoot $rel
  if (-not (Test-Path $src)) { throw "Missing $rel" }
  $dest = Join-Path $stageRoot $rel
  $destDir = Split-Path $dest -Parent
  if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
  Copy-Item $src $dest
}

Get-ChildItem (Join-Path $stageRoot 'deploy') -Recurse -File -Include '*.sh', '*.service' -ErrorAction SilentlyContinue | ForEach-Object {
  $raw = [System.IO.File]::ReadAllText($_.FullName)
  if ($raw -match "`r") {
    [System.IO.File]::WriteAllText($_.FullName, ($raw -replace "`r`n", "`n" -replace "`r", "`n"))
  }
}

if (Test-Path $BundlePath) { Remove-Item $BundlePath -Force }

Push-Location $stageParent
try {
  & tar -czf $BundlePath mooreview-archive
  if ($LASTEXITCODE -ne 0) { throw "tar failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
  Remove-Item $stageParent -Recurse -Force -ErrorAction SilentlyContinue
}

$sizeMb = [math]::Round((Get-Item $BundlePath).Length / 1MB, 1)
$manifest = @"
MooreVIEW Phase 1 — archive droplet bundle (cloud 2)
Built: $(Get-Date -Format o)
Archive: $BundleName
Size: $sizeMb MB

WinSCP: upload to /tmp/ on archive droplet, then SSH:

  mkdir -p /opt/mooreview-archive
  tar xzf /tmp/$BundleName -C /opt/mooreview-archive --strip-components=1
  mkdir -p /etc/mooreview
  cp /opt/mooreview-archive/deploy/cloud/phase1/droplet-archive/archive.env.template /etc/mooreview/archive.env
  nano /etc/mooreview/archive.env
  MOOREVIEW_SOURCE=/opt/mooreview-archive MOOREVIEW_ARCHIVE_DIR=/opt/mooreview-archive \
    MOOREVIEW_SAAS_IP=<cloud-1-private-ip> \
    bash /opt/mooreview-archive/deploy/cloud/debian/install-archive.sh

Docs: deploy/cloud/phase1/WINSCP-DEPLOY.md
"@
Set-Content -Path $ManifestPath -Value $manifest -Encoding UTF8

Write-Host "`nArchive bundle ready:" -ForegroundColor Green
Write-Host "  $BundlePath"
Write-Host "  $sizeMb MB"
Write-Host "  $ManifestPath"
