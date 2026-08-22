'use strict';

/**
 * IoT-Link facility — base Opta + D1608E expansion.
 *
 * AHU: 1× Opta + D1608E — dual unit (I1–I8 base, X1_IRAW1–2 leak analog).
 * COND: 1× Opta + D1608E — dual unit (I1–I8 MCSA CT, X1_IRAW1–4 NTC).
 * Total field Optas: 2 (+ IoT-Link hub).
 */

const AHU_DEVICE_ID = process.env.AHU_DEVICE_ID || 'hvac_ahu_01';
const COND_DEVICE_ID = process.env.COND_DEVICE_ID || 'hvac_cond_01';
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://192.168.10.50:1883';
const EZMETER_SERIAL = process.env.MOOREVIEW_RS485_PORT_A || '/dev/ttyLP6';
const EZMETER_BAUD = Number(process.env.EZMETER_BAUD) || 19200;
const EZMETER_SLAVE = Number(process.env.EZMETER_SLAVE_ID) || 1;

const PROJECT = {
  name: 'facility-hvac-iot-link',
  title: 'Facility HVAC — IoT-Link (2 AHU + 2 cond + EZ Meter)',
  programFile: 'logic/facility_hvac_iot_link.st',
};

const AHU_IO = {
  ct: [
    { input: 'I1', tag: 'AHU1_START_AMPS', label: 'Unit 1 fan start CT' },
    { input: 'I2', tag: 'AHU1_FAN_AMPS', label: 'Unit 1 fan run CT' },
    { input: 'I3', tag: 'AHU2_START_AMPS', label: 'Unit 2 fan start CT' },
    { input: 'I4', tag: 'AHU2_FAN_AMPS', label: 'Unit 2 fan run CT' },
  ],
  ntc: [
    { input: 'I5', tag: 'AHU1_SUPPLY_TEMP_F', label: 'Unit 1 supply °F' },
    { input: 'I6', tag: 'AHU1_RETURN_TEMP_F', label: 'Unit 1 return °F' },
    { input: 'I7', tag: 'AHU2_SUPPLY_TEMP_F', label: 'Unit 2 supply °F' },
    { input: 'I8', tag: 'AHU2_RETURN_TEMP_F', label: 'Unit 2 return °F' },
  ],
  leak: [
    { input: 'X1_IRAW1', tag: 'AHU1_PAN_LEAK', label: 'Unit 1 pan leak (analog)' },
    { input: 'X1_IRAW2', tag: 'AHU2_PAN_LEAK', label: 'Unit 2 pan leak (analog)' },
  ],
};

/** Dual condenser on one Opta + D1608E (matches field wiring table). */
const COND_IO = {
  ct: [
    { input: 'I1', channel: 'COND1_FAN_START_AMPS', label: 'Unit 1 fan start' },
    { input: 'I2', channel: 'COND1_FAN_AMPS', label: 'Unit 1 fan run' },
    { input: 'I3', channel: 'COND2_FAN_START_AMPS', label: 'Unit 2 fan start' },
    { input: 'I4', channel: 'COND2_FAN_AMPS', label: 'Unit 2 fan run' },
    { input: 'I5', channel: 'COND1_COMP_START_AMPS', label: 'Unit 1 comp start' },
    { input: 'I6', channel: 'COND1_COMP_AMPS', label: 'Unit 1 comp run' },
    { input: 'I7', channel: 'COND2_COMP_START_AMPS', label: 'Unit 2 comp start' },
    { input: 'I8', channel: 'COND2_COMP_AMPS', label: 'Unit 2 comp run' },
  ],
  ntc: [
    { input: 'X1_IRAW1', channel: 'T2_C', hiTag: 'COND1_LO_TEMP_F', label: 'Unit 1 low side' },
    { input: 'X1_IRAW2', channel: 'T1_C', hiTag: 'COND1_HI_TEMP_F', label: 'Unit 1 high side' },
    { input: 'X1_IRAW3', channel: 'T4_C', hiTag: 'COND2_LO_TEMP_F', label: 'Unit 2 low side' },
    { input: 'X1_IRAW4', channel: 'T3_C', hiTag: 'COND2_HI_TEMP_F', label: 'Unit 2 high side' },
  ],
};

const DEFAULT_AHU_NTC_CAL = [
  { id: 'ntc0', input: 'I5', label: 'AHU1 supply', vsupply: 24, rfixed: 10000, r25: 10000, beta: 3950, offsetF: 0 },
  { id: 'ntc1', input: 'I6', label: 'AHU1 return', vsupply: 24, rfixed: 10000, r25: 10000, beta: 3950, offsetF: 0 },
  { id: 'ntc2', input: 'I7', label: 'AHU2 supply', vsupply: 24, rfixed: 10000, r25: 10000, beta: 3950, offsetF: 0 },
  { id: 'ntc3', input: 'I8', label: 'AHU2 return', vsupply: 24, rfixed: 10000, r25: 10000, beta: 3950, offsetF: 0 },
];

const DEFAULT_AHU_LEAK_CAL = [
  { id: 'leak0', input: 'X1_IRAW1', expInput: 0, thresholdMv: 2500, detectAbove: true, mvPerRaw: 1.0, label: 'AHU1 pan leak' },
  { id: 'leak1', input: 'X1_IRAW2', expInput: 1, thresholdMv: 2500, detectAbove: true, mvPerRaw: 1.0, label: 'AHU2 pan leak' },
];

const DEFAULT_COND_MCSA = {
  ioLayout: 'hvac',
  deviceType: 'all',
  motorCount: 4,
  motors: [
    { wiring: '1P+cap', ctRun: 'I2', ctStart: 'I1', assetId: 'fan1' },
    { wiring: '1P+cap', ctRun: 'I4', ctStart: 'I3', assetId: 'fan2' },
    { wiring: '1P+cap', ctRun: 'I6', ctStart: 'I5', assetId: 'comp1' },
    { wiring: '1P+cap', ctRun: 'I8', ctStart: 'I7', assetId: 'comp2' },
  ],
  ntc: [
    { input: 'X1_IRAW1', channel: 'T2_C', label: 'Unit 1 low' },
    { input: 'X1_IRAW2', channel: 'T1_C', label: 'Unit 1 high' },
    { input: 'X1_IRAW3', channel: 'T4_C', label: 'Unit 2 low' },
    { input: 'X1_IRAW4', channel: 'T3_C', label: 'Unit 2 high' },
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
    alarmOuterLow: extra.alarmOuterLow ?? null,
    alarmInnerLow: extra.alarmInnerLow ?? null,
    alarmInnerHigh: extra.alarmInnerHigh ?? null,
    alarmOuterHigh: extra.alarmOuterHigh ?? null,
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

function bindRaw(makeTag, driverId, input, extra = {}) {
  return makeTag(extra.id || input, {
    ...extra,
    role: 'input',
    driverId,
    driverAddress: { channel: `${input}_RAW` },
    readonly: true,
  });
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

function buildAhuTags(dAhu) {
  const ctScale = 0.4887;
  const rows = [
    tag('H_CT_AMPS', { label: 'CT overload threshold (A)', type: 'REAL', value: 18, default: 18 }),
    tag('H_SUPPLY_HI_F', { label: 'Supply air high temp °F', type: 'REAL', value: 105, default: 105 }),
    tag('AHU1_FAIL_ALM', { label: 'AHU 1 failure', alarmsEnabled: true, alarmCondition: 'on' }),
    tag('AHU2_FAIL_ALM', { label: 'AHU 2 failure', alarmsEnabled: true, alarmCondition: 'on' }),
    tag('AHU1_FAN_FLT', { label: 'AHU 1 blower run fault', alarmsEnabled: true, alarmCondition: 'on' }),
    tag('AHU1_START_FLT', { label: 'AHU 1 blower start fault', alarmsEnabled: true, alarmCondition: 'on' }),
    tag('AHU2_FAN_FLT', { label: 'AHU 2 blower run fault', alarmsEnabled: true, alarmCondition: 'on' }),
    tag('AHU2_START_FLT', { label: 'AHU 2 blower start fault', alarmsEnabled: true, alarmCondition: 'on' }),
  ];

  for (const row of AHU_IO.ct) {
    rows.push(bindRaw(tag, dAhu, row.input, {
      id: row.tag,
      label: row.label,
      type: 'REAL',
      scale: ctScale,
      graphEnabled: true,
    }));
  }

  for (const row of AHU_IO.ntc) {
    rows.push(bindChannel(tag, dAhu, row.tag, {
      label: row.label,
      type: 'REAL',
      graphEnabled: true,
      comment: `Base ${row.input} NTC — /ahu-env`,
    }));
  }

  for (const row of AHU_IO.leak) {
    rows.push(bindChannel(tag, dAhu, row.tag, {
      label: row.label,
      alarmsEnabled: true,
      alarmCondition: 'on',
      comment: `D1608E ${row.input} leak analog (/ahu-env)`,
    }));
  }

  return rows;
}

function buildCondTags(dCond) {
  const cToF = { scale: 1.8, offset: 32 };
  const rows = [
    tag('H_COND_HI_F', { label: 'Condenser high-side trip °F', type: 'REAL', value: 350, default: 350 }),
    tag('H_COND_LO_F', { label: 'Condenser low-side trip °F', type: 'REAL', value: 30, default: 30 }),
    tag('COND1_FAIL_ALM', { label: 'Condenser 1 failure', alarmsEnabled: true, alarmCondition: 'on' }),
    tag('COND2_FAIL_ALM', { label: 'Condenser 2 failure', alarmsEnabled: true, alarmCondition: 'on' }),
    bindChannel(tag, dCond, 'COND1_FAN_FLT', { id: 'COND1_FAN_FLT', alarmsEnabled: true, alarmCondition: 'on' }),
    bindChannel(tag, dCond, 'COND1_COMP_FLT', { id: 'COND1_COMP_FLT', alarmsEnabled: true, alarmCondition: 'on' }),
    bindChannel(tag, dCond, 'COND2_FAN_FLT', { id: 'COND2_FAN_FLT', alarmsEnabled: true, alarmCondition: 'on' }),
    bindChannel(tag, dCond, 'COND2_COMP_FLT', { id: 'COND2_COMP_FLT', alarmsEnabled: true, alarmCondition: 'on' }),
  ];

  for (const row of COND_IO.ct) {
    rows.push(bindChannel(tag, dCond, row.channel, {
      label: row.label,
      type: 'REAL',
      graphEnabled: true,
    }));
  }

  for (const row of COND_IO.ntc) {
    rows.push(bindChannel(tag, dCond, row.hiTag, {
      label: row.label,
      type: 'REAL',
      graphEnabled: true,
      ...cToF,
      comment: `D1608E ${row.input} → device ${row.channel}`,
    }));
  }

  return rows;
}

function buildSiteTags() {
  return [
    tag('SITE_ALM', { label: 'HVAC site alarm', alarmsEnabled: true, alarmCondition: 'on' }),
    tag('FACILITY_ALM', { label: 'Facility alarm (HVAC + PQ)', alarmsEnabled: true, alarmCondition: 'on' }),
  ];
}

function buildDrivers() {
  return [
    {
      id: 'opta_ahu',
      type: 'mqtt_parc',
      enabled: true,
      deviceId: AHU_DEVICE_ID,
      name: 'Dual AHU Opta + D1608E',
      reportIntervalSec: 1,
      scanMs: 100,
      remoteExecution: true,
      ioBaseOnly: false,
    },
    {
      id: 'opta_cond',
      type: 'mqtt_parc',
      enabled: true,
      deviceId: COND_DEVICE_ID,
      name: 'Dual condenser Opta + D1608E',
      reportIntervalSec: 1,
      scanMs: 100,
      remoteExecution: false,
      telemetryOnly: false,
    },
    {
      id: 'dds_rgb',
      type: 'modbus_rtu',
      enabled: true,
      serialPort: EZMETER_SERIAL,
      baud: EZMETER_BAUD,
      slaveId: EZMETER_SLAVE,
      parity: 'none',
      stopBits: 1,
      timeoutMs: 3000,
    },
  ];
}

function buildSettings(screens = []) {
  return {
    project: { name: PROJECT.name },
    scanMs: 1000,
    activeProgram: PROJECT.programFile,
    remoteExecution: true,
    autoStartRuntime: true,
    mqttParc: {
      enabled: true,
      brokerUrl: MQTT_BROKER_URL,
      topicPrefix: 'mooreview/v1',
      globalSiteKey: 1,
    },
    facilityHvac: {
      ahuDeviceId: AHU_DEVICE_ID,
      condDeviceId: COND_DEVICE_ID,
      ioMap: AHU_IO,
      condIoMap: COND_IO,
      ahuEnvCal: {
        optaPage: '/ahu-env',
        ctCalPage: '/ct-cal',
        ntcPoints: DEFAULT_AHU_NTC_CAL,
        leakPoints: DEFAULT_AHU_LEAK_CAL,
      },
      condMcsa: DEFAULT_COND_MCSA,
      ezMeter: {
        driverId: 'dds_rgb',
        baud: EZMETER_BAUD,
        slaveId: EZMETER_SLAVE,
        serialPort: EZMETER_SERIAL,
        nominalVoltage: 240,
        undervoltV: 216,
        overvoltV: 264,
      },
    },
    assistedLiving: {
      facility: { driver: 'ezmeter' },
      ezMeter: {
        enabled: true,
        driverId: 'dds_rgb',
        nominalVoltage: 240,
        undervoltV: 216,
        overvoltV: 264,
        lowPf: 0.85,
        freqMinHz: 59.5,
        freqMaxHz: 60.5,
        vImbalancePct: 5,
        loadedCurrentA: 5,
      },
    },
    hmi: screens.length
      ? { activeScreen: 'screen_1', screens }
      : { activeScreen: 'screen_1', screens: [] },
  };
}

module.exports = {
  PROJECT,
  AHU_IO,
  COND_IO,
  AHU_DEVICE_ID,
  COND_DEVICE_ID,
  DEFAULT_AHU_NTC_CAL,
  DEFAULT_AHU_LEAK_CAL,
  DEFAULT_COND_MCSA,
  buildAhuTags,
  buildCondTags,
  buildSiteTags,
  buildDrivers,
  buildSettings,
  tag,
};
