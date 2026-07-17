#!/usr/bin/env node
'use strict';

/**
 * Duplex lift station — ALT2 alternator + dual HOA + 3D oblique HMI.
 *
 * Usage: node scripts/duplex-lift-station/generate-est.js
 */

const fs = require('fs');
const path = require('path');
const { MAX_TAGS } = require('../../src/config');
const {
  compositeBindingElementId,
  listHmiComposites,
} = require('../../src/hmi/hmiComposites');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT_EST = path.join(ROOT, 'data', 'projects', 'duplex-lift-station.est.json');
const OUT_ST = path.join(ROOT, 'st', 'logic', '36_duplex_lift_station.st');
const TAGS_FIXTURE = path.join(ROOT, 'st', 'fixtures', 'tags.duplex_lift_station.json');
const LOGIC_DRIVERS = path.join(ROOT, 'st', 'fixtures', 'drivers.logic.json');

const GRID = { cols: 16, rows: 12, cellWidth: 64, cellHeight: 64 };
const PILOT_SVG = '/hmi/svg/library/controls/pilot-lights/mv/pl-canonical/pilot_light_round.svg';

function baseTag(raw) {
  return {
    id: raw.id,
    label: raw.label || raw.id,
    type: raw.type || 'BOOL',
    role: raw.role || 'memory',
    driverId: null,
    driverAddress: null,
    default: raw.type === 'REAL' ? (raw.value ?? 0) : raw.type === 'INT' ? (raw.value ?? 0) : (raw.value ?? false),
    scale: 1,
    offset: 0,
    alarmsEnabled: !!raw.alarmsEnabled,
    alarmOuterLow: null,
    alarmInnerLow: null,
    alarmInnerHigh: null,
    alarmOuterHigh: null,
    alarmCondition: raw.alarmCondition ?? null,
    readonly: false,
    preset: raw.preset ?? (raw.type === 'COUNTER' ? 999999 : raw.type === 'ALT' ? 2 : 0),
    mode: raw.mode || (raw.type === 'COUNTER' ? 'CTU' : raw.type === 'ALT' ? 'ALT2' : 'TON'),
    arrayLen: 1,
    value: raw.value ?? (raw.type === 'BOOL' ? false : 0),
    quality: 'GOOD',
    wordWidth: raw.wordWidth ?? (raw.type === 'INT' ? 16 : 16),
    signed: true,
    forceInput: false,
    forceOutput: false,
    graphEnabled: !!raw.graphEnabled,
    dirty: false,
    alarmLevel: null,
    fb: raw.fb || {},
  };
}

function buildTags() {
  const fixture = JSON.parse(fs.readFileSync(TAGS_FIXTURE, 'utf8'));
  return fixture.map(baseTag);
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

function compositeTile(col, row, compositeId, colSpan, rowSpan, svg) {
  return {
    col,
    row,
    colSpan,
    rowSpan,
    compositeId,
    layers: [{
      kind: 'staticImage',
      z: 0,
      svg,
    }],
  };
}

function pilotTile(col, row, label) {
  return {
    col,
    row,
    colSpan: 2,
    rowSpan: 2,
    label,
    layers: [{
      kind: 'staticImage',
      z: 0,
      svg: PILOT_SVG,
    }],
  };
}

function lampBinding(screenId, col, row, z, elementId, tagId, onColor = '#22c55e') {
  return {
    screenId,
    elementId: `t${col + 1}_${row + 1}_z${z}__${elementId}`,
    tagId,
    property: 'fill',
    onValue: onColor,
    offValue: '#94a3b8',
    classOn: 'hmi-on',
    classOff: 'hmi-off',
  };
}

function motorHoaBindings(screenId, col, row, prefix, manifest) {
  const defs = [
    { elementId: 'status_lamp', property: 'fill5', tagId: `${prefix}_STA`, min: 0, max: 4,
      colors: ['#64748b', '#22c55e', '#ef4444', '#fbed20', '#94a3b8'], flashStates: [] },
    { elementId: 'hoa_state', property: 'text', tagId: `${prefix}_HOA`, format: 'state3', min: 0, max: 2 },
    { elementId: 'run_state', property: 'text', tagId: `${prefix}_STA`, format: 'state5', min: 0, max: 4 },
    { elementId: 'run_hrs', property: 'text', tagId: `${prefix}_HRS`, format: 'fixed1', min: 0, max: 99999 },
    { elementId: 'starts_count', property: 'text', tagId: `${prefix}_STARTS`, format: 'int', min: 0, max: 999999 },
    { elementId: 'btn_offline', property: 'fill', tagId: `${prefix}_OFFLINE`, interaction: 'toggle',
      onValue: '#64748b', offValue: '#22c55e' },
    { elementId: 'btn_offline_label', property: 'text', tagId: `${prefix}_OFFLINE`,
      onValue: 'OFFLINE', offValue: 'ONLINE' },
    { elementId: 'btn_start', property: 'fill', tagId: `${prefix}_START`, onValue: '#22c55e', offValue: '#94a3b8' },
    { elementId: 'btn_stop', property: 'fill', tagId: `${prefix}_STOP`, onValue: '#ef4444', offValue: '#94a3b8' },
    { elementId: 'btn_reset', property: 'fill', tagId: `${prefix}_RESET`, onValue: '#f59e0b', offValue: '#94a3b8' },
  ];
  return defs.map((d) => {
    const elementId = compositeBindingElementId(col, row, manifest, d);
    const out = {
      screenId,
      elementId,
      tagId: d.tagId,
      property: d.property,
      onValue: d.onValue ?? '#22c55e',
      offValue: d.offValue ?? '#94a3b8',
      classOn: 'hmi-on',
      classOff: 'hmi-off',
    };
    if (d.format) out.format = d.format;
    if (d.min != null) out.min = d.min;
    if (d.max != null) out.max = d.max;
    if (d.interaction) out.interaction = d.interaction;
    if (d.colors) out.colors = d.colors.slice();
    if (d.flashStates) out.flashStates = d.flashStates.slice();
    return out;
  });
}

function alternatorBindings(screenId, col, row, manifest) {
  const defs = [
    { elementId: 'alt_label', property: 'text', tagId: 'ALT1', tagField: 'label' },
    { elementId: 'lead_unit', property: 'text', tagId: 'ALT1', tagField: 'activeUnit', format: 'int', min: 0, max: 4 },
    { elementId: 'stage_text', property: 'text', tagId: 'ALT1', tagField: 'pumpStage', format: 'altStage' },
    { elementId: 'lamp_off', property: 'fill', tagId: 'ALT1', tagField: 'offActive', onValue: '#64748b', offValue: '#94a3b8' },
    { elementId: 'lamp_high', property: 'fill', tagId: 'ALT1', tagField: 'highActive', onValue: '#ef4444', offValue: '#94a3b8' },
    { elementId: 'lamp_lag', property: 'fill', tagId: 'ALT1', tagField: 'lowActive', onValue: '#f59e0b', offValue: '#94a3b8' },
    { elementId: 'lamp_fault', property: 'fill', tagId: 'ALT_FAULT', onValue: '#ef4444', offValue: '#94a3b8' },
    { elementId: 'pump1_run', property: 'fill', tagId: 'MOTOR1_RUN', onValue: '#22c55e', offValue: '#94a3b8' },
    { elementId: 'pump2_run', property: 'fill', tagId: 'MOTOR2_RUN', onValue: '#22c55e', offValue: '#94a3b8' },
  ];
  return defs.map((d) => {
    const elementId = compositeBindingElementId(col, row, manifest, d);
    const out = {
      screenId,
      elementId,
      tagId: d.tagId,
      property: d.property,
      onValue: d.onValue ?? '#22c55e',
      offValue: d.offValue ?? '#94a3b8',
      classOn: 'hmi-on',
      classOff: 'hmi-off',
    };
    if (d.format) out.format = d.format;
    if (d.tagField) out.tagField = d.tagField;
    if (d.min != null) out.min = d.min;
    if (d.max != null) out.max = d.max;
    return out;
  });
}

function buildScreens(composites) {
  const motorManifest = composites.find((c) => c.composite?.id === 'motor_hoa')?.composite;
  const altManifest = composites.find((c) => c.composite?.id === 'alternator')?.composite;
  const motorSvg = motorManifest?.parts?.[0]?.svg || '/hmi/svg/library/motor-faceplates/mooreview/motor_hoa.svg';
  const altSvg = altManifest?.parts?.[0]?.svg || '/hmi/svg/library/alternator-faceplates/mooreview/alternator.svg';

  return [
    screenLayout('screen_1', '3D Overview', 1, { tiles: [] }),
    screenLayout('screen_2', 'MCC — Alternator & HOA', 2, {
      tiles: [
        compositeTile(0, 0, 'alternator', 8, 6, altSvg),
        compositeTile(8, 0, 'motor_hoa', 8, 6, motorSvg),
        compositeTile(0, 6, 'motor_hoa', 8, 6, motorSvg),
        pilotTile(8, 6, 'OFF'),
        pilotTile(10, 6, 'LEAD'),
        pilotTile(12, 6, 'LAG'),
        pilotTile(14, 6, 'HIGH'),
        {
          col: 8,
          row: 8,
          colSpan: 4,
          rowSpan: 2,
          label: 'Wet well level %',
          layers: [{
            kind: 'staticText',
            z: 0,
            label: 'Wet well level %',
            textTagId: 'TANK_LVL',
          }],
        },
      ],
    }),
  ];
}

function buildBindings(composites) {
  const motorManifest = composites.find((c) => c.composite?.id === 'motor_hoa')?.composite;
  const altManifest = composites.find((c) => c.composite?.id === 'alternator')?.composite;
  const sid = 'screen_2';

  return [
    ...alternatorBindings(sid, 0, 0, altManifest),
    ...motorHoaBindings(sid, 8, 0, 'MOTOR1', motorManifest),
    ...motorHoaBindings(sid, 0, 6, 'MOTOR2', motorManifest),
    lampBinding(sid, 8, 6, 0, 'lamp', 'LVL_OFF', '#64748b'),
    lampBinding(sid, 10, 6, 0, 'lamp', 'LVL_LEAD', '#22c55e'),
    lampBinding(sid, 12, 6, 0, 'lamp', 'LVL_LAG', '#f59e0b'),
    lampBinding(sid, 14, 6, 0, 'lamp', 'LVL_HIGH', '#ef4444'),
    {
      screenId: sid,
      elementId: 't9_9_z0__label',
      tagId: 'TANK_LVL',
      property: 'text',
      format: 'fixed1',
      min: 0,
      max: 100,
    },
  ];
}

function main() {
  const composites = listHmiComposites(PUBLIC);
  const tags = buildTags();
  if (tags.length > MAX_TAGS) {
    console.error(`Tag count ${tags.length} exceeds MAX_TAGS ${MAX_TAGS}`);
    process.exit(1);
  }

  const screens = buildScreens(composites);
  const bindings = buildBindings(composites);
  const program = fs.readFileSync(OUT_ST, 'utf8');
  const drivers = JSON.parse(fs.readFileSync(LOGIC_DRIVERS, 'utf8'));

  fs.mkdirSync(path.dirname(OUT_EST), { recursive: true });

  const est = {
    format: 'mooreview-est',
    version: 1,
    savedAt: new Date().toISOString(),
    project: { name: 'duplex-lift-station' },
    tags,
    drivers,
    program,
    activeProgram: 'logic/36_duplex_lift_station.st',
    settings: {
      project: { name: 'duplex-lift-station' },
      scanMs: 100,
      activeProgram: 'logic/36_duplex_lift_station.st',
      demoFeatures: { hmiTestMode: true },
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
          facility3dUrl: '/samples/duplex-lift-station-ortho-3d.html',
          areaPopupScreens: ['screen_2'],
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
  console.log('  3D: /samples/duplex-lift-station-ortho-3d.html');
  console.log('  Program: st/logic/36_duplex_lift_station.st');
}

main();
