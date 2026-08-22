'use strict';

/**
 * Consolidated OPTA Parc HVAC project — four selectable site configs:
 *   A (0) single air handler  — base Opta: 2 CT, 1 leak, 2 NTC
 *   B (1) single condenser    — base Opta: MCSA HVAC 2 CT, 2 NTC
 *   C (2) dual air handler    — Opta + D1608E digital expansion
 *   D (3) dual condenser      — 2× Opta MCSA + D1608E on primary
 */

const OPTA_DEVICE_ID = process.env.OPTA_DEVICE_ID || 'hvac_opta_01';
const OPTA_DEVICE_ID_2 = process.env.OPTA_DEVICE_ID_2 || 'hvac_opta_02';
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://192.168.1.233:1883';

/** @enum {number} */
const HVAC_CFG = {
  AHU_SINGLE: 0,
  COND_SINGLE: 1,
  AHU_DUAL: 2,
  COND_DUAL: 3,
};

const CONFIG_META = {
  [HVAC_CFG.AHU_SINGLE]: {
    id: 'A',
    label: 'Single air handler',
    hardware: 'Base Opta only',
    io: 'I1 leak · I2/I3 CT run/start (1P+cap blower) · I4 safety · I6/I7 NTC',
    mcsaLayout: false,
    mcsaWiring: '1P + start cap (blower)',
    expansion: null,
    remoteExecution: true,
  },
  [HVAC_CFG.COND_SINGLE]: {
    id: 'B',
    label: 'Single condenser',
    hardware: 'Base Opta only',
    io: 'MCSA HVAC: comp+fan 1P+cap run CT I1/I2 · hi/lo NTC I3/I4',
    mcsaLayout: 'HVAC',
    mcsaWiring: '1P + start cap (compressor + fan)',
    expansion: null,
    remoteExecution: false,
  },
  [HVAC_CFG.AHU_DUAL]: {
    id: 'C',
    label: 'Dual air handler',
    hardware: 'Opta + D1608E (digital expansion)',
    io: 'I1 + X1_I1 leaks · X1_I2/I3 safety · I2/I3 blower run CT (1P+cap) · 4 NTC',
    mcsaLayout: false,
    mcsaWiring: '1P + start cap (each blower)',
    expansion: 'D1608E',
    remoteExecution: true,
  },
  [HVAC_CFG.COND_DUAL]: {
    id: 'D',
    label: 'Dual condenser',
    hardware: '2× Opta MCSA + D1608E on primary',
    io: 'Each Opta: comp+fan 1P+cap I1/I2 · NTC I3/I4 · X1 lockout DI',
    mcsaLayout: 'HVAC',
    mcsaWiring: '1P + start cap (compressor + fan per unit)',
    expansion: 'D1608E',
    remoteExecution: false,
  },
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
    preset: extra.preset ?? 0,
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

function bind(makeTag, driverId, channel, extra = {}) {
  return makeTag(extra.id || channel, {
    ...extra,
    role: extra.role || 'input',
    driverId,
    driverAddress: { channel },
    readonly: true,
  });
}

function buildTags() {
  const d1 = 'opta_hvac_01';
  const d2 = 'opta_hvac_02';
  const cToF = { scale: 1.8, offset: 32 };

  return [
    tag('HVAC_CFG', {
      label: 'HVAC config (0=A 1=B 2=C 3=D)',
      type: 'INT',
      role: 'memory',
      value: HVAC_CFG.AHU_SINGLE,
      default: HVAC_CFG.AHU_SINGLE,
      comment: '0 single AHU · 1 single cond · 2 dual AHU · 3 dual cond',
    }),
    tag('SITE_ALM', { label: 'Site alarm', alarmsEnabled: true, alarmCondition: 'on' }),
    tag('H_CT_AMPS', {
      label: 'CT overload threshold (A)',
      type: 'REAL',
      role: 'memory',
      value: 18,
      default: 18,
    }),
    tag('H_SUPPLY_HI_F', {
      label: 'Supply air high temp °F',
      type: 'REAL',
      role: 'memory',
      value: 105,
      default: 105,
    }),
    tag('H_COND_HI_F', {
      label: 'Condenser high-side trip °F',
      type: 'REAL',
      role: 'memory',
      value: 350,
      default: 350,
    }),
    tag('H_COND_LO_F', {
      label: 'Condenser low-side trip °F',
      type: 'REAL',
      role: 'memory',
      value: 30,
      default: 30,
    }),

    /* —— Config A / C: air handlers —— */
    tag('AHU1_FAIL_ALM', { label: 'AHU 1 failure', alarmsEnabled: true, alarmCondition: 'on' }),
    tag('AHU2_FAIL_ALM', { label: 'AHU 2 failure', alarmsEnabled: true, alarmCondition: 'on' }),
    bind(tag, d1, 'I1', {
      id: 'AHU1_PAN_LEAK',
      label: 'AHU 1 pan leak',
      type: 'BOOL',
      alarmsEnabled: true,
      alarmCondition: 'on',
      comment: 'Config A/C — base I1 digital',
    }),
    bind(tag, d1, 'I4', {
      id: 'I4',
      label: 'Base DI I4',
      type: 'BOOL',
      comment: 'Config A: AHU1 safety · Config C: AHU2 return NTC uses I4_RAW',
    }),
    bind(tag, d1, 'X1_I1', {
      id: 'X1_I1',
      label: 'Expansion DI X1_I1',
      type: 'BOOL',
      comment: 'Config C: AHU2 leak · Config D: condenser 2 lockout',
    }),
    bind(tag, d1, 'X1_I2', {
      id: 'X1_I2',
      label: 'Expansion DI X1_I2',
      type: 'BOOL',
      comment: 'Config C: AHU1 safety · Config D: condenser 2 shutdown (optional)',
    }),
    bind(tag, d1, 'X1_I3', {
      id: 'X1_I3',
      label: 'Expansion DI X1_I3',
      type: 'BOOL',
      comment: 'Config C: AHU2 safety',
    }),
    tag('AHU2_PAN_LEAK', {
      label: 'AHU 2 pan leak',
      alarmsEnabled: true,
      alarmCondition: 'on',
      comment: 'Config C — derived from X1_I1 in ST',
    }),
    tag('AHU1_SAFETY_SW', {
      label: 'AHU 1 safety switch',
      alarmsEnabled: true,
      alarmCondition: 'off',
      default: true,
      value: true,
      comment: 'NC contact — OFF = tripped · Config A: I4 · Config C: X1_I2',
    }),
    tag('AHU2_SAFETY_SW', {
      label: 'AHU 2 safety switch',
      alarmsEnabled: true,
      alarmCondition: 'off',
      default: true,
      value: true,
      comment: 'NC contact — OFF = tripped · Config C: X1_I3',
    }),
    bind(tag, d1, 'I2_RAW', {
      id: 'AHU1_FAN_AMPS',
      label: 'AHU 1 blower amps',
      type: 'REAL',
      scale: 0.4887,
      graphEnabled: true,
      comment: 'Config A/C — CT on I2',
    }),
    bind(tag, d1, 'I3_RAW', {
      id: 'CT2_AMPS',
      label: 'CT input I3 amps',
      type: 'REAL',
      scale: 0.4887,
      graphEnabled: true,
      comment: 'Config A: AHU1 aux · Config C: AHU2 blower',
    }),
    tag('AHU1_START_AMPS', {
      label: 'AHU 1 blower start-winding amps',
      type: 'REAL',
      role: 'memory',
      graphEnabled: true,
      comment: 'Config A — 1P+cap start CT on I3 (via CT2_AMPS in ST)',
    }),
    tag('AHU2_FAN_AMPS', {
      label: 'AHU 2 blower amps',
      type: 'REAL',
      role: 'memory',
      graphEnabled: true,
      comment: 'Config C — mirror of CT2_AMPS in ST',
    }),
    bind(tag, d1, 'I6_RAW', {
      id: 'AHU1_SUPPLY_TEMP_F',
      label: 'AHU 1 supply °F',
      type: 'REAL',
      graphEnabled: true,
      alarmsEnabled: true,
      alarmInnerHigh: 95,
      alarmOuterHigh: 105,
    }),
    bind(tag, d1, 'I7_RAW', {
      id: 'AHU1_RETURN_TEMP_F',
      label: 'AHU 1 return °F',
      type: 'REAL',
      graphEnabled: true,
    }),
    bind(tag, d1, 'I8_RAW', {
      id: 'AHU2_SUPPLY_TEMP_F',
      label: 'AHU 2 supply °F',
      type: 'REAL',
      graphEnabled: true,
      alarmsEnabled: true,
      alarmInnerHigh: 95,
      alarmOuterHigh: 105,
      comment: 'Config C',
    }),
    bind(tag, d1, 'I4_RAW', {
      id: 'AHU2_RETURN_TEMP_F',
      label: 'AHU 2 return °F',
      type: 'REAL',
      graphEnabled: true,
      comment: 'Config C — I4 as NTC (not CT)',
    }),
    tag('AHU1_FAN_FLT', { label: 'AHU 1 blower fault', alarmsEnabled: true, alarmCondition: 'on' }),
    tag('AHU1_START_FLT', { label: 'AHU 1 blower start-winding fault', alarmsEnabled: true, alarmCondition: 'on' }),
    tag('AHU2_FAN_FLT', { label: 'AHU 2 blower fault', alarmsEnabled: true, alarmCondition: 'on' }),

    /* —— Config B / D: condensers —— */
    tag('COND1_FAIL_ALM', { label: 'Condenser 1 failure', alarmsEnabled: true, alarmCondition: 'on' }),
    tag('COND2_FAIL_ALM', { label: 'Condenser 2 failure', alarmsEnabled: true, alarmCondition: 'on' }),
    bind(tag, d1, 'T1_C', {
      id: 'COND1_HI_TEMP_F',
      label: 'Condenser 1 high side °F',
      type: 'REAL',
      graphEnabled: true,
      alarmsEnabled: true,
      alarmInnerHigh: 300,
      alarmOuterHigh: 350,
      ...cToF,
    }),
    bind(tag, d1, 'T2_C', {
      id: 'COND1_LO_TEMP_F',
      label: 'Condenser 1 low side °F',
      type: 'REAL',
      graphEnabled: true,
      alarmsEnabled: true,
      alarmInnerLow: 40,
      alarmOuterLow: 30,
      ...cToF,
    }),
    bind(tag, d1, 'FAN_FLT', {
      id: 'COND1_FAN_FLT',
      label: 'Condenser 1 fan fault',
      type: 'BOOL',
      alarmsEnabled: true,
      alarmCondition: 'on',
    }),
    bind(tag, d1, 'COMP_FLT', {
      id: 'COND1_COMP_FLT',
      label: 'Condenser 1 compressor fault',
      type: 'BOOL',
      alarmsEnabled: true,
      alarmCondition: 'on',
    }),
    bind(tag, d1, 'FAN_AMPS', {
      id: 'COND1_FAN_AMPS',
      label: 'Condenser 1 fan amps',
      type: 'REAL',
      graphEnabled: true,
    }),
    bind(tag, d1, 'COMP_AMPS', {
      id: 'COND1_COMP_AMPS',
      label: 'Condenser 1 compressor amps',
      type: 'REAL',
      graphEnabled: true,
    }),
    bind(tag, d2, 'T1_C', {
      id: 'COND2_HI_TEMP_F',
      label: 'Condenser 2 high side °F',
      type: 'REAL',
      graphEnabled: true,
      alarmsEnabled: true,
      alarmInnerHigh: 300,
      alarmOuterHigh: 350,
      ...cToF,
      comment: 'Config D — second Opta',
    }),
    bind(tag, d2, 'T2_C', {
      id: 'COND2_LO_TEMP_F',
      label: 'Condenser 2 low side °F',
      type: 'REAL',
      graphEnabled: true,
      alarmsEnabled: true,
      alarmInnerLow: 40,
      alarmOuterLow: 30,
      ...cToF,
    }),
    bind(tag, d2, 'FAN_FLT', {
      id: 'COND2_FAN_FLT',
      label: 'Condenser 2 fan fault',
      type: 'BOOL',
      alarmsEnabled: true,
      alarmCondition: 'on',
    }),
    bind(tag, d2, 'COMP_FLT', {
      id: 'COND2_COMP_FLT',
      label: 'Condenser 2 compressor fault',
      type: 'BOOL',
      alarmsEnabled: true,
      alarmCondition: 'on',
    }),
    bind(tag, d2, 'FAN_AMPS', {
      id: 'COND2_FAN_AMPS',
      label: 'Condenser 2 fan amps',
      type: 'REAL',
      graphEnabled: true,
    }),
    bind(tag, d2, 'COMP_AMPS', {
      id: 'COND2_COMP_AMPS',
      label: 'Condenser 2 compressor amps',
      type: 'REAL',
      graphEnabled: true,
    }),
    tag('COND2_LOCKOUT', {
      label: 'Condenser 2 lockout',
      alarmsEnabled: true,
      alarmCondition: 'on',
      comment: 'Config D — derived from X1_I1 in ST',
    }),
    tag('COND2_SHUTDOWN', {
      label: 'Condenser 2 shutdown',
      comment: 'Config D — derived from X1_I2 in ST',
    }),

    tag('R1', { label: 'Alarm relay 1', role: 'output', driverId: d1, driverAddress: { channel: 'R1' } }),
    tag('R2', { label: 'Alarm relay 2', role: 'output', driverId: d1, driverAddress: { channel: 'R2' } }),
    tag('R3', { label: 'Site OK relay', role: 'output', driverId: d1, driverAddress: { channel: 'R3' } }),
  ];
}

function buildDrivers() {
  return [
    {
      id: 'opta_hvac_01',
      type: 'mqtt_parc',
      enabled: true,
      deviceId: OPTA_DEVICE_ID,
      name: 'Opta HVAC primary',
      reportIntervalMs: 200,
      reportIntervalSec: 1,
      scanMs: 100,
      remoteExecution: false,
      ioBaseOnly: false,
    },
    {
      id: 'opta_hvac_02',
      type: 'mqtt_parc',
      enabled: false,
      deviceId: OPTA_DEVICE_ID_2,
      name: 'Opta HVAC secondary (config D)',
      reportIntervalSec: 1,
      scanMs: 100,
      remoteExecution: false,
      telemetryOnly: true,
    },
  ];
}

function screenLayout(id, name, number, extra = {}) {
  const cols = 16;
  const rows = 12;
  const cell = 64;
  return {
    id,
    number,
    isHome: number === 1,
    name,
    svg: extra.svg || null,
    tiles: extra.tiles || [],
    gridCols: cols,
    gridRows: rows,
    cellWidth: cell,
    cellHeight: cell,
    gridSize: cols,
    width: cols * cell,
    height: rows * cell,
    displayMaxWidth: 1024,
    displayMaxHeight: 768,
    fit: 'contain',
    scale: 100,
    background: extra.background ?? '#f1f5f9',
    offsetX: 0,
    offsetY: 0,
    naturalWidth: null,
    naturalHeight: null,
  };
}

function textTileLayers(prefix, rows, navTarget = 'screen_1') {
  const layers = [
    { kind: 'flashOverlay', z: 2, color: 'red', tagId: `${prefix}_FAIL_ALM` },
    {
      kind: 'navButton',
      z: 4,
      targetScreenId: navTarget,
      label: 'Overview',
      hotspotCol: 0,
      hotspotRow: 0,
      hotspotColSpan: 2,
      hotspotRowSpan: 1,
    },
  ];
  rows.forEach(([suffix, label], i) => {
    layers.push({
      kind: 'textTile',
      z: 3,
      label,
      tagId: `${prefix}_${suffix}`,
      hotspotCol: 2,
      hotspotRow: 1 + i * 2,
      hotspotColSpan: 12,
      hotspotRowSpan: 2,
    });
  });
  return layers;
}

function buildScreens() {
  return [
    screenLayout('screen_1', 'HVAC overview', 1, {
      tiles: [{
        col: 0, row: 0, colSpan: 16, rowSpan: 12,
        layers: [
          { kind: 'flashOverlay', z: 2, color: 'red', tagId: 'SITE_ALM' },
          { kind: 'alarmList', z: 3, alarmList: { showAcked: false } },
          {
            kind: 'textTile',
            z: 3,
            label: 'Active config (0–3)',
            tagId: 'HVAC_CFG',
            hotspotCol: 0,
            hotspotRow: 0,
            hotspotColSpan: 4,
            hotspotRowSpan: 2,
          },
          { kind: 'pageHotspot', z: 4, targetScreenId: 'screen_2', label: 'Unit 1', hotspotCol: 4, hotspotRow: 0, hotspotColSpan: 3, hotspotRowSpan: 2 },
          { kind: 'pageHotspot', z: 4, targetScreenId: 'screen_3', label: 'Unit 2', hotspotCol: 8, hotspotRow: 0, hotspotColSpan: 3, hotspotRowSpan: 2 },
        ],
      }],
    }),
    screenLayout('screen_2', 'Unit 1 detail', 2, {
      tiles: [{
        col: 0, row: 0, colSpan: 16, rowSpan: 12,
        layers: textTileLayers('AHU1', [
          ['PAN_LEAK', 'Pan leak'],
          ['SAFETY_SW', 'Safety switch'],
          ['FAN_AMPS', 'Blower amps'],
          ['SUPPLY_TEMP_F', 'Supply °F'],
          ['RETURN_TEMP_F', 'Return °F'],
          ['FAN_FLT', 'Blower fault'],
        ]),
      }],
    }),
    screenLayout('screen_3', 'Unit 2 / condenser detail', 3, {
      tiles: [{
        col: 0, row: 0, colSpan: 16, rowSpan: 12,
        layers: [
          ...textTileLayers('AHU2', [
            ['PAN_LEAK', 'Pan leak'],
            ['SAFETY_SW', 'Safety switch'],
            ['FAN_AMPS', 'Blower amps'],
            ['SUPPLY_TEMP_F', 'Supply °F'],
            ['RETURN_TEMP_F', 'Return °F'],
            ['FAN_FLT', 'Blower fault'],
          ], 'screen_1'),
          ...textTileLayers('COND2', [
            ['HI_TEMP_F', 'High side °F'],
            ['LO_TEMP_F', 'Low side °F'],
            ['FAN_AMPS', 'Fan amps'],
            ['COMP_AMPS', 'Compressor amps'],
            ['FAN_FLT', 'Fan fault'],
            ['COMP_FLT', 'Compressor fault'],
          ], 'screen_1').slice(2),
        ],
      }],
    }),
  ];
}

function buildMvDraw() {
  return {
    format: 'mooreview-mvdraw',
    version: 1,
    savedAt: new Date().toISOString(),
    name: 'hvac-opta-parc',
    units: 'ft',
    scale: null,
    extents: null,
    background: null,
    nodes: [
      { id: 'node_opta', type: 'sld_opta', x: -15, y: -10, rotation: 0, scaleX: 1, scaleY: 1, label: 'Opta primary', meta: {} },
      { id: 'node_d1608', type: 'sld_expansion_d1608e', x: 37.5, y: -10, rotation: 0, scaleX: 1, scaleY: 1, label: 'D1608E (cfg C/D)', meta: {} },
      { id: 'node_opta2', type: 'sld_opta', x: 90, y: -10, rotation: 0, scaleX: 1, scaleY: 1, label: 'Opta 2 (cfg D)', meta: {} },
      { id: 'node_supply', type: 'sld_dc_supply', x: -75, y: 60, rotation: 0, scaleX: 1, scaleY: 1, label: '24 VDC', meta: {} },
    ],
    edges: [{
      id: 'edge_pwr',
      from: 'node_supply:dc_plus_1',
      to: 'node_opta:com',
      kind: 'src',
      points: [[-100, 12.5], [-100, 30]],
      label: '24 V',
    }],
    groups: [],
    annotations: [],
    libraryFile: 'hvac-opta-parc.mvdraw.json',
    meta: {
      client: '',
      site: '',
      notes: 'Configs A/B base Opta; C/D add D1608E; D adds second Opta',
      mooreviewProject: 'hvac-opta-parc',
    },
  };
}

const COMMISSIONING = {
  doc: 'docs/OPTA_PARC_CLOUD.md',
  firmware: 'firmware/arduino-opta-mqtt-st/MooreviewOptaMqttSt v2.3.63+',
  wifiSetup: {
    apSsid: 'MooreVIEW-Opta',
    apPassMinLen: 8,
    apUrl: 'http://192.168.4.1:8080/setup',
    setupPages: ['/setup', '/mcsa', '/api/status'],
    enableApField: 'wifiApEnable',
    note: 'Connect phone to MooreVIEW-Opta AP → open /setup for broker, device ID, expansions, WiFi AP password',
  },
  mqttParc: {
    topicPattern: 'mooreview/v1/{deviceId}/telemetry',
    cmdPattern: 'mooreview/v1/{deviceId}/cmd',
    globalSiteKey: 1,
    testTopic: 'mooreview/v1/{deviceId}/setup-test',
  },
  configs: Object.entries(CONFIG_META).map(([value, meta]) => ({
    hvacCfg: Number(value),
    ...meta,
  })),
  steps: [
    'Flash MooreviewOptaMqttSt; enable WiFi AP on /setup',
    'Set device ID, broker, MQTT user/pass (≤47 chars), global site key',
    'Scan expansions on /setup when config C or D (D1608E slot 1)',
    'Set HVAC_CFG tag (0–3) to match installed hardware',
    'Configs B/D: /mcsa → I/O layout HVAC; motor wiring 1P + start cap; deviceType 5 (all loads)',
    'Configs B/D: compressor run CT I1, fan run CT I2; edge AI model single-phase-start-v1',
    'Config A: blower 1P+cap — run CT I2, start-winding CT I3',
    'Config A/C: deploy hvac_opta_parc.st to primary Opta (optional remote execution)',
    'Drivers → Add Opta Parc from registry; enable opta_hvac_02 for config D',
    'Calibrate NTC tags (Tags → Scale → Opta NTC 24 VDC divider)',
  ],
};

const PROJECT = {
  name: 'hvac-opta-parc',
  title: 'HVAC — OPTA Parc (configs A–D)',
  programFile: 'logic/hvac_opta_parc.st',
  tagsFixture: 'tags.hvac_opta_parc.json',
  driversFixture: 'drivers.hvac_opta_parc.json',
  starterFixture: 'hvac_opta_parc_starter.json',
  templateId: 'arduino_opta_parc',
  templateIdMcsa: 'arduino_opta_mcsa_monitor',
  buildTags,
  buildDrivers,
  buildScreens,
  buildMvDraw,
  commissioning: COMMISSIONING,
  pdm: {
    motorType: 'mixed',
    application: 'hvac_opta_parc',
    assets: [
      { assetId: 'compressor' },
      { assetId: 'fan' },
      { assetId: 'blower' },
    ],
  },
};

module.exports = {
  OPTA_DEVICE_ID,
  OPTA_DEVICE_ID_2,
  MQTT_BROKER_URL,
  HVAC_CFG,
  CONFIG_META,
  PROJECT,
  tag,
};
