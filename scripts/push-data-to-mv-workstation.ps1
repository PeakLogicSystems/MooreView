# Copy C:\Users\Public\data to MV-workstation over SMB and run cursaves sync on this PC first.
param(
  [string]$RemoteHost = '192.168.1.76',
  [string]$RemoteComputerName = 'MV-workstation',
  [string]$RemoteShare = 'workbox',
  [string]$LocalDataRoot = 'C:\Users\Public\data',
  [string]$RemoteDataRoot = 'C:\data',
  [string]$RemoteUser = 'roy',
  [switch]$Mirror,
  [switch]$SkipCursaves,
  [switch]$EstPcOnly
)

$ErrorActionPreference = 'Stop'

function Ensure-CursavesOnPath {
  $bin = Join-Path $env:USERPROFILE '.local\bin'
  if (Test-Path $bin) { $env:Path = "$bin;$env:Path" }
  if (-not (Get-Command cursaves -ErrorAction SilentlyContinue)) {
    throw "cursaves not found. Run: uv tool install --force git+https://github.com/tibbinova/cursaves.git"
  }
}

Write-Host "=== MooreVIEW: push to $RemoteComputerName ($RemoteHost) ===" -ForegroundColor Cyan

if (-not (Test-Connection -ComputerName $RemoteHost -Count 1 -Quiet)) {
  throw "Cannot reach $RemoteHost. Wake MV-workstation and confirm sharing."
}

if (-not $SkipCursaves) {
  Write-Host "`n[1/3] Pushing Cursor chats to GitHub (cursaves)..." -ForegroundColor Yellow
  Ensure-CursavesOnPath
  $estPc = Join-Path $LocalDataRoot 'est-pc'
  if (-not (Test-Path $estPc)) { throw "Missing $estPc" }
  Push-Location $estPc
  try {
    $env:PYTHONIOENCODING = 'utf-8'
    cursaves sync
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw "cursaves sync failed (exit $LASTEXITCODE)" }
  } finally {
    Pop-Location
  }
  Write-Host "  cursaves sync done." -ForegroundColor Green
} else {
  Write-Host "`n[1/3] Skipping cursaves (-SkipCursaves)" -ForegroundColor DarkYellow
}

Write-Host "`n[2/3] Connect to \\$RemoteHost\$RemoteShare ..." -ForegroundColor Yellow
$cred = Get-Credential -UserName $RemoteUser -Message "Password for $RemoteComputerName ($RemoteUser)"
$uncRoot = "\\$RemoteHost\$RemoteShare"
net use $uncRoot /user:$RemoteUser ($cred.GetNetworkCredential().Password) | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not connect to $uncRoot" }

$destSuffix = $RemoteDataRoot -replace '^[A-Z]:\\', ''
$destRoot = Join-Path $uncRoot $destSuffix
New-Item -ItemType Directory -Path $destRoot -Force | Out-Null

if ($EstPcOnly) {
  $sources = @(@{ Local = Join-Path $LocalDataRoot 'est-pc'; Remote = Join-Path $destRoot 'est-pc' })
} else {
  $sources = @(@{ Local = $LocalDataRoot; Remote = $destRoot })
}

Write-Host "`n[3/3] Robocopy (~16 GB, may take a while)..." -ForegroundColor Yellow
$roboFlags = @('/E', '/Z', '/R:2', '/W:5', '/MT:8', '/NP', '/NFL', '/NDL')
if ($Mirror) { $roboFlags = @('/MIR') + $roboFlags }
$excludeDirs = @('node_modules', '.git', 'dist', '.cursor', '__pycache__')
$excludeFiles = @('*.tgz', '*.zip', 'eth-elite-4g-router.bin')

foreach ($pair in $sources) {
  if (-not (Test-Path $pair.Local)) { throw "Missing source: $($pair.Local)" }
  New-Item -ItemType Directory -Path $pair.Remote -Force | Out-Null
  Write-Host "  $($pair.Local) -> $($pair.Remote)"
  $args = @($pair.Local, $pair.Remote) + $roboFlags
  foreach ($xd in $excludeDirs) { $args += '/XD'; $args += $xd }
  foreach ($xf in $excludeFiles) { $args += '/XF'; $args += $xf }
  & robocopy @args
  $code = $LASTEXITCODE
  if ($code -ge 8) { throw "Robocopy failed with exit code $code" }
  Write-Host "  Robocopy exit $code (0-7 = success with notes)" -ForegroundColor Green
}

net use $uncRoot /delete /y 2>$null | Out-Null

Write-Host "`n=== Copy complete ===" -ForegroundColor Cyan
Write-Host "On MV-workstation, run (PowerShell):"
Write-Host "  cd C:\data\est-pc\scripts"
Write-Host "  .\setup-mv-workstation-cursaves.ps1"
Write-Host ""
