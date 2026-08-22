# MooreVIEW MV-workstation — Cursor chat sync (cursaves)
#
# RUN ON MV-WORKSTATION (192.168.1.76), not the home PC.
#
# Logins (two different systems):
#   Windows file share (home PC -> this PC):  user roy, password yell, share workbox
#   cursaves GitHub (required for sync):      GitHub account mooreview (private repo)
#
# Usage:
#   Double-click:  Setup-MV-Cursaves-Sync.cmd
#   PowerShell:    .\mv-workstation-cursaves-sync.ps1
#   With token:    .\mv-workstation-cursaves-sync.ps1 -GitHubToken 'ghp_xxxx'

param(
  [string]$Remote = 'https://github.com/mooreview/mooreview-cursaves.git',
  [string]$ProjectPath = 'C:\data\est-pc',
  [string]$GitHubHost = 'github.com',
  [switch]$SkipSync,
  [string]$GitHubToken = ''
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Msg) {
  Write-Host "`n=== $Msg ===" -ForegroundColor Cyan
}

function Add-UvToPath {
  $bin = Join-Path $env:USERPROFILE '.local\bin'
  if (Test-Path $bin) { $env:Path = "$bin;$env:Path" }
}

function Install-UvIfNeeded {
  if (Get-Command uv -ErrorAction SilentlyContinue) { return }
  Write-Host 'Installing uv...'
  Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression
  Add-UvToPath
}

function Install-CursavesIfNeeded {
  Install-UvIfNeeded
  Add-UvToPath
  $ver = (& cursaves --version 2>$null)
  if ($ver -notmatch '0\.9\.[2-9]') {
    Write-Host 'Installing cursaves 0.9.2+ (Windows fork)...'
    uv tool install --force git+https://github.com/tibbinova/cursaves.git
    uv tool update-shell 2>$null | Out-Null
    Add-UvToPath
  }
  Write-Host "cursaves $(cursaves --version)"
}

function Install-GhIfNeeded {
  if (Get-Command gh -ErrorAction SilentlyContinue) { return }
  Write-Host 'Installing GitHub CLI (gh)...'
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('Path', 'User')
  } else {
    throw 'Install GitHub CLI manually: https://cli.github.com/  then re-run this script.'
  }
}

function Ensure-GitHubAuth {
  Install-GhIfNeeded

  if ($GitHubToken) {
    Write-Host 'Logging in to GitHub with supplied token...'
    $GitHubToken | gh auth login --hostname $GitHubHost --with-token
  }

  gh auth status 2>&1 | Out-Host
  if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host 'Sign in with the mooreview GitHub account (NOT Windows user roy):' -ForegroundColor Yellow
    Write-Host '  gh auth login'
    Write-Host '  Choose: GitHub.com -> HTTPS -> Login with browser'
    Write-Host ''
    gh auth login --hostname $GitHubHost --git-protocol https --web
  }

  gh auth setup-git 2>&1 | Out-Host
  $status = gh auth status 2>&1 | Out-String
  if ($status -notmatch 'Logged in') {
    throw 'GitHub login failed. Create a PAT at https://github.com/settings/tokens (repo scope) and run: gh auth login --with-token'
  }
  Write-Host 'GitHub OK (mooreview account with repo access)' -ForegroundColor Green
}

function Ensure-CursavesGitRepo {
  $configDir = Join-Path $env:USERPROFILE '.config\cursaves'
  $configFile = Join-Path $configDir 'config.json'
  if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
  }
  @{ backend = 'git' } | ConvertTo-Json | Set-Content $configFile -Encoding UTF8

  $syncDir = Join-Path $env:USERPROFILE '.cursaves'
  if (-not (Test-Path (Join-Path $syncDir '.git'))) {
    Write-Host "Initializing $syncDir ..."
    cursaves init --remote $Remote
  } else {
    git -C $syncDir remote set-url origin $Remote
  }

  Write-Host "Testing git fetch (same as cursaves sync)..."
  $fetchErr = git -C $syncDir fetch --depth 1 origin 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host $fetchErr -ForegroundColor Red
    throw 'git fetch failed — check mooreview GitHub login (gh auth login).'
  }
  Write-Host 'git fetch OK' -ForegroundColor Green
}

Write-Step 'MV-workstation cursaves setup'
Write-Host "Computer: $env:COMPUTERNAME"
Write-Host "Windows user: $env:USERNAME (Cursor chats live under this profile)"
Write-Host "Project: $ProjectPath"
Write-Host "GitHub remote: $Remote"

if (-not (Test-Path $ProjectPath)) {
  throw "Missing $ProjectPath — copy data from home PC first (C:\data on this machine)."
}

Write-Step 'Install cursaves'
Install-CursavesIfNeeded

Write-Step 'GitHub login (mooreview — NOT Windows roy/yell)'
Ensure-GitHubAuth

Write-Step 'Configure cursaves git repo'
Ensure-CursavesGitRepo

if ($SkipSync) {
  Write-Host 'SkipSync set — done.' -ForegroundColor Yellow
  exit 0
}

Write-Step 'cursaves sync'
Push-Location $ProjectPath
try {
  $env:PYTHONIOENCODING = 'utf-8'
  cursaves sync
  if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw "cursaves sync exit $LASTEXITCODE" }
} finally {
  Pop-Location
}

Write-Host ''
Write-Host 'SUCCESS. Fully quit Cursor (File -> Exit), reopen, then open C:\data\est-pc.' -ForegroundColor Green
Write-Host 'Daily sync:  cd C:\data\est-pc ; cursaves sync' -ForegroundColor DarkGray
