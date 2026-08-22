# Deploy Opta HVAC demo + HMI repair to mooreview.io from any OneDrive-synced PC.
param(
  [string]$ConfigPath = '',
  [switch]$DryRun,
  [switch]$TestConnection
)

$ErrorActionPreference = 'Stop'
$ScriptRoot = Split-Path $PSScriptRoot -Parent
if (-not $ConfigPath) {
  $ConfigPath = Join-Path $ScriptRoot 'deploy\portable-saas.config.ps1'
}
if (-not (Test-Path $ConfigPath)) {
  $example = Join-Path $ScriptRoot 'deploy\portable-saas.config.example.ps1'
  if (Test-Path $example) {
    Copy-Item $example $ConfigPath
    Write-Host "Created config: $ConfigPath" -ForegroundColor Yellow
    Write-Host 'Edit if needed, then run this script again.' -ForegroundColor Yellow
    exit 0
  }
  throw "Missing config: $ConfigPath"
}

$cfg = . $ConfigPath
$Root = [string]$cfg.RepoRoot
if (-not $Root) { $Root = $ScriptRoot }
$Root = (Resolve-Path $Root).Path

$HostAlias = [string]$cfg.HostAlias
if (-not $HostAlias) { $HostAlias = 'mv-saas' }
$HostName = [string]$cfg.HostName
if (-not $HostName) { $HostName = '159.223.154.210' }
$SshUser = [string]$cfg.SshUser
if (-not $SshUser) { $SshUser = 'root' }
$Remote = [string]$cfg.RemoteRoot
if (-not $Remote) { $Remote = '/home/mooreview' }
$Timeout = [int]$cfg.ConnectTimeoutSec
if ($Timeout -lt 10) { $Timeout = 45 }
$AceTenantId = [string]$cfg.AceTenantId
if (-not $AceTenantId) { $AceTenantId = '219c5c35-8415-4409-a13c-9059d698c998' }
$ServiceName = [string]$cfg.ServiceName
if (-not $ServiceName) { $ServiceName = 'mooreview-saas' }

$Key = [string]$cfg.IdentityFile
if (-not $Key) { $Key = Join-Path $Root '.ssh\id_ed25519_mooreview' }
if (-not (Test-Path $Key)) {
  throw "SSH key not found: $Key`nCopy id_ed25519_mooreview into .ssh under this OneDrive repo."
}

$sshConfigDir = Join-Path $Root '.ssh'
$sshConfigFile = Join-Path $sshConfigDir 'portable-deploy.config'
$knownHosts = Join-Path $sshConfigDir 'known_hosts'
@(
  "Host $HostAlias",
  "  HostName $HostName",
  "  User $SshUser",
  "  IdentityFile $Key",
  '  IdentitiesOnly yes',
  '  ServerAliveInterval 30',
  '  ServerAliveCountMax 3'
) | Set-Content -Path $sshConfigFile -Encoding ascii

$sshBase = @('-F', $sshConfigFile, '-i', $Key, '-o', "ConnectTimeout=$Timeout")
if (Test-Path $knownHosts) { $sshBase += @('-o', "UserKnownHostsFile=$knownHosts") }

function Invoke-Remote([string]$Command) {
  if ($DryRun) {
    Write-Host "[dry-run] ssh $HostAlias $Command" -ForegroundColor DarkYellow
    return
  }
  & ssh @sshBase $HostAlias $Command
  if ($LASTEXITCODE -ne 0) { throw "remote command failed ($LASTEXITCODE)" }
}

function Invoke-Scp([string[]]$Sources, [string]$Dest) {
  if ($DryRun) {
    Write-Host "[dry-run] scp -> $Dest" -ForegroundColor DarkYellow
    $Sources | ForEach-Object { Write-Host "  $_" }
    return
  }
  & scp @sshBase @Sources "${HostAlias}:$Dest"
  if ($LASTEXITCODE -ne 0) { throw "scp failed ($LASTEXITCODE) -> $Dest" }
}

Write-Host "MooreVIEW portable HVAC deploy" -ForegroundColor Cyan
Write-Host "  Repo:   $Root"
Write-Host "  Target: ${SshUser}@${HostName}:${Remote}"
Write-Host "  Key:    $Key"

if ($TestConnection) {
  Invoke-Remote "echo ok && hostname && uptime"
  exit 0
}

if ($cfg.EnsureBundledProjects) {
  Write-Host 'Building bundled HVAC zips...' -ForegroundColor Cyan
  if (-not $DryRun) {
    Push-Location $Root
    try { & node scripts/ensure-bundled-projects.js | Out-Null }
    finally { Pop-Location }
  }
}

$mustExist = @(
  'src\hmi\hvacSplitScreen.js',
  'src\hmi\duplexlsScreen.js',
  'src\project\estFile.js',
  'data\projects\opta-split-hvac.est.zip',
  'data\projects\opta-double-split-hvac.est.zip',
  'data\projects\opta-split-hvac.est.json',
  'data\projects\opta-double-split-hvac.est.json',
  'st\logic\opta_split_hvac.st',
  'st\logic\opta_double_split_hvac.st',
  'public\hmi\svg\demos\opta-split-hvac',
  'public\hmi\svg\demos\opta-double-split-hvac',
  'public\samples\opta-split-hvac-ortho-3d.html',
  'public\samples\opta-double-split-hvac-ortho-3d.html',
  'public\samples\hvac-split-3d.js'
)
foreach ($rel in $mustExist) {
  $p = Join-Path $Root $rel
  if (-not (Test-Path $p)) { throw "Missing required file: $p" }
}

$zip1 = Join-Path $Root 'data\projects\opta-split-hvac.est.zip'
$zip2 = Join-Path $Root 'data\projects\opta-double-split-hvac.est.zip'
$json1 = Join-Path $Root 'data\projects\opta-split-hvac.est.json'
$json2 = Join-Path $Root 'data\projects\opta-double-split-hvac.est.json'

Write-Host "Upload repair code..." -ForegroundColor Cyan
Invoke-Scp @(
  (Join-Path $Root 'src\hmi\hvacSplitScreen.js'),
  (Join-Path $Root 'src\hmi\duplexlsScreen.js')
) "$Remote/src/hmi/"
Invoke-Scp @(Join-Path $Root 'src\project\estFile.js') "$Remote/src/project/estFile.js"
Invoke-Scp @($json1, $json2) "$Remote/data/projects/"
Invoke-Scp @($zip1, $zip2) "$Remote/data/projects/"
Invoke-Scp @($zip1, $zip2) "$Remote/data/boilerplate/projects/"
Invoke-Scp @(
  (Join-Path $Root 'st\logic\opta_split_hvac.st'),
  (Join-Path $Root 'st\logic\opta_double_split_hvac.st')
) "$Remote/st/logic/"
Invoke-Scp -Sources @(
  (Join-Path $Root 'public\hmi\svg\demos\opta-split-hvac'),
  (Join-Path $Root 'public\hmi\svg\demos\opta-double-split-hvac')
) -Dest "$Remote/public/hmi/svg/demos/"
Invoke-Scp @(
  (Join-Path $Root 'public\samples\opta-split-hvac-ortho-3d.html'),
  (Join-Path $Root 'public\samples\opta-double-split-hvac-ortho-3d.html'),
  (Join-Path $Root 'public\samples\hvac-split-3d.js')
) "$Remote/public/samples/"

$remote = @"
set -euo pipefail
cd '$Remote'
ACE='$AceTenantId'
cp -f data/projects/opta-split-hvac.est.zip data/tenants/\$ACE/projects/
cp -f data/projects/opta-double-split-hvac.est.zip data/tenants/\$ACE/projects/
cp -f data/projects/opta-split-hvac.est.zip data/boilerplate/projects/
cp -f data/projects/opta-double-split-hvac.est.zip data/boilerplate/projects/
chown -R mooreview:mooreview \
  src/hmi/hvacSplitScreen.js src/hmi/duplexlsScreen.js src/project/estFile.js \
  data/projects/opta-split-hvac.est.json data/projects/opta-double-split-hvac.est.json \
  data/projects/opta-split-hvac.est.zip data/projects/opta-double-split-hvac.est.zip \
  data/boilerplate/projects/opta-split-hvac.est.zip data/boilerplate/projects/opta-double-split-hvac.est.zip \
  data/tenants/\$ACE/projects/opta-split-hvac.est.zip data/tenants/\$ACE/projects/opta-double-split-hvac.est.zip \
  public/hmi/svg/demos/opta-split-hvac public/hmi/svg/demos/opta-double-split-hvac \
  public/samples/opta-split-hvac-ortho-3d.html public/samples/opta-double-split-hvac-ortho-3d.html public/samples/hvac-split-3d.js
grep -n ensureHvacSplitHmi src/project/estFile.js | head -1
"@

if ($cfg.ReseedTenants) {
  $remote += @"

sudo -u mooreview env HOME=/var/lib/mooreview MOOREVIEW_DEPLOYMENT=cloud bash -lc 'cd $Remote && node scripts/seed-tenant-projects.js'
ls -la data/tenants/$AceTenantId/projects/*hvac*.est.zip
"@
}

if ($cfg.RestartService) {
  $remote += @"

systemctl restart $ServiceName
sleep 2
systemctl is-active $ServiceName
curl -fsS http://127.0.0.1:3100/health | head -c 200 || true
echo
"@
}

Write-Host 'Apply on server...' -ForegroundColor Cyan
Invoke-Remote $remote

Write-Host 'Done. Hard-refresh https://mooreview.io and open opta-split-hvac.' -ForegroundColor Green
