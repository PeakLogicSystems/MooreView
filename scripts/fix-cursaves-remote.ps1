# Fix "Syncing with remote... failed" on MV-workstation (GitHub auth for private mooreview-cursaves repo).
param(
  [string]$Remote = 'https://github.com/mooreview/mooreview-cursaves.git'
)

$ErrorActionPreference = 'Continue'
$syncDir = Join-Path $env:USERPROFILE '.cursaves'

Write-Host '=== cursaves remote fix ===' -ForegroundColor Cyan
Write-Host ''
Write-Host 'This error is GITHUB login, not Windows user roy.' -ForegroundColor Yellow
Write-Host 'Repo: mooreview/mooreview-cursaves (private)' -ForegroundColor Yellow
Write-Host ''

if (-not (Test-Path (Join-Path $syncDir '.git'))) {
  Write-Host "No cursaves repo at $syncDir" -ForegroundColor Red
  Write-Host 'Run first: cursaves init --remote' $Remote
  exit 1
}

git -C $syncDir remote set-url origin $Remote
Write-Host "Remote:" (git -C $syncDir remote get-url origin)
Write-Host ''

# Install gh if missing
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host 'Installing GitHub CLI (gh)...' -ForegroundColor Yellow
  winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
}

Write-Host '--- GitHub status ---'
gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host 'Sign in to GitHub as the mooreview account:' -ForegroundColor Yellow
  Write-Host '  gh auth login'
  Write-Host 'Choose: GitHub.com -> HTTPS -> Login with browser (or paste token)'
  Write-Host ''
  gh auth login
}

Write-Host ''
Write-Host 'Wire git to gh credentials...'
gh auth setup-git 2>&1

Write-Host ''
Write-Host '--- Test git fetch (same step cursaves uses) ---'
$fetch = git -C $syncDir fetch --depth 1 origin 2>&1
$fetch | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host 'FETCH STILL FAILED.' -ForegroundColor Red
  Write-Host 'Use a GitHub PAT with repo scope for account mooreview:'
  Write-Host '  https://github.com/settings/tokens'
  Write-Host 'Then: gh auth login --with-token < token.txt'
  exit 1
}

Write-Host ''
Write-Host 'Fetch OK. Running cursaves sync...' -ForegroundColor Green
$bin = Join-Path $env:USERPROFILE '.local\bin'
if (Test-Path $bin) { $env:Path = "$bin;$env:Path" }
$env:PYTHONIOENCODING = 'utf-8'
Push-Location C:\data\est-pc
try {
  cursaves sync
} finally {
  Pop-Location
}

Write-Host ''
Write-Host 'If chats imported, fully quit and restart Cursor.' -ForegroundColor Green
