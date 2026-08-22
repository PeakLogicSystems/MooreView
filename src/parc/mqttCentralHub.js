'use strict';

const crypto = require('crypto');
const mqtt = require('mqtt');
const { topics, deviceIdFromTopic, parseGlobalTopic, globalWildcardTopic, wildcardTenantTelemetry, resolveTelemetryRoute } = require('./mqttProtocol');
const { parseMqttJson } = require('./parseMqttJson');
const { decodeGlobalMqttPayload } = require('./globalMqttPayload');
const { normalizeSiteKey } = require('./globalAddressKey');
const { globalBaseType } = require('./globalTagMeta');
const { publishGlobalTag: publishGlobalTagToBroker } = require('./globalMqttPublish');
const { mirrorDuplexFloatLevels, DUPLEX_FLOAT_LVL, DUPLEX_DEMAND_LATCH } = require('./duplexFloatMirror');
const {
  isDraginoPayload,
  parseDraginoTopic,
  draginoSubscribePattern,
  draginoToParcReport,
  defaultDraginoSettings,
} = require('./draginoTelemetry');
const persistence = require('../persistence');

const DUPLEX_DERIVED_TAGS = new Set([...DUPLEX_FLOAT_LVL, ...DUPLEX_DEMAND_LATCH]);

function driverIdForParcDevice(deviceId) {
  const id = String(deviceId || '').trim();
  if (!id) return null;
  const drivers = persistence.readJson('drivers.json', []);
  const row = drivers.find(
    (d) => d && d.enabled !== false && d.type === 'mqtt_parc' && String(d.deviceId || '').trim() === id,
  );
  return row?.id || null;
}

function defaultCentralSettings() {
  return {
    enabled: false,
    brokerUrl: 'mqtt://127.0.0.1:1883',
    topicPrefix: 'mooreview/v1',
    clientId: 'mv-central-hmi',
    username: '',
    password: '',
    commandTimeoutMs: 15000,
    dragino: {
      enabled: true,
      topicPrefix: 'dragino',
      topicSuffix: 'uplink',
      deviceIdPrefix: 'dragino_',
      cloudTenantId: '',
    },
    cloudTenantIngest: false,
  };
}

class MqttCentralHub {
  constructor({ registry }) {
    this.registry = registry;
    this.cfg = defaultCentralSettings();
    this.client = null;
    this.connected = false;
    this._connectWait = null;
    this._pending = new Map();
    /** @type {Map<string, Promise<void>>} */
    this._deviceCmdTail = new Map();
    this._tagStore = null;
  }

  setGlobalMirrorDeps(deps = {}) {
    if (deps.tagStore) this._tagStore = deps.tagStore;
  }

  resolveGlobalSiteKey() {
    return normalizeSiteKey(this.cfg?.globalSiteKey);
  }

  publishGlobalTag(tagName, tag, siteKey) {
    if (!this.client?.connected) return false;
    return publishGlobalTagToBroker(this.client, this.cfg, siteKey, tagName, tag);
  }

  _mirrorGlobalTag(topic, text) {
    const parsed = parseGlobalTopic(topic, this.cfg);
    if (!parsed) return false;
    const decoded = decodeGlobalMqttPayload(text);
    if (!decoded || !this._tagStore) return !!parsed;
    const id = parsed.tagName;
    if (DUPLEX_DERIVED_TAGS.has(id)) {
      if (this._tagStore) mirrorDuplexFloatLevels(this._tagStore);
      return true;
    }
    let row = this._tagStore.get(id);
    if (!row) {
      this._tagStore.upsert({
        id,
        type: decoded.type,
        role: 'memory',
        global: true,
        value: decoded.value,
      });
    } else if (typeof this._tagStore.applyParcTelemetry === 'function') {
      this._tagStore.applyParcTelemetry(id, {
        value: decoded.value,
        type: decoded.type,
        quality: 'GOOD',
      });
    } else {
      this._tagStore.setValue(id, decoded.value, 'GOOD');
    }
    const updated = this._tagStore.get(id);
    if (updated) {
      updated.global = true;
      updated.logicValue = decoded.type === 'BOOL' ? !!decoded.value : decoded.value;
    }
    return true;
  }

  status() {
    return {
      enabled: !!this.cfg.enabled,
      connected: this.isLive(),
      brokerUrl: this.cfg.brokerUrl,
      pendingCommands: this._pending.size,
    };
  }

  isLive() {
    return !!(this.connected && this.client?.connected);
  }

  _finishConnectWait(err) {
    const wait = this._connectWait;
    if (!wait) return;
    this._connectWait = null;
    clearTimeout(wait.timer);
    if (err) wait.reject(err);
    else wait.resolve();
  }

  _onHubConnect() {
    this.connected = true;
    const subs = [
      topics(this.cfg, '_').wildcardTelemetry,
      topics(this.cfg, '_').wildcardCmdResponse,
      topics(this.cfg, '_').wildcardOnline,
    ];
    try {
      subs.push(globalWildcardTopic(this.cfg, this.resolveGlobalSiteKey()));
    } catch (e) {
      console.warn('[mqtt-parc-hub] global subscribe skipped:', e.message || e);
    }
    const draginoTopic = draginoSubscribePattern(this.cfg);
    if (draginoTopic) subs.push(draginoTopic);
    if (this.cfg.cloudTenantIngest) {
      subs.push(wildcardTenantTelemetry(this.cfg));
    }
    this.client.subscribe(subs, { qos: 1 }, (err) => {
      if (err) console.error('[mqtt-parc-hub] subscribe:', err.message);
      this._finishConnectWait();
    });
  }

  async start(rawCfg) {
    await this.stop();
    this.cfg = { ...defaultCentralSettings(), ...(rawCfg || {}) };
    if (!this.cfg.enabled) return;

    const connectTimeoutMs = Math.max(3000, Number(this.cfg.connectTimeoutMs) || 20000);

    await new Promise((resolve, reject) => {
      this._connectWait = {
        resolve,
        reject,
        timer: setTimeout(() => {
          this._finishConnectWait(
            new Error(`MQTT hub connect timeout (${this.cfg.brokerUrl})`),
          );
        }, connectTimeoutMs),
      };

      this.client = mqtt.connect(this.cfg.brokerUrl, {
        clientId: this.cfg.clientId || 'mv-central-hmi',
        username: this.cfg.username || undefined,
        password: this.cfg.password || undefined,
        keepalive: 60,
        reconnectPeriod: 5000,
      });

      this.client.on('connect', () => this._onHubConnect());
      this.client.on('message', (topic, buf) => this._onMessage(topic, buf));
      this.client.on('close', () => { this.connected = false; });
      this.client.on('error', (e) => console.error('[mqtt-parc-hub]', e.message));
    });
  }

  async stop() {
    this._finishConnectWait(new Error('MQTT hub stopped'));
    for (const [, p] of this._pending) {
      clearTimeout(p.timer);
      p.reject(new Error('MQTT hub stopped'));
    }
    this._pending.clear();
    this._deviceCmdTail.clear();
    if (this.client) {
      try { this.client.end(true); } catch { /* ignore */ }
    }
    this.client = null;
    this.connected = false;
  }

  async reload(rawCfg) {
    await this.start(rawCfg);
  }

  _ingestParcTelemetryReport(report, sourceTags) {
    const deviceId = report.deviceId;
    try {
      const { runHostInferenceFromReport } = require('../inference/hostInference');
      const mongoTagLogger = require('../logger/mongoTagLogger');
      mongoTagLogger.logEdgeFromReport(report).catch(() => {});
      runHostInferenceFromReport(report).then((hostResult) => {
        if (hostResult?.docs?.length) {
          mongoTagLogger.logEdgeInferences(hostResult.docs).catch(() => {});
        }
      }).catch(() => {});
      this.registry.ingestReport(report);
      const tagRows = sourceTags || report.tags;
      if (this._tagStore && Array.isArray(tagRows) && tagRows.length) {
        const { ensureParcHardwareTags, applyParcHardwareTelemetry } = require('./parcTagSync');
        ensureParcHardwareTags(this._tagStore, tagRows, {
          driverId: driverIdForParcDevice(deviceId),
        });
        applyParcHardwareTelemetry(this._tagStore, tagRows);
        mirrorDuplexFloatLevels(this._tagStore);
      }
    } catch (e) {
      console.error(`[mqtt-parc-hub] telemetry ingest (${deviceId}):`, e.message);
    }
  }

  _onDraginoUplink(topic, text) {
    const draginoInfo = parseDraginoTopic(topic, this.cfg);
    if (!draginoInfo) return;
    const body = parseMqttJson(text, { dropOnError: true });
    if (!body || !isDraginoPayload(body)) return;
    try {
      const draginoCfg = defaultDraginoSettings(this.cfg);
      const tenantId = draginoCfg.cloudTenantId || null;
      const report = draginoToParcReport(body, draginoInfo.deviceId, { tenantId });
      this._ingestParcTelemetryReport(report, report.tags);
    } catch (e) {
      console.error(`[mqtt-parc-hub] dragino ingest (${draginoInfo.deviceId}):`, e.message);
    }
  }

  _onMessage(topic, buf) {
    const text = buf.toString();

    if (this._mirrorGlobalTag(topic, text)) return;

    if (parseDraginoTopic(topic, this.cfg)) {
      this._onDraginoUplink(topic, text);
      return;
    }

    const telemetryRoute = resolveTelemetryRoute(topic, this.cfg);
    if (telemetryRoute?.deviceId) {
      const deviceId = telemetryRoute.deviceId;
      const body = parseMqttJson(text, { dropOnError: true });
      if (!body || typeof body !== 'object') return;
      try {
        const { expandMcsaEnvTags } = require('./mcsaTelemetry');
        let report;
        if (isDraginoPayload(body)) {
          report = draginoToParcReport(body, deviceId, {
            tenantId: telemetryRoute.tenantId || undefined,
          });
        } else {
          report = expandMcsaEnvTags({ ...body, deviceId: body.deviceId || deviceId });
          if (telemetryRoute.tenantId) {
            report.meta = {
              ...(report.meta || {}),
              tenantId: telemetryRoute.tenantId,
            };
          }
        }
        this._ingestParcTelemetryReport(report, report.tags);
      } catch (e) {
        console.error(`[mqtt-parc-hub] telemetry ingest (${deviceId}):`, e.message);
      }
      return;
    }

    const deviceId = deviceIdFromTopic(topic, this.cfg);
    if (!deviceId) return;

    if (topic.endsWith('/cmd/response')) {
      let msg;
      try { msg = parseMqttJson(text); } catch { return; }
      if (!msg || typeof msg !== 'object') return;
      const p = this._pending.get(msg.id);
      if (!p) return;
      clearTimeout(p.timer);
      this._pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.body);
      else p.reject(Object.assign(new Error(msg.error || 'command failed'), { status: msg.status || 500 }));
      return;
    }

    if (topic.endsWith('/online')) {
      try {
        const msg = parseMqttJson(text);
        if (!msg || typeof msg !== 'object') return;
        if (msg.online === false) {
          this.registry.markDeviceOffline(deviceId);
        } else if (msg.online === true) {
          this.registry.markDeviceOnline(deviceId);
        }
      } catch { /* ignore */ }
    }
  }

  publishDeviceConfig(deviceId, patch) {
    if (!this.client?.connected) return false;
    const t = topics(this.cfg, deviceId);
    this.client.publish(t.config, JSON.stringify(patch), { qos: 1 });
    return true;
  }

  sendCommand(deviceId, op, body, opts = {}) {
    const tail = this._deviceCmdTail.get(deviceId) || Promise.resolve();
    const run = tail.then(() => this._sendCommandNow(deviceId, op, body, opts));
    this._deviceCmdTail.set(deviceId, run.then(() => {}, () => {}));
    return run;
  }

  _sendCommandNow(deviceId, op, body, opts = {}) {
    if (!this.client?.connected) {
      return Promise.reject(new Error('MQTT hub not connected'));
    }
    const id = crypto.randomUUID();
    const t = topics(this.cfg, deviceId);
    const timeoutMs = Math.max(
      3000,
      Number(opts.timeoutMs || this.cfg.commandTimeoutMs) || 15000,
    );
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(new Error(`MQTT command timeout (${op})`));
      }, timeoutMs);
      this._pending.set(id, { resolve, reject, timer });
      this.client.publish(t.cmd, JSON.stringify({ id, op, body: body || {} }), { qos: 1 });
    });
  }
}

let hubSingleton = null;

function getMqttCentralHub(registry) {
  if (!hubSingleton) hubSingleton = new MqttCentralHub({ registry });
  return hubSingleton;
}

module.exports = {
  MqttCentralHub,
  getMqttCentralHub,
  defaultCentralSettings,
};
