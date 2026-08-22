# Run full dry -> wet -> dry2 paired session (5 min each, 15 min total).
# Start while sensor is DRY. Wet at the beep after phase 1; dry again at beep after phase 2.

$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$secs = 300

function Beep-Phase($msg) {
  Write-Host ''
  Write-Host '========================================'
  Write-Host $msg
  Write-Host '========================================'
  Write-Host ''
  [console]::beep(880, 400)
  Start-Sleep -Milliseconds 200
  [console]::beep(1100, 400)
}

Write-Host 'Paired session starting - sensor should be DRY now.'
Write-Host ('Phase 1/3: dry (' + $secs + 's)')
& "$here\capture-labeled.ps1" -Label dry -Seconds $secs -Note 'start dry'

Beep-Phase 'PHASE 2: WET FA003A90 NOW - capture starting'

& "$here\capture-labeled.ps1" -Label wet -Seconds $secs -Note 'user wet at phase start'

Beep-Phase 'PHASE 3: DRY sensor NOW - capture starting'

& "$here\capture-labeled.ps1" -Label dry2 -Seconds $secs -Note 'user dry at phase start'

Write-Host ''
Write-Host 'All captures done. Running diff...'
Set-Location (Split-Path $here -Parent)
node bin/diff-labeled.js
