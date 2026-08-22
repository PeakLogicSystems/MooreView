# Flash FriendlyWRT image to SD card (PhysicalDrive1)
# Requires Administrator
$ErrorActionPreference = 'Stop'
$logFile = Join-Path $env:TEMP 'flash-sd-friendlywrt.log'
function Log($msg) { $line = "[$(Get-Date -Format 'HH:mm:ss')] $msg"; Add-Content -Path $logFile -Value $line; Write-Host $line }
Log 'Script started'

Add-Type @'
using System;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

public static class RawDisk
{
    [DllImport("Kernel32", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern SafeFileHandle CreateFileW(
        string lpFileName, uint dwDesiredAccess, uint dwShareMode,
        IntPtr lpSecurityAttributes, uint dwCreationDisposition,
        uint dwFlagsAndAttributes, IntPtr hTemplateFile);

    const uint GENERIC_READ = 0x80000000;
    const uint GENERIC_WRITE = 0x40000000;
    const uint OPEN_EXISTING = 3;
    const uint FILE_SHARE_READ = 1;
    const uint FILE_SHARE_WRITE = 2;

    public static FileStream OpenForWrite(string path)
    {
        var h = CreateFileW(path, GENERIC_READ | GENERIC_WRITE,
            FILE_SHARE_READ | FILE_SHARE_WRITE, IntPtr.Zero, OPEN_EXISTING, 0, IntPtr.Zero);
        if (h.IsInvalid)
            throw new IOException("CreateFile failed: " + Marshal.GetLastWin32Error());
        return new FileStream(h, FileAccess.ReadWrite, 65536, false);
    }
}
'@

try {
    $imgGz = 'C:\Users\recyc\Downloads\h3-sd-friendlywrt-4.14-armhf-20210512.img.gz'
    $img = 'C:\Users\recyc\Downloads\h3-sd-friendlywrt-4.14-armhf-20210512.img'
    $diskNumber = 1
    $physicalDrive = "\\.\PhysicalDrive$diskNumber"

    if (-not (Test-Path $imgGz)) { throw "Image not found: $imgGz" }

    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) { throw 'Run this script as Administrator.' }

    $disk = Get-Disk -Number $diskNumber -ErrorAction Stop
    Log "Target: PhysicalDrive$diskNumber ($($disk.FriendlyName), $([math]::Round($disk.Size/1GB,2)) GB)"

    if (-not (Test-Path $img)) {
        Log 'Decompressing image to .img (one-time, ~3.3 GB)...'
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $in = [System.IO.File]::OpenRead($imgGz)
        $gz = New-Object System.IO.Compression.GZipStream($in, [System.IO.Compression.CompressionMode]::Decompress)
        $out = [System.IO.File]::Create($img)
        try { $gz.CopyTo($out) } finally { $out.Close(); $gz.Close(); $in.Close() }
        $sw.Stop()
        Log ("Decompressed in {0:N1} min" -f $sw.Elapsed.TotalMinutes)
    } else {
        Log 'Using existing decompressed .img file'
    }

    $imgSize = (Get-Item $img).Length
    Log ("Image size: {0:N0} MB" -f ($imgSize/1MB))

    Get-Partition -DiskNumber $diskNumber -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.DriveLetter -and "$($_.DriveLetter)" -ne ' ') {
            Log "Removing drive letter $($_.DriveLetter):..."
            Remove-PartitionAccessPath -DiskNumber $diskNumber -PartitionNumber $_.PartitionNumber -AccessPath "$($_.DriveLetter):\" -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Seconds 3
    Update-Disk -Number $diskNumber
    Start-Sleep -Seconds 2

    Log 'Writing image to SD card...'
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $inputStream = [System.IO.File]::OpenRead($img)

    $outputStream = $null
    for ($attempt = 1; $attempt -le 5; $attempt++) {
        try {
            $outputStream = [RawDisk]::OpenForWrite($physicalDrive)
            break
        } catch {
            Log "Open attempt $attempt failed: $($_.Exception.Message)"
            Start-Sleep -Seconds 3
            Update-Disk -Number $diskNumber
        }
    }
    if (-not $outputStream) { throw "Could not open $physicalDrive after 5 attempts" }

    try {
        $buffer = New-Object byte[] (8MB)
        $total = 0L
        while (($read = $inputStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $outputStream.Write($buffer, 0, $read)
            $total += $read
            if ($total % (256MB) -lt $read) {
                Log ("  {0:N0} / {1:N0} MB ({2:N0}%)" -f ($total/1MB), ($imgSize/1MB), (100*$total/$imgSize))
            }
        }
        $outputStream.Flush()
    } finally {
        $outputStream.Close()
        $inputStream.Close()
    }

    $sw.Stop()
    Log ("Done. Wrote {0:N0} MB in {1:N1} minutes." -f ($total/1MB), ($sw.Elapsed.TotalMinutes))

    Update-Disk -Number $diskNumber
    Start-Sleep -Seconds 3
    Get-Partition -DiskNumber $diskNumber -ErrorAction SilentlyContinue |
        Format-Table PartitionNumber, DriveLetter, Size, Type |
        Out-String | ForEach-Object { Log $_.TrimEnd() }
} catch {
    Log "ERROR: $($_.Exception.Message)"
    exit 1
}
