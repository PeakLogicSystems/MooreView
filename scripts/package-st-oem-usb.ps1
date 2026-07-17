# Package MV-ST-OEM for USB copy - runtime, sdk, hal, docs (no node_modules).
param(
  [string]$OutputDir = '',
  [string]$FolderName = 'MV-ST-OEM-USB',
  [switch]$SkipFork,
  [switch]$Zip
)

$ErrorActionPreference = 'Stop'
$EstRoot = Split-Path $PSScriptRoot -Parent
$ParentDir = Split-Path $EstRoot -Parent
$ProductRoot = Join-Path $ParentDir 'mooreview-st-oem'

if (-not $OutputDir) {
  $OutputDir = Join-Path $EstRoot 'dist'
}

if (-not $SkipFork) {
  Write-Host 'Regenerating mooreview-st-oem fork...' -ForegroundColor Cyan
  & (Join-Path $PSScriptRoot 'create-product-forks.ps1') -Products st-oem
}

if (-not (Test-Path $ProductRoot)) {
  throw "Product tree missing: $ProductRoot - run create-product-forks.ps1 first"
}
foreach ($req in @('server.js', 'package.json', 'sdk/README.md', 'docs/OPENWRT.md', 'hal/plugins/Makefile')) {
  $p = Join-Path $ProductRoot $req
  if (-not (Test-Path $p)) {
    throw "Missing required file: $req"
  }
}

$usbRoot = Join-Path $OutputDir $FolderName
$stageProduct = Join-Path $usbRoot 'mooreview-st-oem'

if (Test-Path $usbRoot) {
  Remove-Item $usbRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $stageProduct -Force | Out-Null

Write-Host "Staging USB kit -> $usbRoot" -ForegroundColor Cyan

$excludeDirs = @('node_modules', '.git', 'dist', 'products', 'azure')
robocopy $ProductRoot $stageProduct /E /XD $excludeDirs /XF .env .fork-origin /R:1 /W:2 /MT:16 /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }

# Drop duplicate nested trees from stale fork copies
Get-ChildItem $stageProduct -Directory -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
  $nested = Join-Path $_.FullName $_.Name
  if (Test-Path $nested) { Remove-Item $nested -Recurse -Force -ErrorAction SilentlyContinue }
}
if (Test-Path (Join-Path $stageProduct 'sdk\build')) {
  Remove-Item (Join-Path $stageProduct 'sdk\build') -Recurse -Force -ErrorAction SilentlyContinue
}

# Fresh data dir (no runtime state from dev machine)
$dataDir = Join-Path $stageProduct 'data'
if (Test-Path $dataDir) { Remove-Item $dataDir -Recurse -Force }
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
Set-Content -Path (Join-Path $dataDir '.gitkeep') -Value '' -Encoding ASCII

# Remove dev lockfile (npm install on target)
$lock = Join-Path $stageProduct 'package-lock.json'
if (Test-Path $lock) { Remove-Item $lock -Force }
foreach ($big in @('docs\MooreVIEW-Overview.pptx', 'docs\trademark')) {
  $p = Join-Path $stageProduct $big
  if (Test-Path $p) { Remove-Item $p -Recurse -Force -ErrorAction SilentlyContinue }
}

# Top-level USB instructions
Copy-Item (Join-Path $EstRoot 'deploy\st-oem\INSTALL.txt') (Join-Path $usbRoot 'INSTALL.txt') -Force

$pkg = Get-Content (Join-Path $stageProduct 'package.json') -Raw | ConvertFrom-Json
$fileCount = (Get-ChildItem $usbRoot -Recurse -File).Count
$sizeMb = [math]::Round(((Get-ChildItem $usbRoot -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB), 1)

$manifest = @(
  'MV-ST-OEM USB install kit',
  "Built: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')",
  "Product: $($pkg.name) $($pkg.version)",
  'Target: OpenWrt (production), Raspberry Pi / Linux (bench + HAL)',
  "Files: $fileCount",
  "Size: ${sizeMb} MB (excluding node_modules; run npm install on device)",
  '',
  'Copy the entire MV-ST-OEM-USB folder to a USB drive.',
  'On the target device, read INSTALL.txt and cd mooreview-st-oem.',
  '',
  'Key paths:',
  '  mooreview-st-oem/README.md',
  '  mooreview-st-oem/docs/OPENWRT.md',
  '  mooreview-st-oem/sdk/',
  '  mooreview-st-oem/hal/plugins/'
) -join "`n"

Set-Content -Path (Join-Path $usbRoot 'MANIFEST.txt') -Value $manifest -Encoding UTF8

# LF for shell scripts on Linux
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
Get-ChildItem $usbRoot -Recurse -File | Where-Object {
  $_.Extension -in @('.sh', '.service') -or $_.Name -eq 'INSTALL.txt'
} | ForEach-Object {
  $text = [System.IO.File]::ReadAllText($_.FullName)
  $text = $text -replace "`r`n", "`n" -replace "`r", "`n"
  [System.IO.File]::WriteAllText($_.FullName, $text, $utf8NoBom)
}

$zipPath = Join-Path $OutputDir "$FolderName.zip"
if ($Zip) {
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  Compress-Archive -Path $usbRoot -DestinationPath $zipPath -CompressionLevel Optimal
  Write-Host "Zip: $zipPath" -ForegroundColor Green
}

Write-Host "`nUSB kit ready: $usbRoot" -ForegroundColor Green
Write-Host "  $fileCount files, ${sizeMb} MB (run npm install on target)" -ForegroundColor Green
Write-Host "Copy folder to USB drive, then follow INSTALL.txt on the device." -ForegroundColor Green
