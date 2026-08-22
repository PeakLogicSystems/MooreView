'use strict';

const persistence = require('../persistence');
const { registry } = require('./deviceRegistry');
const { getMqttCentralHub } = require('./mqttCentralHub');

const RECOVERY_DEBOUNCE_MS = 30000;
const _lastRecovery = new Map();
let _deps = {};

function registerParcRecoveryDeps(deps = {}) {
  if (deps.scanEngine) _deps.scanEngine = deps.scanEngine;
  if (deps.driverManager) _deps.driverManager = deps.driverManager;
}

function findRemoteDriver(deviceId, driverManager) {
  const id = String(deviceId || '').trim();
  if (!driverManager?.configs) return null;
  for (const cfg of driverManager.configs) {
    if (cfg.enabled === false) continue;
    if (cfg.type !== 'mqtt_parc' && cfg.type !== 'opta_remote') continue;
    const cfgId = String(cfg.deviceId || cfg.id || '').trim();
    if (cfgId === id) return driverManager.instances?.get(cfg.id) || null;
  }
  for (const cfg of driverManager.configs) {
    if (cfg.enabled === false) continue;
    if (cfg.type !== 'mqtt_parc' && cfg.type !== 'opta_remote') continue;
    return driverManager.instances?.get(cfg.id) || null;
  }
  return null;
}

async function maybeRecoverParcDevice(deviceId, opts = {}) {
  const id = String(deviceId || '').trim();
  if (!id) return { skipped: true, reason: 'no deviceId' };

  const now = Date.now();
  const last = _lastRecovery.get(id) || 0;
  if (!opts.force && now - last < RECOVERY_DEBOUNCE_MS) {
    return { skipped: true, reason: 'debounced' };
  }
  _lastRecovery.set(id, now);

  const settings = opts.settings || persistence.readJson('settings.json', {});
  if (settings.remoteExecution !== true) {
    return { skipped: true, reason: 'remoteExecution off' };
  }

  const scanEngine = opts.scanEngine || _deps.scanEngine;
  if (!scanEngine?.running || !scanEngine?.ast?.remote) {
    return { skipped: true, reason: 'scan engine not running remote' };
  }

  const driverManager = opts.driverManager || _deps.driverManager;
  const drv = findRemoteDriver(id, driverManager);
  if (!drv) return { skipped: true, reason: 'no driver' };

  const hub = opts.hub || getMqttCentralHub(registry);
  if (!hub.isLive()) return { skipped: true, reason: 'hub not connected' };

  const reg = opts.registry || registry;
  const dev = reg.getDevice(id);
  const scanMs = Number(drv.cfg?.scanMs) || Number(settings.scanMs) || 100;
  const reportMs = Math.max(
    100,
    Math.min(600000, Number(drv.cfg?.reportIntervalMs) || scanMs * 2),
  );

  console.log(`[parc-recovery] deviceId ${id} reason=${opts.reason || 'unknown'}`);

  hub.publishDeviceConfig(id, {
    pauseTelemetry: false,
    debugAttached: true,
    reportMs,
  });

  if (dev?.runtime?.running !== true && typeof drv.startRuntime === 'function') {
    try {
      await drv.startRuntime({ deviceId: id, attach: true });
    } catch (e) {
      console.warn(`[parc-recovery] runtime_start failed for ${id}: ${e.message || e}`);
      return { ok: false, error: e.message || String(e) };
    }
  }

  return { ok: true };
}

function resetParcRecoveryState() {
  _lastRecovery.clear();
}

module.exports = {
  registerParcRecoveryDeps,
  maybeRecoverParcDevice,
  resetParcRecoveryState,
  RECOVERY_DEBOUNCE_MS,
};
