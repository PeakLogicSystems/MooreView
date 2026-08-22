'use strict';

const { buildTelemetryReport: buildLiftTelemetryReport } = require('../atu-fleet/telemetry-fixtures');
const { LIFT_STATIONS, PLANT, stationTypeMeta } = require('./fleet-data');

/** Minimal MLE plant telemetry for cloud fleet map + PLANT_ALM rollup. */
const PLANT_TAGS = [
  { id: 'PLANT_ALM', type: 'BOOL', role: 'memory', value: false, quality: 'GOOD' },
  { id: 'T1_ALM', type: 'BOOL', role: 'memory', value: false, quality: 'GOOD' },
  { id: 'T2_ALM', type: 'BOOL', role: 'memory', value: false, quality: 'GOOD' },
  { id: 'T1_LVL', type: 'REAL', role: 'memory', value: 62.5, quality: 'GOOD' },
  { id: 'T2_LVL', type: 'REAL', role: 'memory', value: 58.2, quality: 'GOOD' },
  { id: 'T1_AER_DO', type: 'REAL', role: 'memory', value: 2.4, quality: 'GOOD' },
  { id: 'T2_AER_DO', type: 'REAL', role: 'memory', value: 2.1, quality: 'GOOD' },
];

function liftDevices() {
  return LIFT_STATIONS.map((s) => ({
    deviceId: s.deviceId,
    name: s.name,
    stationType: s.stationType,
    alarmTag: stationTypeMeta(s.stationType).alarmTag,
    levelTag: stationTypeMeta(s.stationType).levelTag,
  }));
}

function plantDevice() {
  return {
    deviceId: PLANT.gatewayId,
    name: PLANT.name,
    stationType: 'mle_plant',
    alarmTag: 'PLANT_ALM',
  };
}

function allFleetDevices() {
  return [...liftDevices(), plantDevice()];
}

function buildPlantTelemetryReport(device, opts = {}) {
  const tags = PLANT_TAGS.map((t) => ({ ...t }));
  const forceAlarm = opts.alarmDeviceId === device.deviceId;
  if (forceAlarm) {
    for (const t of tags) {
      if (t.id === 'PLANT_ALM' || t.id === 'T1_ALM') t.value = true;
    }
  }
  if (opts.scenario === 'high_level') {
    for (const t of tags) {
      if (t.id === 'T1_LVL' || t.id === 'T2_LVL') t.value = 88;
    }
  }
  return {
    deviceId: device.deviceId,
    name: device.name,
    platform: 'iot-link',
    reportIntervalSec: 1,
    runtime: {
      running: true,
      firmware: 'mooreview-iot-link',
      deviceMode: 'cloudRemote',
    },
    tags,
  };
}

function buildTelemetryReport(device, opts = {}) {
  if (device.stationType === 'mle_plant') {
    return buildPlantTelemetryReport(device, opts);
  }
  const report = buildLiftTelemetryReport(device, opts);
  const meta = stationTypeMeta(device.stationType);
  if (opts.scenario === 'high_level' && meta.levelTag) {
    for (const t of report.tags) {
      if (t.id === meta.levelTag && t.type === 'REAL') t.value = 92;
    }
  }
  return report;
}

module.exports = {
  liftDevices,
  plantDevice,
  allFleetDevices,
  buildTelemetryReport,
  buildPlantTelemetryReport,
};
