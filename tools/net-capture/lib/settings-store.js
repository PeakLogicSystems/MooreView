'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.PROTO_SNIFF_DATA
  || path.join(__dirname, '..', 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

const DEFAULTS = {
  targetHost: '192.168.1.241',
  iface: 'auto',
  bpf: null,
  promiscuous: true,
  ringSize: 1000,
  plugins: [],
};

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadSettings() {
  ensureDir();
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(patch) {
  ensureDir();
  const next = { ...loadSettings(), ...patch };
  fs.writeFileSync(SETTINGS_FILE, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

module.exports = {
  DATA_DIR,
  SETTINGS_FILE,
  DEFAULTS,
  loadSettings,
  saveSettings,
};
