'use strict';

const { execSync } = require('child_process');
const { findTshark } = require('./lan-interface');

function npcapServiceRunning() {
  if (process.platform !== 'win32') return null;
  try {
    const out = execSync(
      'powershell -NoProfile -Command "(Get-Service -Name npcap -ErrorAction SilentlyContinue).Status"',
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
    return out === 'Running';
  } catch {
    return false;
  }
}

function capModuleAvailable() {
  try {
    require('cap');
    return true;
  } catch {
    return false;
  }
}

function captureReadiness() {
  const npcap = npcapServiceRunning();
  const cap = capModuleAvailable();
  const tshark = findTshark();
  const ready = cap || !!tshark;

  let message;
  if (ready && cap) {
    message = 'Ready (Npcap + Node cap module, promiscuous). Run capture as Administrator.';
  } else if (ready && tshark) {
    message = 'Ready (tshark/Wireshark, promiscuous). Run capture as Administrator.';
  } else if (npcap === true) {
    message = 'Npcap is installed, but no capture backend is available. Install Wireshark (easiest) or build the cap module (needs Visual Studio C++ Build Tools).';
  } else if (npcap === false) {
    message = 'Npcap service not running. Reinstall Npcap or reboot.';
  } else {
    message = 'Install Npcap (Windows) or libpcap, plus cap npm module or tshark.';
  }

  return {
    ready,
    npcap,
    capModule: cap,
    tshark: tshark ? tshark : null,
    message,
    hints: [
      npcap ? 'Npcap driver: OK' : 'Npcap driver: not detected',
      cap ? 'Node cap module: OK' : 'Node cap module: missing (native build failed or not installed)',
      tshark ? `tshark: ${tshark}` : 'tshark: not found — install Wireshark for easiest Windows capture',
    ],
  };
}

module.exports = { captureReadiness, npcapServiceRunning, capModuleAvailable };
