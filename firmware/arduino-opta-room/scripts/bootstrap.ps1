# Build MooreviewOptaRoom sketch from arduino-opta-mqtt-st + room overlays.
# Run once after clone/pull, then open MooreviewOptaRoom/MooreviewOptaRoom.ino in Arduino IDE.

$ErrorActionPreference = 'Stop'
$roomRoot = Split-Path $PSScriptRoot -Parent
$src = Join-Path $roomRoot '..\arduino-opta-mqtt-st\MooreviewOptaMqttSt'
$dst = Join-Path $roomRoot 'MooreviewOptaRoom'
$overlay = Join-Path $roomRoot 'overlays\MooreviewOptaRoom'

if (-not (Test-Path $src)) {
  Write-Error "Source not found: $src"
}

if (Test-Path $dst) {
  Remove-Item $dst -Recurse -Force
}

Copy-Item -Path $src -Destination $dst -Recurse
Copy-Item -Path (Join-Path $overlay '*') -Destination $dst -Force
Remove-Item (Join-Path $dst 'MooreviewOptaMqttSt.ino') -ErrorAction SilentlyContinue

Write-Host "MooreviewOptaRoom sketch ready at: $dst"
Write-Host "Open MooreviewOptaRoom.ino in Arduino IDE (Board: Arduino Opta WiFi)."
