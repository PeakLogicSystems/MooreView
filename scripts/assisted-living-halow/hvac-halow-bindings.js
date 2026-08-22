'use strict';

const { NEXCOMM_HVAC_NODES } = require('./alf-halow-data');

/**
 * ALF floor condenser tags → Nexcomm MCXN947 HVAC MCSA Parc fields.
 * Firmware publishes env.T1_C..T4_C and MCSA spectra; BOOL faults are derived
 * on-device (COMP_FLT/FAN_FLT) or via MooreVIEW MCSA analytics.
 */
function floorHvacBindings(floor) {
  const p = `FL${floor}`;
  const deviceId = `hvac_mcsa_fl${floor}`;
  return [
    {
      tagId: `${p}_COND_HI_TEMP`,
      deviceId,
      parcTagId: 'T1_C',
      scale: 1.8,
      offset: 32,
      note: 'Liquid line / discharge thermistor (°C → °F)',
    },
    {
      tagId: `${p}_COND_LO_TEMP`,
      deviceId,
      parcTagId: 'T2_C',
      scale: 1.8,
      offset: 32,
      note: 'Suction / ambient thermistor (°C → °F)',
    },
    {
      tagId: `${p}_COND_FAN_FLT`,
      deviceId,
      parcTagId: 'FAN_FLT',
      note: 'MCSA fan CT fault (ch 1)',
    },
    {
      tagId: `${p}_COND_COMP_FLT`,
      deviceId,
      parcTagId: 'COMP_FLT',
      note: 'MCSA compressor CT fault (ch 0)',
    },
  ];
}

const HVAC_COND_BINDINGS = [1, 2, 3].flatMap(floorHvacBindings);

function hvacHalowDrivers() {
  return NEXCOMM_HVAC_NODES.map((n) => ({
    id: n.driverId,
    type: 'mqtt_parc',
    enabled: true,
    deviceId: n.deviceId,
    name: n.name,
    scanMs: 100,
    reportIntervalSec: 1,
    remoteExecution: false,
    telemetryOnly: true,
  }));
}

function applyHvacHalowBindings(tags, drivers) {
  const driverByDevice = new Map(drivers.map((d) => [d.deviceId, d.id]));
  const byId = new Map(tags.map((t) => [t.id, { ...t }]));
  for (const b of HVAC_COND_BINDINGS) {
    const t = byId.get(b.tagId);
    if (!t) continue;
    const driverId = driverByDevice.get(b.deviceId);
    if (!driverId) continue;
    t.driverId = driverId;
    t.driverAddress = { channel: b.parcTagId };
    if (b.scale != null) t.scale = b.scale;
    if (b.offset != null) t.offset = b.offset;
    byId.set(b.tagId, t);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

module.exports = {
  floorHvacBindings,
  HVAC_COND_BINDINGS,
  hvacHalowDrivers,
  applyHvacHalowBindings,
};
