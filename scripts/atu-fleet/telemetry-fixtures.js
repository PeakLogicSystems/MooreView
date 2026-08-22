'use strict';

const fs = require('fs');
const path = require('path');
const { stationTypeMeta } = require('./fleet-data');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_DIR = path.join(ROOT, 'st', 'fixtures');

/** Tag fixture per station type (scalar telemetry for PC eval). */
const FIXTURE_BY_TYPE = {
  single_atu: 'tags.single_atu.json',
  dual_atu: 'tags.dual_atu.json',
  quad_atu: 'tags.quad_atu.json',
  simplex: 'tags.lift_simplex.json',
  dual_duplex: 'tags.duplex_lift_station.json',
  triplex: 'tags.opta_triplex.json',
};

const fixtureCache = new Map();

function loadFixture(stationType) {
  const file = FIXTURE_BY_TYPE[stationType];
  if (!file) throw new Error(`No telemetry fixture for station type: ${stationType}`);
  if (fixtureCache.has(file)) return fixtureCache.get(file);
  const full = path.join(FIXTURE_DIR, file);
  const rows = JSON.parse(fs.readFileSync(full, 'utf8'));
  fixtureCache.set(file, rows);
  return rows;
}

/** Parc telemetry tags[] — skip ALT function blocks and other non-scalar rows. */
function scalarTagsFromFixture(stationType) {
  return loadFixture(stationType)
    .filter((t) => t.id && !['ALT', 'PID', 'AVG', 'TIMER', 'COUNTER'].includes(String(t.type || '').toUpperCase()))
    .map((t) => ({
      id: t.id,
      type: String(t.type || 'BOOL').toUpperCase(),
      role: t.role || 'memory',
      value: t.value ?? (String(t.type).toUpperCase() === 'BOOL' ? false : 0),
      quality: 'GOOD',
    }));
}

function buildTelemetryReport(device, opts = {}) {
  const meta = stationTypeMeta(device.stationType);
  const tags = scalarTagsFromFixture(device.stationType).map((t) => ({ ...t }));

  const alarmTags = meta.alarmTags || [meta.alarmTag];
  const forceAlarm = opts.alarmDeviceId === device.deviceId;
  for (const t of tags) {
    if (forceAlarm && alarmTags.includes(t.id)) t.value = true;
    if (opts.scenario === 'high_level' && /^LVL_HIGH/.test(t.id)) t.value = true;
    if (opts.scenario === 'pump_run' && /MOTOR\d+_RUN/.test(t.id)) t.value = true;
    if (opts.scenario === 'tpo_on' && /^TPO\d+_OUT$/.test(t.id)) t.value = true;
  }

  return {
    deviceId: device.deviceId,
    name: device.name,
    platform: 'arduino-opta',
    reportIntervalSec: 0.2,
    runtime: {
      running: true,
      firmware: 'mooreview-opta-mqtt-st',
      deviceMode: 'standalone',
    },
    tags,
  };
}

module.exports = {
  FIXTURE_BY_TYPE,
  scalarTagsFromFixture,
  buildTelemetryReport,
};
