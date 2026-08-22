'use strict';

const fs = require('fs');
const path = require('path');
const persistence = require('../../persistence');
const { ST_DIR } = require('../../config');
const { listPresets, buildFromPreset, getPreset } = require('../../devices/devicePresets');
const { nextSlaveId, offsetTagsForDriver, concubeApplyOptions } = require('../../devices/applyPresetUtils');
const { applyTagsOnlyPreset } = require('../../devices/applyDerivedPreset');
const { MAX_TAGS, DEFAULT_MQTT_PARC_BROKER } = require('../../config');
const { sanitizeDriverConfig } = require('../../drivers/driverConfig');
const { bootstrapMqttParc } = require('../../parc/mqttParcBootstrap');
const { patchWorkspaceDrivers } = require('../../project/estFile');
const { resolveCredentials, loginNextcentury } = require('../../drivers/nextcenturyAuth');
const { createPortalSession } = require('../../drivers/nextcenturyPortalSession');
const { discoverDevices, browseDeviceObjects } = require('../../drivers/bacnetDiscovery');
const { mergeBacnetTagsIntoStore } = require('../../drivers/bacnetTagSync');
const bacnetProfileStore = require('../../drivers/bacnetProfileStore');
const {
  normalizeProfile,
  profileFromBrowsePoints,
} = require('../../drivers/bacnetDeviceBuilder');
const {
  previewProfileApply,
  applyProfileToFleet,
  mergeApplyIntoStore,
} = require('../../drivers/bacnetApplyProfile');

function createDriverRoutes(deps) {
  const { tagStore, driverManager, scanEngine } = deps;
  const router = require('express').Router();

  router.get('/drivers', (req, res) => {
    res.json({ drivers: driverManager.list(), health: driverManager.health() });
  });

  router.put('/drivers', async (req, res) => {
    const drivers = [...(req.body.drivers || [])].map(sanitizeDriverConfig);
    const warnings = [];
    const rtuPorts = new Map();
    for (const d of drivers) {
      if (d.type === 'modbus_rtu' && d.enabled !== false && d.serialPort) {
        const port = String(d.serialPort).toUpperCase();
        if (rtuPorts.has(port)) {
          d.enabled = false;
          warnings.push(
            `Disabled duplicate driver "${d.id}" — ${port} is already used by "${rtuPorts.get(port)}"`
          );
        } else {
          rtuPorts.set(port, d.id);
        }
      }
      if (d.type === 'vgreen_epc' && d.enabled !== false && d.serialPort) {
        const port = String(d.serialPort).toUpperCase();
        if (rtuPorts.has(port)) {
          d.enabled = false;
          warnings.push(
            `Disabled duplicate driver "${d.id}" — ${port} is already used by "${rtuPorts.get(port)}"`
          );
        } else {
          rtuPorts.set(port, d.id);
        }
      }
    }
    driverManager.save(drivers);
    patchWorkspaceDrivers(drivers);
    const hasRemoteOpta = drivers.some(
      (d) => (d.type === 'opta_remote' || d.type === 'mqtt_parc') && d.enabled !== false
    );
    let boot;
    if (hasRemoteOpta) {
      boot = await bootstrapMqttParc({ drivers });
      if (boot.changed) {
        if (scanEngine) scanEngine.loadSettings();
      }
      if (boot.hub?.started) {
        console.log('[mqtt-parc] hub connected (driver save)');
      } else if (boot.hub?.error) {
        console.warn('[mqtt-parc] hub start:', boot.hub.error);
      }
    }
    void driverManager.rebuild()
      .then(async () => {
        if (hasRemoteOpta && boot?.hub?.started && typeof driverManager.linkMqttParcDriversIfHubLive === 'function') {
          await driverManager.linkMqttParcDriversIfHubLive();
        }
      })
      .catch((e) => {
        console.warn('[drivers] rebuild:', e.message || String(e));
      });
    res.json({ ok: true, warnings, health: driverManager.health() });
  });

  router.post('/drivers/test', async (req, res) => {
    try {
      const cfg = sanitizeDriverConfig(req.body);
      res.json({ result: await driverManager.testConnection(cfg) });
    } catch (e) {
      res.status(400).json({ error: e.message || String(e) });
    }
  });

  router.post('/drivers/connect', async (req, res) => {
    const id = req.body?.driverId;
    if (!id) return res.status(400).json({ error: 'driverId required' });
    try {
      const ok = await driverManager.connectDriver(id);
      if (!ok) {
        const row = driverManager.health().find((h) => h.id === id);
        return res.status(400).json({
          error: row?.message || 'Connection failed',
          health: driverManager.health(),
        });
      }
      res.json({ ok: true, health: driverManager.health() });
    } catch (e) {
      res.status(400).json({ error: e.message || String(e), health: driverManager.health() });
    }
  });

  router.post('/drivers/disconnect', async (req, res) => {
    const id = req.body?.driverId;
    if (!id) return res.status(400).json({ error: 'driverId required' });
    try {
      await driverManager.disconnectDriver(id);
      res.json({ ok: true, health: driverManager.health() });
    } catch (e) {
      res.status(400).json({ error: e.message || String(e), health: driverManager.health() });
    }
  });

  router.get('/devices/presets', (req, res) => {
    res.json({ presets: listPresets() });
  });

  router.post('/devices/apply', async (req, res) => {
    const replaceTags = req.body.replaceTags === true;
    const presetMeta = getPreset(req.body.presetId);
    if (!presetMeta) {
      return res.status(404).json({ error: `Unknown device preset: ${req.body.presetId}` });
    }
    const tagList = tagStore.list();
    const driverList = driverManager.list();
    const targetDriverId = req.body.driverId || presetMeta.driver({}).id;
    const buildOpts = {
      driverId: req.body.driverId,
      serialPort: req.body.serialPort,
      host: req.body.host,
      port: req.body.port != null ? +req.body.port : undefined,
      baud: req.body.baud != null ? +req.body.baud : undefined,
      slaveId: req.body.slaveId != null ? +req.body.slaveId : undefined,
      parity: req.body.parity,
      stopBits: req.body.stopBits != null ? +req.body.stopBits : undefined,
      brokerUrl: req.body.brokerUrl,
      serialNum: req.body.serialNum,
      clientId: req.body.clientId,
      username: req.body.username,
      password: req.body.password,
      deviceId: req.body.deviceId,
      topicPrefix: req.body.topicPrefix,
      nominalVoltage: req.body.nominalVoltage,
      undervoltV: req.body.undervoltV,
      overvoltV: req.body.overvoltV,
      lowPf: req.body.lowPf,
      freqMinHz: req.body.freqMinHz,
      freqMaxHz: req.body.freqMaxHz,
      vImbalancePct: req.body.vImbalancePct,
      loadedCurrentA: req.body.loadedCurrentA,
    };

    if (presetMeta.tagsOnly) {
      const result = applyTagsOnlyPreset({
        presetMeta,
        tagList,
        driverList,
        buildOpts,
        replaceTags,
        tagStore,
        persistence,
        loadProgram: req.body.loadProgram !== false,
      });
      if (result.error) {
        return res.status(result.status || 400).json({ error: result.error });
      }
      if (scanEngine) scanEngine.loadSettings();
      return res.json(result);
    }

    if (presetMeta.concube) {
      const cubeOpts = concubeApplyOptions(
        presetMeta,
        tagList,
        targetDriverId,
        replaceTags,
        req.body.paramGroups,
      );
      if (cubeOpts.error) {
        return res.status(400).json({ error: cubeOpts.error });
      }
      Object.assign(buildOpts, cubeOpts);
    }
    const built = buildFromPreset(req.body.presetId, buildOpts);
    const driverIdx = driverList.findIndex((d) => d.id === built.driver.id);
    const driverExists = driverIdx >= 0;
    const driverListOut = driverExists
      ? driverList.map((d, i) => (i === driverIdx ? built.driver : d))
      : [...driverList, built.driver];
    driverManager.save(driverListOut);

    const sharedBus = presetMeta.sharedBus !== false;
    let templateTags = presetMeta.tagsFromDevice ? [] : built.tags;
    let assignedSlave = built.driver.slaveId ?? 1;
    if (!replaceTags) {
      const fallback = req.body.slaveId != null ? +req.body.slaveId : (built.driver.slaveId ?? 1);
      assignedSlave = sharedBus
        ? nextSlaveId(driverList, tagList, built.driver, fallback)
        : fallback;
      templateTags = offsetTagsForDriver(built.tags, built.driver.id, tagList, assignedSlave);
    }

    let merged;
    if (driverExists && !replaceTags) {
      const existingIds = new Set(tagList.map((t) => t.id));
      const conflicts = templateTags.filter((t) => existingIds.has(t.id));
      if (conflicts.length) {
        return res.status(409).json({
          error: `Tag id already in use: ${conflicts.map((t) => t.id).join(', ')}`,
        });
      }
      merged = [...tagList, ...templateTags];
    } else {
      const stripped = tagList.filter((t) => t.driverId !== built.driver.id);
      merged = [...stripped, ...templateTags];
    }
    if (merged.length > MAX_TAGS) {
      return res.status(413).json({ error: `Tag limit ${MAX_TAGS} exceeded (${merged.length})` });
    }
    tagStore.replaceAll(merged);
    if (built.driver?.type === 'opta_remote' || built.driver?.type === 'mqtt_parc') {
      const settings = persistence.readJson('settings.json', {});
      settings.remoteExecution = true;
      persistence.writeJson('settings.json', settings);
    }
    const hasRemoteOpta = driverListOut.some(
      (d) => (d.type === 'mqtt_parc' || d.type === 'opta_remote') && d.enabled !== false,
    );
    let boot;
    if (hasRemoteOpta) {
      boot = await bootstrapMqttParc({ drivers: driverListOut });
      if (boot.changed && scanEngine) scanEngine.loadSettings();
    }
    void driverManager.rebuild()
      .then(async () => {
        if (hasRemoteOpta && boot?.hub?.started && typeof driverManager.linkMqttParcDriversIfHubLive === 'function') {
          await driverManager.linkMqttParcDriversIfHubLive();
        }
      })
      .catch((e) => {
        console.warn('[devices/apply] rebuild:', e.message || String(e));
      });
    if (scanEngine) scanEngine.loadSettings();

    let pdmSeed = null;
    if (req.body.seedPdm !== false) {
      const { seedPdmFromPreset } = require('../../pdm/pdmAssetSeedFromTemplate');
      const settings = persistence.readJson('settings.json', {});
      const deviceId = req.body.deviceId || built.driver.deviceId || presetMeta.defaults?.deviceId || '';
      const seedResult = seedPdmFromPreset(presetMeta, settings, {
        deviceId,
        siteId: req.body.siteId || deviceId,
        siteName: req.body.siteName || presetMeta.label,
        locationClass: req.body.locationClass,
        installDate: req.body.installDate,
        overwrite: req.body.replacePdmAssets === true,
      });
      if (seedResult.changed) {
        persistence.writeJson('settings.json', seedResult.settings);
        pdmSeed = {
          seeded: seedResult.seeded,
          skipped: seedResult.skipped,
          assets: seedResult.seeded.map((id) => ({
            assetId: id,
            installDate: seedResult.assetContext[id]?.installDate,
            serviceHistory: seedResult.assetContext[id]?.serviceHistory,
          })),
        };
      }
    }

    res.json({
      ok: true,
      preset: built.preset,
      driver: built.driver,
      tagsAdded: templateTags.length,
      tagCount: tagStore.count(),
      merged: driverExists && !replaceTags,
      slaveId: assignedSlave,
      tagsFromDevice: !!presetMeta.tagsFromDevice,
      pdmSeed,
      nextStep: presetMeta.tagsFromDevice
        ? 'On Opta /setup → Scan expansions, then Drivers → Sync tags from Parc device'
        : undefined,
    });
  });

  router.get('/drivers/nextcentury/example', (req, res) => {
    const fp = path.join(ST_DIR, 'fixtures', 'nextcentury.setup.example.json');
    if (!fs.existsSync(fp)) {
      return res.status(404).json({ error: 'NextCentury example setup not found' });
    }
    try {
      const example = JSON.parse(fs.readFileSync(fp, 'utf8'));
      res.json(example);
    } catch (e) {
      res.status(500).json({ error: e.message || 'Failed to read example setup' });
    }
  });

  router.post('/drivers/nextcentury/portal-session', async (req, res) => {
    const body = req.body || {};
    const driverId = String(body.driverId || '').trim();
    let cfg = null;
    if (driverId) {
      cfg = driverManager.list().find((d) => d.id === driverId && d.type === 'nextcentury');
      if (!cfg) {
        return res.status(404).json({ error: `NextCentury driver not found: ${driverId}` });
      }
    } else {
      cfg = sanitizeDriverConfig({
        type: 'nextcentury',
        email: body.email,
        password: body.password,
      });
    }
    try {
      const auth = await loginNextcentury(
        resolveCredentials(cfg),
        cfg.timeoutMs || 15000,
      );
      const session = createPortalSession({
        token: auth.token,
        email: auth.email,
        driverId: driverId || cfg.id || '',
      });
      res.json({
        ok: true,
        sessionId: session.sessionId,
        email: auth.email,
        driverId: driverId || cfg.id || '',
        framePath: `/nextcentury-portal/frame/${session.sessionId}`,
        portalPath: `/nextcentury-portal/${session.sessionId}`,
        expiresAt: session.expiresAt,
        note: 'API JWT handoff — portal may still prompt for login if the web app does not accept token URLs.',
      });
    } catch (e) {
      res.status(400).json({ error: e.message || String(e) });
    }
  });

  router.post('/drivers/nextcentury/load-example-tags', async (req, res) => {
    const driverId = String(req.body?.driverId || 'nextcentury1').trim();
    if (!driverId) return res.status(400).json({ error: 'driverId required' });
    const fp = path.join(ST_DIR, 'fixtures', 'tags.nextcentury.json');
    if (!fs.existsSync(fp)) {
      return res.status(404).json({ error: 'tags.nextcentury.json fixture not found' });
    }
    let fixtureTags;
    try {
      fixtureTags = JSON.parse(fs.readFileSync(fp, 'utf8'));
    } catch (e) {
      return res.status(500).json({ error: e.message || 'Failed to read tags fixture' });
    }
    if (!Array.isArray(fixtureTags)) {
      return res.status(500).json({ error: 'Invalid tags fixture' });
    }
    const merge = req.body?.merge !== false;
    const remapped = fixtureTags.map((t) => ({ ...t, driverId }));
    const tagList = tagStore.list();
    let merged;
    if (merge) {
      const stripped = tagList.filter((t) => t.driverId !== driverId);
      const existingIds = new Set(stripped.map((t) => t.id));
      const conflicts = remapped.filter((t) => existingIds.has(t.id));
      if (conflicts.length) {
        return res.status(409).json({
          error: `Tag id already in use: ${conflicts.map((t) => t.id).join(', ')}`,
        });
      }
      merged = [...stripped, ...remapped];
    } else {
      merged = [...tagList.filter((t) => t.driverId !== driverId), ...remapped];
    }
    if (merged.length > MAX_TAGS) {
      return res.status(413).json({ error: `Tag limit ${MAX_TAGS} exceeded (${merged.length})` });
    }
    tagStore.replaceAll(merged);
    await driverManager.rebuild();
    if (scanEngine) scanEngine.loadSettings();
    res.json({
      ok: true,
      driverId,
      tagsAdded: remapped.length,
      tagCount: tagStore.count(),
      merged,
    });
  });

  router.post('/drivers/parc-opta/bulk', async (req, res) => {
    const body = req.body || {};
    const { registry } = require('../../parc/deviceRegistry');
    const { mergeParcTagsIntoStore } = require('../../parc/parcTagSync');
    const { bulkAddParcOptaDrivers } = require('../../devices/bulkAddParcOpta');
    const hardwareHistoryStore = require('../../hardware/hardwareHistoryStore');

    let result;
    try {
      result = bulkAddParcOptaDrivers({
        driverList: driverManager.list(),
        body,
        registry,
      });
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }

    if (!result.added.length) {
      return res.json({
        ok: true,
        added: [],
        addedEntries: [],
        skipped: result.skipped,
        registryFiltered: result.registryFiltered || [],
        syncResults: [],
        drivers: driverManager.list(),
      });
    }

    const drivers = result.drivers.map(sanitizeDriverConfig);
    driverManager.save(drivers);
    patchWorkspaceDrivers(drivers);

    const boot = await bootstrapMqttParc({ drivers });
    if (boot.changed && scanEngine) scanEngine.loadSettings();

    await driverManager.rebuild();
    if (scanEngine) scanEngine.loadSettings();

    const syncResults = [];
    if (body.syncTags !== false) {
      let tagList = tagStore.list();
      for (const entry of result.addedEntries || []) {
        const positionId = entry.positionId || entry;
        const dev = registry.getDevice(entry.deviceId || entry);
        if (!dev) {
          syncResults.push({ driverId: positionId, ok: false, error: 'no telemetry' });
          continue;
        }
        if (dev.stale) {
          syncResults.push({ driverId: positionId, ok: false, error: `stale (${dev.ageSec}s)` });
          continue;
        }
        const merged = mergeParcTagsIntoStore(tagList, dev.tags, positionId, { reassign: true });
        if (!merged.ok) {
          syncResults.push({ driverId: positionId, ok: false, error: merged.error });
          continue;
        }
        if (merged.tags.length > MAX_TAGS) {
          syncResults.push({ driverId: positionId, ok: false, error: `tag limit ${MAX_TAGS}` });
          continue;
        }
        tagList = merged.tags;
        syncResults.push({ driverId: positionId, ok: true, tagsReplaced: merged.count });
      }
      if (syncResults.some((s) => s.ok)) {
        tagStore.replaceAll(tagList);
        await driverManager.rebuild();
        if (scanEngine) scanEngine.loadSettings();
      }
    }

    for (const entry of result.addedEntries || []) {
      const positionId = entry.positionId;
      const dev = registry.getDevice(entry.deviceId);
      const drv = drivers.find((d) => d.id === positionId);
      if (!positionId || !dev || !drv) continue;
      try {
        const current = await hardwareHistoryStore.getCurrentAssignment(positionId);
        if (!current) {
          await hardwareHistoryStore.recordCommission({
            positionId,
            positionName: drv.name,
            registryDev: dev,
            driver: drv,
            note: 'commissioned via bulk add',
          });
        }
      } catch (e) {
        console.warn('[hardware-history] commission:', e.message || e);
      }
    }

    res.json({
      ok: true,
      added: result.added,
      addedEntries: result.addedEntries || [],
      skipped: result.skipped,
      registryFiltered: result.registryFiltered || [],
      syncResults,
      drivers: driverManager.list(),
    });
  });

  router.post('/drivers/parc-opta/replace-hardware', async (req, res) => {
    const positionId = String(req.body?.driverId || req.body?.positionId || '').trim();
    const newDeviceId = String(req.body?.newDeviceId || '').trim();
    if (!positionId) return res.status(400).json({ error: 'driverId (position) required' });
    if (!newDeviceId) return res.status(400).json({ error: 'newDeviceId required' });

    const { registry } = require('../../parc/deviceRegistry');
    const { mergeParcTagsIntoStore } = require('../../parc/parcTagSync');
    const { replaceParcOptaHardware } = require('../../devices/bulkAddParcOpta');
    const hardwareHistoryStore = require('../../hardware/hardwareHistoryStore');
    const mongoSysLog = require('../../logger/mongoSysLog');

    const cfg = driverManager.list().find((d) => d.id === positionId);
    const outgoingRegistryDev = cfg ? registry.getDevice(String(cfg.deviceId || '').trim()) : null;

    let replaced;
    try {
      replaced = replaceParcOptaHardware({
        driverList: driverManager.list(),
        positionId,
        newDeviceId,
        registry,
        note: req.body?.note,
        swapType: req.body?.swapType,
        vendor: req.body?.vendor,
        model: req.body?.model,
      });
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }

    const drivers = replaced.drivers.map(sanitizeDriverConfig);
    driverManager.save(drivers);
    patchWorkspaceDrivers(drivers);
    await driverManager.rebuild();

    let syncResult = null;
    if (req.body?.syncTags !== false) {
      const dev = registry.getDevice(replaced.newDeviceId);
      if (dev && !dev.stale) {
        const merged = mergeParcTagsIntoStore(tagStore.list(), dev.tags, positionId, {
          reassign: req.body?.reassign !== false,
        });
        if (merged.ok && merged.tags.length <= MAX_TAGS) {
          tagStore.replaceAll(merged.tags);
          await driverManager.rebuild();
          syncResult = { ok: true, tagsReplaced: merged.count, reassigned: merged.reassigned || 0 };
        } else if (!merged.ok) {
          syncResult = { ok: false, error: merged.error };
        } else {
          syncResult = { ok: false, error: `Tag limit ${MAX_TAGS} exceeded` };
        }
      } else {
        syncResult = { ok: false, error: dev ? `stale (${dev.ageSec}s)` : 'no telemetry' };
      }
    }

    if (scanEngine) scanEngine.loadSettings();
    const { getMqttCentralHub } = require('../../parc/mqttCentralHub');
    if (getMqttCentralHub(registry).isLive()) {
      await driverManager.linkMqttParcDriversIfHubLive();
    }

    const newCfg = drivers.find((d) => d.id === positionId);
    let historyRecord = null;
    try {
      historyRecord = await hardwareHistoryStore.recordHardwareSwap({
        positionId,
        positionName: newCfg?.name,
        outgoingDriver: cfg,
        outgoingRegistryDev,
        incomingRegistryDev: registry.getDevice(replaced.newDeviceId),
        incomingDriver: newCfg,
        swapType: req.body?.swapType,
        note: req.body?.note,
        vendor: req.body?.vendor,
        model: req.body?.model,
      });
      mongoSysLog.maintenance('hardware', 'Hardware replaced at position', {
        positionId,
        previousDeviceId: replaced.previousDeviceId,
        newDeviceId: replaced.newDeviceId,
        swapType: historyRecord?.swapType,
      }, { user: req.mooreviewUser || undefined });
    } catch (e) {
      console.warn('[hardware-history] swap:', e.message || e);
      mongoSysLog.error('hardware', 'Hardware swap record failed', { message: e.message, positionId });
    }

    res.json({
      ok: true,
      positionId: replaced.positionId,
      previousDeviceId: replaced.previousDeviceId,
      newDeviceId: replaced.newDeviceId,
      syncResult,
      historyRecord,
      drivers: driverManager.list(),
      health: driverManager.health(),
    });
  });

  router.post('/drivers/parc-opta/rename-position', async (req, res) => {
    const oldPositionId = String(req.body?.driverId || req.body?.oldPositionId || '').trim();
    const newPositionId = String(req.body?.newPositionId || '').trim();
    if (!oldPositionId || !newPositionId) {
      return res.status(400).json({ error: 'driverId and newPositionId required' });
    }

    const { renameParcOptaPosition } = require('../../devices/bulkAddParcOpta');
    let renamed;
    try {
      renamed = renameParcOptaPosition({
        driverList: driverManager.list(),
        tagList: tagStore.list(),
        oldPositionId,
        newPositionId,
      });
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }

    const drivers = renamed.drivers.map(sanitizeDriverConfig);
    driverManager.save(drivers);
    patchWorkspaceDrivers(drivers);
    tagStore.replaceAll(renamed.tags);
    await driverManager.rebuild();
    if (scanEngine) scanEngine.loadSettings();

    res.json({
      ok: true,
      oldPositionId: renamed.oldPositionId,
      newPositionId: renamed.newPositionId,
      drivers: driverManager.list(),
    });
  });

  router.post('/drivers/sync-parc-tags', async (req, res) => {
    const driverId = req.body?.driverId;
    if (!driverId) return res.status(400).json({ error: 'driverId required' });
    const cfg = driverManager.list().find((d) => d.id === driverId);
    if (!cfg || cfg.type !== 'mqtt_parc') {
      return res.status(400).json({ error: 'mqtt_parc driver required' });
    }
    const deviceId = String(cfg.deviceId || cfg.id || '').trim();
    const { registry } = require('../../parc/deviceRegistry');
    const { mergeParcTagsIntoStore } = require('../../parc/parcTagSync');
    const dev = registry.getDevice(deviceId);
    if (!dev) {
      return res.status(404).json({
        error: `No Parc report for ${deviceId} — connect Opta to MQTT and scan expansions on /setup`,
      });
    }
    if (dev.stale) {
      return res.status(409).json({
        error: `Telemetry stale for ${deviceId} (last ${dev.ageSec ?? '?'}s ago)`,
      });
    }
    const merged = mergeParcTagsIntoStore(tagStore.list(), dev.tags, driverId, {
      reassign: req.body?.reassign !== false,
    });
    if (!merged.ok) return res.status(400).json({ error: merged.error, conflicts: merged.conflicts });
    if (merged.tags.length > MAX_TAGS) {
      return res.status(413).json({ error: `Tag limit ${MAX_TAGS} exceeded (${merged.tags.length})` });
    }
    tagStore.replaceAll(merged.tags);
    await driverManager.rebuild();
    if (scanEngine) scanEngine.loadSettings();
    res.json({
      ok: true,
      driverId,
      deviceId,
      tagsReplaced: merged.count,
      reassigned: merged.reassigned || 0,
      tagCount: tagStore.count(),
      expansionModules: dev.meta?.expansionModules || [],
    });
  });

  router.post('/drivers/bacnet/discover', async (req, res) => {
    try {
      const driverCfg = req.body?.driverId
        ? driverManager.list().find((d) => d.id === req.body.driverId)
        : null;
      const cfg = { ...(driverCfg || {}), ...(req.body || {}) };
      const result = await discoverDevices(cfg);
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(400).json({ error: e.message || String(e) });
    }
  });

  router.post('/drivers/bacnet/browse', async (req, res) => {
    try {
      const driverCfg = req.body?.driverId
        ? driverManager.list().find((d) => d.id === req.body.driverId)
        : null;
      const cfg = { ...(driverCfg || {}), ...(req.body || {}) };
      const result = await browseDeviceObjects(cfg);
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(400).json({ error: e.message || String(e) });
    }
  });

  router.post('/drivers/bacnet/import-tags', async (req, res) => {
    const driverId = req.body?.driverId;
    const points = req.body?.points;
    if (!driverId) return res.status(400).json({ error: 'driverId required' });
    const cfg = driverManager.list().find((d) => d.id === driverId);
    if (!cfg || cfg.type !== 'bacnet') {
      return res.status(400).json({ error: 'bacnet driver required' });
    }
    const merged = mergeBacnetTagsIntoStore(tagStore.list(), points, driverId, {
      reassign: req.body?.reassign !== false,
      role: req.body?.role || 'input',
    });
    if (!merged.ok) {
      return res.status(400).json({ error: merged.error, conflicts: merged.conflicts });
    }
    if (merged.tags.length > MAX_TAGS) {
      return res.status(413).json({ error: `Tag limit ${MAX_TAGS} exceeded (${merged.tags.length})` });
    }
    tagStore.replaceAll(merged.tags);
    await driverManager.rebuild();
    if (scanEngine) scanEngine.loadSettings();
    res.json({
      ok: true,
      driverId,
      added: merged.added,
      updated: merged.updated,
      tagCount: tagStore.count(),
    });
  });

  router.get('/drivers/bacnet/profiles', (req, res) => {
    res.json({ ok: true, profiles: bacnetProfileStore.listProfiles() });
  });

  router.put('/drivers/bacnet/profiles', (req, res) => {
    try {
      const raw = req.body?.profiles;
      if (!Array.isArray(raw)) {
        return res.status(400).json({ error: 'profiles array required' });
      }
      const profiles = raw.map((p) => normalizeProfile(p));
      bacnetProfileStore.saveProfiles(profiles);
      res.json({ ok: true, count: profiles.length, profiles });
    } catch (e) {
      res.status(400).json({ error: e.message || String(e) });
    }
  });

  router.post('/drivers/bacnet/profiles/save', (req, res) => {
    try {
      const profile = normalizeProfile(req.body?.profile || req.body);
      const saved = bacnetProfileStore.upsertProfile(profile);
      res.json({ ok: true, profile: saved });
    } catch (e) {
      res.status(400).json({ error: e.message || String(e) });
    }
  });

  router.delete('/drivers/bacnet/profiles/:id', (req, res) => {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'profile id required' });
    const result = bacnetProfileStore.deleteProfile(id);
    res.json({ ok: true, ...result });
  });

  router.post('/drivers/bacnet/profiles/from-browse', (req, res) => {
    try {
      const profile = profileFromBrowsePoints({
        id: req.body?.id,
        label: req.body?.label,
        description: req.body?.description,
        tagPrefixPattern: req.body?.tagPrefixPattern,
        deviceNamePattern: req.body?.deviceNamePattern,
        points: req.body?.points,
        selectedSlotIds: req.body?.selectedSlotIds,
      });
      if (req.body?.save !== false) {
        bacnetProfileStore.upsertProfile(profile);
      }
      res.json({ ok: true, profile });
    } catch (e) {
      res.status(400).json({ error: e.message || String(e) });
    }
  });

  router.post('/drivers/bacnet/profiles/preview', async (req, res) => {
    try {
      const driverId = req.body?.driverId;
      if (!driverId) return res.status(400).json({ error: 'driverId required' });
      const driverCfg = driverManager.list().find((d) => d.id === driverId);
      if (!driverCfg || driverCfg.type !== 'bacnet') {
        return res.status(400).json({ error: 'bacnet driver required' });
      }
      const cfg = { ...driverCfg, ...(req.body || {}) };
      const result = await previewProfileApply(cfg, {
        driverId,
        profileId: req.body?.profileId,
        mode: req.body?.mode,
        devices: req.body?.devices,
        discover: req.body?.discover,
        maxObjects: req.body?.maxObjects,
      });
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message || String(e) });
    }
  });

  router.post('/drivers/bacnet/profiles/apply', async (req, res) => {
    const driverId = req.body?.driverId;
    if (!driverId) return res.status(400).json({ error: 'driverId required' });
    const driverCfg = driverManager.list().find((d) => d.id === driverId);
    if (!driverCfg || driverCfg.type !== 'bacnet') {
      return res.status(400).json({ error: 'bacnet driver required' });
    }
    try {
      const cfg = { ...driverCfg, ...(req.body || {}) };
      const built = await applyProfileToFleet(cfg, {
        driverId,
        profileId: req.body?.profileId,
        mode: req.body?.mode || 'discover',
        devices: req.body?.devices,
        discover: req.body?.discover,
        maxObjects: req.body?.maxObjects,
        allowPartial: req.body?.allowPartial !== false,
        reassign: req.body?.reassign === true,
      });
      if (!built.ok) {
        return res.status(400).json(built);
      }
      if (req.body?.importTags === false) {
        return res.json({ ok: true, ...built, imported: false });
      }
      const merged = mergeApplyIntoStore(tagStore, built, req.body || {});
      if (!merged.ok) {
        return res.status(400).json({ error: merged.error, conflicts: merged.conflicts });
      }
      if (merged.tags.length > MAX_TAGS) {
        return res.status(413).json({ error: `Tag limit ${MAX_TAGS} exceeded (${merged.tags.length})` });
      }
      tagStore.replaceAll(merged.tags);
      await driverManager.rebuild();
      if (scanEngine) scanEngine.loadSettings();
      res.json({
        ok: true,
        driverId,
        profileId: built.profileId,
        matchedDevices: built.matchedDevices,
        added: merged.added,
        updated: merged.updated,
        tagCount: tagStore.count(),
        devices: built.devices,
        browseErrors: built.browseErrors,
        imported: true,
      });
    } catch (e) {
      res.status(400).json({ error: e.message || String(e) });
    }
  });

  router.get('/drivers/bacnet/profiles/example', (req, res) => {
    const fp = path.join(ST_DIR, 'fixtures', 'bacnet-profiles.example.json');
    if (!fs.existsSync(fp)) {
      return res.status(404).json({ error: 'bacnet-profiles.example.json not found' });
    }
    try {
      const profiles = JSON.parse(fs.readFileSync(fp, 'utf8'));
      res.json({ ok: true, profiles });
    } catch (e) {
      res.status(500).json({ error: e.message || 'Failed to read example profiles' });
    }
  });

  router.post('/drivers/bacnet/load-example-tags', async (req, res) => {
    const driverId = String(req.body?.driverId || 'bacnet1').trim();
    if (!driverId) return res.status(400).json({ error: 'driverId required' });
    const fp = path.join(ST_DIR, 'fixtures', 'tags.bacnet.json');
    if (!fs.existsSync(fp)) {
      return res.status(404).json({ error: 'tags.bacnet.json fixture not found' });
    }
    let fixtureTags;
    try {
      fixtureTags = JSON.parse(fs.readFileSync(fp, 'utf8'));
    } catch (e) {
      return res.status(500).json({ error: e.message || 'Failed to read tags fixture' });
    }
    if (!Array.isArray(fixtureTags)) {
      return res.status(500).json({ error: 'Invalid tags fixture' });
    }
    const remapped = fixtureTags.map((t) => ({ ...t, driverId }));
    const tagList = tagStore.list();
    const stripped = tagList.filter((t) => t.driverId !== driverId);
    const existingIds = new Set(stripped.map((t) => t.id));
    const conflicts = remapped.filter((t) => existingIds.has(t.id));
    if (conflicts.length) {
      return res.status(409).json({
        error: `Tag id already in use: ${conflicts.map((t) => t.id).join(', ')}`,
      });
    }
    const merged = [...stripped, ...remapped];
    if (merged.length > MAX_TAGS) {
      return res.status(413).json({ error: `Tag limit ${MAX_TAGS} exceeded (${merged.length})` });
    }
    tagStore.replaceAll(merged);
    await driverManager.rebuild();
    if (scanEngine) scanEngine.loadSettings();
    res.json({
      ok: true,
      driverId,
      tagsAdded: remapped.length,
      tagCount: tagStore.count(),
    });
  });

  return router;
}

module.exports = { createDriverRoutes };
