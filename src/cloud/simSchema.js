'use strict';

const crypto = require('crypto');
const { normalizeTenantId } = require('../parc/cloudMqttTopics');
const { normalizeDeviceId } = require('../parc/mqttProtocol');

const SIM_TYPES = new Set(['opta', 'modbus', 'mixed', 'jxct_soil', 'pool_chemistry']);
const SIM_STATUSES = new Set(['stopped', 'starting', 'running', 'error']);

function newSimId() {
  return `sim_${crypto.randomBytes(8).toString('hex')}`;
}

function defaultDeviceId(type = 'opta', config = {}) {
  const suffix = crypto.randomBytes(4).toString('hex');
  if (type === 'jxct_soil') {
    return Number(config.sensorCount) === 1 ? 'dragino_jxct_01' : 'dragino_jxct_x4';
  }
  if (type === 'pool_chemistry') return 'dragino_pool_chem';
  if (type === 'modbus') return `sim_modbus_${suffix}`;
  if (type === 'mixed') return `sim_mixed_${suffix}`;
  return `sim_opta_${suffix}`;
}

function defaultConfig(type = 'opta') {
  const base = {
    intervalMs: 2000,
    topicPrefix: 'mooreview/v1',
    brokerUrl: '',
  };
  if (type === 'modbus') {
    return { ...base, registers: [{ address: 40001, type: 'holding', value: 0 }] };
  }
  if (type === 'mixed') {
    return {
      ...base,
      optaTags: true,
      modbusRegisters: [{ address: 40001, type: 'holding', value: 0 }],
    };
  }
  if (type === 'jxct_soil') {
    return {
      ...base,
      sensorCount: 4,
      modbusPreset: 'jxct_npk_jxbs3001_dragino_x4',
    };
  }
  if (type === 'pool_chemistry') {
    return {
      ...base,
      modbusPreset: 'dfrobot_pool_chemistry_dragino',
    };
  }
  return base;
}

function normalizeConfig(input, type = 'opta') {
  const base = defaultConfig(type);
  if (!input || typeof input !== 'object') return base;
  const intervalMs = Number(input.intervalMs ?? base.intervalMs);
  const out = {
    ...base,
    ...input,
    intervalMs: Number.isFinite(intervalMs) && intervalMs >= 200 ? intervalMs : base.intervalMs,
    topicPrefix: String(input.topicPrefix || base.topicPrefix).trim().replace(/\/+$/, '') || base.topicPrefix,
    brokerUrl: String(input.brokerUrl || '').trim(),
  };
  if (type === 'jxct_soil') {
    const sensorCount = Math.max(1, Math.min(4, Math.trunc(Number(input.sensorCount ?? base.sensorCount) || 4)));
    out.sensorCount = sensorCount;
    out.modbusPreset = input.modbusPreset || (sensorCount === 1
      ? 'jxct_npk_jxbs3001_dragino'
      : 'jxct_npk_jxbs3001_dragino_x4');
  }
  if (type === 'pool_chemistry') {
    out.modbusPreset = input.modbusPreset || base.modbusPreset || 'dfrobot_pool_chemistry_dragino';
  }
  return out;
}

function normalizeSimInput(input, prev = null) {
  if (!input || typeof input !== 'object') {
    throw Object.assign(new Error('sim body required'), { status: 400 });
  }
  const type = String(input.type ?? prev?.type ?? 'opta').trim().toLowerCase();
  if (!SIM_TYPES.has(type)) {
    throw Object.assign(new Error('type must be opta, modbus, mixed, jxct_soil, or pool_chemistry'), { status: 400 });
  }
  const name = String(input.name ?? prev?.name ?? '').trim();
  if (!name) {
    throw Object.assign(new Error('name required'), { status: 400 });
  }
  const tenantId = normalizeTenantId(input.tenantId ?? prev?.tenantId ?? 'demo-tenant');
  const config = normalizeConfig(input.config ?? prev?.config, type);
  const mqttDeviceId = normalizeDeviceId(
    input.mqttDeviceId ?? prev?.mqttDeviceId ?? defaultDeviceId(type, config),
  );
  const status = prev?.status && SIM_STATUSES.has(prev.status) ? prev.status : 'stopped';
  const now = new Date().toISOString();
  return {
    id: prev?.id || newSimId(),
    name: name.slice(0, 128),
    tenantId,
    type,
    status: SIM_STATUSES.has(input.status) ? input.status : status,
    mqttDeviceId,
    config: config,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
    lastStartedAt: prev?.lastStartedAt || null,
    lastStoppedAt: prev?.lastStoppedAt || null,
    lastError: input.lastError != null ? String(input.lastError).slice(0, 500) : (prev?.lastError || null),
  };
}

function summarizeSim(sim) {
  if (!sim) return null;
  return {
    id: sim.id,
    name: sim.name,
    tenantId: sim.tenantId,
    type: sim.type,
    status: sim.status,
    mqttDeviceId: sim.mqttDeviceId,
    config: sim.config,
    createdAt: sim.createdAt,
    updatedAt: sim.updatedAt,
    lastStartedAt: sim.lastStartedAt,
    lastStoppedAt: sim.lastStoppedAt,
    lastError: sim.lastError,
  };
}

module.exports = {
  SIM_TYPES,
  SIM_STATUSES,
  newSimId,
  defaultDeviceId,
  defaultConfig,
  normalizeConfig,
  normalizeSimInput,
  summarizeSim,
};
