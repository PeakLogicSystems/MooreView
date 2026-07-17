'use strict';

/** Drop connection fields that do not apply to the driver type (e.g. stray COM on API drivers). */
function sanitizeDriverConfig(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const d = { ...raw };
  const t = String(d.type || 'mock');

  const keep = new Set(['id', 'type', 'enabled']);

  switch (t) {
    case 'modbus_rtu':
    case 'vgreen_epc':
      ['serialPort', 'baud', 'slaveId', 'parity', 'stopBits', 'timeoutMs'].forEach((k) => keep.add(k));
      break;
    case 'modbus_tcp':
      ['host', 'port', 'slaveId', 'timeoutMs'].forEach((k) => keep.add(k));
      break;
    case 'modbus_bridge':
      ['serialPort', 'baud', 'listenPort', 'rtu', 'timeoutMs'].forEach((k) => keep.add(k));
      break;
    case 'serial':
      ['port', 'baud', 'profile', 'timeoutMs'].forEach((k) => keep.add(k));
      break;
    case 'mqtt':
      ['brokerUrl', 'broker', 'clientId', 'subscriptions', 'timeoutMs'].forEach((k) => keep.add(k));
      break;
    case 'https':
      ['baseUrl', 'url', 'pollIntervalMs', 'bearerToken', 'timeoutMs'].forEach((k) => keep.add(k));
      break;
    case 'nextcentury':
      ['email', 'password', 'reportId', 'pollIntervalMs', 'propertyIds', 'propertyDelayMs', 'autoSyncTags', 'timeoutMs'].forEach((k) => keep.add(k));
      break;
    case 'opta_remote':
      ['host', 'port', 'scanMs', 'bearerToken', 'deviceId', 'timeoutMs'].forEach((k) => keep.add(k));
      break;
    case 'mqtt_parc':
      ['deviceId', 'scanMs', 'reportIntervalSec', 'timeoutMs'].forEach((k) => keep.add(k));
      break;
    case 'hal':
      ['backend', 'pluginPath', 'halConfig', 'timeoutMs'].forEach((k) => keep.add(k));
      break;
    case 'native_so':
      ['library', 'timeoutMs'].forEach((k) => keep.add(k));
      break;
  }

  const out = {};
  for (const k of keep) {
    if (d[k] !== undefined) out[k] = d[k];
  }
  if (out.enabled === undefined) out.enabled = d.enabled !== false;
  return out;
}

function driverUsesSerialPort(type) {
  return type === 'modbus_rtu' || type === 'vgreen_epc' || type === 'modbus_bridge' || type === 'serial';
}

module.exports = { sanitizeDriverConfig, driverUsesSerialPort };
