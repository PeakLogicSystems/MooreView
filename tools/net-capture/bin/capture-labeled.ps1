# Labeled capture for paired dry/wet diff analysis (GW4 / NextCentury cloud protocol).
# Requires Admin + Wireshark/tshark. Mirror port 2 -> 3 on TL-SG108E recommended.
#
# Workflow:
#   1. .\bin\capture-labeled.ps1 -Label dry   -Seconds 300
#   2. Wet FA003A90, then: .\bin\capture-labeled.ps1 -Label wet -Seconds 300
#   3. Dry again, then:     .\bin\capture-labeled.ps1 -Label dry2 -Seconds 300
#   4. node bin/diff-labeled.js
#
# Usage:
#   .\bin\capture-labeled.ps1 -Label dry
#   .\bin\capture-labeled.ps1 -Label wet -Seconds 180 -Note "FA003A90 wet"

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('dry', 'wet', 'dry2')]
  [string]$Label,
  [string]$TargetHost = '192.168.1.241',
  [int]$Seconds = 300,
  [int]$Iface = 8,
  [string]$Note = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$pairedDir = Join-Path $root 'data\paired'
New-Item -ItemType Directory -Force -Path $pairedDir | Out-Null

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$out = Join-Path $pairedDir "$Label-$stamp.pcapng"
$manifest = Join-Path $pairedDir 'manifest.json'

$tshark = 'C:\Program Files\Wireshark\tshark.exe'
if (-not (Test-Path $tshark)) { throw 'Install Wireshark (tshark) first.' }

Write-Host ''
Write-Host "=== Labeled capture: $Label ==="
Write-Host "Target: $TargetHost  Interface: $Iface  Duration: ${Seconds}s"
if ($Note) { Write-Host "Note: $Note" }
Write-Host "Output: $out"
Write-Host ''

ping -n 1 $TargetHost | Out-Host

Write-Host "Capturing... (trigger sensor state NOW if this is the wet label)"
& $tshark -i $Iface -f "host $TargetHost" -a "duration:$Seconds" -w $out

$frames = 0
try {
  $stat = & $tshark -r $out -q -z io,stat,0 2>&1 | Out-String
  if ($stat -match '\|\s*(\d+)\s*\|') { $frames = [int]$Matches[1] }
} catch { }

$entry = [ordered]@{
  label   = $Label
  file    = Split-Path $out -Leaf
  host    = $TargetHost
  seconds = $Seconds
  note    = $Note
  at      = (Get-Date).ToUniversalTime().ToString('o')
  frames  = $frames
}

$list = @()
if (Test-Path $manifest) {
  $list = Get-Content $manifest -Raw | ConvertFrom-Json
  if ($list -isnot [array]) { $list = @($list) }
}
$list += [pscustomobject]$entry
$list | ConvertTo-Json -Depth 6 | Set-Content $manifest -Encoding utf8NoBOM

Write-Host ''
Write-Host "Saved $frames frame(s) -> $out"
Write-Host "Manifest updated -> $manifest"
Write-Host ''
Write-Host 'Next: run remaining labeled captures, then:'
Write-Host '  node bin/diff-labeled.js'
