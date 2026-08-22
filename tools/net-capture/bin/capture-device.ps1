# Capture traffic for an unknown LAN device (requires Admin + Npcap/Wireshark).
# Usage:
#   .\bin\capture-device.ps1 -Host 192.168.1.241 -Seconds 60
#   .\bin\capture-device.ps1 -Host 192.168.1.241 -Iface 8 -Probe

param(
  [string]$Host = '192.168.1.241',
  [int]$Seconds = 60,
  [int]$Iface = 8,
  [switch]$Probe
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root "capture-$($Host.Replace('.','-')).pcapng"
$tshark = 'C:\Program Files\Wireshark\tshark.exe'
if (-not (Test-Path $tshark)) { throw 'Install Wireshark (tshark) first.' }

Write-Host "Target: $Host"
Write-Host "Ping test..."
ping -n 2 $Host | Out-Host
arp -a | Select-String $Host | Out-Host

if ($Probe) {
  Write-Host "Probing common ports (80, 502, 1883, 8080)..."
  foreach ($port in 80, 502, 1883, 8080) {
    $tcp = New-Object Net.Sockets.TcpClient
    try {
      $iar = $tcp.BeginConnect($Host, $port, $null, $null)
      if ($iar.AsyncWaitHandle.WaitOne(500)) {
        $tcp.EndConnect($iar)
        Write-Host "  TCP $port OPEN"
      }
    } catch { } finally { $tcp.Close() }
  }
}

Write-Host "Capturing $Seconds s on interface $Iface -> $out"
Write-Host "BPF filter: host $Host"
& $tshark -i $Iface -f "host $Host" -a "duration:$Seconds" -w $out
$count = & $tshark -r $out -q -z io,stat,0 2>&1
Write-Host $count
Write-Host "Saved: $out"
Write-Host "Analyze: tshark -r `"$out`" -Y `"ip.addr==$Host`""
