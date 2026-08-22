$ErrorActionPreference = 'Stop'
. 'C:\Espressif\tools\Microsoft.v6.0.2.PowerShell_profile.ps1'

function Build-EspProj {
    param(
        [string]$Dir,
        [string]$Target,
        [switch]$FreshConfig
    )
    Write-Host ""
    Write-Host "==== BUILD $Dir ($Target) ===="
    Set-Location $Dir
    if ($FreshConfig) {
        if (Test-Path 'sdkconfig') { Remove-Item -Force 'sdkconfig' }
        if (Test-Path 'build') { Remove-Item -Recurse -Force 'build' }
    }
    if ((Test-Path 'build') -and -not (Test-Path 'build\build.ninja')) {
        Remove-Item -Recurse -Force 'build'
    }
    if (-not (Test-Path 'sdkconfig')) {
        idf.py set-target $Target
        if ($LASTEXITCODE -ne 0) { throw "set-target failed: $Dir" }
    }
    idf.py build
    if ($LASTEXITCODE -ne 0) { throw "build failed: $Dir" }
}

$root = 'C:\Users\public\data\est-pc'
Build-EspProj -Dir "$root\cellular-parc-st" -Target 'esp32s3'
Build-EspProj -Dir "$root\cellular-opta-gateway" -Target 'esp32s3'
Build-EspProj -Dir "$root\halow-xiao-sta" -Target 'esp32s3'
Write-Host 'ALL BUILDS OK'
