#!/usr/bin/env node
'use strict';

/**
 * Demo American house — Next Century wired pilot project:
 * - Client room 101 (RM101_TOILET_LEAK → NC FA0032A8)
 * - Common hall bath (COMM_BATH_TOILET_LEAK → NC FA003195)
 * - Mechanical electric meter (MECH_METER_KWH → NC 11F01BBC)
 *
 * Usage: node scripts/demo-american-house/generate-est.js
 */

const fs = require('fs');
const path = require('path');
const { MAX_TAGS } = require('../../src/config');
const {
  NC_DRIVER_ID,
  DEVICES,
  SEMANTIC_MAP,
  applySemanticMap,
  buildNcMirrorTags,
} = require('./nextcentury-map');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_EST = path.join(ROOT, 'data', 'projects', 'demo-american-house.est.json');
const OUT_ST = path.join(ROOT, 'st', 'logic', 'demo_american_house.st');
const NC_DRIVERS = path.join(ROOT, 'st', 'fixtures', 'drivers.nextcentury.json');

const GRID = { cols: 16, rows: 12, cellWidth: 64, cellHeight: 64 };
const SVG = {
  overview: '/hmi/svg/demos/american-house/house_overview.svg',
  room: '/hmi/svg/demos/assisted-living/room_interior.svg',
  commonBath: '/hmi/svg/demos/assisted-living/support_restroom.svg',
  mechanical: '/hmi/svg/demos/assisted-living/mechanical_room.svg',
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
    value: extra.type === 'BOOL' ? false : 0,
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

function buildTags() {
  const tags = [
    baseTag('HOUSE_ANY_ALM', { label: 'House — any area alarm', role: 'memory', alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag('RM101_ALM', { label: 'Room 101 area alarm', role: 'memory', alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag('RM101_BATH_MID_LEAK', { label: 'Rm101 bath mid leak (sim)', role: 'input', alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag('RM101_TOILET_LEAK', { label: 'Rm101 toilet leak (NC)', role: 'input', alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag('COMM_BATH_ALM', { label: 'Common hall bath alarm', role: 'memory', alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag('COMM_BATH_BATH_MID_LEAK', { label: 'Common bath mid leak (sim)', role: 'input', alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag('COMM_BATH_TOILET_LEAK', { label: 'Common bath toilet leak (NC)', role: 'input', alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag('MECH_CFG_GAS_WH', { label: 'Mechanical — gas water heaters', role: 'memory', default: false, value: false }),
    baseTag('MECH_CFG_ELEC_WH', { label: 'Mechanical — electric water heaters', role: 'memory', default: true, value: true }),
    baseTag('MECH_FLOW_GPM', { label: 'DHW supply flow GPM', type: 'REAL', role: 'input', graphEnabled: true, alarmsEnabled: true, alarmInnerLow: 8, alarmOuterLow: 5, default: 12 }),
    baseTag('MECH_METER_KWH', { label: 'Site electric meter kWh (NC)', type: 'REAL', role: 'input', graphEnabled: true, default: 0 }),
    baseTag('MECH_TOTAL_KW', { label: 'HWH bank electric kW (sim)', type: 'REAL', role: 'input', graphEnabled: true, default: 12.5 }),
    baseTag('MECH_GAS_CFM', { label: 'HWH bank gas CFM (sim)', type: 'REAL', role: 'input', graphEnabled: true, default: 42 }),
    baseTag('MECH_WH1_KW', { label: 'WH1 electric kW', type: 'REAL', role: 'input', graphEnabled: true, default: 4.2 }),
    baseTag('MECH_WH2_KW', { label: 'WH2 electric kW', type: 'REAL', role: 'input', graphEnabled: true, default: 3.8 }),
    baseTag('MECH_WH3_KW', { label: 'WH3 electric kW', type: 'REAL', role: 'input', graphEnabled: true, default: 4.5 }),
    baseTag('MECH_WH1_TEMP', { label: 'WH1 outlet °F', type: 'REAL', role: 'input', graphEnabled: true, alarmsEnabled: true, alarmInnerHigh: 140, alarmOuterHigh: 160, default: 124 }),
    baseTag('MECH_WH2_TEMP', { label: 'WH2 outlet °F', type: 'REAL', role: 'input', graphEnabled: true, alarmsEnabled: true, alarmInnerHigh: 140, alarmOuterHigh: 160, default: 122 }),
    baseTag('MECH_WH3_TEMP', { label: 'WH3 outlet °F', type: 'REAL', role: 'input', graphEnabled: true, alarmsEnabled: true, alarmInnerHigh: 140, alarmOuterHigh: 160, default: 125 }),
    baseTag('MECH_WH1_RUN', { label: 'WH1 running', role: 'input', default: true }),
    baseTag('MECH_WH2_RUN', { label: 'WH2 running', role: 'input', default: true }),
    baseTag('MECH_WH3_RUN', { label: 'WH3 running', role: 'input', default: false }),
    baseTag('MECH_WH1_ALM', { label: 'WH1 alarm', role: 'memory' }),
    baseTag('MECH_WH2_ALM', { label: 'WH2 alarm', role: 'memory' }),
    baseTag('MECH_WH3_ALM', { label: 'WH3 alarm', role: 'memory' }),
    baseTag('ALF_MECH_ALM', { label: 'Mechanical area alarm', role: 'memory', alarmsEnabled: true, alarmCondition: 'on' }),
    ...buildNcMirrorTags(),
  ];
  return applySemanticMap(tags);
}

function screenLayout(id, name, number, extra = {}) {
  return {
    id,
    number,
    isHome: number === 1,
    name,
    svg: extra.svg || SVG.overview,
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

function navChip(target, label = 'Overview') {
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

function fixtureTile(svgPath, alarmTag) {
  return {
    col: 0, row: 0, colSpan: 16, rowSpan: 12,
    layers: [
      { kind: 'staticImage', z: 0, svg: svgPath },
      { kind: 'flashOverlay', z: 2, color: 'red', tagId: alarmTag },
      navChip('screen_1'),
    ],
  };
}

function buildScreens() {
  return [
    screenLayout('screen_1', 'House overview', 1, {
      svg: SVG.overview,
      tiles: [{
        col: 0, row: 0, colSpan: 16, rowSpan: 12,
        layers: [
          { kind: 'staticImage', z: 0, svg: SVG.overview },
          { kind: 'flashOverlay', z: 2, color: 'red', tagId: 'HOUSE_ANY_ALM', hotspotCol: 0, hotspotRow: 0, hotspotColSpan: 16, hotspotRowSpan: 12 },
          { kind: 'pageHotspot', z: 3, targetScreenId: 'screen_2', label: 'Client room', hotspotCol: 0, hotspotRow: 1, hotspotColSpan: 7, hotspotRowSpan: 5 },
          { kind: 'pageHotspot', z: 3, targetScreenId: 'screen_3', label: 'Common bath', hotspotCol: 9, hotspotRow: 1, hotspotColSpan: 7, hotspotRowSpan: 5 },
          { kind: 'pageHotspot', z: 3, targetScreenId: 'screen_4', label: 'Mechanical', hotspotCol: 4, hotspotRow: 7, hotspotColSpan: 8, hotspotRowSpan: 4 },
        ],
      }],
    }),
    screenLayout('screen_2', 'Client room 101', 2, {
      tiles: [fixtureTile(SVG.room, 'RM101_ALM')],
    }),
    screenLayout('screen_3', 'Common hall bath', 3, {
      tiles: [fixtureTile(SVG.commonBath, 'COMM_BATH_ALM')],
    }),
    screenLayout('screen_4', 'Mechanical', 4, {
      tiles: [{
        col: 0, row: 0, colSpan: 16, rowSpan: 12,
        layers: [
          { kind: 'staticImage', z: 0, svg: SVG.mechanical },
          { kind: 'flashOverlay', z: 2, color: 'red', tagId: 'ALF_MECH_ALM' },
          { kind: 'alarmList', z: 3, alarmList: { showAcked: false } },
          navChip('screen_1'),
        ],
      }],
    }),
  ];
}

function buildBindings() {
  const z = 't1_1_z0__';
  const lamp = (sid, el, tag) => ({ screenId: sid, elementId: `${z}${el}`, tagId: tag, property: 'fill', onValue: '#ef4444', offValue: '#64748b' });
  return [
    { screenId: 'screen_1', elementId: 't1_1_z2__flash_overlay', tagId: 'HOUSE_ANY_ALM', property: 'flashState', onValue: 'red', offValue: 'hidden' },
    { screenId: 'screen_1', elementId: `${z}lamp_site_alm`, tagId: 'HOUSE_ANY_ALM', property: 'fill', onValue: '#ef4444', offValue: '#64748b' },
    { screenId: 'screen_2', elementId: 't1_1_z2__flash_overlay', tagId: 'RM101_ALM', property: 'flashState', onValue: 'red', offValue: 'hidden' },
    lamp('screen_2', 'lamp_bath_mid', 'RM101_BATH_MID_LEAK'),
    lamp('screen_2', 'lamp_toilet', 'RM101_TOILET_LEAK'),
    lamp('screen_2', 'lamp_room_alm', 'RM101_ALM'),
    { screenId: 'screen_3', elementId: 't1_1_z2__flash_overlay', tagId: 'COMM_BATH_ALM', property: 'flashState', onValue: 'red', offValue: 'hidden' },
    lamp('screen_3', 'lamp_bath_mid', 'COMM_BATH_BATH_MID_LEAK'),
    lamp('screen_3', 'lamp_toilet', 'COMM_BATH_TOILET_LEAK'),
    lamp('screen_3', 'lamp_area_alm', 'COMM_BATH_ALM'),
    { screenId: 'screen_4', elementId: 't1_1_z2__flash_overlay', tagId: 'ALF_MECH_ALM', property: 'flashState', onValue: 'red', offValue: 'hidden' },
    { screenId: 'screen_4', elementId: `${z}val_flow_gpm`, tagId: 'MECH_FLOW_GPM', property: 'text', format: 'fixed1' },
    { screenId: 'screen_4', elementId: `${z}val_total_kw`, tagId: 'MECH_METER_KWH', property: 'text', format: 'fixed0' },
    { screenId: 'screen_4', elementId: `${z}val_gas_cfm`, tagId: 'MECH_GAS_CFM', property: 'text', format: 'fixed1' },
    { screenId: 'screen_4', elementId: `${z}val_wh1_kw`, tagId: 'MECH_WH1_KW', property: 'text', format: 'fixed1' },
    { screenId: 'screen_4', elementId: `${z}val_wh2_kw`, tagId: 'MECH_WH2_KW', property: 'text', format: 'fixed1' },
    { screenId: 'screen_4', elementId: `${z}val_wh3_kw`, tagId: 'MECH_WH3_KW', property: 'text', format: 'fixed1' },
    { screenId: 'screen_4', elementId: `${z}val_wh1_temp`, tagId: 'MECH_WH1_TEMP', property: 'text', format: 'fixed1' },
    { screenId: 'screen_4', elementId: `${z}val_wh2_temp`, tagId: 'MECH_WH2_TEMP', property: 'text', format: 'fixed1' },
    { screenId: 'screen_4', elementId: `${z}val_wh3_temp`, tagId: 'MECH_WH3_TEMP', property: 'text', format: 'fixed1' },
    lamp('screen_4', 'lamp_wh1_run', 'MECH_WH1_RUN'),
    lamp('screen_4', 'lamp_wh2_run', 'MECH_WH2_RUN'),
    lamp('screen_4', 'lamp_wh3_run', 'MECH_WH3_RUN'),
    lamp('screen_4', 'lamp_wh1_alm', 'MECH_WH1_ALM'),
    lamp('screen_4', 'lamp_wh2_alm', 'MECH_WH2_ALM'),
    lamp('screen_4', 'lamp_wh3_alm', 'MECH_WH3_ALM'),
    lamp('screen_4', 'lamp_mech_alm', 'ALF_MECH_ALM'),
    { screenId: 'screen_4', elementId: `${z}grp_energy_elec`, tagId: 'MECH_CFG_ELEC_WH', property: 'visibility', onValue: '1', offValue: '0' },
    { screenId: 'screen_4', elementId: `${z}grp_wh_elec`, tagId: 'MECH_CFG_ELEC_WH', property: 'visibility', onValue: '1', offValue: '0' },
    { screenId: 'screen_4', elementId: `${z}grp_energy_gas`, tagId: 'MECH_CFG_GAS_WH', property: 'visibility', onValue: '1', offValue: '0' },
  ];
}

function main() {
  const tags = buildTags();
  if (tags.length > MAX_TAGS) {
    console.error(`Tag count ${tags.length} exceeds MAX_TAGS ${MAX_TAGS}`);
    process.exit(1);
  }

  const screens = buildScreens();
  const bindings = buildBindings();
  const program = fs.readFileSync(OUT_ST, 'utf8');
  const drivers = JSON.parse(fs.readFileSync(NC_DRIVERS, 'utf8'));

  const est = {
    format: 'mooreview-est',
    version: 1,
    savedAt: new Date().toISOString(),
    project: { name: 'demo-american-house' },
    tags,
    drivers,
    program,
    activeProgram: 'logic/demo_american_house.st',
    settings: {
      project: { name: 'demo-american-house' },
      scanMs: 100,
      activeProgram: 'logic/demo_american_house.st',
      demoFeatures: { hmiTestMode: true },
      assistedLiving: { mechWhGas: false },
      demoAmericanHouse: {
        nextCentury: {
          driverId: NC_DRIVER_ID,
          propertyIds: [39990, 40074],
          devices: DEVICES,
          semanticMap: SEMANTIC_MAP,
        },
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
          composerMode: 'display',
          areaPopupScreens: ['screen_2', 'screen_3', 'screen_4'],
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
  console.log('  Next Century map:');
  for (const m of SEMANTIC_MAP) {
    console.log(`    ${m.tagId} ← ${m.deviceId}.${m.field}`);
  }
}

main();
