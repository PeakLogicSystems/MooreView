# One-time + daily Cursor chat sync on MV-workstation (or any second PC).
param(
  [string]$Remote = 'https://github.com/mooreview/mooreview-cursaves.git',
  [string]$ProjectPath = 'C:\data\est-pc',
  [switch]$PullOnly
)

$ErrorActionPreference = 'Stop'

function Install-UvIfNeeded {
  if (Get-Command uv -ErrorAction SilentlyContinue) { return }
  Write-Host 'Installing uv...'
  Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression
  $bin = Join-Path $env:USERPROFILE '.local\bin'
  if (Test-Path $bin) { $env:Path = "$bin;$env:Path" }
}

function Install-CursavesIfNeeded {
  Install-UvIfNeeded
  $bin = Join-Path $env:USERPROFILE '.local\bin'
  if (Test-Path $bin) { $env:Path = "$bin;$env:Path" }
  $ver = & cursaves --version 2>$null
  if ($ver -notmatch '0\.9\.[2-9]') {
    Write-Host 'Installing cursaves (Windows fork)...'
    uv tool install --force git+https://github.com/tibbinova/cursaves.git
    uv tool update-shell 2>$null | Out-Null
    $env:Path = "$bin;$env:Path"
  }
  & cursaves --version
}

Write-Host '=== MV-workstation cursaves setup ===' -ForegroundColor Cyan
Install-CursavesIfNeeded

$configDir = Join-Path $env:USERPROFILE '.config\cursaves'
$configFile = Join-Path $configDir 'config.json'
if (-not (Test-Path $configFile)) {
  New-Item -ItemType Directory -Path $configDir -Force | Out-Null
  @{ backend = 'git' } | ConvertTo-Json | Set-Content $configFile -Encoding UTF8
}

$syncDir = Join-Path $env:USERPROFILE '.cursaves'
if (-not (Test-Path (Join-Path $syncDir '.git'))) {
  Write-Host 'Initializing cursaves sync repo...'
  cursaves init --remote $Remote
} else {
  git -C $syncDir remote set-url origin $Remote
}

if (-not (Test-Path $ProjectPath)) {
  throw "Project not found: $ProjectPath - copy data folder first."
}

Write-Host 'Pulling chat snapshots from GitHub...'
Push-Location $ProjectPath
try {
  $env:PYTHONIOENCODING = 'utf-8'
  cursaves sync
} finally {
  Pop-Location
}

Write-Host ''
Write-Host 'Done. Fully quit and restart Cursor to see imported chats.' -ForegroundColor Green
if (-not $PullOnly) {
  Write-Host "Daily: cd $ProjectPath; cursaves sync" -ForegroundColor DarkGray
}
