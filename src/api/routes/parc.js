'use strict';

const programStore = require('../../programs/programStore');
const mongoTagLogger = require('../../logger/mongoTagLogger');
const { registry } = require('../../parc/deviceRegistry');
const { getMqttCentralHub } = require('../../parc/mqttCentralHub');
const { buildOptaProgramBody } = require('../../parc/mqttOptaProgram');

function hub() {
  return getMqttCentralHub(registry);
}

function createParcRoutes(deps = {}) {
  const { tagStore } = deps;
  const router = require('express').Router();

  router.get('/parc/settings', (req, res) => {
    res.json({
      settings: registry.settings(),
      mqtt: hub().status(),
    });
  });

  router.put('/parc/settings', (req, res) => {
    const patch = req.body || {};
    res.json({ settings: registry.updateSettings(patch) });
  });

  router.get('/parc/devices', (req, res) => {
    res.json({
      devices: registry.listDevices(),
      settings: registry.settings(),
      mqtt: hub().status(),
    });
  });

  router.get('/parc/devices/:id', (req, res) => {
    const device = registry.getDevice(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json({ device });
  });

  router.get('/parc/devices/:id/reporter', (req, res) => {
    res.json(registry.reporterConfig(req.params.id));
  });

  /** Legacy HTTP ingest — prefer MQTT telemetry from edge runtime. */
  router.post('/parc/report', async (req, res) => {
    const body = req.body || {};
    mongoTagLogger.logEdgeFromReport(body).catch(() => {});
    const result = registry.ingestReport(body);
    if (!result.ok) return res.status(result.status || 400).json(result);
    res.json(result);
  });

  router.post('/parc/devices/:id/attach', (req, res) => {
    const body = req.body || {};
    const device = registry.attach(req.params.id, {
      host: body.host,
      port: body.port,
      sessionId: body.sessionId,
    });
    hub().publishDeviceConfig(req.params.id, { pauseTelemetry: true, debugAttached: true });
    res.json({
      ok: true,
      device,
      transport: 'mqtt',
      message: 'Debug attach: telemetry throttled; program device via POST /api/parc/devices/:id/cmd',
    });
  });

  router.post('/parc/devices/:id/detach', (req, res) => {
    const device = registry.detach(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    hub().publishDeviceConfig(req.params.id, { pauseTelemetry: false, debugAttached: false });
    res.json({ ok: true, device, transport: 'mqtt' });
  });

  /** Deploy ST program to MQTT Opta ST device (parses .st → AST). */
  router.post('/parc/devices/:id/program', async (req, res) => {
    if (!tagStore) return res.status(500).json({ error: 'tagStore required' });
    const source = req.body?.source ?? programStore.readActive();
    const driverId = req.body?.driverId || req.params.id;
    const built = buildOptaProgramBody(source, tagStore, driverId);
    if (!built.ok) return res.status(400).json({ ok: false, errors: built.errors });
    try {
      await hub().sendCommand(req.params.id, 'put_program', built.body);
      if (req.body?.start) await hub().sendCommand(req.params.id, 'runtime_start', { scanMs: req.body.scanMs || 100 });
      res.json({ ok: true, deployed: true });
    } catch (e) {
      res.status(e.status || 502).json({ error: e.message || String(e) });
    }
  });

  /** Ask Opta to rescan expansion modules and refresh tag table (MQTT cmd). */
  router.post('/parc/devices/:id/scan-expansions', async (req, res) => {
    try {
      const body = await hub().sendCommand(req.params.id, 'scan_expansions', {});
      res.json({ ok: true, body });
    } catch (e) {
      res.status(e.status || 502).json({ error: e.message || String(e) });
    }
  });

  /** Replace MooreVIEW tags for a driver from latest Parc telemetry. */
  router.post('/parc/devices/:id/sync-tags', async (req, res) => {
    if (!tagStore) return res.status(500).json({ error: 'tagStore required' });
    const driverId = req.body?.driverId;
    if (!driverId) return res.status(400).json({ error: 'driverId required' });
    const { mergeParcTagsIntoStore } = require('../../parc/parcTagSync');
    const { MAX_TAGS } = require('../../config');
    const dev = registry.getDevice(req.params.id);
    if (!dev) return res.status(404).json({ error: 'Device not found in Parc registry' });
    if (dev.stale) {
      return res.status(409).json({ error: `Telemetry stale (${dev.ageSec ?? '?'}s)` });
    }
    const merged = mergeParcTagsIntoStore(tagStore.list(), dev.tags, driverId);
    if (!merged.ok) return res.status(400).json({ error: merged.error });
    if (merged.tags.length > MAX_TAGS) {
      return res.status(413).json({ error: `Tag limit ${MAX_TAGS} exceeded` });
    }
    tagStore.replaceAll(merged.tags);
    res.json({
      ok: true,
      driverId,
      deviceId: req.params.id,
      tagsReplaced: merged.count,
      tagCount: tagStore.count(),
      expansionModules: dev.expansionModules || [],
    });
  });

  /** Remote programming / debug over MQTT (proxied to edge runtime). */
  router.post('/parc/devices/:id/cmd', async (req, res) => {
    const { op, body } = req.body || {};
    if (!op) return res.status(400).json({ error: 'op required' });
    try {
      if (op === 'opta_set_relay') {
        const relay = Number(body?.relay);
        if (!relay) return res.status(400).json({ error: 'body.relay required (1-based)' });
        hub().publishLegacyOptaRelay(relay, body?.state);
        return res.json({ ok: true, body: { relay, state: !!body?.state } });
      }
      const result = await hub().sendCommand(req.params.id, op, body);
      res.json({ ok: true, body: result });
    } catch (e) {
      res.status(e.status || 502).json({ error: e.message || String(e) });
    }
  });

  return router;
}

module.exports = { createParcRoutes };
