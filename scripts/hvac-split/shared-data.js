'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function baseTag(id, extra = {}) {
  return {
    id,
    label: extra.label || id,
    type: extra.type || 'BOOL',
    role: extra.role || 'memory',
    driverId: extra.driverId ?? null,
    driverAddress: extra.driverAddress ?? null,
    default: extra.type === 'REAL' ? (extra.default ?? 0) : extra.type === 'INT' ? (extra.default ?? 0) : (extra.default ?? false),
    scale: extra.scale ?? 1,
    offset: extra.offset ?? 0,
    alarmsEnabled: !!extra.alarmsEnabled,
    alarmOuterLow: null,
    alarmInnerLow: null,
    alarmInnerHigh: null,
    alarmOuterHigh: null,
    alarmCondition: extra.alarmCondition ?? null,
    readonly: !!extra.readonly,
    preset: 0,
    mode: 'TON',
    arrayLen: 1,
    value: extra.type === 'BOOL' ? (extra.default ?? false) : (extra.default ?? 0),
    quality: 'GOOD',
    wordWidth: 16,
    signed: true,
    forceInput: false,
    forceOutput: false,
    graphEnabled: !!extra.graphEnabled,
    dirty: false,
    alarmLevel: null,
    fb: {},
  };
}

/** Parc field → project tag (°C thermistors scaled to °F in driver). */
function parcInput(id, parcTagId, extra = {}) {
  const scale = extra.scale ?? (String(parcTagId).endsWith('_C') ? 1.8 : 1);
  const offset = extra.offset ?? (String(parcTagId).endsWith('_C') ? 32 : 0);
  return baseTag(id, {
    ...extra,
    role: 'input',
    driverId: extra.driverId || 'opta_hvac',
    driverAddress: { channel: parcTagId },
    scale,
    offset,
    readonly: true,
  });
}

const SINGLE_SPLIT_TAGS = () => [
  parcInput('COMP_FLT', 'COMP_FLT', { label: 'Compressor fault', alarmsEnabled: true, alarmCondition: 'on' }),
  parcInput('FAN_FLT', 'FAN_FLT', { label: 'Condenser fan fault', alarmsEnabled: true, alarmCondition: 'on' }),
  parcInput('COND_HI_TEMP', 'T1_C', { label: 'Condenser hi side °F', type: 'REAL', default: 95, graphEnabled: true }),
  parcInput('COND_LO_TEMP', 'T2_C', { label: 'Condenser lo side °F', type: 'REAL', default: 42, graphEnabled: true }),
  parcInput('COMP_AMPS', 'COMP_AMPS', { label: 'Compressor amps', type: 'REAL', default: 12.5, graphEnabled: true }),
  parcInput('FAN_AMPS', 'FAN_AMPS', { label: 'Fan amps', type: 'REAL', default: 1.2, graphEnabled: true }),
  parcInput('AHU1_SUPPLY_TEMP_F', 'AHU1_SUPPLY_TEMP_F', { label: 'AHU supply °F', type: 'REAL', default: 58, graphEnabled: true }),
  parcInput('AHU1_RETURN_TEMP_F', 'AHU1_RETURN_TEMP_F', { label: 'AHU return °F', type: 'REAL', default: 74, graphEnabled: true }),
  parcInput('AHU1_PAN_LEAK', 'AHU1_PAN_LEAK', { label: 'AHU pan leak', alarmsEnabled: true, alarmCondition: 'on' }),
  baseTag('COND_ALM', { label: 'Condenser alarm', alarmsEnabled: true, alarmCondition: 'on' }),
  baseTag('AHU_ALM', { label: 'Air handler alarm', alarmsEnabled: true, alarmCondition: 'on' }),
  baseTag('SYS_ALM', { label: 'System alarm', alarmsEnabled: true, alarmCondition: 'on' }),
];

const DOUBLE_SPLIT_TAGS = () => [
  parcInput('COND1_FAN_FLT', 'COND1_FAN_FLT', { label: 'Condenser 1 fan fault', alarmsEnabled: true, alarmCondition: 'on' }),
  parcInput('COND1_COMP_FLT', 'COND1_COMP_FLT', { label: 'Condenser 1 comp fault', alarmsEnabled: true, alarmCondition: 'on' }),
  parcInput('COND2_FAN_FLT', 'COND2_FAN_FLT', { label: 'Condenser 2 fan fault', alarmsEnabled: true, alarmCondition: 'on' }),
  parcInput('COND2_COMP_FLT', 'COND2_COMP_FLT', { label: 'Condenser 2 comp fault', alarmsEnabled: true, alarmCondition: 'on' }),
  parcInput('COND1_HI_TEMP', 'T1_C', { label: 'Unit 1 hi side °F', type: 'REAL', default: 98, graphEnabled: true }),
  parcInput('COND1_LO_TEMP', 'T2_C', { label: 'Unit 1 lo side °F', type: 'REAL', default: 44, graphEnabled: true }),
  parcInput('COND2_HI_TEMP', 'T3_C', { label: 'Unit 2 hi side °F', type: 'REAL', default: 96, graphEnabled: true }),
  parcInput('COND2_LO_TEMP', 'T4_C', { label: 'Unit 2 lo side °F', type: 'REAL', default: 43, graphEnabled: true }),
  parcInput('COND1_FAN_AMPS', 'COND1_FAN_AMPS', { label: 'Unit 1 fan amps', type: 'REAL', default: 1.1, graphEnabled: true }),
  parcInput('COND1_COMP_AMPS', 'COND1_COMP_AMPS', { label: 'Unit 1 comp amps', type: 'REAL', default: 11.8, graphEnabled: true }),
  parcInput('COND2_FAN_AMPS', 'COND2_FAN_AMPS', { label: 'Unit 2 fan amps', type: 'REAL', default: 1.0, graphEnabled: true }),
  parcInput('COND2_COMP_AMPS', 'COND2_COMP_AMPS', { label: 'Unit 2 comp amps', type: 'REAL', default: 10.5, graphEnabled: true }),
  parcInput('AHU1_SUPPLY_TEMP_F', 'AHU1_SUPPLY_TEMP_F', { label: 'AHU1 supply °F', type: 'REAL', default: 57, graphEnabled: true }),
  parcInput('AHU1_RETURN_TEMP_F', 'AHU1_RETURN_TEMP_F', { label: 'AHU1 return °F', type: 'REAL', default: 73, graphEnabled: true }),
  parcInput('AHU1_PAN_LEAK', 'AHU1_PAN_LEAK', { label: 'AHU1 pan leak', alarmsEnabled: true, alarmCondition: 'on' }),
  parcInput('AHU2_SUPPLY_TEMP_F', 'AHU2_SUPPLY_TEMP_F', { label: 'AHU2 supply °F', type: 'REAL', default: 59, graphEnabled: true }),
  parcInput('AHU2_RETURN_TEMP_F', 'AHU2_RETURN_TEMP_F', { label: 'AHU2 return °F', type: 'REAL', default: 75, graphEnabled: true }),
  parcInput('AHU2_PAN_LEAK', 'AHU2_PAN_LEAK', { label: 'AHU2 pan leak', alarmsEnabled: true, alarmCondition: 'on' }),
  baseTag('COND1_ALM', { label: 'Condenser 1 alarm', alarmsEnabled: true, alarmCondition: 'on' }),
  baseTag('COND2_ALM', { label: 'Condenser 2 alarm', alarmsEnabled: true, alarmCondition: 'on' }),
  baseTag('AHU1_ALM', { label: 'AHU1 alarm', alarmsEnabled: true, alarmCondition: 'on' }),
  baseTag('AHU2_ALM', { label: 'AHU2 alarm', alarmsEnabled: true, alarmCondition: 'on' }),
  baseTag('SYS_ALM', { label: 'System alarm', alarmsEnabled: true, alarmCondition: 'on' }),
];

function mqttParcDriver(projectId, deviceId, name, activeProgram) {
  return [{
    id: 'opta_hvac',
    type: 'mqtt_parc',
    enabled: true,
    deviceId,
    name,
    scanMs: 100,
    reportIntervalSec: 1,
    remoteExecution: true,
    activeProgram,
    templateId: projectId.includes('double') ? 'arduino_opta_hvac_double_split' : 'arduino_opta_hvac_split',
  }];
}

function lampBinding(screenId, elementId, tagId) {
  return {
    screenId,
    elementId,
    tagId,
    property: 'fill',
    onValue: '#ef4444',
    offValue: '#64748b',
    classOn: 'hmi-alarm',
    classOff: 'hmi-ok',
  };
}

function textBinding(screenId, elementId, tagId, format = 'fixed1') {
  return {
    screenId,
    elementId,
    tagId,
    property: 'text',
    onValue: '#0f172a',
    offValue: '#0f172a',
    format,
    classOn: 'hmi-on',
    classOff: 'hmi-off',
  };
}

function writeCondenserSvg(outPath, prefix, title) {
  const p = prefix ? `${prefix}_` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 680" width="320" height="680">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e0f2fe"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
  </defs>
  <rect width="320" height="680" fill="url(#sky)"/>
  <text x="160" y="36" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="16" font-weight="600" fill="#0f172a">${title}</text>
  <rect x="24" y="56" width="272" height="100" rx="4" fill="#cbd5e1" stroke="#64748b"/>
  <text x="160" y="82" text-anchor="middle" font-size="11" fill="#475569">Outdoor pad</text>
  <rect x="44" y="92" width="232" height="180" rx="6" fill="#f1f5f9" stroke="#334155" stroke-width="2"/>
  <circle cx="96" cy="182" r="46" fill="none" stroke="#64748b" stroke-width="3"/>
  <circle cx="96" cy="182" r="6" fill="#64748b"/>
  <rect x="148" y="118" width="100" height="128" rx="4" fill="#e2e8f0" stroke="#475569"/>
  <text x="198" y="140" text-anchor="middle" font-size="10" fill="#475569">Compressor</text>
  <text x="28" y="310" font-size="12" fill="#334155">Fan fault</text>
  <circle id="lamp_${p}fan" cx="280" cy="306" r="10" fill="#64748b"/>
  <text x="28" y="345" font-size="12" fill="#334155">Compressor fault</text>
  <circle id="lamp_${p}comp" cx="280" cy="341" r="10" fill="#64748b"/>
  <rect x="24" y="370" width="272" height="130" rx="6" fill="#fff" stroke="#cbd5e1"/>
  <text x="160" y="395" text-anchor="middle" font-size="13" font-weight="600" fill="#334155">Refrigerant temps</text>
  <text x="40" y="430" font-size="12" fill="#334155">Hi side °F</text>
  <text id="val_${p}hi" x="280" y="430" text-anchor="end" font-family="Consolas,monospace" font-size="18" fill="#0f172a">—</text>
  <text x="40" y="465" font-size="12" fill="#334155">Lo side °F</text>
  <text id="val_${p}lo" x="280" y="465" text-anchor="end" font-family="Consolas,monospace" font-size="18" fill="#0f172a">—</text>
  <text x="40" y="500" font-size="12" fill="#334155">Fan amps</text>
  <text id="val_${p}fan_amps" x="280" y="500" text-anchor="end" font-family="Consolas,monospace" font-size="16" fill="#0f172a">—</text>
  <text x="40" y="530" font-size="12" fill="#334155">Comp amps</text>
  <text id="val_${p}comp_amps" x="280" y="530" text-anchor="end" font-family="Consolas,monospace" font-size="16" fill="#0f172a">—</text>
  <rect x="24" y="560" width="272" height="44" rx="4" fill="#fee2e2" stroke="#ef4444"/>
  <circle id="lamp_${p}alm" cx="48" cy="582" r="10" fill="#64748b"/>
  <text x="66" y="587" font-size="12" fill="#991b1b">Condenser alarm</text>
</svg>`;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, svg, 'utf8');
}

function writeAirHandlerSvg(outPath, prefix, title) {
  const p = prefix ? `${prefix}_` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 520" width="320" height="520">
  <rect width="320" height="520" fill="#f8fafc"/>
  <text x="160" y="36" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="16" font-weight="600" fill="#0f172a">${title}</text>
  <rect x="24" y="56" width="272" height="200" rx="6" fill="#e0e7ff" stroke="#4f46e5" stroke-width="2"/>
  <text x="160" y="86" text-anchor="middle" font-size="14" font-weight="600" fill="#312e81">Indoor air handler</text>
  <rect x="48" y="110" width="224" height="56" rx="4" fill="#c7d2fe" stroke="#6366f1"/>
  <text x="160" y="128" text-anchor="middle" font-size="11" fill="#3730a3">Supply plenum</text>
  <text id="val_${p}supply" x="160" y="154" text-anchor="middle" font-family="Consolas,monospace" font-size="22" fill="#0f172a">—</text>
  <rect x="48" y="178" width="224" height="56" rx="4" fill="#ddd6fe" stroke="#7c3aed"/>
  <text x="160" y="196" text-anchor="middle" font-size="11" fill="#5b21b6">Return grille</text>
  <text id="val_${p}return" x="160" y="222" text-anchor="middle" font-family="Consolas,monospace" font-size="22" fill="#0f172a">—</text>
  <text x="40" y="290" font-size="12" fill="#334155">Condensate pan leak</text>
  <circle id="lamp_${p}pan" cx="280" cy="286" r="10" fill="#64748b"/>
  <rect x="24" y="320" width="272" height="44" rx="4" fill="#fee2e2" stroke="#ef4444"/>
  <circle id="lamp_${p}alm" cx="48" cy="342" r="10" fill="#64748b"/>
  <text x="66" y="347" font-size="12" fill="#991b1b">Air handler alarm</text>
  <text x="160" y="400" text-anchor="middle" font-size="10" fill="#94a3b8">Opta AHU env — I5–I8 NTC + D1608E pan rope</text>
</svg>`;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, svg, 'utf8');
}

function writeSystemOverviewSvg(outPath, variant) {
  const isDouble = variant === 'double';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 640" width="1024" height="640">
  <rect width="1024" height="640" fill="#f1f5f9"/>
  <text x="512" y="40" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="22" font-weight="600" fill="#0f172a">${isDouble ? 'Double split HVAC' : 'Split HVAC'} — system overview</text>
  <rect x="40" y="70" width="420" height="320" rx="8" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/>
  <text x="250" y="100" text-anchor="middle" font-size="16" font-weight="600" fill="#1e40af">Building — air handlers</text>
  <rect x="70" y="130" width="160" height="120" rx="6" fill="#e0e7ff" stroke="#4f46e5"/>
  <text x="150" y="155" text-anchor="middle" font-size="13" fill="#312e81">AHU 1</text>
  <circle id="lamp_ahu1_alm" cx="210" cy="145" r="10" fill="#64748b"/>
  ${isDouble ? `<rect x="260" y="130" width="160" height="120" rx="6" fill="#e0e7ff" stroke="#4f46e5"/>
  <text x="340" y="155" text-anchor="middle" font-size="13" fill="#312e81">AHU 2</text>
  <circle id="lamp_ahu2_alm" cx="400" cy="145" r="10" fill="#64748b"/>` : ''}
  <rect x="540" y="70" width="440" height="320" rx="8" fill="#ecfccb" stroke="#65a30d" stroke-width="2"/>
  <text x="760" y="100" text-anchor="middle" font-size="16" font-weight="600" fill="#365314">Outdoor — condensers</text>
  <rect x="580" y="130" width="160" height="120" rx="6" fill="#f1f5f9" stroke="#334155"/>
  <text x="660" y="155" text-anchor="middle" font-size="13" fill="#334155">Condenser 1</text>
  <circle id="lamp_cond1_alm" cx="720" cy="145" r="10" fill="#64748b"/>
  ${isDouble ? `<rect x="770" y="130" width="160" height="120" rx="6" fill="#f1f5f9" stroke="#334155"/>
  <text x="850" y="155" text-anchor="middle" font-size="13" fill="#334155">Condenser 2</text>
  <circle id="lamp_cond2_alm" cx="910" cy="145" r="10" fill="#64748b"/>` : `<circle id="lamp_cond_alm" cx="720" cy="145" r="10" fill="#64748b"/>`}
  <rect x="40" y="430" width="940" height="56" rx="6" fill="#fee2e2" stroke="#ef4444" stroke-width="2"/>
  <circle id="lamp_sys_alm" cx="70" cy="458" r="12" fill="#64748b"/>
  <text x="95" y="463" font-size="15" fill="#991b1b">System alarm</text>
  <text x="512" y="520" text-anchor="middle" font-size="11" fill="#64748b">Firmware v2.3.81 · /mcsa HVAC + /ahu-env · Opta Parc mqtt_parc</text>
</svg>`;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, svg, 'utf8');
}

function singleSplitBindings() {
  const s2 = 'screen_2';
  const s3 = 'screen_3';
  const s4 = 'screen_4';
  return [
    lampBinding('screen_1', 'lamp_sys_alm', 'SYS_ALM'),
    lampBinding(s2, 'lamp_sys_alm', 'SYS_ALM'),
    lampBinding(s2, 'lamp_cond_alm', 'COND_ALM'),
    lampBinding(s2, 'lamp_ahu1_alm', 'AHU_ALM'),
    lampBinding(s3, 'lamp_pan', 'AHU1_PAN_LEAK'),
    lampBinding(s3, 'lamp_alm', 'AHU_ALM'),
    textBinding(s3, 'val_supply', 'AHU1_SUPPLY_TEMP_F', 'fixed0'),
    textBinding(s3, 'val_return', 'AHU1_RETURN_TEMP_F', 'fixed0'),
    lampBinding(s4, 'lamp_fan', 'FAN_FLT'),
    lampBinding(s4, 'lamp_comp', 'COMP_FLT'),
    lampBinding(s4, 'lamp_alm', 'COND_ALM'),
    textBinding(s4, 'val_hi', 'COND_HI_TEMP', 'fixed0'),
    textBinding(s4, 'val_lo', 'COND_LO_TEMP', 'fixed0'),
    textBinding(s4, 'val_fan_amps', 'FAN_AMPS', 'fixed1'),
    textBinding(s4, 'val_comp_amps', 'COMP_AMPS', 'fixed1'),
  ];
}

function doubleSplitBindings() {
  const s2 = 'screen_2';
  const s3 = 'screen_3';
  const s4 = 'screen_4';
  const s5 = 'screen_5';
  const s6 = 'screen_6';
  return [
    lampBinding('screen_1', 'lamp_sys_alm', 'SYS_ALM'),
    lampBinding(s2, 'lamp_sys_alm', 'SYS_ALM'),
    lampBinding(s2, 'lamp_cond1_alm', 'COND1_ALM'),
    lampBinding(s2, 'lamp_cond2_alm', 'COND2_ALM'),
    lampBinding(s2, 'lamp_ahu1_alm', 'AHU1_ALM'),
    lampBinding(s2, 'lamp_ahu2_alm', 'AHU2_ALM'),
    lampBinding(s3, 'lamp_ahu1_pan', 'AHU1_PAN_LEAK'),
    lampBinding(s3, 'lamp_ahu1_alm', 'AHU1_ALM'),
    textBinding(s3, 'val_ahu1_supply', 'AHU1_SUPPLY_TEMP_F', 'fixed0'),
    textBinding(s3, 'val_ahu1_return', 'AHU1_RETURN_TEMP_F', 'fixed0'),
    lampBinding(s3, 'lamp_ahu2_pan', 'AHU2_PAN_LEAK'),
    lampBinding(s3, 'lamp_ahu2_alm', 'AHU2_ALM'),
    textBinding(s3, 'val_ahu2_supply', 'AHU2_SUPPLY_TEMP_F', 'fixed0'),
    textBinding(s3, 'val_ahu2_return', 'AHU2_RETURN_TEMP_F', 'fixed0'),
    lampBinding(s4, 'lamp_cond1_fan', 'COND1_FAN_FLT'),
    lampBinding(s4, 'lamp_cond1_comp', 'COND1_COMP_FLT'),
    lampBinding(s4, 'lamp_cond1_alm', 'COND1_ALM'),
    textBinding(s4, 'val_cond1_hi', 'COND1_HI_TEMP', 'fixed0'),
    textBinding(s4, 'val_cond1_lo', 'COND1_LO_TEMP', 'fixed0'),
    textBinding(s4, 'val_cond1_fan_amps', 'COND1_FAN_AMPS', 'fixed1'),
    textBinding(s4, 'val_cond1_comp_amps', 'COND1_COMP_AMPS', 'fixed1'),
    lampBinding(s5, 'lamp_cond2_fan', 'COND2_FAN_FLT'),
    lampBinding(s5, 'lamp_cond2_comp', 'COND2_COMP_FLT'),
    lampBinding(s5, 'lamp_cond2_alm', 'COND2_ALM'),
    textBinding(s5, 'val_cond2_hi', 'COND2_HI_TEMP', 'fixed0'),
    textBinding(s5, 'val_cond2_lo', 'COND2_LO_TEMP', 'fixed0'),
    textBinding(s5, 'val_cond2_fan_amps', 'COND2_FAN_AMPS', 'fixed1'),
    textBinding(s5, 'val_cond2_comp_amps', 'COND2_COMP_AMPS', 'fixed1'),
  ];
}

function screenLayout(id, name, number, svg, extra = {}) {
  const GRID = { cols: 16, rows: 12, cellWidth: 64, cellHeight: 64 };
  return {
    id,
    number,
    isHome: number === 1,
    name,
    svg,
    tiles: [],
    gridCols: GRID.cols,
    gridRows: GRID.rows,
    cellWidth: GRID.cellWidth,
    cellHeight: GRID.cellHeight,
    gridSize: GRID.cols,
    width: GRID.cols * GRID.cellWidth,
    height: GRID.rows * GRID.cellHeight,
    displayMaxWidth: 1024,
    displayMaxHeight: 768,
    fit: 'contain',
    scale: 100,
    background: svg ? '#f8fafc' : '#0f172a',
    offsetX: 0,
    offsetY: 0,
    naturalWidth: null,
    naturalHeight: null,
    ...extra,
  };
}

module.exports = {
  ROOT,
  baseTag,
  SINGLE_SPLIT_TAGS,
  DOUBLE_SPLIT_TAGS,
  mqttParcDriver,
  writeCondenserSvg,
  writeAirHandlerSvg,
  writeSystemOverviewSvg,
  singleSplitBindings,
  doubleSplitBindings,
  screenLayout,
};
