'use strict';

/**
 * ALF semantic tags → T-HaLow Parc device + on-device tag id.
 * Replaces nextcentury-map.js for HaLow phase 1.
 */

const SEMANTIC_MAP = [
  { tagId: 'RM101_AC_PAN_LEAK', deviceId: 'thalow_rm101_room', parcTagId: 'LEAK_PAN' },
  { tagId: 'RM101_TOILET_LEAK', deviceId: 'thalow_rm101_bath', parcTagId: 'FLOW_TOILET' },
  { tagId: 'RM102_TOILET_LEAK', deviceId: 'thalow_rm102_bath', parcTagId: 'FLOW_TOILET' },
  { tagId: 'RM102_AC_PAN_LEAK', deviceId: 'thalow_rm102_room', parcTagId: 'LEAK_PAN' },
  { tagId: 'COMM_GF_LOUNGE_R1_TOILET_LEAK', deviceId: 'thalow_comm_gf_rr1', parcTagId: 'FLOW_TOILET' },
  { tagId: 'KITCH_FREEZER_TEMP', deviceId: 'thalow_kitchen_01', parcTagId: 'TEMP_FRZ' },
  { tagId: 'KITCH_REEFER_TEMP', deviceId: 'thalow_kitchen_01', parcTagId: 'TEMP_REF' },
  { tagId: 'KITCH_SINK1_SINK_LEAK', deviceId: 'thalow_kitchen_sinks', parcTagId: 'LEAK1' },
  { tagId: 'KITCH_SINK2_SINK_LEAK', deviceId: 'thalow_kitchen_sinks', parcTagId: 'LEAK2' },
  { tagId: 'MECH_METER_KWH', deviceId: 'thalow_mech_01', parcTagId: 'FLOW_IN' },
];

const { HVAC_COND_BINDINGS } = require('./hvac-halow-bindings');

/** Pool chemistry rollup on main ALF UI (read from pool subsystem via cloud or mirrored tag). */
const POOL_ROLLUP_MAP = [
  { tagId: 'POOL_PH', deviceId: 'pool_sensor_01', parcTagId: 'PH_AI' },
  { tagId: 'POOL_ORP', deviceId: 'pool_sensor_01', parcTagId: 'ORP_AI' },
  { tagId: 'POOL_TEMP', deviceId: 'pool_sensor_01', parcTagId: 'WATER_TEMP_C' },
];

function driverIdForDevice(deviceId, drivers) {
  const d = drivers.find((x) => x.deviceId === deviceId);
  return d?.id || deviceId;
}

function applyHalowSemanticMap(tags, drivers = []) {
  const byId = new Map(tags.map((t) => [t.id, t]));
  const allMaps = [...SEMANTIC_MAP, ...POOL_ROLLUP_MAP, ...HVAC_COND_BINDINGS];
  for (const m of allMaps) {
    const t = byId.get(m.tagId);
    if (!t) continue;
    const driverId = driverIdForDevice(m.deviceId, drivers);
    t.driverId = driverId;
    t.driverAddress = { channel: m.parcTagId };
    if (m.scale != null) t.scale = m.scale;
    if (m.offset != null) t.offset = m.offset;
  }
  return tags;
}

module.exports = {
  SEMANTIC_MAP,
  POOL_ROLLUP_MAP,
  HVAC_COND_BINDINGS,
  applyHalowSemanticMap,
  driverIdForDevice,
};
