# Build MooreVIEW update bundle for Compulab IOT-LINK (Windows).
# Output: dist/mooreview-iot-link-update-YYYYMMDD.tgz
$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Dist = Join-Path $RepoRoot 'dist'
$Stamp = Get-Date -Format 'yyyyMMdd'
$Archive = Join-Path $Dist "mooreview-iot-link-update-$Stamp.tgz"
New-Item -ItemType Directory -Force -Path $Dist | Out-Null
Push-Location $RepoRoot
try {
  tar czf $Archive `
    --exclude=node_modules `
    --exclude=.git `
    --exclude=data `
    --exclude=products `
    --exclude=azure `
    --exclude=dist `
    --exclude=deploy/windows `
    .
  Write-Host "Created $Archive"
  Write-Host "Transfer: scp $Archive root@<iot-link-ip>:/tmp/"
  Write-Host "Update:   tar xzf /tmp/$(Split-Path $Archive -Leaf) --overwrite -C /opt/mooreview --strip-components=1"
  Write-Host "          bash /opt/mooreview/deploy/iot-link/update.sh"
} finally {
  Pop-Location
}
