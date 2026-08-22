'use strict';

const { POOL_HALOW_NODES } = require('./alf-halow-data');

/** Wire pool controller tags to HaLow Parc devices (replaces Opta mqtt_parc). */
const POOL_TAG_BINDINGS = [
  { tagId: 'PH_AI', deviceId: 'pool_sensor_01', parcTagId: 'PH_AI' },
  { tagId: 'ORP_AI', deviceId: 'pool_sensor_01', parcTagId: 'ORP_AI' },
  { tagId: 'COND_AI', deviceId: 'pool_sensor_01', parcTagId: 'COND_AI' },
  { tagId: 'WATER_TEMP_C', deviceId: 'pool_sensor_01', parcTagId: 'WATER_TEMP_C' },
  { tagId: 'POOL_FLOW_PULSE', deviceId: 'thalow_pool_deck', parcTagId: 'FLOW' },
  { tagId: 'POOL_FLOW_SW', deviceId: 'thalow_pool_deck', parcTagId: 'FLOW_SW' },
  { tagId: 'DOSE_BASE', deviceId: 'thalow_pool_deck', parcTagId: 'R1', role: 'output' },
  { tagId: 'DOSE_ACID', deviceId: 'thalow_pool_deck', parcTagId: 'R2', role: 'output' },
  { tagId: 'DOSE_CL', deviceId: 'thalow_pool_deck', parcTagId: 'R3', role: 'output' },
  { tagId: 'DOSE_SALT', deviceId: 'thalow_pool_deck', parcTagId: 'R4', role: 'output' },
];

function poolHalowDrivers() {
  return POOL_HALOW_NODES.map((n) => ({
    id: n.driverId,
    type: 'mqtt_parc',
    enabled: true,
    deviceId: n.deviceId,
    name: n.name,
    scanMs: 100,
    reportIntervalSec: n.deviceId === 'pool_sensor_01' ? 1 : 0.5,
    remoteExecution: false,
  }));
}

function applyPoolHalowBindings(tags, drivers) {
  const driverByDevice = new Map(drivers.map((d) => [d.deviceId, d.id]));
  const byId = new Map(tags.map((t) => [t.id, { ...t }]));
  for (const b of POOL_TAG_BINDINGS) {
    const t = byId.get(b.tagId);
    if (!t) continue;
    const driverId = driverByDevice.get(b.deviceId);
    if (!driverId) continue;
    t.driverId = driverId;
    t.driverAddress = { channel: b.parcTagId };
    if (b.role) t.role = b.role;
    t.readonly = b.role === 'output' ? false : true;
    byId.set(b.tagId, t);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function patchPoolDrivers(drivers) {
  return drivers
    .filter((d) => d.id !== 'opta_mqtt_st')
    .concat(poolHalowDrivers());
}

module.exports = {
  POOL_TAG_BINDINGS,
  poolHalowDrivers,
  applyPoolHalowBindings,
  patchPoolDrivers,
};
