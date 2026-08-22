#Requires -Version 5.1
<#
.SYNOPSIS
  Build #1 — pack nexcomm-sb-mqtt-function (sync mapMessage from bridge, npm install, zip).

.EXAMPLE
  .\build.ps1
  .\build.ps1 -ZipPath C:\Users\Public\data\est-pc\dist\nexcomm-sb-mqtt-function.zip
#>
param(
  [string]$ZipPath = ''
)

$ErrorActionPreference = 'Stop'
$FnRoot = $PSScriptRoot
$RepoRoot = Resolve-Path (Join-Path $FnRoot '..\..\..')
$BridgeMap = Join-Path $RepoRoot 'services\nexcomm-sb-mqtt-bridge\src\mapMessage.js'
$DistDir = Join-Path $RepoRoot 'dist'
$Stage = Join-Path $env:TEMP "nexcomm-sb-mqtt-fn-$([Guid]::NewGuid().ToString('N').Substring(0, 8))"

if (-not $ZipPath) {
  if (-not (Test-Path $DistDir)) {
    New-Item -ItemType Directory -Path $DistDir -Force | Out-Null
  }
  $ZipPath = Join-Path $DistDir 'nexcomm-sb-mqtt-function.zip'
}

if (-not (Test-Path $BridgeMap)) {
  throw "Canonical mapMessage missing: $BridgeMap"
}

Write-Host "=== Build #1: nexcomm-sb-mqtt-function ===" -ForegroundColor Cyan
Write-Host "Staging: $Stage"

New-Item -ItemType Directory -Path $Stage -Force | Out-Null
Copy-Item -Path (Join-Path $FnRoot 'package.json') -Destination $Stage
Copy-Item -Path (Join-Path $FnRoot 'host.json') -Destination $Stage
Copy-Item -Path (Join-Path $FnRoot 'src') -Destination $Stage -Recurse

# Keep Function mapping identical to long-running bridge
$libDir = Join-Path $Stage 'src\lib'
New-Item -ItemType Directory -Path $libDir -Force | Out-Null
Copy-Item -Path $BridgeMap -Destination (Join-Path $libDir 'mapMessage.js') -Force
Write-Host "Synced mapMessage.js from nexcomm-sb-mqtt-bridge" -ForegroundColor Green

# Ensure mqttPublish.js present (not overwritten by bridge sync)
if (-not (Test-Path (Join-Path $libDir 'mqttPublish.js'))) {
  Copy-Item -Path (Join-Path $FnRoot 'src\lib\mqttPublish.js') -Destination (Join-Path $libDir 'mqttPublish.js') -Force
}

Push-Location $Stage
try {
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  npm install --omit=dev --no-audit --no-fund 2>&1 | Out-Host
  $npmExit = $LASTEXITCODE
  $ErrorActionPreference = $prevEap
  if ($npmExit -ne 0) { throw "npm install failed ($npmExit)" }
} finally {
  Pop-Location
}

# Sanity: required entrypoints
$required = @(
  'host.json',
  'package.json',
  'src\functions\nexcommTelemetryToMqtt.js',
  'src\lib\mapMessage.js',
  'src\lib\mqttPublish.js',
  'node_modules\@azure\functions\package.json',
  'node_modules\mqtt\package.json'
)
foreach ($rel in $required) {
  $p = Join-Path $Stage $rel
  if (-not (Test-Path $p)) { throw "Build incomplete - missing $rel" }
}

if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
Compress-Archive -Path (Join-Path $Stage '*') -DestinationPath $ZipPath -Force
Remove-Item $Stage -Recurse -Force

$item = Get-Item $ZipPath
Write-Host ""
Write-Host "OK  $($item.FullName)" -ForegroundColor Green
Write-Host "    Size: $([math]::Round($item.Length / 1KB, 1)) KB"
Write-Host ""
Write-Host "Next (when az + Function App exist):" -ForegroundColor Yellow
Write-Host "  az deployment group create -g YOUR_RG -f main.bicep ..."
Write-Host "  az functionapp deployment source config-zip -g YOUR_RG -n APP_NAME --src `"$ZipPath`""
Write-Host ""
Write-Host "Inbound device templates / tag alignment: your step."
Write-Output $ZipPath
