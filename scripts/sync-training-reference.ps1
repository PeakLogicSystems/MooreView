# Copy all MooreVIEW training reference material into docs/training/reference/.
param(
  [string]$EstRoot = (Split-Path $PSScriptRoot -Parent),
  [string]$OemDocs = (Join-Path (Split-Path $EstRoot -Parent) 'mooreview-st-oem\docs')
)

$ErrorActionPreference = 'Stop'
$RefRoot = Join-Path $EstRoot 'docs\training\reference'

function Copy-Ref {
  param(
    [string]$Src,
    [string]$DestRel,
    [string]$Label = ''
  )
  if (-not (Test-Path $Src)) {
    Write-Warning "Skip missing: $Src"
    return $false
  }
  $dest = Join-Path $RefRoot $DestRel
  $parent = Split-Path $dest -Parent
  if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  Copy-Item $Src $dest -Force
  Write-Host "  $(if ($Label) { $Label } else { $DestRel })" -ForegroundColor Green
  return $true
}

if (Test-Path $RefRoot) {
  Get-ChildItem $RefRoot -Recurse -File | Remove-Item -Force
} else {
  New-Item -ItemType Directory -Path $RefRoot -Force | Out-Null
}

Write-Host "Building training reference pack at $RefRoot" -ForegroundColor Cyan

# Core curriculum (copies of docs/training/*.md except this pack's README)
foreach ($name in @('iot-cbm-training.md', 'instructor-guide.md', 'quizzes-answer-key.md')) {
  Copy-Ref (Join-Path $EstRoot "docs\training\$name") "curriculum\$name"
}

# Platform / integration guides (est-pc + OEM docs cited by training)
$platform = @(
  @{ Src = 'docs\CAMERAS.md'; Dest = 'platform\CAMERAS.md' },
  @{ Src = 'docs\facilities\EZMETER_FACILITY_PQ.md'; Dest = 'platform\EZMETER_FACILITY_PQ.md' },
  @{ Src = 'docs\BACNET.md'; Dest = 'platform\BACNET.md' },
  @{ Src = 'docs\ARCHIVE_EXPORT.md'; Dest = 'platform\ARCHIVE_EXPORT.md' },
  @{ Src = 'docs\EST_PC_PARITY.md'; Dest = 'platform\EST_PC_PARITY.md' },
  @{ Src = 'docs\HAL.md'; Dest = 'platform\HAL.md' },
  @{ Src = 'docs\CMMS_APPLIANCE.md'; Dest = 'platform\CMMS_APPLIANCE.md' },
  @{ Src = 'docs\pdm\PDM_PROACTIVE_CMMS.md'; Dest = 'platform\PDM_PROACTIVE_CMMS.md' },
  @{ Src = 'docs\pdm\LIFT-STATION-PDM-TRAINING-REVIEW.md'; Dest = 'platform\LIFT-STATION-PDM-TRAINING-REVIEW.md' },
  @{ Src = 'docs\CLOUD_USER_GUIDE.md'; Dest = 'platform\CLOUD_USER_GUIDE.md' },
  @{ Src = 'docs\testing\FULL_SYSTEM_TEST.md'; Dest = 'platform\FULL_SYSTEM_TEST.md' },
  @{ Src = 'docs\CMMS_INTEGRATION.md'; Dest = 'platform\CMMS_INTEGRATION.md' },
  @{ Src = 'docs\BASELINE_TEST.md'; Dest = 'platform\BASELINE_TEST.md' },
  @{ Src = 'docs\MQTT_PARC.md'; Dest = 'platform\MQTT_PARC.md' },
  @{ Src = 'docs\ARCHITECTURE.md'; Dest = 'platform\ARCHITECTURE.md' },
  @{ Src = 'docs\CELLULAR_SIMS.md'; Dest = 'platform\CELLULAR_SIMS.md' },
  @{ Src = 'docs\CLOUD_DEPLOY_DO.md'; Dest = 'platform\CLOUD_DEPLOY_DO.md' },
  @{ Src = 'docs\CLOUD_SAAS.md'; Dest = 'platform\CLOUD_SAAS.md' },
  @{ Src = 'docs\UPDATES.md'; Dest = 'platform\UPDATES.md' },
  @{ Src = 'docs\MV-WORKSTATION-CURSAVES.md'; Dest = 'platform\MV-WORKSTATION-CURSAVES.md' }
)
foreach ($item in $platform) {
  $root = if ($item.Root) { $item.Root } else { $EstRoot }
  Copy-Ref (Join-Path $root $item.Src) $item.Dest
}

# Hardware / firmware READMEs cited in M7, M14, M15, Parc tab
$hardware = @(
  @{ Src = 'firmware\arduino-opta-mqtt-st\README.md'; Dest = 'hardware\arduino-opta-mqtt-st.md' },
  @{ Src = 'st\opta-mqtt\README.md'; Dest = 'hardware\st-opta-mqtt.md' },
  @{ Src = 'st\opta\README.md'; Dest = 'hardware\st-opta.md' },
  @{ Src = 'st\README.md'; Dest = 'hardware\st-overview.md' },
  @{ Src = 'cellular-parc-st\README.md'; Dest = 'hardware\cellular-parc-st.md' },
  @{ Src = 'cellular-parc-st\BUILD.md'; Dest = 'hardware\cellular-parc-st-build.md' },
  @{ Src = 'cellular-opta-gateway\README.md'; Dest = 'hardware\cellular-opta-gateway.md' },
  @{ Src = 'mv-draw\README.md'; Dest = 'hardware\mv-draw.md' },
  @{ Src = 'hal\plugins\README_SM-I-001.md'; Dest = 'hardware\hal-sequent-sm-i-001.md' },
  @{ Src = 'firmware\README.md'; Dest = 'hardware\firmware-overview.md' }
)
foreach ($item in $hardware) {
  Copy-Ref (Join-Path $EstRoot $item.Src) $item.Dest
}

# PDF (if added to docs/training later)
$pdfNames = @(
  'IoT-Condition-Monitoring-Training.pdf',
  'IoT Condition monitoring training.pdf'
)
foreach ($pdf in $pdfNames) {
  $src = Join-Path $EstRoot "docs\training\$pdf"
  if (Test-Path $src) {
    Copy-Ref $src "curriculum\$pdf"
  }
}

$missing = @(
  @{ Path = 'docs/training/IoT-Condition-Monitoring-Training.pdf'; UsedIn = 'Original CBM PDF (copy exists when present in docs/training/)' },
  @{ Path = 'halow-xiao-sta/README.md'; UsedIn = 'T-HaLow sensor template (M14)' }
)
$missingText = @"
# Materials not in this repository

The training curriculum references these paths. Add the source files to est-pc (or OEM docs) and re-run:

``````powershell
cd est-pc
powershell -File scripts\sync-training-reference.ps1
``````

| Referenced path | Used in |
|-----------------|---------|
$(($missing | ForEach-Object { "| ``$($_.Path)`` | $($_.UsedIn) |" }) -join "`n")

"@

Set-Content -Path (Join-Path $RefRoot 'MISSING-SOURCES.md') -Value $missingText.TrimEnd() -Encoding UTF8

$readme = @"
# Training reference pack

Single folder with **copies** of all MooreVIEW training reference material (curriculum + cited guides).

Regenerate after doc updates:

``````powershell
cd est-pc
powershell -File scripts\sync-training-reference.ps1
``````

## Layout

| Folder | Contents |
|--------|----------|
| **curriculum/** | Full course, instructor guide, quiz answer key, CBM PDF (if present) |
| **platform/** | Integration guides: cameras, Parc/MQTT, BACnet/IP, EZ Meter facility PQ, CMMS, PdM proactive CMMS, lift-station PdM, archive export, baseline test, architecture, cellular SIMs, HAL, edge vs cloud parity |
| **hardware/** | Firmware and field-device READMEs (Opta, Parc ST, cellular Opta gateway, MV Draw, Sequent HAL) |

## In-app access

Learners use **Tools → Training (F2)**. Trainers use the **Instructor** tab. This folder is for offline printing, WinSCP to classroom PCs, and instructor prep.

## Missing sources

See [MISSING-SOURCES.md](./MISSING-SOURCES.md) for paths cited in training but not yet in the repo.

Built: $(Get-Date -Format o)
"@

Set-Content -Path (Join-Path $RefRoot 'README.md') -Value $readme.TrimEnd() -Encoding UTF8
Write-Host "`nReference pack ready: $RefRoot" -ForegroundColor Green
