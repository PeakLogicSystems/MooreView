'use strict';

const { jxctSoil7in1Tags, dfrobotPoolChemistryDraginoTags } = require('../devices/tagBuilders');

/** Build tenant-scoped Parc telemetry payloads for cloud sim runners. */

function round1(n) {
  return Math.round(n * 10) / 10;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function buildOptaTags(tick) {
  const phase = tick / 10;
  const sine = Math.sin(phase);
  return [
    { id: 'I1', type: 'BOOL', role: 'input', value: tick % 2 === 0, quality: 'GOOD' },
    { id: 'I2', type: 'BOOL', role: 'input', value: tick % 4 < 2, quality: 'GOOD' },
    { id: 'DI1', type: 'BOOL', role: 'input', value: true, quality: 'GOOD' },
    { id: 'DI2', type: 'BOOL', role: 'input', value: tick % 6 >= 3, quality: 'GOOD' },
    { id: 'R1', type: 'BOOL', role: 'output', value: tick % 3 === 0, quality: 'GOOD' },
    { id: 'mA_AI3', type: 'REAL', role: 'input', value: 4 + (sine + 1) * 8, quality: 'GOOD' },
    { id: 'mA_AI4', type: 'REAL', role: 'input', value: 4 + (Math.cos(phase) + 1) * 8, quality: 'GOOD' },
    { id: 'scaled_AI3', type: 'REAL', role: 'input', value: Math.round((sine + 1) * 50), quality: 'GOOD' },
  ];
}

function buildModbusTags(tick, config = {}) {
  const registers = Array.isArray(config.registers) ? config.registers : [{ address: 40001, value: 0 }];
  return registers.map((reg, i) => ({
    id: `HR${reg.address ?? (40001 + i)}`,
    type: 'INT',
    role: 'input',
    value: Math.round(Number(reg.value ?? 0) + tick + i * 3),
    quality: 'GOOD',
  }));
}

function jxctSimValue(tagId, tick, sensorIndex = 0) {
  const phase = tick / 20 + sensorIndex * 1.7;
  const s = Math.sin(phase);
  const c = Math.cos(phase * 0.7);
  if (tagId.endsWith('SOIL_PH')) return round2(6.5 + s * 0.4);
  if (tagId.endsWith('SOIL_MOIST_PCT')) return round1(38 + s * 12);
  if (tagId.endsWith('SOIL_TEMP_C')) return round1(22 + c * 6);
  if (tagId.endsWith('SOIL_EC_US_CM')) return Math.round(650 + s * 350);
  if (tagId.endsWith('N_MG_KG')) return Math.round(95 + sensorIndex * 8 + s * 15);
  if (tagId.endsWith('P_MG_KG')) return Math.round(42 + sensorIndex * 3 + c * 8);
  if (tagId.endsWith('K_MG_KG')) return Math.round(160 + sensorIndex * 5 + s * 20);
  return 0;
}

function buildJxctSoilTags(tick, config = {}) {
  const sensorCount = Math.max(1, Math.min(4, Number(config.sensorCount) || 4));
  const slaves = Array.from({ length: sensorCount }, (_, i) => i + 1);
  const idPrefix = sensorCount === 1 ? '' : 'S{n}_';
  const defs = jxctSoil7in1Tags('_sim', { slaves, idPrefix });
  return defs.map((tag, idx) => ({
    id: tag.id,
    type: tag.type,
    role: tag.role || 'input',
    value: jxctSimValue(tag.id, tick, Math.floor(idx / 7)),
    quality: 'GOOD',
  }));
}

function poolSimValue(tagId, tick) {
  const phase = tick / 15;
  const s = Math.sin(phase);
  const c = Math.cos(phase * 0.5);
  switch (tagId) {
    case 'PH_PV': return round2(7.4 + s * 0.15);
    case 'CL_PV': return round2(1.8 + s * 0.6);
    case 'WATER_TEMP_C': return round1(28 + c * 2.5);
    case 'NH3_MG_L': return round2(Math.max(0, 0.08 + Math.abs(c) * 0.12));
    default: return 0;
  }
}

function buildPoolChemistryTags(tick) {
  const defs = dfrobotPoolChemistryDraginoTags('_sim', { phSlaveId: 1, clSlaveId: 2 });
  return defs.map((tag) => ({
    id: tag.id,
    type: tag.type,
    role: tag.role || 'input',
    value: poolSimValue(tag.id, tick),
    quality: 'GOOD',
  }));
}

function draginoSimMeta(sim) {
  const preset = sim.config?.modbusPreset
    || (sim.type === 'jxct_soil'
      ? (Number(sim.config?.sensorCount) === 1
        ? 'jxct_npk_jxbs3001_dragino'
        : 'jxct_npk_jxbs3001_dragino_x4')
      : sim.type === 'pool_chemistry'
        ? 'dfrobot_pool_chemistry_dragino'
        : null);
  return preset ? { modbusPreset: preset, gatewayRole: 'cellular_rs485' } : {};
}

function buildSimTelemetry(sim, tick = 0) {
  const deviceId = sim.mqttDeviceId;
  const intervalMs = Math.max(200, Number(sim.config?.intervalMs) || 2000);
  const draginoMeta = draginoSimMeta(sim);
  const base = {
    deviceId,
    name: sim.name,
    platform: sim.type === 'jxct_soil' || sim.type === 'pool_chemistry'
      ? 'dragino-rs485-nb'
      : sim.type === 'modbus'
        ? 'modbus-slave-sim'
        : sim.type === 'mixed'
          ? 'mixed-sim'
          : 'arduino-opta',
    reportIntervalSec: Math.max(1, Math.round(intervalMs / 1000)),
    runtime: { running: true, firmware: 'cloud-sim', deviceMode: 'simulated' },
    driverHealth: [{ id: 'mqtt', type: 'mqtt', connected: true, message: 'OK' }],
    meta: {
      source: 'mooreview-cloud-sim',
      simId: sim.id,
      tenantId: sim.tenantId,
      simType: sim.type,
      ...draginoMeta,
    },
    ...draginoMeta,
  };

  if (sim.type === 'jxct_soil') {
    return { ...base, tags: buildJxctSoilTags(tick, sim.config) };
  }
  if (sim.type === 'pool_chemistry') {
    return { ...base, tags: buildPoolChemistryTags(tick) };
  }
  if (sim.type === 'modbus') {
    return { ...base, tags: buildModbusTags(tick, sim.config) };
  }
  if (sim.type === 'mixed') {
    return {
      ...base,
      platform: 'mixed-sim',
      tags: [...buildOptaTags(tick), ...buildModbusTags(tick, sim.config)],
    };
  }
  return { ...base, tags: buildOptaTags(tick) };
}

module.exports = {
  buildOptaTags,
  buildModbusTags,
  buildJxctSoilTags,
  buildPoolChemistryTags,
  buildSimTelemetry,
  jxctSimValue,
  poolSimValue,
};
