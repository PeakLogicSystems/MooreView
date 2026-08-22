'use strict';

/**
 * Residential/commercial split-unit condenser — base Opta only (no D1608E).
 *
 * I1–I4 fan/comp MCSA · I5/I6 refrigerant NTC.
 */

const DEVICE_ID = process.env.SPLIT_COND_DEVICE_ID || 'hvac_split_cond_01';
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://192.168.10.50:1883';

const PROJECT = {
  name: 'hvac-split-unit-cond',
  title: 'Split unit cond — res/com · base Opta',
  programFile: 'logic/hvac_split_unit_cond.st',
};

const SPLIT_UNIT_COND_IO = {
  ct: [
    { input: 'I1', channel: 'COND1_FAN_START_AMPS', label: 'Fan start CT' },
    { input: 'I2', channel: 'COND1_FAN_AMPS', label: 'Fan run CT' },
    { input: 'I3', channel: 'COND1_COMP_START_AMPS', label: 'Comp start CT' },
    { input: 'I4', channel: 'COND1_COMP_AMPS', label: 'Comp run CT' },
  ],
  ntc: [
    { input: 'I5', channel: 'T2_C', tag: 'COND1_LO_TEMP_F', label: 'Low side' },
    { input: 'I6', channel: 'T1_C', tag: 'COND1_HI_TEMP_F', label: 'High side' },
  ],
};

const DEFAULT_MCSA = {
  ioLayout: 'hvac',
  deviceType: 'all',
  motorCount: 2,
  motors: [
    { wiring: '1P+cap', ctRun: 'I2', ctStart: 'I1', assetId: 'fan' },
    { wiring: '1P+cap', ctRun: 'I4', ctStart: 'I3', assetId: 'comp' },
  ],
  ntc: [
    { input: 'I5', channel: 'T2_C', label: 'Low side' },
    { input: 'I6', channel: 'T1_C', label: 'High side' },
  ],
  mcsaPreset: 'split-unit-cond',
};

function tag(id, extra = {}) {
  const type = extra.type || 'BOOL';
  return {
    id,
    label: extra.label || id.replace(/_/g, ' '),
    type,
    role: extra.role || 'memory',
    driverId: extra.driverId ?? null,
    driverAddress: extra.driverAddress ?? null,
    default: extra.default ?? (type === 'REAL' ? 0 : type === 'INT' ? 0 : false),
    scale: extra.scale ?? 1,
    offset: extra.offset ?? 0,
    alarmsEnabled: !!extra.alarmsEnabled,
    alarmCondition: extra.alarmCondition ?? null,
    readonly: extra.readonly ?? (extra.role === 'input'),
    preset: 0,
    mode: 'TON',
    arrayLen: 1,
    value: extra.value ?? (type === 'BOOL' ? false : 0),
    quality: 'GOOD',
    wordWidth: 16,
    signed: true,
    forceInput: false,
    forceOutput: false,
    graphEnabled: !!extra.graphEnabled,
    dirty: false,
    alarmLevel: null,
    fb: {},
    comment: extra.comment ?? null,
  };
}

function bindChannel(makeTag, driverId, channel, extra = {}) {
  return makeTag(extra.id || channel, {
    ...extra,
    role: 'input',
    driverId,
    driverAddress: { channel },
    readonly: true,
  });
}

function buildTags(driverId) {
  const cToF = { scale: 1.8, offset: 32 };
  const rows = [
    tag('H_COND_HI_F', { label: 'High-side trip °F', type: 'REAL', value: 350, default: 350 }),
    tag('H_COND_LO_F', { label: 'Low-side trip °F', type: 'REAL', value: 30, default: 30 }),
    tag('COND1_FAIL_ALM', { label: 'Condenser failure', alarmsEnabled: true, alarmCondition: 'on' }),
    tag('SITE_ALM', { label: 'Site alarm', alarmsEnabled: true, alarmCondition: 'on' }),
    bindChannel(tag, driverId, 'FAN_FLT', { id: 'COND1_FAN_FLT', alarmsEnabled: true, alarmCondition: 'on' }),
    bindChannel(tag, driverId, 'COMP_FLT', { id: 'COND1_COMP_FLT', alarmsEnabled: true, alarmCondition: 'on' }),
  ];
  const ctMap = {
    COND1_FAN_START_AMPS: 'FAN_START_AMPS',
    COND1_FAN_AMPS: 'FAN_AMPS',
    COND1_COMP_START_AMPS: 'COMP_START_AMPS',
    COND1_COMP_AMPS: 'COMP_AMPS',
  };
  for (const row of SPLIT_UNIT_COND_IO.ct) {
    rows.push(bindChannel(tag, driverId, ctMap[row.channel], {
      id: row.channel,
      label: row.label,
      type: 'REAL',
      graphEnabled: true,
    }));
  }
  for (const row of SPLIT_UNIT_COND_IO.ntc) {
    rows.push(bindChannel(tag, driverId, row.tag, {
      label: row.label,
      type: 'REAL',
      graphEnabled: true,
      ...cToF,
      comment: `Base ${row.input} → ${row.channel}`,
    }));
  }
  return rows;
}

function buildDrivers() {
  return [{
    id: 'opta_split_cond',
    type: 'mqtt_parc',
    enabled: true,
    deviceId: DEVICE_ID,
    name: 'Split unit cond (res/com · base Opta)',
    reportIntervalSec: 1,
    scanMs: 100,
    remoteExecution: false,
    ioBaseOnly: true,
  }];
}

function buildSettings() {
  return {
    project: { name: PROJECT.name },
    scanMs: 1000,
    activeProgram: PROJECT.programFile,
    mqttParc: { enabled: true, brokerUrl: MQTT_BROKER_URL, topicPrefix: 'mooreview/v1', globalSiteKey: 1 },
    facilityHvac: { splitUnitCondIoMap: SPLIT_UNIT_COND_IO, splitUnitCondMcsa: DEFAULT_MCSA },
    hmi: { activeScreen: 'screen_1', screens: [] },
  };
}

module.exports = {
  PROJECT,
  SPLIT_UNIT_COND_IO,
  DEVICE_ID,
  DEFAULT_MCSA,
  buildTags,
  buildDrivers,
  buildSettings,
  tag,
};
