<#
.SYNOPSIS
  Sync MooreviewOptaMqttSt sketch sources from the Arduino working tree into the repo.

.DESCRIPTION
  Default source: C:\data\MooreviewOptaMqttSt (Arduino IDE / local build tree).
  Destination: firmware\arduino-opta-mqtt-st\MooreviewOptaMqttSt\

  Copies *.ino, *.cpp, *.h only (skips .theia and other IDE metadata).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\sync-opta-firmware-from-data.ps1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\sync-opta-firmware-from-data.ps1 -Source 'D:\work\MooreviewOptaMqttSt'
#>
[CmdletBinding()]
param(
  [string]$Source = 'C:\data\MooreviewOptaMqttSt',
  [string]$Dest = ''
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
if (-not $Dest) {
  $Dest = Join-Path $repoRoot 'firmware\arduino-opta-mqtt-st\MooreviewOptaMqttSt'
}

if (-not (Test-Path -LiteralPath $Source)) {
  throw "Source not found: $Source"
}
if (-not (Test-Path -LiteralPath $Dest)) {
  New-Item -ItemType Directory -Path $Dest -Force | Out-Null
}

$srcVer = Select-String -Path (Join-Path $Source 'mv_version.h') -Pattern 'MV_FIRMWARE_VERSION\s+"([^"]+)"' |
  ForEach-Object { $_.Matches.Groups[1].Value } | Select-Object -First 1
Write-Host "Sync Opta firmware  $Source  →  $Dest" -ForegroundColor Cyan
if ($srcVer) { Write-Host "Source firmwareVersion=$srcVer" -ForegroundColor Cyan }

$files = Get-ChildItem -LiteralPath $Source -File | Where-Object {
  $_.Extension -match '^\.(ino|cpp|h)$'
}
if (-not $files) { throw "No .ino/.cpp/.h files in $Source" }

$copied = 0
foreach ($f in $files) {
  Copy-Item -LiteralPath $f.FullName -Destination (Join-Path $Dest $f.Name) -Force
  $copied++
}

$dstVer = Select-String -Path (Join-Path $Dest 'mv_version.h') -Pattern 'MV_FIRMWARE_VERSION\s+"([^"]+)"' |
  ForEach-Object { $_.Matches.Groups[1].Value } | Select-Object -First 1

Write-Host "Copied $copied files. Dest firmwareVersion=$dstVer" -ForegroundColor Green
Write-Host "Open $Dest\MooreviewOptaMqttSt.ino in Arduino IDE to build/flash." -ForegroundColor Yellow
