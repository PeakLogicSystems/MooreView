'use strict';

const fs = require('fs');
const path = require('path');

function diTags(driverId, count = 8, prefix = 'DI', start = 0) {
  const tags = [];
  for (let i = 0; i < count; i++) {
    const n = `${prefix}${i + 1}`;
    tags.push({
      id: n,
      type: 'BOOL',
      role: 'input',
      value: false,
      driverId,
      driverAddress: { table: 'discrete', address: start + i },
    });
  }
  return tags;
}

function doTags(driverId, count = 8, prefix = 'Q', start = 0) {
  const tags = [];
  for (let i = 0; i < count; i++) {
    const n = `${prefix}${i + 1}`;
    tags.push({
      id: n,
      type: 'BOOL',
      role: 'output',
      value: false,
      driverId,
      driverAddress: { table: 'coil', address: start + i },
    });
  }
  return tags;
}

function holdingRegTags(driverId, count, startAddr = 0, idPrefix = 'H') {
  const tags = [];
  for (let i = 0; i < count; i++) {
    const n = count <= 8 ? `${idPrefix}${i + 1}` : `${idPrefix}${String(i + 1).padStart(2, '0')}`;
    tags.push({
      id: n,
      type: 'INT',
      role: 'memory',
      value: 0,
      wordWidth: 16,
      signed: false,
      driverId,
      driverAddress: { table: 'holding', address: startAddr + i },
    });
  }
  return tags;
}

function inputRegTags(driverId, count, startAddr, idPrefix, idSuffix = '') {
  const tags = [];
  for (let i = 0; i < count; i++) {
    const n = count <= 8
      ? `${idPrefix}${i + 1}${idSuffix}`
      : `${idPrefix}${String(i + 1).padStart(2, '0')}${idSuffix}`;
    tags.push({
      id: n,
      type: 'INT',
      role: 'input',
      value: 0,
      wordWidth: 16,
      signed: false,
      driverId,
      driverAddress: { table: 'input', address: startAddr + i },
    });
  }
  return tags;
}

/** Explicit VGreen EPC RS-485 tags (Century / SPECK BADU VS pumps). */
function explicitVgreenTags(driverId, list) {
  if (!Array.isArray(list)) return [];
  return list.map((spec) => {
    const type = spec.type || 'INT';
    const addr = { vgreen: spec.point || spec.vgreen };
    if (spec.slaveId != null) addr.slaveId = Number(spec.slaveId);
    return {
      id: spec.id,
      type,
      role: spec.role || (addr.vgreen === 'run' || addr.vgreen === 'rpm_cmd' ? 'output' : 'input'),
      value: spec.value ?? (type === 'BOOL' ? false : 0),
      wordWidth: spec.wordWidth ?? 16,
      signed: spec.signed !== false,
      scale: spec.scale ?? 1,
      offset: spec.offset ?? 0,
      driverId,
      driverAddress: addr,
      graphEnabled: spec.graphEnabled !== false && (type === 'INT' || type === 'REAL'),
      comment: spec.comment,
    };
  });
}

/** JXBS-3001-NPK-RS seven-in-one soil probe — FC03 holding registers. */
const JXCT_SOIL_7IN1_FIELDS = [
  {
    id: 'SOIL_PH',
    type: 'REAL',
    table: 'holding',
    address: 6,
    wordWidth: 16,
    signed: false,
    scale: 0.01,
    comment: 'Soil pH (HR 0x0006, register ×100)',
  },
  {
    id: 'SOIL_MOIST_PCT',
    type: 'REAL',
    table: 'holding',
    address: 18,
    wordWidth: 16,
    signed: false,
    scale: 0.1,
    comment: 'Soil moisture % (HR 0x0012, register ×10)',
  },
  {
    id: 'SOIL_TEMP_C',
    type: 'REAL',
    table: 'holding',
    address: 19,
    wordWidth: 16,
    signed: true,
    scale: 0.1,
    comment: 'Soil temperature °C (HR 0x0013, register ×10)',
  },
  {
    id: 'SOIL_EC_US_CM',
    type: 'INT',
    table: 'holding',
    address: 21,
    signed: false,
    scale: 1,
    comment: 'Soil conductivity µS/cm (HR 0x0015)',
  },
  {
    id: 'N_MG_KG',
    type: 'INT',
    table: 'holding',
    address: 30,
    signed: false,
    scale: 1,
    comment: 'Soil nitrogen mg/kg (HR 0x001E)',
  },
  {
    id: 'P_MG_KG',
    type: 'INT',
    table: 'holding',
    address: 31,
    signed: false,
    scale: 1,
    comment: 'Soil phosphorus mg/kg (HR 0x001F)',
  },
  {
    id: 'K_MG_KG',
    type: 'INT',
    table: 'holding',
    address: 32,
    signed: false,
    scale: 1,
    comment: 'Soil potassium mg/kg (HR 0x0020)',
  },
];

/**
 * JXCT JXBS-3001-NPK-RS tags for one or more Modbus slaves on the same RS485 bus.
 * @param {string} driverId
 * @param {{ slaves?: number[], idPrefix?: string, slaveId?: number }} opts
 *   slaves — Modbus unit IDs (default [1]); idPrefix — tag prefix with `{n}` = 1-based index
 */
function jxctSoil7in1Tags(driverId, opts = {}) {
  const slaves = Array.isArray(opts.slaves) && opts.slaves.length
    ? opts.slaves.map((s) => Number(s))
    : [Number(opts.slaveId ?? 1)];
  const prefixPattern = opts.idPrefix != null ? String(opts.idPrefix) : 'S{n}_';
  const specs = [];
  slaves.forEach((slaveId, idx) => {
    const prefix = prefixPattern.replace(/\{n\}/g, String(idx + 1));
    for (const field of JXCT_SOIL_7IN1_FIELDS) {
      specs.push({
        ...field,
        id: `${prefix}${field.id}`,
        role: 'input',
        slaveId,
        comment: `${field.comment} (Modbus slave ${slaveId})`,
      });
    }
  });
  return explicitModbusTags(driverId, specs);
}

/**
 * DFRobot SEN0711 (pH / ammonia / temp) + SEN0712 (free chlorine) — pool chemistry monitor.
 * Default tag ids align with Dragino / HMI (`PH_PV`, `CL_PV`).
 * Local IOT-LINK ST: set phTagId=PH_AI, clTagId=ORP_AI (ORP_* is already CL2 ppm).
 */
function dfrobotPoolChemistryDraginoTags(driverId, opts = {}) {
  const phSlave = Number(opts.phSlaveId ?? 1);
  const clSlave = Number(opts.clSlaveId ?? 2);
  const phTagId = opts.phTagId || 'PH_PV';
  const clTagId = opts.clTagId || 'CL_PV';
  return explicitModbusTags(driverId, [
    {
      id: 'NH3_MG_L',
      type: 'REAL',
      role: 'input',
      table: 'input',
      address: 0,
      slaveId: phSlave,
      wordWidth: 16,
      signed: false,
      scale: 0.01,
      comment: `Ammonia nitrogen mg/L — SEN0711 IR 0x0000 (slave ${phSlave})`,
    },
    {
      id: phTagId,
      type: 'REAL',
      role: 'input',
      table: 'input',
      address: 1,
      slaveId: phSlave,
      wordWidth: 16,
      signed: false,
      scale: 0.01,
      comment: `Pool pH — SEN0711 IR 0x0001 (slave ${phSlave})`,
    },
    {
      id: 'WATER_TEMP_C',
      type: 'REAL',
      role: 'input',
      table: 'input',
      address: 2,
      slaveId: phSlave,
      wordWidth: 16,
      signed: true,
      scale: 0.1,
      comment: `Water temperature °C — SEN0711 IR 0x0002 (slave ${phSlave})`,
    },
    {
      id: clTagId,
      type: 'REAL',
      role: 'input',
      table: 'input',
      address: 0,
      slaveId: clSlave,
      wordWidth: 16,
      signed: false,
      scale: 0.01,
      comment: `Free chlorine mg/L — SEN0712 IR 0x0000 (slave ${clSlave})`,
    },
  ]);
}

/** Explicit Modbus tags from template JSON (non-uniform addresses / REAL float32). */
function explicitModbusTags(driverId, list) {
  if (!Array.isArray(list)) return [];
  return list.map((spec) => {
    const type = spec.type || 'INT';
    if (spec.driverAddress && typeof spec.driverAddress === 'object') {
      return {
        id: spec.id,
        type,
        role: spec.role || 'input',
        value: spec.value ?? (type === 'BOOL' ? false : 0),
        wordWidth: spec.wordWidth ?? (type === 'REAL' ? 32 : 16),
        signed: spec.signed !== false,
        scale: spec.scale ?? 1,
        offset: spec.offset ?? 0,
        driverId,
        driverAddress: { ...spec.driverAddress },
        graphEnabled: spec.graphEnabled !== false && (type === 'INT' || type === 'REAL' || type === 'BOOL'),
        comment: spec.comment,
      };
    }
    const table = spec.table || 'input';
    const wordWidth = spec.wordWidth ?? (type === 'REAL' ? 32 : 16);
    const addr = {
      table,
      address: Number(spec.address) || 0,
    };
    if (spec.slaveId != null) addr.slaveId = Number(spec.slaveId);
    if (spec.encoding) addr.encoding = spec.encoding;
    if (spec.byteOrder) addr.byteOrder = spec.byteOrder;
    if (wordWidth > 16) addr.wordWidth = wordWidth;
    return {
      id: spec.id,
      type,
      role: spec.role || (table === 'holding' ? 'memory' : 'input'),
      value: spec.value ?? (type === 'BOOL' ? false : 0),
      wordWidth,
      signed: spec.signed !== false,
      scale: spec.scale ?? 1,
      offset: spec.offset ?? 0,
      driverId,
      driverAddress: addr,
      graphEnabled: spec.graphEnabled !== false && (type === 'INT' || type === 'REAL'),
    };
  });
}

/**
 * Opta Parc-equivalent Modbus RTU slave map for Dragino RS485 gateway polling.
 * Tag names match MQTT Parc (`I1`–`I8`, `R1`–`R4`, `I1_RAW`–`I8_RAW`, `mA_AI3`–`mA_AI6`,
 * `scaled_AI3`–`scaled_AI6`) plus optional MCSA-lite pseudo-AI scalars.
 *
 * Register map (slave ID 2, 9600 8N1 — extend Opta RTU slave sketch):
 *   FC02 DI 0–7   → I1–I8
 *   FC01 CO 0–3   → R1–R4
 *   FC04 IR 0–7   → I1_RAW–I8_RAW
 *   FC04 IR 8–11  → mA_AI3–6 (centi-mA, scale 0.01)
 *   FC04 IR 12–15 → scaled_AI3–6 (deci-units, scale 0.1)
 *   FC04 IR 16–21 → MCSA_CH1_AMPS–CH6 (centi-A, scale 0.01)
 *   FC04 IR 22–23 → PDM_P1_HEALTH, PDM_P2_HEALTH (0–100, scale 0.01)
 *   FC03 HR 0–7   → H1–H8
 */
function optaParcModbusDraginoTags(driverId, options = {}) {
  const includePseudoAi = options.includePseudoAi !== false;
  const includeHolding = options.includeHolding !== false;
  const tags = [];

  for (let i = 0; i < 8; i++) {
    tags.push({
      id: `I${i + 1}`,
      type: 'BOOL',
      role: 'input',
      value: false,
      driverId,
      driverAddress: { table: 'discrete', address: i },
    });
  }
  for (let i = 0; i < 4; i++) {
    tags.push({
      id: `R${i + 1}`,
      type: 'BOOL',
      role: 'output',
      value: false,
      driverId,
      driverAddress: { table: 'coil', address: i },
    });
  }
  for (let i = 0; i < 8; i++) {
    tags.push({
      id: `I${i + 1}_RAW`,
      type: 'INT',
      role: 'input',
      value: 0,
      wordWidth: 16,
      signed: false,
      driverId,
      driverAddress: { table: 'input', address: i },
      graphEnabled: true,
      comment: 'Opta ADC raw 0–1023 (UINT16 in Modbus IR)',
    });
  }
  for (let i = 0; i < 4; i++) {
    const ch = i + 3;
    tags.push({
      id: `mA_AI${ch}`,
      type: 'REAL',
      role: 'input',
      value: 0,
      wordWidth: 16,
      signed: false,
      scale: 0.01,
      driverId,
      driverAddress: { table: 'input', address: 8 + i },
      graphEnabled: true,
      comment: '4–20 mA input (centi-mA in IR)',
    });
  }
  for (let i = 0; i < 4; i++) {
    const ch = i + 3;
    tags.push({
      id: `scaled_AI${ch}`,
      type: 'REAL',
      role: 'input',
      value: 0,
      wordWidth: 16,
      signed: true,
      scale: 0.1,
      driverId,
      driverAddress: { table: 'input', address: 12 + i },
      graphEnabled: true,
      comment: 'Engineering units from mA_AI (deci-units in IR)',
    });
  }
  if (includePseudoAi) {
    for (let i = 0; i < 6; i++) {
      tags.push({
        id: `MCSA_CH${i + 1}_AMPS`,
        type: 'REAL',
        role: 'input',
        value: 0,
        wordWidth: 16,
        signed: false,
        scale: 0.01,
        driverId,
        driverAddress: { table: 'input', address: 16 + i },
        graphEnabled: true,
        comment: 'MCSA-lite CT amps EMA (centi-A)',
      });
    }
    for (let p = 1; p <= 2; p++) {
      tags.push({
        id: `PDM_P${p}_HEALTH`,
        type: 'REAL',
        role: 'input',
        value: 0,
        wordWidth: 16,
        signed: false,
        scale: 0.01,
        driverId,
        driverAddress: { table: 'input', address: 21 + p },
        graphEnabled: true,
        comment: 'Pump health score 0–100 (centi-units)',
      });
    }
  }
  if (includeHolding) {
    tags.push(...holdingRegTags(driverId, 8, 0, 'H'));
  }
  return tags;
}

/**
 * MQTT Parc + EZ Meter on Opta RS485 fieldbus (DDS_* from device telemetry, PQ/THD memory tags).
 */
function optaParcEzmeterTags(driverId, options = {}) {
  const { pqThresholds, buildEzMeterPqDerivedTagDefs } = require('../facilities/ezmeterPq');
  const { buildEzMeterSemanticMirrorTagDefs } = require('./applyDerivedPreset');
  const th = pqThresholds(options.assistedLiving || options);
  const tags = [];
  const ddsLive = [
    'DDS_V_A', 'DDS_I_A', 'DDS_W_A', 'DDS_HZ_A', 'DDS_PF_A',
    'DDS_V_B', 'DDS_I_B', 'DDS_W_B', 'DDS_HZ_B', 'DDS_PF_B',
    'DDS_V_C', 'DDS_I_C', 'DDS_W_C', 'DDS_HZ_C', 'DDS_PF_C',
    'DDS_VA_A', 'DDS_VA_B', 'DDS_VA_C',
    'DDS_WH_SUM_IMP', 'DDS_WH_SUM_EXP',
  ];
  for (const id of ddsLive) {
    tags.push({
      id,
      type: 'REAL',
      role: 'input',
      value: 0,
      driverId,
      driverAddress: { channel: id },
      graphEnabled: true,
      comment: 'EZ Meter via Opta RS485 fieldbus → MQTT Parc',
    });
  }
  for (const def of [...buildEzMeterSemanticMirrorTagDefs(), ...buildEzMeterPqDerivedTagDefs(th)]) {
    tags.push({
      id: def.id,
      type: def.type || 'REAL',
      role: def.role || 'memory',
      value: def.default ?? (def.type === 'BOOL' ? false : 0),
      driverId: def.role === 'input' ? driverId : null,
      driverAddress: def.role === 'input' ? { channel: def.id } : null,
      graphEnabled: def.graphEnabled === true,
      alarmsEnabled: def.alarmsEnabled === true,
      alarmCondition: def.alarmCondition ?? null,
    });
  }
  return tags;
}

function halDiTags(driverId, count = 8, prefix = 'DI') {
  const tags = [];
  for (let i = 0; i < count; i++) {
    const n = `${prefix}${i + 1}`;
    tags.push({
      id: n,
      type: 'BOOL',
      role: 'input',
      value: false,
      driverId,
      driverAddress: { pin: `DI${i}` },
    });
  }
  return tags;
}

function halDoTags(driverId, count = 8, prefix = 'Q') {
  const tags = [];
  for (let i = 0; i < count; i++) {
    const n = `${prefix}${i + 1}`;
    tags.push({
      id: n,
      type: 'BOOL',
      role: 'output',
      value: false,
      driverId,
      driverAddress: { pin: `DO${i}` },
    });
  }
  return tags;
}

function halAiTags(driverId, count = 4, prefix = 'AI', startIndex = 0) {
  const tags = [];
  for (let i = 0; i < count; i++) {
    const n = `${prefix}${i + 1}`;
    tags.push({
      id: n,
      type: 'INT',
      role: 'input',
      value: 0,
      wordWidth: 16,
      signed: true,
      driverId,
      driverAddress: { pin: `AI${startIndex + i}` },
    });
  }
  return tags;
}

function halAoTags(driverId, count = 2, prefix = 'AO', startIndex = 0) {
  const tags = [];
  for (let i = 0; i < count; i++) {
    const n = `${prefix}${i + 1}`;
    tags.push({
      id: n,
      type: 'REAL',
      role: 'output',
      value: 0,
      driverId,
      driverAddress: { pin: `AO${startIndex + i}` },
    });
  }
  return tags;
}

/** Hardware pulse counters (distinct from ST COUNTER function-block tags). */
/** Modbus holding block: N consecutive 32-bit INT values (FC3 read / FC16 write). */
function modbusDintArrayTags(driverId, count, startAddr = 0, idPrefix = 'DINT') {
  const tags = [];
  const n = Math.max(1, Math.min(62, count || 1));
  if (n <= 1) {
    tags.push({
      id: idPrefix,
      type: 'INT',
      role: 'memory',
      value: 0,
      wordWidth: 32,
      signed: true,
      driverId,
      driverAddress: { table: 'holding', address: startAddr, wordWidth: 32 },
    });
    return tags;
  }
  tags.push({
    id: `${idPrefix}_ARR`,
    type: 'INT',
    role: 'memory',
    value: Array.from({ length: n }, () => 0),
    wordWidth: 32,
    signed: true,
    arrayLen: n,
    driverId,
    driverAddress: { table: 'holding', address: startAddr, wordWidth: 32 },
  });
  return tags;
}

/**
 * s::can con::cube parameter input registers (D-330 manual §7.4).
 * Each parameter: status bitmask @ base, IEEE float32 value @ base+2; stride 8 registers.
 * @param {string} driverId
 * @param {{ paramStart?: number, paramCount?: number, includeSystemTags?: boolean }} [opts]
 */
function scanConcubeParameterTags(driverId, opts = {}) {
  const paramStart = Math.max(1, Math.min(64, Number(opts.paramStart) || 1));
  const paramCount = Math.max(1, Math.min(64 - paramStart + 1, Number(opts.paramCount) || 4));
  const includeSystemTags = opts.includeSystemTags === true;
  const tags = [];
  if (includeSystemTags) {
    tags.push(
      {
        id: 'CUBE_MB_MAP_VER',
        type: 'INT',
        role: 'input',
        value: 0,
        wordWidth: 16,
        signed: false,
        driverId,
        driverAddress: { table: 'input', address: 0 },
        graphEnabled: false,
      },
      {
        id: 'CUBE_DEV_STATUS',
        type: 'INT',
        role: 'input',
        value: 0,
        wordWidth: 16,
        signed: false,
        driverId,
        driverAddress: { table: 'input', address: 120 },
        graphEnabled: false,
      },
    );
  }
  for (let p = paramStart; p < paramStart + paramCount; p++) {
    const base = 128 + (p - 1) * 8;
    const id = `PARM${p}`;
    tags.push({
      id: `${id}_STS`,
      type: 'INT',
      role: 'input',
      value: 0,
      wordWidth: 16,
      signed: false,
      driverId,
      driverAddress: { table: 'input', address: base },
      graphEnabled: false,
    });
    tags.push({
      id: `${id}_VAL`,
      type: 'REAL',
      role: 'input',
      value: 0,
      wordWidth: 32,
      signed: false,
      driverId,
      driverAddress: {
        table: 'input',
        address: base + 2,
        wordWidth: 32,
        encoding: 'float32',
        byteOrder: 'BE',
      },
      graphEnabled: true,
    });
  }
  return tags;
}

function halCntTags(driverId, count = 2, prefix = 'HWCNT') {
  const tags = [];
  for (let i = 0; i < count; i++) {
    tags.push({
      id: `${prefix}${i + 1}`,
      type: 'INT',
      role: 'input',
      value: 0,
      wordWidth: 32,
      signed: false,
      driverId,
      driverAddress: { pin: `CNT${i}`, field: 'count' },
    });
    tags.push({
      id: `${prefix}${i + 1}_HZ`,
      type: 'REAL',
      role: 'input',
      value: 0,
      driverId,
      driverAddress: { pin: `CNT${i}`, field: 'freq' },
    });
  }
  return tags;
}

/** MooreVIEW Opta / MQTT Parc channel tag (id matches firmware + telemetry). */
function optaChannelTag(driverId, id, type, role) {
  const t = String(type || 'BOOL').toUpperCase();
  const r = role || (t === 'BOOL' && /^R\d|_R\d|_PWM/i.test(id) ? 'output' : 'input');
  return {
    id,
    type: t,
    role: r,
    value: t === 'BOOL' ? false : 0,
    driverId,
    driverAddress: { channel: id },
  };
}

/**
 * Opta expansion module tags — naming matches firmware mv_expansions.cpp (X{n}_I*, IRAW*, R*, AI*, PWM*).
 * @param {string} driverId
 * @param {Array<{slot:number,type:string}>} expansions
 */
function optaExpansionTags(driverId, expansions) {
  const out = [];
  for (const exp of expansions || []) {
    const slot = Math.max(1, Math.min(5, Number(exp.slot) || 1));
    const pfx = `X${slot}`;
    const type = String(exp.type || exp.module || '').toLowerCase();
    if (type === 'd1608e' || type === 'afx00005' || type === 'digital') {
      for (let i = 1; i <= 16; i++) {
        out.push(optaChannelTag(driverId, `${pfx}_I${i}`, 'BOOL', 'input'));
        out.push(optaChannelTag(driverId, `${pfx}_IRAW${i}`, 'INT', 'input'));
      }
      for (let i = 1; i <= 8; i++) {
        out.push(optaChannelTag(driverId, `${pfx}_R${i}`, 'BOOL', 'output'));
      }
    } else if (type === 'a0602' || type === 'afx00007' || type === 'analog') {
      const rtd = exp.rtdsEnabled === true;
      const rtdComment = rtd
        ? 'A0602 2-wire PT100 RTD (°C via firmware pinRtd)'
        : 'A0602 voltage/current analog input';
      for (let i = 1; i <= 8; i++) {
        out.push({
          ...optaChannelTag(driverId, `${pfx}_AI${i}`, 'REAL', 'input'),
          comment: rtdComment,
        });
      }
      for (let i = 1; i <= 4; i++) {
        out.push(optaChannelTag(driverId, `${pfx}_PWM${i}`, 'INT', 'output'));
      }
    }
  }
  return out;
}

/** Match nexcomm-sb-mqtt-bridge: strip hyphens/spaces so xxxx-xxxxxx → topic id. */
function normalizeEdgepointSerial(serialNum) {
  return String(serialNum ?? '')
    .trim()
    .toLowerCase()
    .replace(/[-\s_]/g, '');
}

function edgepointEventsTopic(serialNum) {
  const s = normalizeEdgepointSerial(serialNum);
  return `/devices/${s}/messages/events/`;
}

function edgepointDeviceboundTopic(serialNum) {
  const s = normalizeEdgepointSerial(serialNum);
  return `/devices/${s}/messages/devicebound/`;
}

function edgepointInputIndex(register) {
  if (register >= 9010 && register <= 9160) return (register - 9010) / 10;
  if (register >= 9170 && register <= 9200) return 16 + (register - 9170) / 10;
  return -1;
}

function edgepointOutputIndex(register) {
  if (register >= 9410 && register <= 9530) return (register - 9410) / 10;
  return -1;
}

/** EdgePoint Industrial gateway tags (MQTT JSON on /devices/&lt;serial&gt;/messages/events/). */
function edgepointGatewayTags(driverId, serialNum, spec = {}) {
  if (!serialNum) throw new Error('EdgePoint template requires serialNum');
  const events = edgepointEventsTopic(serialNum);
  const devicebound = edgepointDeviceboundTopic(serialNum);
  const tags = [];
  const includeMeta = spec.includeMeta !== false;
  const includeInputs = spec.includeInputs !== false;
  const includeOutputs = spec.includeOutputs !== false;
  const includeOutputWrites = spec.includeOutputWrites !== false;

  if (includeMeta) {
    tags.push(
      {
        id: 'EPI_VARIANT',
        type: 'INT',
        role: 'input',
        value: 0,
        driverId,
        driverAddress: { topic: events, payloadTemplate: 'json:variant' },
        comment: 'Hardware variant',
      },
      {
        id: 'EPI_TZ',
        type: 'INT',
        role: 'input',
        value: 0,
        driverId,
        driverAddress: { topic: events, payloadTemplate: 'json:tz' },
        comment: 'Time zone offset',
      },
      {
        id: 'EPI_DST',
        type: 'INT',
        role: 'input',
        value: 0,
        driverId,
        driverAddress: { topic: events, payloadTemplate: 'json:dst' },
        comment: 'Daylight savings indicator',
      },
    );
  }

  if (includeInputs) {
    for (let ch = 1; ch <= 16; ch += 1) {
      const reg = 9010 + (ch - 1) * 10;
      const idx = edgepointInputIndex(reg);
      tags.push(
        {
          id: `EPI_AC_IN${ch}`,
          type: 'BOOL',
          role: 'input',
          value: false,
          driverId,
          driverAddress: { topic: events, payloadTemplate: `json:inputs.${idx}.${reg}` },
          comment: `AC input ${ch} state (0=OFF, 1=ON)`,
        },
        {
          id: `EPI_AC_IN${ch}_TYPE`,
          type: 'INT',
          role: 'input',
          value: 0,
          driverId,
          driverAddress: { topic: events, payloadTemplate: `json:inputs.${idx}.${reg + 1}` },
          comment: 'Input type (0=discrete)',
        },
      );
    }
    for (let ch = 1; ch <= 4; ch += 1) {
      const reg = 9170 + (ch - 1) * 10;
      const idx = edgepointInputIndex(reg);
      tags.push(
        {
          id: `EPI_AN${ch}_V`,
          type: 'REAL',
          role: 'input',
          value: 0,
          wordWidth: 32,
          driverId,
          driverAddress: { topic: events, payloadTemplate: `json:inputs.${idx}.${reg}` },
          comment: `Analog input ${ch} voltage (V)`,
        },
        {
          id: `EPI_AN${ch}_TYPE`,
          type: 'INT',
          role: 'input',
          value: 0,
          driverId,
          driverAddress: { topic: events, payloadTemplate: `json:inputs.${idx}.${reg + 1}` },
          comment: 'Input type (3=analog)',
        },
      );
    }
  }

  if (includeOutputs) {
    const outputDefs = [
      { reg: 9410, id: 'EPI_RELAY1', label: 'Relay 1' },
      { reg: 9420, id: 'EPI_RELAY2', label: 'Relay 2' },
      { reg: 9430, id: 'EPI_RELAY3', label: 'Relay 3' },
      { reg: 9440, id: 'EPI_SINK1', label: 'Current sink 1' },
      { reg: 9450, id: 'EPI_SINK2', label: 'Current sink 2' },
      { reg: 9460, id: 'EPI_SINK3', label: 'Current sink 3' },
      { reg: 9470, id: 'EPI_SINK4', label: 'Current sink 4' },
      { reg: 9480, id: 'EPI_SINK5', label: 'Current sink 5' },
      { reg: 9490, id: 'EPI_SINK6', label: 'Current sink 6' },
      { reg: 9500, id: 'EPI_SINK7', label: 'Current sink 7' },
      { reg: 9510, id: 'EPI_SINK8', label: 'Current sink 8' },
      { reg: 9520, id: 'EPI_SINK9', label: 'Current sink 9' },
      { reg: 9530, id: 'EPI_SINK10', label: 'Current sink 10' },
    ];
    for (const out of outputDefs) {
      const idx = edgepointOutputIndex(out.reg);
      tags.push({
        id: out.id,
        type: 'BOOL',
        role: 'input',
        value: false,
        driverId,
        driverAddress: { topic: events, payloadTemplate: `json:outputs.${idx}.${out.reg}` },
        comment: `${out.label} state`,
      });
      if (includeOutputWrites) {
        tags.push({
          id: `${out.id}_CMD`,
          type: 'BOOL',
          role: 'output',
          value: false,
          driverId,
          driverAddress: {
            topic: devicebound,
            payloadTemplate: `edgepoint:output:${out.reg}`,
          },
          comment: `${out.label} command`,
        });
      }
    }
  }

  return tags;
}

const EPI_LIFT_PROFILES = {
  epi_master: {
    label: 'EPI master lift (4-float duplex, Nexus Cloud map)',
    inputs: [
      { id: 'X1_I1', label: 'High level float', reg: 9010, nexus: 'High Level Float' },
      { id: 'X1_I2', label: 'Lead float', reg: 9040, nexus: 'Lead Float' },
      { id: 'X1_I3', label: 'Lag float', reg: 9030, nexus: 'Lag Float' },
      { id: 'X1_I4', label: 'Off float', reg: 9050, nexus: 'OFF Float' },
      { id: 'X1_I5', label: 'Pump 1 run feedback', reg: 9090, nexus: 'MS 1 Run' },
      { id: 'X1_I6', label: 'Pump 2 run feedback', reg: 9100, nexus: 'MS 2 Run' },
      { id: 'X1_I7', label: 'Phase loss', reg: 9150, nexus: 'Phase Loss' },
      { id: 'X1_I8', label: 'MS 3 run / gen run', reg: 9110, nexus: 'MS 3 Run' },
      { id: 'X1_I10', label: 'Generator fault', reg: 9160, nexus: 'Gen Fault' },
    ],
    analogs: [
      { id: 'AI1', label: 'Motor 1 CT amps', reg: 9180, scale: 50, nexus: 'Motor 1 CT' },
      { id: 'AI2', label: 'Motor 2 CT amps', reg: 9190, scale: 50, nexus: 'Motor 2 CT' },
      { id: 'AI3', label: 'Motor 3 CT amps', reg: 9200, scale: 50, nexus: 'Motor 3 CT' },
      { id: 'AI4', label: 'Generator fuel level (V)', reg: 9170, scale: 1, nexus: 'Gen fuel' },
    ],
    semantics: [
      { id: 'LVL_HIGH', label: 'High level float', reg: 9010 },
      { id: 'LVL_LAG2', label: 'Lag float 2', reg: 9020 },
      { id: 'LVL_LAG', label: 'Lag float', reg: 9030 },
      { id: 'LVL_LEAD', label: 'Lead float', reg: 9040 },
      { id: 'LVL_OFF', label: 'Off float', reg: 9050 },
      { id: 'PHASE_FAULT', label: 'Phase loss', reg: 9150 },
      { id: 'GEN_FAULT', label: 'Generator fault', reg: 9160 },
      { id: 'P1_RUN_FB', label: 'Pump 1 run feedback', reg: 9090 },
      { id: 'P2_RUN_FB', label: 'Pump 2 run feedback', reg: 9100 },
    ],
    outputs: [
      { id: 'R1', label: 'Pump 1 contactor', reg: 9410 },
      { id: 'R2', label: 'Pump 2 contactor', reg: 9420 },
    ],
  },
  liftpoint_light: {
    label: 'LiftPoint Light (2-float duplex monitor)',
    inputs: [
      { id: 'X1_I1', label: 'High level float alarm', reg: 9010, nexus: 'High Level Float Alarm' },
      { id: 'X1_I2', label: 'Lead float', reg: 9020, nexus: 'Lead Float' },
      { id: 'X1_I3', label: 'Motor fault', reg: 9050, nexus: 'Motor Fault' },
      { id: 'X1_I4', label: 'Input 5', reg: 9060, nexus: 'Input 5' },
      { id: 'X1_I5', label: 'Pump 1 run', reg: 9030, nexus: 'Pump 1 Run' },
      { id: 'X1_I6', label: 'Pump 2 run', reg: 9040, nexus: 'Pump 2 Run' },
      { id: 'X1_I7', label: 'Input 6', reg: 9090, nexus: 'Input 6' },
    ],
    analogs: [
      { id: 'AI1', label: 'Pump 1 amps', reg: 9070, scale: 1, nexus: 'Pump 1 Motor Amps' },
      { id: 'AI2', label: 'Pump 2 amps', reg: 9080, scale: 1, nexus: 'Pump 2 Motor Amps' },
    ],
    semantics: [
      { id: 'LVL_HIGH', label: 'High level float alarm', reg: 9010 },
      { id: 'LVL_LEAD', label: 'Lead float', reg: 9020 },
      { id: 'MOTOR_FAULT', label: 'Motor fault', reg: 9050 },
      { id: 'P1_RUN_FB', label: 'Pump 1 run', reg: 9030 },
      { id: 'P2_RUN_FB', label: 'Pump 2 run', reg: 9040 },
      { id: 'P1_AMPS', label: 'Pump 1 amps', reg: 9070, type: 'REAL' },
      { id: 'P2_AMPS', label: 'Pump 2 amps', reg: 9080, type: 'REAL' },
    ],
    extras: [
      { id: 'EXT_POWER_OK', label: 'External power OK', payloadTemplate: 'json:battery_power', type: 'BOOL', nexus: 'External Power' },
      { id: 'BATTERY_V', label: 'Battery voltage', payloadTemplate: 'json:vbat', type: 'REAL', nexus: 'Battery' },
      { id: 'P1_STARTS', label: 'Pump 1 starts', payloadTemplate: 'json:in3_starts', type: 'INT', nexus: 'Pump 1 Motor Starts' },
      { id: 'P2_STARTS', label: 'Pump 2 starts', payloadTemplate: 'json:in4_starts', type: 'INT', nexus: 'Pump 2 Motor Starts' },
      { id: 'P1_RUNTIME_HRS', label: 'Pump 1 runtime hours', payloadTemplate: 'json:in3_runtime', type: 'REAL', nexus: 'Pump 1 Motor Run Time' },
      { id: 'P2_RUNTIME_HRS', label: 'Pump 2 runtime hours', payloadTemplate: 'json:in4_runtime', type: 'REAL', nexus: 'Pump 2 Motor Run Time' },
      { id: 'P1_FLOW_1HR_GAL', label: 'Pump 1 flow last hour (gal)', payloadTemplate: 'json:s1p1_total_1hr_flow', type: 'REAL', nexus: 'Flow Rate Pump1 (1 hr)' },
      { id: 'P2_FLOW_1HR_GAL', label: 'Pump 2 flow last hour (gal)', payloadTemplate: 'json:s1p2_total_1hr_flow', type: 'REAL', nexus: 'Flow Rate Pump2 (1 hr)' },
    ],
    outputs: [],
  },
};

function isLiftHardwareIoTag(id) {
  return /^X1_I\d+$/.test(id)
    || /^AI\d+$/.test(id)
    || /^I\d_RAW$/.test(id)
    || id === 'R1'
    || id === 'R2'
    || id === 'R3'
    || id === 'R4'
    || id === 'MOTOR1_TEMP'
    || id === 'MOTOR2_TEMP';
}

/** ST alternator / HOA memory tags from duplex lift fixture (excludes Opta hardware I/O). */
function liftStationLogicTagsFromFixture(fixtureName = 'tags.duplex_lift_station.json') {
  const fp = path.join(__dirname, '../../st/fixtures', fixtureName);
  const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
  return raw.filter((t) => !isLiftHardwareIoTag(t.id));
}

function epiLiftInputTag(driverId, events, def) {
  const idx = edgepointInputIndex(def.reg);
  return {
    id: def.id,
    label: def.label,
    type: 'BOOL',
    role: 'input',
    value: false,
    driverId,
    driverAddress: { topic: events, payloadTemplate: `json:inputs.${idx}.${def.reg}` },
    comment: def.nexus ? `Nexus: ${def.nexus} (reg ${def.reg})` : `EPI reg ${def.reg}`,
  };
}

function epiLiftAnalogTag(driverId, events, def) {
  const idx = edgepointInputIndex(def.reg);
  const tag = {
    id: def.id,
    label: def.label,
    type: 'REAL',
    role: 'input',
    value: 0,
    wordWidth: 32,
    driverId,
    driverAddress: { topic: events, payloadTemplate: `json:inputs.${idx}.${def.reg}` },
    comment: def.nexus ? `Nexus: ${def.nexus} (reg ${def.reg})` : `EPI reg ${def.reg}`,
    graphEnabled: def.id.startsWith('AI'),
  };
  if (def.scale != null) {
    tag.scale = def.scale;
    tag.offset = 0;
  }
  return tag;
}

function epiLiftSemanticTag(driverId, events, def) {
  if (def.type === 'REAL') return epiLiftAnalogTag(driverId, events, def);
  return epiLiftInputTag(driverId, events, def);
}

function epiLiftOutputTag(driverId, events, devicebound, def, includeFeedback) {
  const tags = [];
  if (includeFeedback) {
    const idx = edgepointOutputIndex(def.reg);
    tags.push({
      id: `${def.id}_FB`,
      label: `${def.label} feedback`,
      type: 'BOOL',
      role: 'input',
      value: false,
      driverId,
      driverAddress: { topic: events, payloadTemplate: `json:outputs.${idx}.${def.reg}` },
      comment: `EPI output state reg ${def.reg}`,
    });
  }
  tags.push({
    id: def.id,
    label: def.label,
    type: 'BOOL',
    role: 'output',
    value: false,
    driverId,
    driverAddress: { topic: devicebound, payloadTemplate: `edgepoint:output:${def.reg}` },
    comment: `EPI relay/sink command reg ${def.reg}`,
  });
  return tags;
}

function epiLiftExtraTag(driverId, events, def) {
  return {
    id: def.id,
    label: def.label,
    type: def.type || 'BOOL',
    role: 'input',
    value: def.type === 'REAL' ? 0 : def.type === 'INT' ? 0 : false,
    wordWidth: def.type === 'INT' ? 16 : undefined,
    driverId,
    driverAddress: { topic: events, payloadTemplate: def.payloadTemplate },
    comment: def.nexus
      ? `Nexus CSV/MQTT: ${def.nexus} (${def.payloadTemplate})`
      : 'LiftPoint Light telemetry field (Nexus MQTT JSON)',
    graphEnabled: def.type === 'REAL',
  };
}

/**
 * EdgePoint lift station tags — Nexus Cloud register map → MV ST I/O (X1_I*, AI*, R*).
 * Profiles: epi_master (4-float duplex) | liftpoint_light (monitoring).
 */
function edgepointLiftStationTags(driverId, serialNum, spec = {}) {
  if (!serialNum) throw new Error('EdgePoint lift template requires serialNum');
  const profileName = spec.profile || 'epi_master';
  const profile = EPI_LIFT_PROFILES[profileName];
  if (!profile) throw new Error(`Unknown EdgePoint lift profile: ${profileName}`);
  const events = edgepointEventsTopic(serialNum);
  const devicebound = edgepointDeviceboundTopic(serialNum);
  const includeSemantic = spec.includeSemantic !== false;
  const includeOutputFeedback = spec.includeOutputFeedback === true;
  const includeExtras = spec.includeExtras !== false && !!(profile.extras?.length);
  const tags = [];

  for (const def of profile.inputs || []) {
    tags.push(epiLiftInputTag(driverId, events, def));
  }
  for (const def of profile.analogs || []) {
    tags.push(epiLiftAnalogTag(driverId, events, def));
  }
  if (includeSemantic) {
    for (const def of profile.semantics || []) {
      if (profile.inputs?.some((i) => i.id === def.id) || profile.analogs?.some((a) => a.id === def.id)) {
        continue;
      }
      tags.push(epiLiftSemanticTag(driverId, events, def));
    }
  }
  for (const def of profile.outputs || []) {
    tags.push(...epiLiftOutputTag(driverId, events, devicebound, def, includeOutputFeedback));
  }
  if (includeExtras && profile.extras?.length) {
    for (const def of profile.extras) {
      tags.push(epiLiftExtraTag(driverId, events, def));
    }
  }

  return tags;
}

/**
 * Inbound MQTT JSON tags from Nexcomm CSV alignment maps.
 * @param {string} driverId
 * @param {string} eventsTopic - e.g. /devices/<serial>/messages/events/
 * @param {{ fields?: Array<{ id, label, type, payloadTemplate, comment }> }} spec
 */
function mqttJsonInboundTags(driverId, eventsTopic, spec = {}) {
  const fields = Array.isArray(spec.fields) ? spec.fields : [];
  return fields.map((def) => {
    const type = def.type || 'REAL';
    return {
      id: def.id,
      label: def.label || def.id,
      type,
      role: 'input',
      value: type === 'BOOL' ? false : 0,
      wordWidth: type === 'INT' ? 16 : type === 'REAL' ? 32 : undefined,
      driverId,
      driverAddress: {
        topic: eventsTopic,
        payloadTemplate: def.payloadTemplate || `json:${String(def.id).toLowerCase()}`,
      },
      comment: def.comment || 'Nexcomm inbound CSV alignment',
      graphEnabled: type === 'REAL',
    };
  });
}

module.exports = {
  diTags,
  doTags,
  holdingRegTags,
  inputRegTags,
  explicitModbusTags,
  explicitVgreenTags,
  edgepointGatewayTags,
  edgepointLiftStationTags,
  liftStationLogicTagsFromFixture,
  mqttJsonInboundTags,
  normalizeEdgepointSerial,
  edgepointEventsTopic,
  edgepointDeviceboundTopic,
  EPI_LIFT_PROFILES,
  halDiTags,
  halDoTags,
  halAiTags,
  halAoTags,
  halCntTags,
  modbusDintArrayTags,
  scanConcubeParameterTags,
  optaChannelTag,
  optaExpansionTags,
  optaParcModbusDraginoTags,
  optaParcEzmeterTags,
  jxctSoil7in1Tags,
  JXCT_SOIL_7IN1_FIELDS,
  dfrobotPoolChemistryDraginoTags,
};
