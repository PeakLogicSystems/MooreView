#!/usr/bin/env node
'use strict';

/**
 * MLE plant — 2× separate 125K gal integrated circular MLE tanks (3D HMI).
 *
 * Usage: node scripts/mle-wastewater/generate-est.js
 */

const fs = require('fs');
const path = require('path');
const { MAX_TAGS } = require('../../src/config');
const { buildFromPreset } = require('../../src/devices/devicePresets');
const {
  compositeBindingElementId,
  listHmiComposites,
} = require('../../src/hmi/hmiComposites');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT_EST = path.join(ROOT, 'data', 'projects', 'mle-wastewater.est.json');
const OUT_ST = path.join(ROOT, 'st', 'logic', 'mle_wastewater_plant.st');
const LOGIC_DRIVERS = path.join(ROOT, 'st', 'fixtures', 'drivers.logic.json');
const DO3500_FACEPLATE = '/hmi/svg/library/sensor-faceplates/mooreview/icon_do3500.svg';
const DO3500_SERIAL = process.env.DO3500_SERIAL || 'COM3';

const GRID = { cols: 16, rows: 12, cellWidth: 64, cellHeight: 64 };
const SVG = {
  tank1: '/hmi/svg/demos/mle-wastewater/tank1_detail.svg',
  tank2: '/hmi/svg/demos/mle-wastewater/tank2_detail.svg',
  overview: '/hmi/svg/demos/mle-wastewater/plant_overview.svg',
  control: '/hmi/svg/demos/mle-wastewater/control_building.svg',
};

function baseTag(id, extra = {}) {
  return {
    id,
    label: extra.label || id,
    type: extra.type || 'BOOL',
    role: extra.role || 'memory',
    driverId: null,
    driverAddress: null,
    default: extra.default ?? (extra.type === 'REAL' ? 0 : extra.type === 'INT' ? 0 : false),
    scale: extra.scale ?? 1,
    offset: extra.offset ?? 0,
    alarmsEnabled: !!extra.alarmsEnabled,
    alarmOuterLow: extra.alarmOuterLow ?? null,
    alarmInnerLow: extra.alarmInnerLow ?? null,
    alarmInnerHigh: extra.alarmInnerHigh ?? null,
    alarmOuterHigh: extra.alarmOuterHigh ?? null,
    alarmCondition: extra.alarmCondition ?? null,
    readonly: false,
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

function integratedMleTankTags(n, defaults = {}) {
  const p = `T${n}`;
  const name = `Tank ${n}`;
  return [
    baseTag(`${p}_LVL`, { label: `${name} level %`, type: 'REAL', role: 'input', graphEnabled: true, default: defaults.lvl ?? 58, alarmsEnabled: true, alarmInnerHigh: 90, alarmOuterHigh: 95 }),
    baseTag(`${p}_ANOX_DO`, { label: `${name} anoxic DO mg/L`, type: 'REAL', role: 'input', graphEnabled: true, default: defaults.anoxDo ?? 0.3, alarmsEnabled: true, alarmInnerHigh: 0.8, alarmOuterHigh: 1.0 }),
    baseTag(`${p}_ANOX_ORP`, { label: `${name} anoxic ORP mV`, type: 'REAL', role: 'input', graphEnabled: true, default: defaults.anoxOrp ?? -175, alarmsEnabled: true, alarmInnerHigh: -80, alarmOuterHigh: -50 }),
    baseTag(`${p}_AER_DO_SP`, { label: `${name} aerobic DO setpoint`, type: 'REAL', role: 'memory', default: 2.5, value: 2.5 }),
    baseTag(`${p}_NH3`, { label: `${name} ammonia mg/L`, type: 'REAL', role: 'input', graphEnabled: true, default: defaults.nh3 ?? 11, alarmsEnabled: true, alarmInnerHigh: 20, alarmOuterHigh: 25 }),
    baseTag(`${p}_PH`, { label: `${name} pH`, type: 'REAL', role: 'input', graphEnabled: true, default: defaults.ph ?? 7.1, alarmsEnabled: true, alarmInnerLow: 6.5, alarmOuterLow: 6.0, alarmInnerHigh: 8.5, alarmOuterHigh: 9.0 }),
    baseTag(`${p}_TEMP`, { label: `${name} temp °F`, type: 'REAL', role: 'input', graphEnabled: true, default: defaults.temp ?? 68 }),
    baseTag(`${p}_IR_FLOW`, { label: `${name} internal recycle GPM`, type: 'REAL', role: 'input', graphEnabled: true, default: defaults.irFlow ?? 180, alarmsEnabled: true, alarmInnerLow: 60, alarmOuterLow: 40 }),
    baseTag(`${p}_SCRAPER_RUN`, { label: `${name} sludge scraper run`, role: 'input', default: defaults.scraperRun ?? true, value: defaults.scraperRun ?? true }),
    baseTag(`${p}_SCRAPER_ALM`, { label: `${name} sludge scraper alarm`, role: 'memory', alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag(`${p}_WAS_PUMP1_RUN`, { label: `${name} WAS recirc pump 1 run`, role: 'input', default: defaults.wasPump1Run ?? true, value: defaults.wasPump1Run ?? true }),
    baseTag(`${p}_WAS_PUMP2_RUN`, { label: `${name} WAS recirc pump 2 run`, role: 'input', default: defaults.wasPump2Run ?? true, value: defaults.wasPump2Run ?? true }),
    baseTag(`${p}_WAS1_FLOW`, { label: `${name} WAS recirc pump 1 GPM`, type: 'REAL', role: 'input', graphEnabled: true, default: defaults.was1Flow ?? 95, alarmsEnabled: true, alarmInnerLow: 25, alarmOuterLow: 15 }),
    baseTag(`${p}_WAS2_FLOW`, { label: `${name} WAS recirc pump 2 GPM`, type: 'REAL', role: 'input', graphEnabled: true, default: defaults.was2Flow ?? 88, alarmsEnabled: true, alarmInnerLow: 25, alarmOuterLow: 15 }),
    baseTag(`${p}_WAS_PUMP_ALM`, { label: `${name} WAS recirculation pump alarm`, role: 'memory', alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag(`${p}_HI`, { label: `${name} high level`, role: 'memory' }),
    baseTag(`${p}_LO`, { label: `${name} low level`, role: 'memory' }),
    baseTag(`${p}_ALM`, { label: `${name} integrated MLE alarm`, role: 'memory', alarmsEnabled: true, alarmCondition: 'on' }),
  ];
}

function driverTagToEst(tag, overrides = {}) {
  const type = tag.type || 'REAL';
  const id = overrides.id || tag.id;
  return {
    id,
    label: overrides.label || tag.comment || id.replace(/_/g, ' '),
    type,
    role: tag.role || 'input',
    driverId: tag.driverId,
    driverAddress: tag.driverAddress,
    default: tag.value ?? (type === 'BOOL' ? false : 0),
    scale: tag.scale ?? 1,
    offset: tag.offset ?? 0,
    alarmsEnabled: overrides.alarmsEnabled ?? false,
    alarmOuterLow: overrides.alarmOuterLow ?? null,
    alarmInnerLow: overrides.alarmInnerLow ?? null,
    alarmInnerHigh: overrides.alarmInnerHigh ?? null,
    alarmOuterHigh: overrides.alarmOuterHigh ?? null,
    alarmCondition: overrides.alarmCondition ?? null,
    readonly: (tag.role || 'input') === 'input',
    preset: 0,
    mode: 'TON',
    arrayLen: 1,
    value: tag.value ?? (type === 'BOOL' ? false : 0),
    quality: 'GOOD',
    wordWidth: tag.wordWidth ?? (type === 'REAL' ? 32 : 16),
    signed: tag.signed !== false,
    forceInput: false,
    forceOutput: false,
    graphEnabled: overrides.graphEnabled ?? (tag.graphEnabled !== false && (type === 'REAL' || type === 'INT')),
    dirty: false,
    alarmLevel: null,
    fb: {},
  };
}

/** Icon ProCon DO3500 #n — aerobic DO wired to existing T{n}_AER_DO tag. */
function buildDo3500ForTank(n) {
  const p = `T${n}`;
  const name = `Tank ${n}`;
  const built = buildFromPreset('icon_do3500', {
    driverId: `do3500_t${n}`,
    serialPort: DO3500_SERIAL,
  });
  built.driver.slaveId = n;
  const idMap = {
    DO3500_DO: {
      id: `${p}_AER_DO`,
      label: `${name} aerobic DO mg/L (DO3500 #${n})`,
      alarmsEnabled: true,
      alarmInnerLow: 2.0,
      alarmOuterLow: 1.5,
      graphEnabled: true,
    },
    DO3500_TEMP_C: { id: `${p}_DO3500_TEMP_C`, label: `${name} DO3500 #${n} temp` },
    DO3500_MAIN_V: { id: `${p}_DO3500_MAIN_V`, label: `${name} DO3500 #${n} main V`, graphEnabled: false },
    DO3500_TEMP_V: { id: `${p}_DO3500_TEMP_V`, label: `${name} DO3500 #${n} temp V`, graphEnabled: false },
  };
  const tags = built.tags
    .filter((t) => idMap[t.id])
    .map((t) => driverTagToEst(t, idMap[t.id]));
  return { driver: built.driver, tags };
}

function sharedBlowerTags() {
  const aerRun = [true, true, false];
  const anoxRun = [true, true, true];
  const tags = [];
  for (let i = 1; i <= 3; i++) {
    tags.push(baseTag(`AER_CEN_BLOW${i}_RUN`, {
      label: `Shared aerobic centrifugal blower ${i} run`,
      role: 'input',
      default: aerRun[i - 1],
      value: aerRun[i - 1],
    }));
    tags.push(baseTag(`AER_CEN_BLOW${i}_AMPS`, {
      label: `Shared aerobic centrifugal blower ${i} amps`,
      type: 'REAL',
      role: 'input',
      graphEnabled: true,
      default: 26 + i * 3,
    }));
    tags.push(baseTag(`ANOX_PD_BLOW${i}_RUN`, {
      label: `Shared anoxic PD blower ${i} run`,
      role: 'input',
      default: anoxRun[i - 1],
      value: anoxRun[i - 1],
    }));
    tags.push(baseTag(`ANOX_PD_BLOW${i}_AMPS`, {
      label: `Shared anoxic PD blower ${i} amps`,
      type: 'REAL',
      role: 'input',
      graphEnabled: true,
      default: 12 + i * 2,
    }));
  }
  tags.push(baseTag('AER_BLOW_ALM', { label: 'Shared aerobic blower alarm', role: 'memory', alarmsEnabled: true, alarmCondition: 'on' }));
  tags.push(baseTag('ANOX_BLOW_ALM', { label: 'Shared anoxic blower alarm', role: 'memory', alarmsEnabled: true, alarmCondition: 'on' }));
  return tags;
}

function controlElectricalTags() {
  return [
    baseTag('GEN_RUN', { label: 'Generator running', role: 'input', default: false, value: false }),
    baseTag('ATS_ENGAGED', { label: 'Transfer switch engaged (on generator)', role: 'input', default: false, value: false }),
    baseTag('GEN_FUEL_LOW', { label: 'Low generator fuel fault', role: 'input', default: false, value: false, alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag('GEN_FAULT', { label: 'Generator fault', role: 'input', default: false, value: false, alarmsEnabled: true, alarmCondition: 'on' }),
  ];
}

function buildTags() {
  const do1 = buildDo3500ForTank(1);
  const do2 = buildDo3500ForTank(2);
  return [
    baseTag('PLANT_ALM', { label: 'Plant — any alarm', role: 'memory', alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag('CTRL_ALM', { label: 'Control building alarm', role: 'memory', alarmsEnabled: true, alarmCondition: 'on' }),
    ...controlElectricalTags(),
    ...sharedBlowerTags(),
    ...integratedMleTankTags(1, { lvl: 62, anoxOrp: -180, nh3: 10 }),
    ...integratedMleTankTags(2, { lvl: 55, anoxOrp: -170, nh3: 12 }),
    ...do1.tags,
    ...do2.tags,
    baseTag('FLOW_IN', { label: 'Plant influent GPM', type: 'REAL', role: 'input', graphEnabled: true, default: 185 }),
    baseTag('FLOW_OUT', { label: 'Plant effluent GPM', type: 'REAL', role: 'input', graphEnabled: true, default: 172 }),
  ];
}

function buildDo3500Drivers() {
  return [
    buildDo3500ForTank(1).driver,
    buildDo3500ForTank(2).driver,
  ];
}

function screenLayout(id, name, number, extra = {}) {
  return {
    id,
    number,
    isHome: number === 1,
    name,
    svg: extra.svg || null,
    tiles: extra.tiles || [],
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
    background: '#f1f5f9',
    offsetX: 0,
    offsetY: 0,
    naturalWidth: null,
    naturalHeight: null,
  };
}

function navChip(target, label = '3D Overview') {
  return {
    kind: 'navButton',
    z: 4,
    targetScreenId: target,
    label,
    hotspotCol: 0,
    hotspotRow: 0,
    hotspotColSpan: 2,
    hotspotRowSpan: 1,
  };
}

function zoneTile(svgPath, alarmTag) {
  return {
    col: 0, row: 0, colSpan: 16, rowSpan: 12,
    layers: [
      { kind: 'staticImage', z: 0, svg: svgPath },
      { kind: 'flashOverlay', z: 2, color: 'red', tagId: alarmTag },
      navChip('screen_1'),
    ],
  };
}

function do3500Tile(col, row, tankNum) {
  return {
    col,
    row,
    colSpan: 5,
    rowSpan: 4,
    label: `DO3500 #${tankNum}`,
    compositeId: 'icon_do3500',
    layers: [{
      kind: 'staticImage',
      z: 0,
      svg: DO3500_FACEPLATE,
    }],
  };
}

function do3500CompositeBindings(screenId, col, row, tankNum, manifest) {
  const p = `T${tankNum}`;
  const defs = [
    { elementId: 'do_pv', property: 'text', tagId: `${p}_AER_DO`, format: 'fixed2', min: 0, max: 20 },
    { elementId: 'temp_pv', property: 'text', tagId: `${p}_DO3500_TEMP_C`, format: 'fixed1', min: -10, max: 150 },
    { elementId: 'main_v', property: 'text', tagId: `${p}_DO3500_MAIN_V`, format: 'fixed1', min: 0, max: 500 },
  ];
  return defs.map((d) => ({
    screenId,
    elementId: compositeBindingElementId(col, row, manifest, d),
    tagId: d.tagId,
    property: d.property,
    format: d.format,
    min: d.min,
    max: d.max,
    onValue: '#22c55e',
    offValue: '#94a3b8',
    classOn: 'hmi-on',
    classOff: 'hmi-off',
  }));
}

function runLamp(screenId, el, tag) {
  return {
    screenId,
    elementId: `t1_1_z0__${el}`,
    tagId: tag,
    property: 'fill',
    onValue: '#22c55e',
    offValue: '#64748b',
    classOn: 'hmi-on',
    classOff: 'hmi-off',
  };
}

function sharedBlowerBindings(screenId) {
  const out = [];
  for (let i = 1; i <= 3; i++) {
    out.push(runLamp(screenId, `lamp_aer_cent${i}_run`, `AER_CEN_BLOW${i}_RUN`));
    out.push(runLamp(screenId, `lamp_anox_pd${i}_run`, `ANOX_PD_BLOW${i}_RUN`));
  }
  const z = 't1_1_z0__';
  const alm = (el, tag) => ({
    screenId,
    elementId: `${z}${el}`,
    tagId: tag,
    property: 'fill',
    onValue: '#ef4444',
    offValue: '#64748b',
    classOn: 'hmi-on',
    classOff: 'hmi-off',
  });
  out.push(alm('lamp_aer_blow_alm', 'AER_BLOW_ALM'));
  out.push(alm('lamp_anox_blow_alm', 'ANOX_BLOW_ALM'));
  return out;
}

function wasPumpBindings(screenId, n) {
  const p = `T${n}`;
  const z = 't1_1_z0__';
  const lamp = (el, tag) => ({
    screenId,
    elementId: `${z}${el}`,
    tagId: tag,
    property: 'fill',
    onValue: '#ef4444',
    offValue: '#64748b',
    classOn: 'hmi-on',
    classOff: 'hmi-off',
  });
  const text = (el, tag, fmt = 'fixed0') => ({
    screenId,
    elementId: `${z}${el}`,
    tagId: tag,
    property: 'text',
    format: fmt,
  });
  return [
    runLamp(screenId, 'lamp_was_pump1_run', `${p}_WAS_PUMP1_RUN`),
    runLamp(screenId, 'lamp_was_pump2_run', `${p}_WAS_PUMP2_RUN`),
    lamp('lamp_was_pump_alm', `${p}_WAS_PUMP_ALM`),
    text('val_was1_flow', `${p}_WAS1_FLOW`, 'fixed0'),
    text('val_was2_flow', `${p}_WAS2_FLOW`, 'fixed0'),
    text(`val_t${n}_was1_flow`, `${p}_WAS1_FLOW`, 'fixed0'),
    text(`val_t${n}_was2_flow`, `${p}_WAS2_FLOW`, 'fixed0'),
  ];
}

function statusLamp(screenId, el, tag, onValue = '#f59e0b') {
  return {
    screenId,
    elementId: `t1_1_z0__${el}`,
    tagId: tag,
    property: 'fill',
    onValue,
    offValue: '#64748b',
    classOn: 'hmi-on',
    classOff: 'hmi-off',
  };
}

function controlBuildingBindings(screenId) {
  const z = 't1_1_z0__';
  const alm = (el, tag) => ({
    screenId,
    elementId: `${z}${el}`,
    tagId: tag,
    property: 'fill',
    onValue: '#ef4444',
    offValue: '#64748b',
    classOn: 'hmi-on',
    classOff: 'hmi-off',
  });
  return [
    alm('lamp_plant_alm', 'PLANT_ALM'),
    alm('lamp_t1_alm', 'T1_ALM'),
    alm('lamp_t2_alm', 'T2_ALM'),
    alm('lamp_ctrl_alm', 'CTRL_ALM'),
    runLamp(screenId, 'lamp_gen_run', 'GEN_RUN'),
    statusLamp(screenId, 'lamp_ats_engaged', 'ATS_ENGAGED'),
    alm('lamp_gen_fuel_low', 'GEN_FUEL_LOW'),
    alm('lamp_gen_fault', 'GEN_FAULT'),
    ...sharedBlowerBindings(screenId),
  ];
}

function tankBindings(screenId, n) {
  const p = `T${n}`;
  const z = 't1_1_z0__';
  const lamp = (el, tag) => ({ screenId, elementId: `${z}${el}`, tagId: tag, property: 'fill', onValue: '#ef4444', offValue: '#64748b' });
  const text = (el, tag, fmt = 'fixed1') => ({ screenId, elementId: `${z}${el}`, tagId: tag, property: 'text', format: fmt });

  return [
    { screenId, elementId: 't1_1_z2__flash_overlay', tagId: `${p}_ALM`, property: 'flashState', onValue: 'red', offValue: 'hidden' },
    text(`val_t${n}_lvl`, `${p}_LVL`, 'fixed1'),
    text(`val_t${n}_anox_do`, `${p}_ANOX_DO`, 'fixed2'),
    text(`val_t${n}_anox_orp`, `${p}_ANOX_ORP`, 'fixed0'),
    text(`val_t${n}_ph`, `${p}_PH`, 'fixed2'),
    text(`val_t${n}_aer_do`, `${p}_AER_DO`, 'fixed1'),
    text(`val_t${n}_aer_do_sp`, `${p}_AER_DO_SP`, 'fixed1'),
    text(`val_t${n}_ir_flow`, `${p}_IR_FLOW`, 'fixed0'),
    text(`val_t${n}_nh3`, `${p}_NH3`, 'fixed1'),
    text('val_place_do1', `${p}_AER_DO`, 'fixed1'),
    text('val_place_do2', `${p}_ANOX_DO`, 'fixed2'),
    text('val_place_orp', `${p}_ANOX_ORP`, 'fixed0'),
    text('val_place_ph', `${p}_PH`, 'fixed2'),
    runLamp(screenId, 'lamp_scraper_run', `${p}_SCRAPER_RUN`),
    lamp('lamp_scraper_alm', `${p}_SCRAPER_ALM`),
    ...wasPumpBindings(screenId, n),
    lamp(`lamp_t${n}_alm`, `${p}_ALM`),
  ];
}

function buildScreens() {
  return [
    screenLayout('screen_1', 'Plant Overview', 1, { tiles: [] }),
    screenLayout('screen_2', 'Tank 1 — Integrated MLE', 2, {
      svg: SVG.tank1,
      tiles: [zoneTile(SVG.tank1, 'T1_ALM'), do3500Tile(11, 8, 1)],
    }),
    screenLayout('screen_3', 'Tank 2 — Integrated MLE', 3, {
      svg: SVG.tank2,
      tiles: [zoneTile(SVG.tank2, 'T2_ALM'), do3500Tile(11, 8, 2)],
    }),
    screenLayout('screen_4', 'Plant Summary', 4, { svg: SVG.overview, tiles: [zoneTile(SVG.overview, 'PLANT_ALM')] }),
    screenLayout('screen_5', 'Control Building', 5, { svg: SVG.control, tiles: [zoneTile(SVG.control, 'PLANT_ALM')] }),
  ];
}

function buildBindings(do3500Manifest) {
  const z = 't1_1_z0__';
  const lamp = (sid, el, tag) => ({ screenId: sid, elementId: `${z}${el}`, tagId: tag, property: 'fill', onValue: '#ef4444', offValue: '#64748b' });
  const text = (sid, el, tag, fmt = 'fixed1') => ({ screenId: sid, elementId: `${z}${el}`, tagId: tag, property: 'text', format: fmt });

  return [
    ...tankBindings('screen_2', 1),
    ...tankBindings('screen_3', 2),
    ...sharedBlowerBindings('screen_2'),
    ...sharedBlowerBindings('screen_3'),
    text('screen_4', 'val_flow_in', 'FLOW_IN', 'fixed0'),
    text('screen_4', 'val_flow_out', 'FLOW_OUT', 'fixed0'),
    lamp('screen_4', 'lamp_t1_alm', 'T1_ALM'),
    lamp('screen_4', 'lamp_t2_alm', 'T2_ALM'),
    lamp('screen_4', 'lamp_plant_alm', 'PLANT_ALM'),
    lamp('screen_4', 'lamp_aer_blow_alm', 'AER_BLOW_ALM'),
    lamp('screen_4', 'lamp_anox_blow_alm', 'ANOX_BLOW_ALM'),
    ...controlBuildingBindings('screen_5'),
    ...do3500CompositeBindings('screen_2', 11, 8, 1, do3500Manifest),
    ...do3500CompositeBindings('screen_3', 11, 8, 2, do3500Manifest),
  ];
}

function main() {
  const tags = buildTags();
  if (tags.length > MAX_TAGS) {
    console.error(`Tag count ${tags.length} exceeds MAX_TAGS ${MAX_TAGS}`);
    process.exit(1);
  }

  const composites = listHmiComposites(PUBLIC);
  const do3500Manifest = composites.find((c) => c.composite?.id === 'icon_do3500')?.composite;
  if (!do3500Manifest) {
    console.error('Missing composite manifest icon_do3500');
    process.exit(1);
  }

  const screens = buildScreens();
  const bindings = buildBindings(do3500Manifest);
  const program = fs.readFileSync(OUT_ST, 'utf8');
  const logicDrivers = JSON.parse(fs.readFileSync(LOGIC_DRIVERS, 'utf8'));
  const drivers = [...logicDrivers, ...buildDo3500Drivers()];

  const est = {
    format: 'mooreview-est',
    version: 1,
    savedAt: new Date().toISOString(),
    project: { name: 'mle-wastewater' },
    tags,
    drivers,
    program,
    activeProgram: 'logic/mle_wastewater_plant.st',
    settings: {
      project: { name: 'mle-wastewater' },
      scanMs: 100,
      activeProgram: 'logic/mle_wastewater_plant.st',
      demoFeatures: { hmiTestMode: true },
      mleWastewater: {
        process: 'Modified Ludzack-Ettinger',
        layout: 'two_integrated_circular_tanks',
        tankZones: {
          center: 'large_clarifier',
          outerRing: { aerobic: 'half_perimeter', anoxic: 'half_perimeter', ringWidth: 'narrow_band' },
        },
        blowers: {
          aerobic: { type: 'centrifugal', count: 3, shared: true },
          anoxic: { type: 'pd', count: 3, shared: true },
        },
        tanks: [
          { id: 'T1', capacityGal: 125000, shape: 'circular', type: 'integrated_mle', label: 'Integrated MLE Tank 1' },
          { id: 'T2', capacityGal: 125000, shape: 'circular', type: 'integrated_mle', label: 'Integrated MLE Tank 2' },
        ],
      },
      hmi: {
        activeScreen: 'screen_1',
        testMode: false,
        layout: {
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
          showGridChrome: false,
          showLiveStatus: true,
          composerMode: '3d',
          facility3dUrl: '/samples/mle-wastewater-ortho-3d.html',
          areaPopupScreens: ['screen_2', 'screen_3', 'screen_4', 'screen_5'],
        },
        screens,
        bindings,
      },
    },
  };

  fs.writeFileSync(OUT_EST, `${JSON.stringify(est, null, 2)}\n`, 'utf8');
  console.log(`Generated ${OUT_EST}`);
  console.log(`  Tags: ${tags.length} / ${MAX_TAGS}`);
  console.log(`  Screens: ${screens.length}`);
  console.log(`  Bindings: ${bindings.length}`);
  console.log(`  DO3500 drivers: do3500_t1, do3500_t2 (${DO3500_SERIAL}, slave 1 & 2)`);
  console.log('  3D: /samples/mle-wastewater-ortho-3d.html');
}

main();
