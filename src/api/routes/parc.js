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
  const { tagStore, driverManager } = deps;
  const router = require('express').Router();
  const persistence = require('../../persistence');
  const { enrichParcDevicesWithDriverLink } = require('../../parc/parcDiscovery');

  function listParcDevicesEnriched() {
    const settings = persistence.readJson('settings.json', {});
    const drivers = typeof driverManager?.list === 'function' ? driverManager.list() : [];
    return enrichParcDevicesWithDriverLink(registry.listDevices(), drivers, {
      hubBrokerUrl: settings?.mqttParc?.brokerUrl || '',
    });
  }

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
      devices: listParcDevicesEnriched(),
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
      const result = await hub().sendCommand(req.params.id, op, body);
      res.json({ ok: true, body: result });
    } catch (e) {
      res.status(e.status || 502).json({ error: e.message || String(e) });
    }
  });

  /** Dragino RS485-NB → MQTT gateway commission plan for MooreVIEW Cloud. */
  router.post('/parc/dragino-gateway/plan', (req, res) => {
    try {
      const persistence = require('../../persistence');
      const { defaultMqttParcSettings } = require('../../parc/mqttParcBootstrap');
      const { buildDraginoGatewayPlan } = require('../../parc/draginoGatewayCommission');
      const settings = persistence.readJson('settings.json', {});
      const mqttParc = defaultMqttParcSettings(settings.mqttParc || {});
      const plan = buildDraginoGatewayPlan(req.body || {}, mqttParc);
      res.json({ ok: true, plan });
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  /** Bind a Modbus device template to a Dragino mqtt_parc gateway (Modbus Parc mapping). */
  router.post('/parc/dragino-gateway/bind-preset', async (req, res) => {
    try {
      const persistence = require('../../persistence');
      const { sanitizeDriverConfig } = require('../../drivers/driverConfig');
      const { defaultMqttParcSettings } = require('../../parc/mqttParcBootstrap');
      const { buildDraginoGatewayPlan } = require('../../parc/draginoGatewayCommission');
      const { modbusMapFromPreset } = require('../../parc/draginoModbusMap');
      const { patchWorkspaceDrivers } = require('../../project/estFile');

      const body = req.body || {};
      const deviceId = String(body.deviceId || '').trim();
      const presetId = String(body.presetId || '').trim();
      const driverId = String(body.driverId || deviceId).trim();
      if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
      if (!presetId) return res.status(400).json({ error: 'presetId required (modbus_rtu device template)' });

      const modbusMap = modbusMapFromPreset(presetId, {
        slaveId: body.slaveId,
        baud: body.baud,
        parity: body.parity,
        stopBits: body.stopBits,
      });

      const drivers = persistence.readJson('drivers.json', []);
      let row = drivers.find((d) => d.id === driverId);
      if (!row) {
        row = {
          id: driverId,
          type: 'mqtt_parc',
          enabled: true,
          deviceId,
          telemetryOnly: true,
          remoteExecution: false,
        };
        drivers.push(row);
      }
      row.type = 'mqtt_parc';
      row.enabled = body.enabled !== false;
      row.deviceId = deviceId;
      row.telemetryOnly = true;
      row.remoteExecution = false;
      row.draginoModbus = modbusMap;

      const sanitized = drivers.map(sanitizeDriverConfig);
      persistence.writeJson('drivers.json', sanitized);
      patchWorkspaceDrivers(sanitized);

      const settings = persistence.readJson('settings.json', {});
      const mqttParc = defaultMqttParcSettings(settings.mqttParc || {});
      const plan = buildDraginoGatewayPlan({
        ...body,
        deviceId,
        presetId,
      }, mqttParc);

      if (deps.driverManager) {
        deps.driverManager.save(sanitized);
        void deps.driverManager.rebuild().catch(() => {});
      }

      res.json({
        ok: true,
        deviceId,
        driverId,
        presetId,
        modbusMap: {
          presetId: modbusMap.presetId,
          tagCount: modbusMap.tags.length,
          tagIds: modbusMap.tags.map((t) => t.id),
          reads: modbusMap.reads,
        },
        plan,
      });
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  return router;
}

module.exports = { createParcRoutes };
