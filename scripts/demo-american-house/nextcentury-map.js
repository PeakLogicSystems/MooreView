'use strict';

/**
 * Next Century device IDs for the American house demo (Ace Septic property 39990).
 * Update deviceId values here if your portal uses different IDs.
 */
const NC_DRIVER_ID = 'nextcentury1';

const DEVICES = {
  /** Unit 2 toilet — client / master suite bath */
  clientRoomToilet: 'FA0032A8',
  /** Main bathroom toilet — common hall bath */
  commonBathToilet: 'FA003195',
  /** Site integrated electric meter (kWh cumulative totalUsage) */
  electricMeter: '11F01BBC',
};

/** Project semantic tags wired directly to Next Century poll fields. */
const SEMANTIC_MAP = [
  { tagId: 'RM101_TOILET_LEAK', deviceId: DEVICES.clientRoomToilet, field: 'leakActive' },
  { tagId: 'COMM_BATH_TOILET_LEAK', deviceId: DEVICES.commonBathToilet, field: 'leakActive' },
  { tagId: 'MECH_METER_KWH', deviceId: DEVICES.electricMeter, field: 'totalUsage' },
  { tagId: 'MECH_METER_INTERVAL_KWH', deviceId: DEVICES.electricMeter, field: 'currentReading' },
];

function applySemanticMap(tags) {
  const byId = new Map(tags.map((t) => [t.id, t]));
  for (const m of SEMANTIC_MAP) {
    const t = byId.get(m.tagId);
    if (!t) continue;
    t.driverId = NC_DRIVER_ID;
    t.driverAddress = { deviceId: m.deviceId, field: m.field };
  }
  return tags;
}

/** Mirror NC_* tags for diagnostics (subset matching SEMANTIC_MAP devices). */
function buildNcMirrorTags() {
  const rows = [
    { suffix: 'LEAK', type: 'BOOL', field: 'leakActive', devices: [DEVICES.clientRoomToilet, DEVICES.commonBathToilet] },
    { suffix: 'USAGE', type: 'REAL', field: 'totalUsage', devices: [DEVICES.electricMeter] },
    { suffix: 'TEMP', type: 'REAL', field: 'temperature', devices: [DEVICES.clientRoomToilet, DEVICES.commonBathToilet, DEVICES.electricMeter] },
  ];
  const tags = [{
    id: 'NC_STATUS_DEVICES',
    label: 'NC device count',
    type: 'INT',
    role: 'input',
    value: 0,
    driverId: NC_DRIVER_ID,
    driverAddress: { deviceId: '_meta', field: '_deviceCount' },
  }];
  for (const row of rows) {
    for (const deviceId of row.devices) {
      tags.push({
        id: `NC_${deviceId}_${row.suffix}`,
        label: `NC ${deviceId} ${row.suffix.toLowerCase()}`,
        type: row.type,
        role: 'input',
        value: row.type === 'BOOL' ? false : 0,
        driverId: NC_DRIVER_ID,
        driverAddress: { deviceId, field: row.field },
        ncAuto: true,
      });
    }
  }
  return tags;
}

module.exports = {
  NC_DRIVER_ID,
  DEVICES,
  SEMANTIC_MAP,
  applySemanticMap,
  buildNcMirrorTags,
};
