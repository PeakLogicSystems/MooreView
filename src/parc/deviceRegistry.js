'use strict';

const persistence = require('../persistence');
const { dedupeParcTags } = require('./parcTagSync');

const PARC_FILE = 'parc.json';
const SAVE_DEBOUNCE_MS = 300;

let _saveTimer = null;
let _pendingStore = null;
let _saveFailRetryTimer = null;

function defaultParcSettings() {
  return {
    enabled: true,
    defaultReportIntervalSec: 300,
    staleAfterSec: 900,
  };
}

function emptyStore() {
  return { devices: {}, settings: defaultParcSettings() };
}

function loadStore() {
  const raw = persistence.readJson(PARC_FILE, null);
  if (!raw || typeof raw !== 'object') return emptyStore();
  return {
    devices: raw.devices && typeof raw.devices === 'object' ? raw.devices : {},
    settings: { ...defaultParcSettings(), ...(raw.settings || {}) },
  };
}

function saveStore(store) {
  try {
    persistence.writeJson(PARC_FILE, store);
    if (_saveFailRetryTimer) {
      clearTimeout(_saveFailRetryTimer);
      _saveFailRetryTimer = null;
    }
  } catch (err) {
    console.warn(`[parc-registry] failed to save ${PARC_FILE}: ${err.message}`);
    _pendingStore = store;
    if (_saveFailRetryTimer) return;
    _saveFailRetryTimer = setTimeout(() => {
      _saveFailRetryTimer = null;
      const pending = _pendingStore;
      _pendingStore = null;
      if (pending) saveStore(pending);
    }, 2000);
  }
}

function scheduleSaveStore(store) {
  _pendingStore = store;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    const pending = _pendingStore;
    _pendingStore = null;
    if (pending) saveStore(pending);
  }, SAVE_DEBOUNCE_MS);
}

function flushDebouncedSave() {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  if (!_pendingStore) return;
  const pending = _pendingStore;
  _pendingStore = null;
  saveStore(pending);
}

function normalizeDeviceId(id) {
  const s = String(id || '').trim();
  if (!s) throw Object.assign(new Error('deviceId required'), { status: 400 });
  if (!/^[a-zA-Z0-9._-]{1,64}$/.test(s)) {
    throw Object.assign(new Error('deviceId must be 1-64 chars: letters, digits, . _ -'), { status: 400 });
  }
  return s;
}

function deviceSummary(rec, settings) {
  const staleAfterSec = settings.staleAfterSec || 900;
  const ageSec = rec.lastReportAt
    ? Math.floor((Date.now() - Date.parse(rec.lastReportAt)) / 1000)
    : null;
  return {
    deviceId: rec.deviceId,
    name: rec.name || rec.deviceId,
    platform: rec.platform || '',
    reportIntervalSec: rec.reportIntervalSec || settings.defaultReportIntervalSec,
    lastReportAt: rec.lastReportAt || null,
    ageSec,
    stale: ageSec == null || ageSec > staleAfterSec,
    runtime: rec.runtime || null,
    tagCount: Array.isArray(rec.tags) ? rec.tags.length : 0,
    expansionCount: rec.meta?.expansionCount ?? null,
    expansionModules: rec.meta?.expansionModules || [],
    ethIp: rec.meta?.ethIp || null,
    mqttBroker: rec.meta?.mqttBroker || null,
    mqttBrokerPort: rec.meta?.mqttBrokerPort ?? null,
    firmwareVersion: rec.meta?.firmwareVersion || null,
    deviceMode: rec.meta?.deviceMode || rec.runtime?.deviceMode || null,
    ctCal: rec.ctCal || null,
    ctCalibrated: !!(rec.runtime?.ctCalibrated || (rec.ctCal?.zeroedCount > 0)),
    attached: !!rec.attach?.active,
    attachHost: rec.attach?.host || null,
    pauseReports: !!rec.attach?.active,
  };
}

let _recoveryHook = null;

function setParcRecoveryHook(fn) {
  _recoveryHook = typeof fn === 'function' ? fn : null;
}

function _triggerRecovery(deviceId, opts) {
  if (_recoveryHook) {
    _recoveryHook(deviceId, opts);
    return;
  }
  try {
    const { maybeRecoverParcDevice } = require('./parcDeviceRecovery');
    maybeRecoverParcDevice(deviceId, opts).catch((e) => {
      console.warn(`[parc-recovery] hook failed for ${deviceId}:`, e.message || e);
    });
  } catch { /* optional during tests */ }
}

class DeviceRegistry {
  constructor() {
    this._store = loadStore();
    this._offlineDevices = new Set();
  }

  settings() {
    return { ...this._store.settings };
  }

  updateSettings(patch) {
    this._store.settings = { ...this._store.settings, ...patch };
    saveStore(this._store);
    return this.settings();
  }

  listDevices() {
    const settings = this._store.settings;
    return Object.values(this._store.devices)
      .map((d) => deviceSummary(d, settings))
      .sort((a, b) => a.deviceId.localeCompare(b.deviceId));
  }

  getDevice(deviceId) {
    const id = normalizeDeviceId(deviceId);
    const rec = this._store.devices[id];
    if (!rec) return null;
    const settings = this._store.settings;
    return {
      ...deviceSummary(rec, settings),
      tags: rec.tags || [],
      driverHealth: rec.driverHealth || [],
      meta: rec.meta || {},
      attach: rec.attach || { active: false },
    };
  }

  ingestReport(body) {
    if (!this._store.settings.enabled) {
      return { ok: false, error: 'Parc ingest disabled', status: 503 };
    }
    const deviceId = normalizeDeviceId(body.deviceId);
    const settings = this._store.settings;
    const existing = this._store.devices[deviceId] || { deviceId };
    const attach = existing.attach || { active: false };
    const wasOffline = existing.meta?.online === false || this._offlineDevices.has(deviceId);
    const goingOffline = body.meta?.online === false;

    const meta = {
      ...(existing.meta || {}),
      ...(body.meta || {}),
      ...(body.ethIp ? { ethIp: String(body.ethIp) } : {}),
      ...(body.mqttBroker ? { mqttBroker: String(body.mqttBroker) } : {}),
      ...(body.mqttBrokerPort != null ? { mqttBrokerPort: Number(body.mqttBrokerPort) || 1883 } : {}),
      ...(body.firmwareVersion ? { firmwareVersion: String(body.firmwareVersion) } : {}),
      ...(body.deviceMode ? { deviceMode: String(body.deviceMode) } : {}),
      ...(body.mqttAuth != null ? { mqttAuth: !!body.mqttAuth } : {}),
      ...(Array.isArray(body.expansionModules)
        ? { expansionModules: body.expansionModules }
        : {}),
      ...(body.expansionCount != null ? { expansionCount: body.expansionCount } : {}),
    };

    const ateccSerial = String(body.ateccSerial || body.meta?.ateccSerial || meta.ateccSerial || '').trim();
    if (ateccSerial) meta.ateccSerial = ateccSerial;

    if (body.mqttAuthFailed === true || body.meta?.mqttAuthFailed === true) {
      meta.mqttAuthFailed = true;
    } else if (
      body.mqttAuthFailed === false
      || body.meta?.mqttAuthFailed === false
      || (body.mqttAuth === true && body.mqttAuthFailed !== true)
      || (body.meta?.mqttAuth === true && body.meta?.mqttAuthFailed !== true)
    ) {
      meta.mqttAuthFailed = false;
    }

    if (goingOffline) {
      meta.online = false;
    } else {
      meta.online = true;
    }

    const rec = {
      ...existing,
      deviceId,
      name: body.name || existing.name || deviceId,
      platform: body.platform || existing.platform || '',
      reportIntervalSec: Math.max(
        30,
        Number(body.reportIntervalSec) || existing.reportIntervalSec || settings.defaultReportIntervalSec
      ),
      lastReportAt: new Date().toISOString(),
      runtime: body.runtime != null ? body.runtime : existing.runtime || null,
      ctCal: body.ctCal != null ? body.ctCal : (existing.ctCal || null),
      tags: dedupeParcTags(Array.isArray(body.tags) ? body.tags : (existing.tags || [])),
      driverHealth: Array.isArray(body.driverHealth) ? body.driverHealth : (existing.driverHealth || []),
      meta,
      attach,
    };

    this._store.devices[deviceId] = rec;
    scheduleSaveStore(this._store);

    if (wasOffline && !goingOffline) {
      this._offlineDevices.delete(deviceId);
      _triggerRecovery(deviceId, { reason: 'telemetry' });
    }

    const pauseReports = !!attach.active;
    const nextReportSec = pauseReports
      ? Math.max(rec.reportIntervalSec * 2, 600)
      : rec.reportIntervalSec;

    const result = {
      ok: true,
      deviceId,
      nextReportSec,
      pauseReports,
      attached: pauseReports,
      reportIntervalSec: rec.reportIntervalSec,
    };

    if (!pauseReports) {
      try {
        const { relayParcReportIfEnabled } = require('../integrations/applianceCloudRelay');
        relayParcReportIfEnabled({
          deviceId: rec.deviceId,
          name: rec.name,
          platform: rec.platform,
          reportIntervalSec: rec.reportIntervalSec,
          runtime: rec.runtime,
          tags: rec.tags,
          meta: rec.meta,
          driverHealth: rec.driverHealth,
        }).catch(() => {});
      } catch { /* cloud remote optional */ }
    }

    return result;
  }

  reporterConfig(deviceId) {
    const id = normalizeDeviceId(deviceId);
    const rec = this._store.devices[id];
    const settings = this._store.settings;
    const interval = rec?.reportIntervalSec || settings.defaultReportIntervalSec;
    const attached = !!rec?.attach?.active;
    return {
      deviceId: id,
      reportIntervalSec: interval,
      pauseReports: attached,
      attached,
      parcEnabled: settings.enabled,
    };
  }

  attach(deviceId, { host, port, sessionId } = {}) {
    const id = normalizeDeviceId(deviceId);
    const rec = this._store.devices[id] || { deviceId: id, tags: [], driverHealth: [] };
    rec.attach = {
      active: true,
      host: host || rec.meta?.lastHost || null,
      port: port != null ? Number(port) : (rec.meta?.lastPort || 3080),
      sessionId: sessionId || null,
      at: new Date().toISOString(),
    };
    this._store.devices[id] = rec;
    saveStore(this._store);
    return this.getDevice(id);
  }

  detach(deviceId) {
    const id = normalizeDeviceId(deviceId);
    const rec = this._store.devices[id];
    if (!rec) return null;
    rec.attach = { active: false };
    this._store.devices[id] = rec;
    saveStore(this._store);
    return this.getDevice(id);
  }

  /** Drop a device row from parc.json (test/noise cleanup). */
  removeDevice(deviceId) {
    const id = normalizeDeviceId(deviceId);
    if (!this._store.devices[id]) return false;
    delete this._store.devices[id];
    this._offlineDevices.delete(id);
    saveStore(this._store);
    return true;
  }

  markDeviceOffline(deviceId) {
    const id = normalizeDeviceId(deviceId);
    const rec = this._store.devices[id];
    if (!rec) return null;
    rec.meta = { ...(rec.meta || {}), online: false };
    rec.runtime = { ...(rec.runtime || {}), running: false };
    rec.attach = { active: false };
    this._offlineDevices.add(id);
    this._store.devices[id] = rec;
    scheduleSaveStore(this._store);
    return this.getDevice(id);
  }

  markDeviceOnline(deviceId) {
    const id = normalizeDeviceId(deviceId);
    const rec = this._store.devices[id];
    if (!rec) {
      this._offlineDevices.delete(id);
      return null;
    }
    const wasOffline = rec.meta?.online === false || this._offlineDevices.has(id);
    rec.meta = { ...(rec.meta || {}), online: true };
    this._offlineDevices.delete(id);
    this._store.devices[id] = rec;
    scheduleSaveStore(this._store);
    if (wasOffline) {
      _triggerRecovery(id, { reason: 'online' });
    }
    return this.getDevice(id);
  }
}

const registry = new DeviceRegistry();

module.exports = {
  DeviceRegistry,
  registry,
  defaultParcSettings,
  flushDebouncedSave,
  SAVE_DEBOUNCE_MS,
  setParcRecoveryHook,
  normalizeDeviceId,
};
