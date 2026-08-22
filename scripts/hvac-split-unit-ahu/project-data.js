'use strict';

/**
 * Residential/commercial split-unit air handler — base Opta only (no D1608E).
 *
 * I1/I2 blower MCSA · I3/I4 supply/return NTC · I5 pan leak analog.
 */

const DEVICE_ID = process.env.SPLIT_AHU_DEVICE_ID || 'hvac_split_ahu_01';
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://192.168.10.50:1883';

const PROJECT = {
  name: 'hvac-split-unit-ahu',
  title: 'Split unit AHU — res/com · base Opta',
  programFile: 'logic/hvac_split_unit_ahu.st',
};

const SPLIT_UNIT_AHU_IO = {
  ct: [
    { input: 'I1', channel: 'AHU1_START_AMPS', label: 'Blower start CT' },
    { input: 'I2', channel: 'AHU1_FAN_AMPS', label: 'Blower run CT' },
  ],
  ntc: [
    { input: 'I3', tag: 'AHU1_SUPPLY_TEMP_F', label: 'Supply air' },
    { input: 'I4', tag: 'AHU1_RETURN_TEMP_F', label: 'Return air' },
  ],
  leak: [{ input: 'I5', tag: 'AHU1_PAN_LEAK', label: 'Pan leak (analog)' }],
};

const DEFAULT_MCSA = {
  ioLayout: 'hvac',
  deviceType: 'all',
  motorCount: 1,
  motors: [{ wiring: '1P+cap', ctRun: 'I2', ctStart: 'I1', assetId: 'blower' }],
  mcsaPreset: 'split-unit-ahu',
};

const DEFAULT_ENV_CAL = {
  optaPage: '/ahu-env',
  ntcPoints: [
    { id: 'ntc0', input: 'I3', baseInput: 2, label: 'Supply', vsupply: 24, rfixed: 10000, r25: 10000, beta: 3950, offsetF: 0 },
    { id: 'ntc1', input: 'I4', baseInput: 3, label: 'Return', vsupply: 24, rfixed: 10000, r25: 10000, beta: 3950, offsetF: 0 },
  ],
  leakPoints: [
    { id: 'leak0', input: 'I5', baseInput: 4, onExpansion: false, thresholdMv: 2500, detectAbove: true, mvPerRaw: 1.0, label: 'Pan leak' },
  ],
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
  const rows = [
    tag('H_CT_AMPS', { label: 'CT overload threshold (A)', type: 'REAL', value: 18, default: 18 }),
    tag('H_SUPPLY_HI_F', { label: 'Supply air high temp °F', type: 'REAL', value: 105, default: 105 }),
    tag('AHU1_FAIL_ALM', { label: 'AHU failure', alarmsEnabled: true, alarmCondition: 'on' }),
    tag('SITE_ALM', { label: 'Site alarm', alarmsEnabled: true, alarmCondition: 'on' }),
    bindChannel(tag, driverId, 'FAN_FLT', { id: 'AHU1_FAN_FLT', alarmsEnabled: true, alarmCondition: 'on' }),
  ];
  for (const row of SPLIT_UNIT_AHU_IO.ct) {
    const mqttCh = row.channel === 'AHU1_FAN_AMPS' ? 'FAN_AMPS' : 'FAN_START_AMPS';
    rows.push(bindChannel(tag, driverId, mqttCh, {
      id: row.channel,
      label: row.label,
      type: 'REAL',
      graphEnabled: true,
    }));
  }
  for (const row of SPLIT_UNIT_AHU_IO.ntc) {
    rows.push(bindChannel(tag, driverId, row.tag, { label: row.label, type: 'REAL', graphEnabled: true }));
  }
  rows.push(bindChannel(tag, driverId, SPLIT_UNIT_AHU_IO.leak[0].tag, {
    label: SPLIT_UNIT_AHU_IO.leak[0].label,
    alarmsEnabled: true,
    alarmCondition: 'on',
    comment: `Base ${SPLIT_UNIT_AHU_IO.leak[0].input} leak analog`,
  }));
  return rows;
}

function buildDrivers() {
  return [{
    id: 'opta_split_ahu',
    type: 'mqtt_parc',
    enabled: true,
    deviceId: DEVICE_ID,
    name: 'Split unit AHU (res/com · base Opta)',
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
    facilityHvac: {
      splitUnitAhuIoMap: SPLIT_UNIT_AHU_IO,
      splitUnitAhuMcsa: DEFAULT_MCSA,
      splitUnitAhuEnvCal: DEFAULT_ENV_CAL,
    },
    hmi: { activeScreen: 'screen_1', screens: [] },
  };
}

module.exports = {
  PROJECT,
  SPLIT_UNIT_AHU_IO,
  DEVICE_ID,
  DEFAULT_MCSA,
  DEFAULT_ENV_CAL,
  buildTags,
  buildDrivers,
  buildSettings,
  tag,
};
