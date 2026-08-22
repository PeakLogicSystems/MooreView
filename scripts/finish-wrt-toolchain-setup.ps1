#Requires -Version 5.1
<#
.SYNOPSIS
  Run after reboot to finish WSL + OpenWrt toolchain setup.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\finish-wrt-toolchain-setup.ps1
#>
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$setupScript = Join-Path $repoRoot 'scripts\setup-wrt-eclipse-toolchains.ps1'

Write-Host 'Checking WSL...' -ForegroundColor Cyan
$status = wsl --status 2>&1 | Out-String
Write-Host $status

try {
    wsl -e true 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'WSL not ready' }
} catch {
    Write-Host @'

WSL is not running yet. If you just rebooted:
  1. Open "Ubuntu" from the Start menu once and create your Linux user.
  2. Re-run: powershell -ExecutionPolicy Bypass -File scripts\finish-wrt-toolchain-setup.ps1

If WSL reports virtualization is disabled, enable Intel VT-x / AMD-V in BIOS:
  https://aka.ms/enablevirtualization

'@ -ForegroundColor Yellow
    exit 1
}

Write-Host 'WSL OK — extracting OpenWrt MIPS + ARM7 toolchains...' -ForegroundColor Cyan
& $setupScript

Write-Host @'

Done. Build examples (from WSL, in mooreview repo):

  # MIPS (router / WRT)
  source ~/toolchains/openwrt/env-wrt-toolchains.sh && wrt_mips_env
  cmake -S sdk -B build-mips -DCMAKE_TOOLCHAIN_FILE=sdk/cmake/toolchain-openwrt.cmake
  cmake --build build-mips

  # ARM7 (NanoPi NEO / FriendlyWrt)
  source ~/toolchains/openwrt/env-wrt-toolchains.sh && wrt_arm_env
  cmake -S sdk -B build-arm7 -DCMAKE_TOOLCHAIN_FILE=sdk/cmake/toolchain-openwrt-arm.cmake
  cmake --build build-arm7

'@ -ForegroundColor Green
