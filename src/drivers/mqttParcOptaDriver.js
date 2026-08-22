'use strict';

const { QUALITY } = require('../tags/constants');
const { rawToEngineering } = require('../tags/tagAnalog');
const { registry } = require('../parc/deviceRegistry');
const { getMqttCentralHub } = require('../parc/mqttCentralHub');
const { parcDeployErrorHint } = require('../parc/cmdFailureHint');
const { mirrorDuplexFloatLevels, DUPLEX_FLOAT_LVL } = require('../parc/duplexFloatMirror');
const { buildParcTagSnap, isParcHardwareIoRow } = require('../parc/parcTagSync');
const { resolveParcDeviceId, normalizeAteccSerialHex } = require('../parc/optaSerial');
const { findRegistryDeviceForDriver } = require('../parc/parcDeviceResolve');
const { clientDeployMeta, assessOptaDeployLimits, optaDeployLimitsFromDeviceStatus } = require('./optaProtocol');
const programStore = require('../programs/programStore');
const persistence = require('../persistence');
const {
  buildPcProgramDeployArtifact,
  evaluateProgramDeploy,
  fetchDeviceProgramState,
  skipDeployEnabled,
  recordDeployVerdict,
} = require('../parc/programDeployMatch');

/** Active hardware_assignments row for this driver position (commissioned Opta). */
function assignmentForDriverPosition(positionId) {
  const id = String(positionId || '').trim();
  if (!id) return null;
  try {
    const rows = persistence.readJson('hardware_assignments.json', { assignments: [] }).assignments || [];
    const matches = rows.filter(
      (r) => !r?.removedAt && String(r.positionId || '').trim() === id && String(r.deviceId || '').trim(),
    );
    if (!matches.length) return null;
    matches.sort((a, b) => String(b.installedAt || '').localeCompare(String(a.installedAt || '')));
    return matches[0];
  } catch {
    return null;
  }
}

function isWriteMemoryUnsupportedError(err) {
  return /unknown op/i.test(err?.message || String(err));
}

/** BOOL memory tags cleared by ST each scan — set_force must be pulsed, not latched. */
function isMomentaryMemoryBoolTag(tag) {
  if (!tag?.id || tag.type !== 'BOOL') return false;
  if (/^MOTOR[12]_(START|STOP|RESET)$/.test(tag.id)) return true;
  if (tag.id === 'ALT_BUMP') return true;
  return false;
}

/** ST auto branch clears MOTORx_HAND every scan unless MOTORx_HOA=2 on device. */
const HAND_HOA_COMPANION = {
  MOTOR1_HAND: { hoaTag: 'MOTOR1_HOA', hoaValue: 2 },
  MOTOR2_HAND: { hoaTag: 'MOTOR2_HOA', hoaValue: 2 },
};

/** Prevent ST re-latching HAND from stuck START/STOP memory after HMI pulse writes. */
function motorPulseClearRows(handTagId) {
  const match = /^MOTOR([12])_HAND$/.exec(String(handTagId || ''));
  if (!match) return [];
  const n = match[1];
  return [
    { id: `MOTOR${n}_START`, type: 'BOOL', value: false },
    { id: `MOTOR${n}_STOP`, type: 'BOOL', value: false },
  ];
}

function tagChannel(tag) {
  const ch = tag?.driverAddress?.channel ?? tag?.driverAddress?.id;
  return String(ch || tag?.id || '').trim();
}

function outputWriteValue(tag, store) {
  const v = store?.get?.(tag.id)?.value ?? tag.value;
  if (tag.type === 'BOOL') return !!v;
  if (tag.type === 'INT') return Math.trunc(Number(v) || 0);
  return Number(v) || 0;
}

/** JSON numbers for INT tags must stay integers so Opta set_force lands on .i not .r */
function normalizeTagMemoryValue(tag) {
  if (!tag) return tag?.value;
  if (tag.type === 'BOOL') return !!tag.value;
  if (tag.type === 'INT') return Math.trunc(Number(tag.value) || 0);
  if (tag.type === 'REAL' || tag.type === 'PID' || tag.type === 'AVG') {
    return Number(tag.value) || 0;
  }
  return tag.value;
}

class MqttParcOptaDriver {
  constructor(cfg) {
    this.cfg = cfg;
    this.connected = false;
    this._lastError = '';
  }

  _deviceId() {
    const cfg = this.cfg || {};
    const raw = String(cfg.deviceId || cfg.id || '').trim();
    let serial = normalizeAteccSerialHex(cfg.ateccSerial || '');
    const assigned = !serial || raw === 'opta_st_01' || !/^mv_/i.test(raw)
      ? assignmentForDriverPosition(cfg.id)
      : null;
    if (!serial && assigned?.serialNumber) {
      serial = normalizeAteccSerialHex(assigned.serialNumber);
    }
    const enriched = serial ? { ...cfg, ateccSerial: serial } : cfg;
    const resolved = resolveParcDeviceId(enriched);
    if (resolved && resolved !== raw) return resolved;
    if ((raw === 'opta_st_01' || !/^mv_/i.test(raw)) && assigned?.deviceId) {
      return String(assigned.deviceId).trim();
    }
    const { deviceId: liveId } = findRegistryDeviceForDriver(registry, enriched);
    if (liveId && (raw === 'opta_st_01' || !registry.getDevice(raw) || registry.getDevice(raw)?.stale)) {
      const live = registry.getDevice(liveId);
      if (live && !live.stale) return liveId;
    }
    return resolved || raw;
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
    if (this.cfg.remoteExecution === false || this.cfg.telemetryOnly === true) {
      if (this._deviceOnline()) {
        this.connected = true;
        this._lastError = '';
        return true;
      }
      const dev = registry.getDevice(deviceId);
      this.connected = false;
      if (!dev) {
        this._lastError = `Device ${deviceId} not seen on MQTT — check Dragino/Parc uplink topic and mqttParc hub broker`;
      } else if (dev.stale) {
        this._lastError = `Telemetry stale for ${deviceId} (last report ${dev.ageSec ?? '?'}s ago)`;
      } else {
        this._lastError = 'no Parc telemetry yet';
      }
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
    const snap = buildParcTagSnap(dev?.tags || []);
    for (const t of tags) {
      if (DUPLEX_FLOAT_LVL.has(t.id)) continue;
      if (store.isDriverReadSkipped?.(t)) continue;
      const row = snap.get(t.id) || (t.driverAddress?.channel ? snap.get(t.driverAddress.channel) : null);
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
      if (typeof store.applyParcTelemetry === 'function') {
        store.applyParcTelemetry(t.id, {
          value: val,
          quality,
          forceInput: row.forceInput,
          forceOutput: row.forceOutput,
          forceValue: row.forceValue,
          logicValue: row.logicValue,
          type: t.type,
        });
      } else {
        store.setValue(t.id, val, quality);
      }
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

  async writeBatch(tags, store) {
    if (this.cfg.remoteExecution || this.cfg.telemetryOnly) return;
    const outputs = {};
    for (const t of tags || []) {
      const key = tagChannel(t);
      if (!key) continue;
      const value = outputWriteValue(t, store);
      outputs[key] = value;
      if (t.id && t.id !== key) outputs[t.id] = value;
    }
    if (!Object.keys(outputs).length) return;
    const ok = await this.ensureConnected();
    if (!ok) {
      this._lastError = this._lastError || 'write_outputs skipped — device offline';
      return;
    }
    const deviceId = this._deviceId();
    try {
      await this._hub().sendCommand(deviceId, 'write_outputs', { outputs }, { timeoutMs: 4000 });
      this._lastError = '';
    } catch (e) {
      this._lastError = e.message || String(e);
      throw e;
    }
  }

  async deployProgram(source, tagStore) {
    const persistence = require('../persistence');
    const settings = persistence.readJson('settings.json', {});
    const artifact = buildPcProgramDeployArtifact(source, tagStore, this.cfg.id);
    if (!artifact.ok) return artifact;

    const programName = programStore.activeRel() || '';
    const body = {
      ...artifact.body,
      ...clientDeployMeta({ programName }),
    };
    const payloadBytes = Buffer.byteLength(JSON.stringify(body));
    const deviceId = this._deviceId();
    const { bcLimit, wireLimit } = optaDeployLimitsFromDeviceStatus(
      registry.getDevice(deviceId)?.status,
    );
    const sizing = assessOptaDeployLimits({
      bcBytes: artifact.bcBytes,
      wireBytes: payloadBytes,
      bcLimit,
      wireLimit,
    });
    if (sizing.overLimit) {
      return {
        ok: false,
        errors: sizing.errors.length
          ? sizing.errors
          : [`Program deploy exceeds Opta limit (bytecode ${artifact.bcBytes} B, wire ${payloadBytes} B)`],
      };
    }
    const hub = this._hub();
    const pcMeta = {
      crc: artifact.crc,
      programName,
      bcBytes: artifact.bcBytes,
      tagCount: artifact.tagCount,
    };
    const programVersion = {
      crc: artifact.crc,
      programName,
      bcBytes: artifact.bcBytes,
      tagCount: artifact.tagCount,
    };

    if (skipDeployEnabled(settings)) {
      const deviceState = await fetchDeviceProgramState(
        hub,
        deviceId,
        registry.getDevice(deviceId),
      );
      const verdict = evaluateProgramDeploy({ pc: pcMeta, device: deviceState });
      recordDeployVerdict(deviceId, pcMeta, deviceState, verdict);
      if (verdict.action === 'skip' || verdict.action === 'skip_deploy') {
        console.log(`[mqtt-parc] skip put_program → ${deviceId} (${verdict.reason})`);
        return {
          ok: true,
          skipped: true,
          needsRuntimeStart: verdict.needsRuntimeStart,
          reason: verdict.reason,
          crc: artifact.crc,
          deviceCrc: deviceState.programNvCrc,
          programVersion,
          errors: [],
        };
      }
      console.log(`[mqtt-parc] put_program required → ${deviceId} (${verdict.reason})`);
    }

    console.log(
      `[mqtt-parc] put_program → ${deviceId} (${payloadBytes} bytes, ${artifact.body?.tagCount ?? '?'} tags, CRC 0x${artifact.crc.toString(16)})`,
    );
    hub.publishDeviceConfig(deviceId, { pauseTelemetry: true });
    try {
      await hub.sendCommand(deviceId, 'put_program', body, { timeoutMs: 180000 });
    } catch (e) {
      const hint = parcDeployErrorHint(e.message || String(e));
      console.error(`[mqtt-parc] put_program FAILED → ${deviceId}: ${hint}`);
      return { ok: false, errors: [hint] };
    } finally {
      hub.publishDeviceConfig(deviceId, { pauseTelemetry: false });
    }
    recordDeployVerdict(
      deviceId,
      pcMeta,
      { programNvCrc: artifact.crc, programName },
      { action: 'deploy', reason: 'put_program completed', needsRuntimeStart: true },
      { deployed: true },
    );
    console.log(
      `[mqtt-parc] put_program OK → ${deviceId} (${payloadBytes} bytes, CRC 0x${artifact.crc.toString(16)})`,
    );
    return { ok: true, skipped: false, needsRuntimeStart: true, programVersion, errors: [] };
  }

  async ensureRemoteSession(opts = {}) {
    const deviceId = String(opts.deviceId || this._deviceId()).trim();
    if (!deviceId) throw new Error('deviceId required for ensureRemoteSession');
    registry.attach(deviceId, { sessionId: 'mooreview-pc' });
    const scanMs = Number(this.cfg.scanMs) || 100;
    const reportMs = Math.max(
      100,
      Math.min(600000, Number(this.cfg.reportIntervalMs) || scanMs * 2),
    );
    this._hub().publishDeviceConfig(deviceId, {
      pauseTelemetry: false,
      debugAttached: true,
      reportMs,
    });
  }

  async startRuntime(opts = {}) {
    const scanMs = Number(this.cfg.scanMs) || 100;
    const deviceId = String(opts.deviceId || this._deviceId()).trim();
    if (!deviceId) throw new Error('deviceId required for runtime_start');
    if (opts.attach !== false) {
      registry.attach(deviceId, { sessionId: 'mooreview-pc' });
    }
    const reportMs = Math.max(100, Math.min(600000, Number(this.cfg.reportIntervalMs) || scanMs * 2));
    this._hub().publishDeviceConfig(deviceId, {
      pauseTelemetry: false,
      debugAttached: true,
      reportMs,
    });
    const timeoutMs = Math.max(3000, Number(opts.timeoutMs) || 15000);
    await this._hub().sendCommand(deviceId, 'runtime_start', { scanMs }, { timeoutMs });
    console.log(`[mqtt-parc] runtime_start → ${deviceId} scanMs=${scanMs}`);
  }

  async stopRuntime() {
    await this._hub().sendCommand(this._deviceId(), 'runtime_stop', {});
  }

  /** Tags to mirror from Parc telemetry — assigned to this driver or unassigned program tags on device. */
  _tagsForParcSync(store) {
    const dev = registry.getDevice(this._deviceId());
    const parcIds = new Set((dev?.tags || []).map((row) => row.id));
    return store.list().filter((t) => {
      if (store.isDriverReadSkipped?.(t)) return false;
      if (t.driverId === this.cfg.id) return true;
      // Program/fixture tags often have driverId null until "Import from device".
      if (!t.driverId && parcIds.has(t.id)) return true;
      // Project template may use arduino_opta_st while auto-discovered driver is io_1 — still sync hardware I/O.
      if (parcIds.has(t.id) && isParcHardwareIoRow(t)) return true;
      return false;
    });
  }

  /** Pull latest Parc registry telemetry into tag store (io-map + scan cycle). */
  syncFromParcTelemetry(store) {
    const dev = registry.getDevice(this._deviceId());
    if (dev?.tags?.length) {
      const { ensureParcHardwareTags } = require('../parc/parcTagSync');
      ensureParcHardwareTags(store, dev.tags, { driverId: this.cfg.id });
    }
    const maps = this._tagsForParcSync(store);
    this._syncTagsFromParc(maps, store);
    mirrorDuplexFloatLevels(store);
    return maps.length;
  }

  async runScanCycle(store) {
    const n = this.syncFromParcTelemetry(store);
    return { ok: true, tags: n };
  }

  async syncTagForce(tag, opts = {}) {
    const deviceId = String(opts.deviceId || this._deviceId()).trim();
    await this.ensureConnected();
    const hub = this._hub();
    if (!tag?.forceInput && !tag?.forceOutput) {
      await hub.sendCommand(deviceId, 'clear_force', {
        tagId: tag.id,
        id: tag.id,
      });
      return;
    }
    const forceValue = tag.forceValue === undefined
      ? tag.forceValue
      : normalizeTagMemoryValue({ ...tag, value: tag.forceValue });
    await hub.sendCommand(deviceId, 'set_force', {
      tagId: tag.id,
      id: tag.id,
      forceInput: !!tag.forceInput,
      forceOutput: !!tag.forceOutput,
      forceValue,
    });
  }

  async _clearRemoteForce(deviceId, tagId) {
    await this._hub().sendCommand(deviceId, 'clear_force', {
      tagId,
      id: tagId,
    });
  }

  async _pushRemoteMemoryForce(deviceId, row, opts = {}) {
    const type = row.type || (String(row.id).endsWith('_HOA') ? 'INT' : 'BOOL');
    const value = normalizeTagMemoryValue({ id: row.id, type, value: row.value });
    // Opta clear_force drops force flags but leaves mirrored tag storage true — force false explicitly.
    await this.syncTagForce({
      id: row.id,
      type,
      forceInput: false,
      forceOutput: true,
      forceValue: value,
    }, { deviceId });
    // Release force flag so Live I/O shows ST logic, not permanent PLC force on memory tags.
    if (!opts.retainForce) {
      await this._clearRemoteForce(deviceId, row.id);
    }
  }

  async syncTagMemory(tag, opts = {}) {
    const deviceId = String(opts.deviceId || this._deviceId()).trim();
    await this.ensureConnected();
    const value = normalizeTagMemoryValue(tag);
    const companion = HAND_HOA_COMPANION[tag.id];
    const rows = [];
    if (companion) {
      rows.push({ id: companion.hoaTag, type: 'INT', value: companion.hoaValue });
      rows.push(...motorPulseClearRows(tag.id));
    }
    if (/^MOTOR[12]_HOA$/.test(tag.id) && Math.trunc(Number(value)) !== 2) {
      rows.push({ id: tag.id.replace('_HOA', '_HAND'), type: 'BOOL', value: false });
    }
    rows.push({ id: tag.id, type: tag.type, value });

    if (isMomentaryMemoryBoolTag(tag) && tag.value) {
      for (const row of rows) {
        if (row.id !== tag.id) await this._pushRemoteMemoryForce(deviceId, row);
      }
      await this._pushRemoteMemoryForce(deviceId, { id: tag.id, type: tag.type, value: true }, { retainForce: true });
      const scanMs = Math.max(50, Number(this.cfg.scanMs) || 100);
      await new Promise((r) => setTimeout(r, scanMs * 2));
      await this._clearRemoteForce(deviceId, tag.id);
      await this._pushRemoteMemoryForce(deviceId, { id: tag.id, type: tag.type, value: false });
      return;
    }

    for (const row of rows) {
      await this._pushRemoteMemoryForce(deviceId, row);
    }
  }
}

module.exports = {
  MqttParcOptaDriver,
  isWriteMemoryUnsupportedError,
  isMomentaryMemoryBoolTag,
  normalizeTagMemoryValue,
  tagChannel,
  HAND_HOA_COMPANION,
  motorPulseClearRows,
};
