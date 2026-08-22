'use strict';

const { F1_OFFICE_NUM } = require('./facility-config');

/**
 * Next Century → assisted-living semantic tags.
 * Site fixtures (kitchen, mechanical) + per-room sensor map for full facility scale.
 */
const NC_DRIVER_ID = 'nextcentury1';

/** Live NC portal property IDs for commissioning demo (Ace Septic samples). */
const COMMISSIONING_PROPERTY_IDS = [39990, 40074];

/** Demo / commissioning devices on property 39990–40074 (Ace Septic samples). */
const DEVICES = {
  clientRoomToilet: 'FA0032A8',
  commonBathToilet: 'FA003195',
  kitchenSink1: 'FA0032CF',
  kitchenSink2: 'FA003682',
  freezerTransceiver: 'BC0077DF',
  reeferTransceiver: 'BC00776F',
  electricMeter: '11F01BBC',
  acPanLeak: 'FA003A8C',
  rm101AcPanLeak: 'FA003A90',
  rm101ToiletLeak: 'FA003190',
};

const SITE_SEMANTIC_MAP = [
  { tagId: 'RM101_AC_PAN_LEAK', deviceId: DEVICES.rm101AcPanLeak, field: 'leakActive' },
  { tagId: 'RM101_TOILET_LEAK', deviceId: DEVICES.rm101ToiletLeak, field: 'leakActive' },
  { tagId: 'RM102_TOILET_LEAK', deviceId: DEVICES.clientRoomToilet, field: 'leakActive' },
  { tagId: 'RM102_AC_PAN_LEAK', deviceId: DEVICES.acPanLeak, field: 'leakActive' },
  { tagId: 'COMM_GF_LOUNGE_R1_TOILET_LEAK', deviceId: DEVICES.commonBathToilet, field: 'leakActive' },
  { tagId: 'KITCH_FREEZER_TEMP', deviceId: DEVICES.freezerTransceiver, field: 'temperature' },
  { tagId: 'KITCH_REEFER_TEMP', deviceId: DEVICES.reeferTransceiver, field: 'temperature' },
  { tagId: 'KITCH_SINK1_SINK_LEAK', deviceId: DEVICES.kitchenSink1, field: 'leakActive' },
  { tagId: 'KITCH_SINK2_SINK_LEAK', deviceId: DEVICES.kitchenSink2, field: 'leakActive' },
  { tagId: 'MECH_METER_KWH', deviceId: DEVICES.electricMeter, field: 'totalUsage' },
  { tagId: 'MECH_METER_INTERVAL_KWH', deviceId: DEVICES.electricMeter, field: 'currentReading' },
];

/** Per-room NC sensor bindings (commissioning placeholders — replace deviceId after NC portal import). */
const ROOM_SENSOR_BINDINGS = [
  { suffix: 'TOILET_LEAK', field: 'leakActive', deviceSuffix: 'T' },
  { suffix: 'BATH_MID_LEAK', field: 'leakActive', deviceSuffix: 'B' },
  { suffix: 'AC_PAN_LEAK', field: 'leakActive', deviceSuffix: 'P' },
  { suffix: 'LIV_TEMP', field: 'temperature', deviceSuffix: 'LT' },
  { suffix: 'BED_TEMP', field: 'temperature', deviceSuffix: 'BT' },
];

function padRoom(n, width = 3) {
  return String(n).padStart(width, '0');
}

function roomTagPrefix(roomNum, width = 3) {
  return `RM${padRoom(roomNum, width)}`;
}

/** Synthetic NC device id for commissioning CSV (map to portal serial after install). */
function ncDeviceIdForRoom(roomNum, deviceSuffix, padWidth = 3) {
  return `ALF${padRoom(roomNum, padWidth)}${deviceSuffix}`;
}

function buildRoomSemanticMap(roomNums, padWidth = 3) {
  const rows = [];
  for (const roomNum of roomNums) {
    const p = roomTagPrefix(roomNum);
    for (const b of ROOM_SENSOR_BINDINGS) {
      rows.push({
        tagId: `${p}_${b.suffix}`,
        deviceId: ncDeviceIdForRoom(roomNum, b.deviceSuffix, padWidth),
        field: b.field,
      });
    }
  }
  return rows;
}

function buildSemanticMap(roomNums, { includeSiteFixtures = true, padWidth = 3 } = {}) {
  const site = includeSiteFixtures ? SITE_SEMANTIC_MAP : [];
  const byTag = new Map(site.map((m) => [m.tagId, m]));
  for (const m of buildRoomSemanticMap(roomNums, padWidth)) {
    if (!byTag.has(m.tagId)) byTag.set(m.tagId, m);
  }
  return [...byTag.values()];
}

function applySemanticMap(tags, semanticMap = SITE_SEMANTIC_MAP) {
  const byId = new Map(tags.map((t) => [t.id, t]));
  for (const m of semanticMap) {
    const t = byId.get(m.tagId);
    if (!t) continue;
    t.driverId = NC_DRIVER_ID;
    t.driverAddress = { deviceId: m.deviceId, field: m.field };
  }
  return tags;
}

module.exports = {
  NC_DRIVER_ID,
  COMMISSIONING_PROPERTY_IDS,
  DEVICES,
  SITE_SEMANTIC_MAP,
  SEMANTIC_MAP: SITE_SEMANTIC_MAP,
  ROOM_SENSOR_BINDINGS,
  buildRoomSemanticMap,
  buildSemanticMap,
  applySemanticMap,
  ncDeviceIdForRoom,
};
