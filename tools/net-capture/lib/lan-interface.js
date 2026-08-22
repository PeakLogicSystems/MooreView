'use strict';

const os = require('os');
const { execSync } = require('child_process');

/** Pick the IPv4 interface on the same /24 as targetHost (default 192.168.1.x). */
function detectInterfaceForHost(targetHost) {
  const parts = String(targetHost).split('.').map(Number);
  const prefix = parts.length >= 3 ? `${parts[0]}.${parts[1]}.${parts[2]}` : '192.168.1';
  const nets = os.networkInterfaces();
  const matches = [];

  for (const [name, addrs] of Object.entries(nets)) {
    for (const net of addrs || []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      if (net.address.startsWith(`${prefix}.`)) {
        matches.push({ name, address: net.address, net });
      }
    }
  }

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const nonVm = matches.find((m) => !/vmware|virtual|vethernet|hyper-v|loopback/i.test(m.name));
    return nonVm || matches[0];
  }

  for (const [name, addrs] of Object.entries(nets)) {
    for (const net of addrs || []) {
      if (net.family === 'IPv4' && !net.internal && /^192\.168\./.test(net.address)) {
        return { name, address: net.address, net };
      }
    }
  }
  return null;
}

function listInterfaces() {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const net of addrs || []) {
      if (net.family === 'IPv4') {
        out.push({ name, address: net.address, internal: net.internal });
      }
    }
  }
  return out;
}

function findTshark() {
  const candidates = [
    process.env.TSHARK_PATH,
    'tshark',
    'C:\\Program Files\\Wireshark\\tshark.exe',
    'C:\\Program Files (x86)\\Wireshark\\tshark.exe',
  ].filter(Boolean);
  for (const exe of candidates) {
    try {
      execSync(`"${exe}" -v`, { stdio: 'pipe', timeout: 5000 });
      return exe;
    } catch {
      /* try next */
    }
  }
  return null;
}

function tsharkListInterfaces(tshark) {
  try {
    const raw = execSync(`"${tshark}" -D`, { encoding: 'utf8', timeout: 8000 });
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const m = line.match(/^(\d+)\.\s+(.+?)(?:\s+\((.+)\))?$/);
        return m ? { index: Number(m[1]), name: m[2], detail: m[3] || '' } : null;
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

module.exports = {
  detectInterfaceForHost,
  listInterfaces,
  findTshark,
  tsharkListInterfaces,
};
