'use strict';

const { QUALITY } = require('../tags/constants');
const { rawToEngineering } = require('../tags/tagAnalog');
const { registry } = require('../parc/deviceRegistry');
const { getMqttCentralHub } = require('../parc/mqttCentralHub');
const { buildOptaProgramBody } = require('../parc/mqttOptaProgram');
const { clientDeployMeta } = require('./optaProtocol');
const programStore = require('../programs/programStore');

class MqttParcOptaDriver {
  constructor(cfg) {
    this.cfg = cfg;
    this.connected = false;
    this._lastError = '';
  }

  _deviceId() {
    return String(this.cfg.deviceId || this.cfg.id || '').trim();
  }

  _hub() {
    return getMqttCentralHub(registry);
  }

  health() {
    if (!this.connected) return this._lastError || 'disconnected';
    const dev = registry.getDevice(this._deviceId());
    if (dev?.stale) return 'stale telemetry';
    return 'OK';
  }

  _deviceOnline() {
    const dev = registry.getDevice(this._deviceId());
    return dev && !dev.stale;
  }

  async ensureConnected() {
    if (this.connected && this._deviceOnline()) return true;
    this.connected = false;
    return this.connect(this.cfg);
  }

  async connect(cfg) {
    this.cfg = { ...this.cfg, ...(cfg || {}) };
    const deviceId = this._deviceId();
    const hub = this._hub();
    if (!hub.status().connected) {
      this.connected = false;
      this._lastError = 'MQTT Parc hub not connected — start Mosquitto and check mqttParc.brokerUrl in settings';
      return false;
    }
    if (!deviceId) {
      this.connected = false;
      this._lastError = 'deviceId required';
      return false;
    }
    try {
      await hub.sendCommand(deviceId, 'runtime_status', {});
      this.connected = true;
      this._lastError = '';
      return true;
    } catch (e) {
      if (this._deviceOnline()) {
        this.connected = true;
        this._lastError = '';
        return true;
      }
      this.connected = false;
      const dev = registry.getDevice(deviceId);
      if (!dev) {
        this._lastError = `Device ${deviceId} not seen on MQTT — Opta broker must be ${hub.status().brokerUrl} and deviceId must match firmware`;
      } else if (dev.stale) {
        this._lastError = `Telemetry stale for ${deviceId} (last report ${dev.ageSec ?? '?'}s ago) — power-cycle Opta or check Ethernet`;
      } else {
        this._lastError = e.message || String(e);
      }
      return false;
    }
  }

  async disconnect() {
    const deviceId = this._deviceId();
    if (this.cfg.remoteExecution && deviceId) {
      try {
        await this._hub().sendCommand(deviceId, 'runtime_stop', {});
      } catch { /* ignore */ }
    }
    if (deviceId) registry.detach(deviceId);
    this.connected = false;
  }

  _syncTagsFromParc(tags, store) {
    const deviceId = this._deviceId();
    const dev = registry.getDevice(deviceId);
    const quality = !dev || dev.stale ? QUALITY.STALE : QUALITY.GOOD;
    const snap = new Map((dev?.tags || []).map((t) => [t.id, t]));
    for (const t of tags) {
      const row = snap.get(t.id);
      if (!row) {
        if (quality === QUALITY.STALE) {
          store.setValue(t.id, store.get(t.id)?.value ?? t.value, QUALITY.STALE);
        }
        continue;
      }
      let val = row.value;
      if (t.type === 'BOOL') val = !!val;
      else if (t.type === 'INT') {
        const raw = Math.trunc(Number(val) || 0);
        val = Math.trunc(rawToEngineering(raw, t));
      } else if (t.type === 'REAL' || t.type === 'PID' || t.type === 'AVG') {
        const raw = Number(val) || 0;
        val = rawToEngineering(raw, t);
      }
      store.setValue(t.id, val, quality);
    }
    if (!dev) this._lastError = 'no Parc telemetry yet';
    else if (dev.stale) this._lastError = 'telemetry stale';
    else this._lastError = '';
    this.connected = quality === QUALITY.GOOD;
  }

  async readBatch(tags, store) {
    if (this.cfg.remoteExecution) return;
    this._syncTagsFromParc(tags, store);
  }

  async writeBatch() {
    if (this.cfg.remoteExecution) return;
  }

  async deployProgram(source, tagStore) {
    const built = buildOptaProgramBody(source, tagStore, this.cfg.id);
    if (!built.ok) return built;
    const body = {
      ...built.body,
      ...clientDeployMeta({ programName: programStore.activeRel() || '' }),
    };
    const payloadBytes = Buffer.byteLength(JSON.stringify(body));
    const { OPTA_PROGRAM_MAX_BYTES } = require('./optaProtocol');
    if (payloadBytes >= OPTA_PROGRAM_MAX_BYTES) {
      return {
        ok: false,
        errors: [`Program deploy is ${payloadBytes} bytes (limit ${OPTA_PROGRAM_MAX_BYTES})`],
      };
    }
    await this._hub().sendCommand(this._deviceId(), 'put_program', body);
    console.log(
      `[mqtt-parc] put_program → ${this._deviceId()} (${payloadBytes} bytes, ${built.body?.tagCount ?? '?'} tags)`,
    );
    return { ok: true, errors: [] };
  }

  async startRuntime() {
    const scanMs = Number(this.cfg.scanMs) || 100;
    const deviceId = this._deviceId();
    registry.attach(deviceId, { sessionId: 'mooreview-pc' });
    const reportMs = Math.max(100, Math.min(600000, Number(this.cfg.reportIntervalMs) || scanMs * 2));
    this._hub().publishDeviceConfig(deviceId, {
      pauseTelemetry: false,
      debugAttached: true,
      reportMs,
    });
    await this._hub().sendCommand(deviceId, 'runtime_start', { scanMs });
    console.log(`[mqtt-parc] runtime_start → ${deviceId} scanMs=${scanMs}`);
  }

  async stopRuntime() {
    await this._hub().sendCommand(this._deviceId(), 'runtime_stop', {});
  }

  async runScanCycle(store) {
    const maps = store.list().filter((t) => t.driverId === this.cfg.id);
    this._syncTagsFromParc(maps, store);
    return { ok: true, tags: maps.length };
  }
}

module.exports = { MqttParcOptaDriver };
