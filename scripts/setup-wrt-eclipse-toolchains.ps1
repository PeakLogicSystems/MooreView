#Requires -Version 5.1
<#
.SYNOPSIS
  Install/configure Eclipse + OpenWrt (WRT) cross-toolchains for ARM7 and MIPS.

.DESCRIPTION
  Installs (via winget if missing):
    - Eclipse IDE for Embedded C/C++ Developers
    - GNU Arm Embedded Toolchain (arm-none-eabi, bare-metal ARM7)
    - MSYS2 (helper shell)

  Downloads OpenWrt toolchains (Linux x86_64 — run under WSL):
    - MIPS:  mipsel_24kc / ramips-mt7621 (OpenWrt 23.05.5)
    - ARM7:  sunxi/cortexa7 (OpenWrt 19.07.8, NanoPi NEO / FriendlyWrt)

  OpenWrt SDK binaries are Linux ELF. On Windows you need WSL2 + Ubuntu to
  extract and run them. Use -InstallWsl to enable that step.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\setup-wrt-eclipse-toolchains.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\setup-wrt-eclipse-toolchains.ps1 -InstallWsl
#>
param(
    [switch]$InstallWsl,
    [string]$ToolchainRoot = "$env:USERPROFILE\toolchains\openwrt"
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

function Ensure-WingetPackage {
    param([string]$Id, [string]$Name)
    $installed = winget list --id $Id --disable-interactivity 2>$null | Select-String $Id
    if ($installed) {
        Write-Host "  OK: $Name already installed"
        return
    }
    Write-Host "  Installing $Name..."
    winget install --id $Id --accept-package-agreements --accept-source-agreements --disable-interactivity
}

Write-Step 'Installing IDE and Windows-native ARM toolchain'
Ensure-WingetPackage 'EclipseFoundation.Eclipse.EmbedCPP' 'Eclipse Embedded C/C++'
Ensure-WingetPackage 'Arm.GnuArmEmbeddedToolchain' 'GNU Arm Embedded Toolchain'
Ensure-WingetPackage 'MSYS2.MSYS2' 'MSYS2'

$eclipseExe = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\EclipseFoundation.Eclipse.EmbedCPP_Microsoft.Winget.Source_8wekyb3d8bbwe\eclipse\eclipse.exe'
$armGcc = 'C:\Program Files (x86)\Arm GNU Toolchain arm-none-eabi\14.2 rel1\bin\arm-none-eabi-gcc.exe'

if (-not (Test-Path $eclipseExe)) {
    Write-Warning "Eclipse not found at expected path. Launch from Start menu: 'Eclipse Embedded C/C++'"
} else {
    Write-Host "  Eclipse: $eclipseExe"
}
if (Test-Path $armGcc) {
    & $armGcc --version | Select-Object -First 1
}

Write-Step 'Downloading OpenWrt MIPS + ARM7 SDK archives'
New-Item -ItemType Directory -Force -Path $ToolchainRoot | Out-Null

$mipsUrl = 'https://downloads.openwrt.org/releases/23.05.5/targets/ramips/mt7621/openwrt-toolchain-23.05.5-ramips-mt7621_gcc-12.3.0_musl.Linux-x86_64.tar.xz'
$armUrl  = 'https://downloads.openwrt.org/releases/19.07.8/targets/sunxi/cortexa7/openwrt-sdk-19.07.8-sunxi-cortexa7_gcc-7.5.0_musl_eabi.Linux-x86_64.tar.xz'
$mipsTar = Join-Path $ToolchainRoot 'openwrt-toolchain-mipsel.tar.xz'
$armTar  = Join-Path $ToolchainRoot 'openwrt-sdk-arm7.tar.xz'

foreach ($item in @(
        @{ Url = $mipsUrl; Path = $mipsTar; Label = 'MIPS toolchain' },
        @{ Url = $armUrl;  Path = $armTar;  Label = 'ARM7 SDK' }
    )) {
    if (-not (Test-Path $item.Path)) {
        Write-Host "  Downloading $($item.Label)..."
        Invoke-WebRequest -Uri $item.Url -OutFile $item.Path -UseBasicParsing
    } else {
        Write-Host "  OK: $($item.Label) archive present"
    }
}

if ($InstallWsl) {
    Write-Step 'Installing WSL2 + Ubuntu (required to run OpenWrt Linux toolchains)'
    wsl --install -d Ubuntu --no-launch
    Write-Host @'

  Reboot if prompted, then open Ubuntu once to finish setup.
  Re-run this script without -InstallWsl to extract toolchains in WSL.

'@
}

$wslOk = $false
try {
    $null = wsl -e true 2>$null
    if ($LASTEXITCODE -eq 0) { $wslOk = $true }
} catch {}

if ($wslOk) {
    Write-Step 'Extracting OpenWrt toolchains inside WSL (preserves symlinks)'
    $wslRoot = wsl wslpath -a $ToolchainRoot
    wsl bash -lc "set -e; mkdir -p '$wslRoot'; cd '$wslRoot'; [ -d openwrt-toolchain-23.05.5-ramips-mt7621_gcc-12.3.0_musl.Linux-x86_64 ] || tar -xf openwrt-toolchain-mipsel.tar.xz; [ -d openwrt-sdk-19.07.8-sunxi-cortexa7_gcc-7.5.0_musl_eabi.Linux-x86_64 ] || tar -xf openwrt-sdk-arm7.tar.xz"

    Write-Step 'Verifying cross-compilers in WSL'
    wsl bash -lc @"
set -e
MIPS_BIN='$wslRoot/openwrt-toolchain-23.05.5-ramips-mt7621_gcc-12.3.0_musl.Linux-x86_64/toolchain-mipsel_24kc_gcc-12.3.0_musl/bin'
SDK='$wslRoot/openwrt-sdk-19.07.8-sunxi-cortexa7_gcc-7.5.0_musl_eabi.Linux-x86_64'
ARM_BIN=\$(ls -d \"\$SDK\"/staging_dir/toolchain-*/bin)
echo 'MIPS:'; \"\$MIPS_BIN\"/mipsel-openwrt-linux-musl-gcc --version | head -1
echo 'ARM7:'; \"\$ARM_BIN\"/arm-openwrt-linux-muslgnueabi-gcc --version | head -1
"@

    # WSL-side env helper for cmake / shell builds
    $envSh = Join-Path $ToolchainRoot 'env-wrt-toolchains.sh'
    @"
#!/usr/bin/env bash
# Source before building sdk/ for OpenWrt targets.
ROOT=\"\$(cd \"\$(dirname \"\${BASH_SOURCE[0]}\")\" && pwd)\"

export MIPS_STAGING_DIR=\"\$ROOT/openwrt-toolchain-23.05.5-ramips-mt7621_gcc-12.3.0_musl.Linux-x86_64/toolchain-mipsel_24kc_gcc-12.3.0_musl\"
export MIPS_PATH=\"\$MIPS_STAGING_DIR/bin\"

SDK=\"\$ROOT/openwrt-sdk-19.07.8-sunxi-cortexa7_gcc-7.5.0_musl_eabi.Linux-x86_64\"
export ARM_STAGING_DIR=\"\$SDK/staging_dir/target-arm_cortex-a7+neon-vfpv4_musl_eabi\"
export ARM_PATH=\"\$SDK/staging_dir/toolchain-arm_cortex-a7+neon-vfpv4_gcc-7.5.0_musl_eabi/bin\"

wrt_mips_env() {
  export STAGING_DIR=\"\$MIPS_STAGING_DIR\"
  export PATH=\"\$MIPS_PATH:\$PATH\"
  export TOOLCHAIN_PREFIX=mipsel-openwrt-linux-musl
}

wrt_arm_env() {
  export STAGING_DIR=\"\$ARM_STAGING_DIR\"
  export PATH=\"\$ARM_PATH:\$PATH\"
  export TOOLCHAIN_PREFIX=arm-openwrt-linux-muslgnueabi
}

# Example — MIPS SDK build from mooreview repo root:
#   source ~/toolchains/openwrt/env-wrt-toolchains.sh && wrt_mips_env
#   cmake -S sdk -B build-mips -DCMAKE_TOOLCHAIN_FILE=sdk/cmake/toolchain-openwrt.cmake
"@ | Set-Content -Encoding UTF8 -Path $envSh
    Write-Host "  Wrote $envSh"
} else {
    Write-Host @"

  WSL is not available. OpenWrt archives downloaded to:
    $ToolchainRoot

  To finish MIPS/ARM7 toolchain setup, install WSL and re-run:
    wsl --install -d Ubuntu
    powershell -ExecutionPolicy Bypass -File scripts\setup-wrt-eclipse-toolchains.ps1

"@ -ForegroundColor Yellow
}

Write-Step 'Eclipse toolchain registration'
Write-Host @"
  1. Launch: Eclipse IDE for Embedded C/C++ Developers
  2. Window > Preferences > C/C++ > Core Build Toolchains
  3. Add GNU Arm Embedded (Windows — bare-metal ARM7):
       Prefix:  arm-none-eabi-
       Path:    C:\Program Files (x86)\Arm GNU Toolchain arm-none-eabi\14.2 rel1\bin
  4. For OpenWrt Linux userspace (sdk/ C++ daemons), point Eclipse Remote/WSL
     toolchains at WSL paths after extraction:
       MIPS:  ~/toolchains/openwrt/.../toolchain-mipsel_24kc_gcc-12.3.0_musl/bin
       ARM7:  ~/toolchains/openwrt/.../staging_dir/toolchain-arm_cortex-a7+neon-vfpv4_gcc-7.5.0_musl_eabi/bin

  CMake toolchain files in this repo:
    sdk/cmake/toolchain-openwrt.cmake      (MIPS / mipsel)
    sdk/cmake/toolchain-openwrt-arm.cmake  (ARM7 / cortex-a7)

"@

Write-Step 'Done'
