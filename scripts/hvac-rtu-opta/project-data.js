'use strict';

/**
 * Rooftop unit (RTU) — 1× Opta + D1608E.
 *
 * Base I1–I6: blower / condenser fan / compressor MCSA (1P+cap start+run).
 * D1608E X1_IRAW1–4: refrigerant low/high + supply/return NTC.
 * D1608E X1_IRAW5: pan leak analog (/ahu-env). NTC on X1_IRAW1–4 via /mcsa.
 */

const RTU_DEVICE_ID = process.env.RTU_DEVICE_ID || 'hvac_rtu_01';
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://192.168.10.50:1883';

const PROJECT = {
  name: 'hvac-rtu-opta',
  title: 'HVAC RTU — Opta + D1608E',
  programFile: 'logic/hvac_rtu_opta.st',
};

const RTU_IO = {
  ct: [
    { input: 'I1', channel: 'RTU_BLOWER_START_AMPS', label: 'Blower start CT' },
    { input: 'I2', channel: 'RTU_BLOWER_AMPS', label: 'Blower run CT' },
    { input: 'I3', channel: 'RTU_FAN_START_AMPS', label: 'Condenser fan start CT' },
    { input: 'I4', channel: 'RTU_FAN_AMPS', label: 'Condenser fan run CT' },
    { input: 'I5', channel: 'RTU_COMP_START_AMPS', label: 'Compressor start CT' },
    { input: 'I6', channel: 'RTU_COMP_AMPS', label: 'Compressor run CT' },
  ],
  ntc: [
    { input: 'X1_IRAW1', channel: 'T2_C', tag: 'RTU_LO_TEMP_F', label: 'Refrigerant low side' },
    { input: 'X1_IRAW2', channel: 'T1_C', tag: 'RTU_HI_TEMP_F', label: 'Refrigerant high side' },
    { input: 'X1_IRAW3', channel: 'T3_C', tag: 'RTU_SUPPLY_TEMP_F', label: 'Supply air' },
    { input: 'X1_IRAW4', channel: 'T4_C', tag: 'RTU_RETURN_TEMP_F', label: 'Return air' },
  ],
  leak: [{ input: 'X1_IRAW5', tag: 'RTU_PAN_LEAK', label: 'Pan leak (analog)' }],
};

const DEFAULT_RTU_LEAK_CAL = [
  {
    id: 'leak0',
    input: 'X1_IRAW5',
    expInput: 4,
    thresholdMv: 2500,
    detectAbove: true,
    mvPerRaw: 1.0,
    label: 'RTU pan leak',
  },
];

const DEFAULT_RTU_MCSA = {
  ioLayout: 'hvac',
  deviceType: 'all',
  motorCount: 3,
  motors: [
    { wiring: '1P+cap', ctRun: 'I2', ctStart: 'I1', assetId: 'blower' },
    { wiring: '1P+cap', ctRun: 'I4', ctStart: 'I3', assetId: 'fan' },
    { wiring: '1P+cap', ctRun: 'I6', ctStart: 'I5', assetId: 'comp' },
  ],
  ntc: RTU_IO.ntc.map((n) => ({ input: n.input, channel: n.channel, label: n.label })),
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

function bindChannel(makeTag, driverId, channel, extra = {}) {
  return makeTag(extra.id || channel, {
    ...extra,
    role: 'input',
    driverId,
    driverAddress: { channel },
    readonly: true,
  });
}

function buildRtuTags(dRtu) {
  const cToF = { scale: 1.8, offset: 32 };
  const rows = [
    tag('H_CT_AMPS', { label: 'CT overload threshold (A)', type: 'REAL', value: 18, default: 18 }),
    tag('H_SUPPLY_HI_F', { label: 'Supply air high temp °F', type: 'REAL', value: 105, default: 105 }),
    tag('H_COND_HI_F', { label: 'Refrigerant high-side trip °F', type: 'REAL', value: 350, default: 350 }),
    tag('H_COND_LO_F', { label: 'Refrigerant low-side trip °F', type: 'REAL', value: 30, default: 30 }),
    tag('RTU_FAIL_ALM', { label: 'RTU failure', alarmsEnabled: true, alarmCondition: 'on' }),
    tag('SITE_ALM', { label: 'Site alarm', alarmsEnabled: true, alarmCondition: 'on' }),
    tag('RTU_BLOWER_START_FLT', { label: 'RTU blower start fault', alarmsEnabled: true, alarmCondition: 'on' }),
    bindChannel(tag, dRtu, 'RTU_BLOWER_FLT', { id: 'RTU_BLOWER_FLT', alarmsEnabled: true, alarmCondition: 'on' }),
    bindChannel(tag, dRtu, 'RTU_FAN_FLT', { id: 'RTU_FAN_FLT', alarmsEnabled: true, alarmCondition: 'on' }),
    bindChannel(tag, dRtu, 'RTU_COMP_FLT', { id: 'RTU_COMP_FLT', alarmsEnabled: true, alarmCondition: 'on' }),
  ];

  for (const row of RTU_IO.ct) {
    rows.push(bindChannel(tag, dRtu, row.channel, {
      label: row.label,
      type: 'REAL',
      graphEnabled: true,
    }));
  }

  for (const row of RTU_IO.ntc) {
    rows.push(bindChannel(tag, dRtu, row.tag, {
      label: row.label,
      type: 'REAL',
      graphEnabled: true,
      ...cToF,
      comment: `D1608E ${row.input} → device ${row.channel}`,
    }));
  }

  rows.push(bindChannel(tag, dRtu, 'AHU1_PAN_LEAK', {
    id: 'RTU_PAN_LEAK',
    label: RTU_IO.leak[0].label,
    alarmsEnabled: true,
    alarmCondition: 'on',
    comment: `D1608E ${RTU_IO.leak[0].input} leak analog (/ahu-env)`,
  }));

  return rows;
}

function buildDrivers() {
  return [
    {
      id: 'opta_rtu',
      type: 'mqtt_parc',
      enabled: true,
      deviceId: RTU_DEVICE_ID,
      name: 'RTU Opta + D1608E',
      reportIntervalSec: 1,
      scanMs: 100,
      remoteExecution: false,
      telemetryOnly: false,
    },
  ];
}

function buildSettings() {
  return {
    project: { name: PROJECT.name },
    scanMs: 1000,
    activeProgram: PROJECT.programFile,
    remoteExecution: false,
    autoStartRuntime: true,
    mqttParc: {
      enabled: true,
      brokerUrl: MQTT_BROKER_URL,
      topicPrefix: 'mooreview/v1',
      globalSiteKey: 1,
    },
    facilityHvac: {
      rtuDeviceId: RTU_DEVICE_ID,
      rtuIoMap: RTU_IO,
      rtuMcsa: DEFAULT_RTU_MCSA,
      rtuEnvCal: {
        optaPage: '/ahu-env',
        leakPoints: DEFAULT_RTU_LEAK_CAL,
      },
    },
    hmi: { activeScreen: 'screen_1', screens: [] },
  };
}

module.exports = {
  PROJECT,
  RTU_IO,
  RTU_DEVICE_ID,
  DEFAULT_RTU_MCSA,
  DEFAULT_RTU_LEAK_CAL,
  buildRtuTags,
  buildDrivers,
  buildSettings,
  tag,
};
