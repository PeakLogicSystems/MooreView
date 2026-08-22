'use strict';

const path = require('path');
const express = require('express');
const { loadSettings, saveSettings } = require('./lib/settings-store');
const { CaptureSession } = require('./lib/capture-session');
const { captureReadiness } = require('./lib/capture-readiness');
const { listInterfaces, detectInterfaceForHost, findTshark, tsharkListInterfaces } = require('./lib/lan-interface');

const PORT = Number(process.env.PROTO_SNIFF_PORT) || 3210;
const ROOT = path.join(__dirname);
const session = new CaptureSession();

const app = express();
app.use(express.json());
app.use(express.static(path.join(ROOT, 'public')));

function isIpv4(s) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(String(s || '').trim());
}

app.get('/api/settings', (_req, res) => {
  res.json({ settings: loadSettings() });
});

app.put('/api/settings', (req, res) => {
  const body = req.body || {};
  const patch = {};
  if (body.targetHost != null) {
    const host = String(body.targetHost).trim();
    if (!isIpv4(host)) {
      return res.status(400).json({ error: 'targetHost must be a valid IPv4 address' });
    }
    patch.targetHost = host;
  }
  if (body.iface != null) patch.iface = String(body.iface);
  if (body.bpf != null) patch.bpf = body.bpf === '' ? null : String(body.bpf);
  if (body.promiscuous != null) patch.promiscuous = !!body.promiscuous;
  if (body.plugins != null && Array.isArray(body.plugins)) patch.plugins = body.plugins;
  const settings = saveSettings(patch);
  res.json({ settings });
});

app.get('/api/status', (_req, res) => {
  res.json({
    status: session.status(),
    settings: loadSettings(),
    capture: captureReadiness(),
  });
});

app.get('/api/interfaces', (_req, res) => {
  const ifaces = listInterfaces();
  const settings = loadSettings();
  const suggested = detectInterfaceForHost(settings.targetHost);
  const tshark = findTshark();
  res.json({
    interfaces: ifaces,
    suggested: suggested ? { name: suggested.name, address: suggested.address } : null,
    tshark: tshark ? { path: tshark, devices: tsharkListInterfaces(tshark) } : null,
  });
});

app.post('/api/capture/start', async (req, res) => {
  const settings = { ...loadSettings(), ...(req.body || {}) };
  if (!isIpv4(settings.targetHost)) {
    return res.status(400).json({ error: 'Set a valid target IPv4 address first' });
  }
  try {
    const status = await session.start({
      targetHost: settings.targetHost,
      iface: settings.iface,
      bpf: settings.bpf,
      plugins: settings.plugins,
      ringSize: settings.ringSize,
    });
    res.json({ ok: true, status });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e), status: session.status() });
  }
});

app.post('/api/capture/stop', (_req, res) => {
  res.json({ ok: true, status: session.stop() });
});

app.post('/api/capture/clear', (_req, res) => {
  try {
    res.json({ ok: true, status: session.clear() });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.get('/api/packets', (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const scheme = req.query.scheme || null;
  res.json(session.listPackets({ limit, offset, scheme }));
});

app.get('/api/flows', (_req, res) => {
  res.json(session.flows());
});

app.get('/api/proposal', (_req, res) => {
  res.json(session.getProposal());
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(ROOT, 'public', 'index.html'));
});

const HOST = process.env.PROTO_SNIFF_HOST || '127.0.0.1';

if (require.main === module) {
  const server = app.listen(PORT, HOST, () => {
    console.log(`proto-sniff UI  http://${HOST}:${PORT}`);
    console.log('Set target IP in the UI, then Start capture (requires Admin + Npcap on Windows).');
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the other server:`);
      console.error(`  npm run stop`);
      console.error(`  or: netstat -ano | findstr :${PORT}  then  taskkill /PID <pid> /F`);
      process.exit(1);
    }
    throw err;
  });
}

module.exports = app;
