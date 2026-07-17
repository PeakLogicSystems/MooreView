'use strict';

const { optaBrokerHint } = require('./mqttBrokerHint');
const { semverCompare } = require('../drivers/optaProtocol');
const {
  isLegacyOptaDeviceId,
  mvDeviceIdFromAteccSerial,
  legacyOptaDeviceIdFromAteccSerial,
  normalizeAteccSerialHex,
  resolveParcDeviceId,
} = require('./optaSerial');

function parseBrokerHost(brokerUrl) {
  const u = String(brokerUrl || '').trim();
  const m = u.match(/^mqtt(?:s)?:\/\/([^:/]+)/i) || u.match(/^([^:/]+)/);
  return m ? m[1] : '';
}

function brokerMismatchMessage(dev, hubBrokerUrl) {
  const hint = optaBrokerHint();
  const hubHost = parseBrokerHost(hubBrokerUrl) || hint.lanIp;
  /** On IOT-LINK / appliance MooreVIEW uses mqtt://127.0.0.1 — Opta must use LAN IP. */
  const expectedHost = hubHost === '127.0.0.1' ? hint.lanIp : hubHost;
  const devBroker = String(dev?.meta?.mqttBroker || dev?.mqttBroker || '').trim();
  const devPort = dev?.meta?.mqttBrokerPort || dev?.mqttBrokerPort || 1883;
  if (!devBroker) return '';
  if (devBroker === '127.0.0.1' || devBroker === 'localhost') {
    return `Opta MQTT broker is ${devBroker} — open http://<opta-ip>/setup → MQTT Parc broker → ${expectedHost}:1883, save`;
  }
  if (expectedHost && expectedHost !== 'your PC LAN IP' && devBroker !== expectedHost) {
    return `Opta broker ${devBroker}:${devPort} ≠ MooreVIEW Mosquitto ${expectedHost}:1883 — fix on Opta /setup → MQTT Parc broker`;
  }
  return '';
}

function isFreshForCmdHint(dev) {
  return !!(dev && !dev.stale && dev.ageSec != null && dev.ageSec <= 120);
}

/** Health/control ops work when telemetry is throttled (attach, large tag maps). */
const PARC_CMD_OPS_ALLOW_STALE = new Set([
  'runtime_status',
  'sync_time',
  'runtime_start',
  'runtime_stop',
]);

function parcCmdAllowsStale(op, dev) {
  if (PARC_CMD_OPS_ALLOW_STALE.has(op)) return true;
  if (dev?.runtime?.running === true) return true;
  return false;
}

function serialFromLegacyDeviceId(deviceId) {
  if (!isLegacyOptaDeviceId(deviceId)) return '';
  return normalizeAteccSerialHex(String(deviceId).replace(/^opta_/i, ''));
}

/** Fresh telemetry under mv_* / opta_* sibling — driver still on legacy id after firmware upgrade. */
function deviceIdMismatchHint(configuredId, registry, opts = {}) {
  if (!configuredId) return '';
  const id = String(configuredId).trim();
  const serialFromDriver = normalizeAteccSerialHex(opts.ateccSerial || '');
  const configured = registry?.getDevice?.(id);
  const serial = serialFromDriver
    || serialFromLegacyDeviceId(id)
    || normalizeAteccSerialHex(configured?.meta?.ateccSerial || configured?.ateccSerial || '');
  if (!serial) return '';

  let expectedMv = '';
  let expectedLegacy = '';
  try {
    expectedMv = mvDeviceIdFromAteccSerial(serial);
    expectedLegacy = legacyOptaDeviceIdFromAteccSerial(serial);
  } catch {
    return '';
  }

  if (expectedMv && id !== expectedMv && (isLegacyOptaDeviceId(id) || id === 'opta_st_01' || !/^mv_/i.test(id))) {
    return `Driver deviceId ${id} ≠ firmware ${expectedMv} — update Drivers → deviceId (firmware v2.3.40+ uses mv_* ids)`;
  }

  for (const candidateId of [expectedMv, expectedLegacy]) {
    if (!candidateId || candidateId === id) continue;
    const candidate = registry?.getDevice?.(candidateId);
    if (!isFreshForCmdHint(candidate)) continue;
    return `Driver deviceId ${id} ≠ firmware ${candidateId} — update Drivers → deviceId (firmware v2.3.40+ uses mv_* ids)`;
  }
  return '';
}

function cmdFailureHint(dev, opts = {}) {
  const { hubBrokerUrl, deviceId, registry, mqttHubUsername, ateccSerial } = opts;
  const idMismatch = deviceId
    ? deviceIdMismatchHint(deviceId, registry, { ateccSerial })
    : '';
  if (idMismatch) return idMismatch;

  const fw = String(dev?.meta?.firmwareVersion || dev?.firmwareVersion || '').trim();
  const hint = optaBrokerHint();
  const mismatch = brokerMismatchMessage(dev, hubBrokerUrl);
  if (mismatch) return mismatch;

  if (!dev || dev.stale || (dev.ageSec != null && dev.ageSec > 120)) {
    let msg = `No fresh telemetry — power-cycle Opta; set MQTT broker ${hint.optaBrokerIp}:1883 on http://<opta-ip>/setup`;
    if (opts.mqttHubUsername) {
      msg += ' — Mosquitto password auth blocks Opta (firmware has no MQTT user/pass); set MOSQUITTO_ALLOW_ANONYMOUS=true on the gateway';
    }
    return msg;
  }

  if (fw && semverCompare(fw, '2.3.18') < 0) {
    return `Firmware ${fw} — upload MooreviewOptaMqttSt v2.3.18+ via Arduino IDE (Parc deploy does not flash firmware)`;
  }
  if (fw && semverCompare(fw, '2.3.41') < 0) {
    return `Telemetry OK but MQTT commands timeout on ${fw} — reflash MooreviewOptaMqttSt v2.3.41+; Serial should show "MQTT subscribed cmd+config"`;
  }
  if (fw) {
    return `Telemetry OK but MQTT commands timeout on ${fw} — Serial: look for "MQTT subscribed cmd+config" (not "subscribe FAILED"); verify /setup broker ${hint.optaBrokerIp}:1883; put_program blocks other cmds until done`;
  }
  return `MQTT commands timeout — reflash MooreviewOptaMqttSt v2.3.41+; set broker ${hint.optaBrokerIp}:1883 on Opta /setup`;
}

function cmdTimeoutMessage({ deviceId, op, dev, hubBrokerUrl, registry }) {
  const topic = `mooreview/v1/${deviceId}/cmd`;
  const detail = cmdFailureHint(dev, { hubBrokerUrl, deviceId, registry });
  return `MQTT command timeout (${op}) on ${topic} — ${detail}`;
}

/**
 * Fail fast before MQTT cmd publish — broker mismatch, id mismatch, or stale telemetry.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function parcCmdPreflight(dev, opts = {}) {
  const {
    hubBrokerUrl,
    deviceId,
    registry,
    ateccSerial,
    mqttHubUsername,
    allowStale,
    op,
  } = opts;
  if (deviceId) {
    const idMismatch = deviceIdMismatchHint(deviceId, registry, { ateccSerial });
    if (idMismatch) return { ok: false, error: idMismatch };
  }
  const mismatch = brokerMismatchMessage(dev, hubBrokerUrl);
  if (mismatch) return { ok: false, error: mismatch };
  if (!dev) {
    const hint = optaBrokerHint();
    const id = deviceId || 'device';
    let msg = `No telemetry from ${id} — power Opta; set MQTT broker ${hint.optaBrokerIp}:1883 on http://<opta-ip>/setup`;
    if (mqttHubUsername) {
      msg += ' — Mosquitto password auth blocks Opta (firmware has no MQTT user/pass); set MOSQUITTO_ALLOW_ANONYMOUS=true on the gateway';
    }
    return { ok: false, error: msg };
  }
  const staleOk = allowStale === true || parcCmdAllowsStale(op, dev);
  if (!staleOk && !isFreshForCmdHint(dev)) {
    return {
      ok: false,
      error: cmdFailureHint(dev, {
        hubBrokerUrl,
        deviceId,
        registry,
        mqttHubUsername,
        ateccSerial,
      }),
    };
  }
  return { ok: true };
}

module.exports = {
  cmdFailureHint,
  cmdTimeoutMessage,
  brokerMismatchMessage,
  deviceIdMismatchHint,
  parseBrokerHost,
  parcCmdPreflight,
  parcCmdAllowsStale,
  isFreshForCmdHint,
  PARC_CMD_OPS_ALLOW_STALE,
};
