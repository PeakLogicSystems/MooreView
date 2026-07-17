'use strict';

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
      for (let i = 1; i <= 8; i++) {
        out.push(optaChannelTag(driverId, `${pfx}_AI${i}`, 'REAL', 'input'));
      }
      for (let i = 1; i <= 4; i++) {
        out.push(optaChannelTag(driverId, `${pfx}_PWM${i}`, 'INT', 'output'));
      }
    }
  }
  return out;
}

function edgepointEventsTopic(serialNum) {
  return `/devices/${serialNum}/messages/events/`;
}

function edgepointDeviceboundTopic(serialNum) {
  return `/devices/${serialNum}/messages/devicebound/`;
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

module.exports = {
  diTags,
  doTags,
  holdingRegTags,
  inputRegTags,
  explicitModbusTags,
  explicitVgreenTags,
  edgepointGatewayTags,
  edgepointEventsTopic,
  edgepointDeviceboundTopic,
  halDiTags,
  halDoTags,
  halAiTags,
  halAoTags,
  halCntTags,
  modbusDintArrayTags,
  scanConcubeParameterTags,
  optaChannelTag,
  optaExpansionTags,
};
