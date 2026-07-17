'use strict';

/**
 * Generates assisted-living MooreVIEW project:
 * - data/projects/assisted-living.est.json
 * - st/programs/logic/assisted_living.st
 * - public/hmi/svg/demos/assisted-living/floor_N_plan.svg
 *
 * Run: node scripts/generate-assisted-living-project.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SVG_DIR = path.join(ROOT, 'public/hmi/svg/demos/assisted-living');
const OUT_EST = path.join(ROOT, 'data/projects/assisted-living.est.json');
const OUT_ST = path.join(ROOT, 'st/programs/logic/assisted_living.st');

const DEMO_SVG = '/hmi/svg/demos/demo_process.svg';
const AL_SVG = '/hmi/svg/demos/assisted-living';

const GRID = { cols: 16, rows: 12, cellWidth: 64, cellHeight: 64 };
const STOVE_PRESET_MS = 1_800_000; // 30 min excess-on

function pad3(n) {
  return String(n).padStart(3, '0');
}

function rmPrefix(n) {
  return `RM${pad3(n)}`;
}

function baseTag(id, label, type, role, extra = {}) {
  return {
    id,
    label,
    type,
    role,
    driverId: null,
    driverAddress: null,
    default: type === 'BOOL' ? 0 : 0,
    scale: 1,
    offset: 0,
    alarmsEnabled: false,
    alarmOuterLow: null,
    alarmInnerLow: null,
    alarmInnerHigh: null,
    alarmOuterHigh: null,
    alarmCondition: null,
    readonly: false,
    preset: extra.preset ?? 0,
    mode: extra.mode ?? 'TON',
    arrayLen: 1,
    value: type === 'BOOL' ? false : 0,
    quality: 'GOOD',
    wordWidth: type === 'REAL' ? 32 : 16,
    signed: true,
    forceInput: false,
    forceOutput: false,
    graphEnabled: !!extra.graphEnabled,
    dirty: false,
    alarmLevel: null,
    fb: extra.fb ?? {},
    ...extra,
  };
}

function boolTag(id, label, alarmsEnabled = false, alarmCondition = null) {
  return baseTag(id, label, 'BOOL', 'memory', {
    alarmsEnabled,
    alarmCondition,
    value: false,
  });
}

function realTag(id, label, opts = {}) {
  return baseTag(id, label, 'REAL', 'memory', {
    alarmsEnabled: !!opts.alarmsEnabled,
    alarmInnerLow: opts.innerLow ?? null,
    alarmInnerHigh: opts.innerHigh ?? null,
    alarmOuterLow: opts.outerLow ?? null,
    alarmOuterHigh: opts.outerHigh ?? null,
    graphEnabled: opts.graphEnabled !== false,
    value: opts.value ?? 72,
  });
}

function timerTag(id, label, preset = STOVE_PRESET_MS) {
  return baseTag(id, label, 'TIMER', 'fb', {
    preset,
    fb: { input: false, elapsed: 0, done: false, running: false },
    value: false,
  });
}

function roomTags(n) {
  const p = rmPrefix(n);
  return [
    realTag(`${p}_LIV_TEMP`, `Rm ${n} living temp °F`, { innerLow: 65, innerHigh: 80, alarmsEnabled: true }),
    realTag(`${p}_BED_TEMP`, `Rm ${n} bedroom temp °F`, { innerLow: 65, innerHigh: 80, alarmsEnabled: true }),
    boolTag(`${p}_STOVE_ON`, `Rm ${n} stove on`),
    timerTag(`${p}_STOVE_TMR`, `Rm ${n} stove excess timer`, STOVE_PRESET_MS),
    boolTag(`${p}_STOVE_ALM`, `Rm ${n} stove on too long`, true, 'on'),
    boolTag(`${p}_BATH_TS_LEAK`, `Rm ${n} leak toilet/tub area`, true, 'on'),
    boolTag(`${p}_TOILET_LEAK`, `Rm ${n} toilet leak`, true, 'on'),
    boolTag(`${p}_BATH_ALM`, `Rm ${n} bath zone alarm`),
    boolTag(`${p}_AC_PAN_LEAK`, `Rm ${n} A/C pan leak`, true, 'on'),
    boolTag(`${p}_AC_BLOWER_FLT`, `Rm ${n} A/C blower fault`, true, 'on'),
    boolTag(`${p}_AC_COND_FAN_FLT`, `Rm ${n} roof condenser fan fault`, true, 'on'),
    boolTag(`${p}_AC_COMP_FLT`, `Rm ${n} A/C compressor fault`, true, 'on'),
    realTag(`${p}_AC_HI`, `Rm ${n} A/C high side °F`, { innerHigh: 300, outerHigh: 350, alarmsEnabled: true }),
    realTag(`${p}_AC_LO`, `Rm ${n} A/C low side °F`, { innerLow: 40, outerLow: 30, alarmsEnabled: true }),
    boolTag(`${p}_AC_FAIL_ALM`, `Rm ${n} A/C failure`),
    boolTag(`${p}_ANY_ALM`, `Rm ${n} any alarm`),
  ];
}

function facilityTags() {
  const tags = [
    boolTag('ALF_POOL_ALM', 'Facility pool area alarm'),
    boolTag('ALF_MECH_ALM', 'Facility mechanical alarm'),
    boolTag('ALF_FL1_ALM', 'Facility floor 1 alarm'),
    boolTag('ALF_FL2_ALM', 'Facility floor 2 alarm'),
    boolTag('ALF_FL3_ALM', 'Facility floor 3 alarm'),
    boolTag('SIM_ENABLE', 'Simulation enable', false),
    realTag('POOL_TEMP', 'Pool water temp °F', { innerLow: 82, innerHigh: 92, alarmsEnabled: true }),
    realTag('POOL_PH', 'Pool pH', { innerLow: 7.2, innerHigh: 7.6, alarmsEnabled: true }),
    realTag('POOL_ORP', 'Pool ORP mV', { innerLow: 650, innerHigh: 780, alarmsEnabled: true }),
    realTag('POOL_FLOW', 'Pool flow GPM', { innerLow: 20, outerLow: 10, alarmsEnabled: true }),
    boolTag('POOL_PUMP_RUN', 'Pool pump running'),
    boolTag('POOL_HEATER_ON', 'Pool heater on'),
    boolTag('POOL_LEVEL_OK', 'Pool level OK'),
    boolTag('POOL_FILTER_OK', 'Pool filter OK'),
    boolTag('POOL_ANY_ALM', 'Pool any alarm'),
    realTag('MECH_WH1_TEMP', 'WH1 supply temp °F', { innerLow: 110, innerHigh: 140, alarmsEnabled: true }),
    realTag('MECH_WH2_TEMP', 'WH2 supply temp °F', { innerLow: 110, innerHigh: 140, alarmsEnabled: true }),
    realTag('MECH_WH3_TEMP', 'WH3 supply temp °F', { innerLow: 110, innerHigh: 140, alarmsEnabled: true }),
    realTag('MECH_WH1_KWH', 'WH1 kWh meter', { graphEnabled: true }),
    realTag('MECH_WH2_KWH', 'WH2 kWh meter', { graphEnabled: true }),
    realTag('MECH_WH3_KWH', 'WH3 kWh meter', { graphEnabled: true }),
    realTag('MECH_WH1_KW', 'WH1 kW demand', { innerHigh: 12, alarmsEnabled: true }),
    realTag('MECH_WH2_KW', 'WH2 kW demand', { innerHigh: 12, alarmsEnabled: true }),
    realTag('MECH_WH3_KW', 'WH3 kW demand', { innerHigh: 12, alarmsEnabled: true }),
    realTag('MECH_WH_FLOW', 'Combined DHW flow GPM', { innerLow: 0.5, outerLow: 0.1, alarmsEnabled: true }),
    boolTag('MECH_ANY_ALM', 'Mechanical any alarm'),
  ];
  for (let n = 1; n <= 75; n++) tags.push(...roomTags(n));
  return tags;
}

function layoutScreen(id, number, name, tiles, opts = {}) {
  return {
    id,
    number,
    name,
    svg: DEMO_SVG,
    tiles,
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
    background: opts.background || '#f1f5f9',
    offsetX: 0,
    offsetY: 0,
    naturalWidth: null,
    naturalHeight: null,
    isHome: number === 1,
    navHidden: !!opts.navHidden,
  };
}

function bgTile(svgPath, col = 0, row = 0, cs = 16, rs = 10) {
  return {
    col, row, colSpan: cs, rowSpan: rs,
    layers: [{ kind: 'staticImage', z: 0, svg: svgPath }],
  };
}

function hotspotLayer(target, label, hc, hr, hcs, hrs, z = 1) {
  return {
    kind: 'pageHotspot', z, targetScreenId: target, label,
    hotspotCol: hc, hotspotRow: hr, hotspotColSpan: hcs, hotspotRowSpan: hrs,
  };
}

function flashLayer(color, hc, hr, hcs, hrs, z = 2) {
  return {
    kind: 'flashOverlay', z, color,
    hotspotCol: hc, hotspotRow: hr, hotspotColSpan: hcs, hotspotRowSpan: hrs,
  };
}

function navLayer(target, label, col, row, z = 4) {
  return { kind: 'navButton', z, targetScreenId: target, label };
}

function alarmListTile(col = 0, row = 10, cs = 16, rs = 2) {
  return {
    col, row, colSpan: cs, rowSpan: rs,
    layers: [{ kind: 'alarmList', z: 0, alarmList: { showAcked: true } }],
  };
}

function dynTextTile(col, row, label, cs = 3, rs = 1) {
  return {
    col, row, colSpan: cs, rowSpan: rs,
    layers: [{ kind: 'dynamicText', z: 0, label, svg: DEMO_SVG }],
  };
}

function binding(screenId, elementId, tagId, property, onValue, offValue, format) {
  const b = { screenId, elementId, tagId, property };
  if (onValue != null) b.onValue = onValue;
  if (offValue != null) b.offValue = offValue;
  if (format) b.format = format;
  return b;
}

function flashBinding(screenId, col, row, z, tagId, color = 'red') {
  return binding(
    screenId,
    `t${col}_${row}_z${z}__flash_overlay`,
    tagId,
    'flashState',
    color,
    'hidden',
  );
}

function textBinding(screenId, col, row, z, tagId, format = 'fixed1') {
  return binding(screenId, `t${col}_${row}_z${z}__hmi_label`, tagId, 'text', null, null, format);
}

function svgTextBinding(screenId, tileCol, tileRow, z, svgId, tagId, format = 'fixed1') {
  return binding(screenId, `t${tileCol}_${tileRow}_z${z}__${svgId}`, tagId, 'text', null, null, format);
}

function roomGridPos(index1to25) {
  const idx = index1to25 - 1;
  const gc = 1 + (idx % 5) * 3;
  const gr = 1 + Math.floor(idx / 5) * 3;
  return { col: gc, row: gr, cs: 2, rs: 2 };
}

function writeFloorSvg(floorNum, startRoom, endRoom) {
  const rooms = [];
  for (let n = startRoom; n <= endRoom; n++) rooms.push(n);
  let cells = '';
  rooms.forEach((n, i) => {
    const c = i % 5;
    const r = Math.floor(i / 5);
    const x = 40 + c * 188;
    const y = 70 + r * 108;
    cells += `<rect x="${x}" y="${y}" width="172" height="92" rx="4" fill="#dbeafe" stroke="#2563eb" stroke-width="1.5"/>`;
    cells += `<text x="${x + 86}" y="${y + 52}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="16" font-weight="600" fill="#1e3a8a">Rm ${n}</text>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 640" width="1024" height="640">
  <rect width="1024" height="640" fill="#f8fafc"/>
  <text x="512" y="36" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="20" font-weight="600" fill="#0f172a">Floor ${floorNum} — Rooms ${pad3(startRoom)}–${pad3(endRoom)}</text>
  ${cells}
  <text x="512" y="620" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="11" fill="#64748b">Click a room for apartment detail (living · bedroom · kitchen · bath)</text>
</svg>`;
  const file = path.join(SVG_DIR, `floor_${floorNum}_plan.svg`);
  fs.writeFileSync(file, svg, 'utf8');
  return `${AL_SVG}/floor_${floorNum}_plan.svg`;
}

function buildOverviewScreen() {
  const id = 'screen_overview';
  const tile = bgTile(`${AL_SVG}/facility_overview.svg`, 0, 0, 16, 10);
  const layers = [...tile.layers];
  const zones = [
    { label: 'Floor 3', target: 'screen_floor_3', flash: 'ALF_FL3_ALM', hc: 2, hr: 1, hcs: 12, hrs: 2 },
    { label: 'Floor 2', target: 'screen_floor_2', flash: 'ALF_FL2_ALM', hc: 2, hr: 3, hcs: 12, hrs: 2 },
    { label: 'Floor 1', target: 'screen_floor_1', flash: 'ALF_FL1_ALM', hc: 2, hr: 5, hcs: 12, hrs: 2 },
    { label: 'Pool', target: 'screen_pool', flash: 'ALF_POOL_ALM', hc: 5, hr: 8, hcs: 6, hrs: 2 },
    { label: 'Mechanical', target: 'screen_mech', flash: 'ALF_MECH_ALM', hc: 12, hr: 8, hcs: 3, hrs: 2 },
  ];
  for (const z of zones) {
    layers.push(hotspotLayer(z.target, z.label, z.hc, z.hr, z.hcs, z.hrs, 1));
    layers.push(flashLayer('red', z.hc, z.hr, z.hcs, z.hrs, 2));
  }
  tile.layers = layers;
  return layoutScreen(id, 1, 'Overview', [tile]);
}

function buildFloorScreen(floorNum, startRoom, svgPath) {
  const id = `screen_floor_${floorNum}`;
  const tile = bgTile(svgPath, 0, 0, 16, 10);
  const layers = [...tile.layers];
  for (let i = 1; i <= 25; i++) {
    const roomNum = startRoom + i - 1;
    const g = roomGridPos(i);
    const target = `screen_rm_${pad3(roomNum)}`;
    layers.push(hotspotLayer(target, `Room ${roomNum}`, g.col, g.row, g.cs, g.rs, 1));
    layers.push(flashLayer('red', g.col, g.row, g.cs, g.rs, 2));
  }
  layers.push(navLayer('screen_overview', 'Overview', 0, 11, 4));
  tile.layers = layers;
  return layoutScreen(id, floorNum + 1, `Floor ${floorNum}`, [tile]);
}

function buildRoomScreen(roomNum) {
  const id = `screen_rm_${pad3(roomNum)}`;
  const p = rmPrefix(roomNum);
  const tile = bgTile(`${AL_SVG}/room_detail.svg`, 0, 0, 16, 9);
  const layers = [...tile.layers];
  layers.push({ kind: 'staticText', z: 1, label: `Room ${roomNum}`, svg: DEMO_SVG });
  // Zone flash overlays (relative to 16×9 tile)
  layers.push(flashLayer('red', 8, 5, 8, 4, 2));   // bath
  layers.push(flashLayer('amber', 0, 5, 8, 4, 2)); // kitchen stove
  layers.push(flashLayer('red', 0, 0, 8, 5, 2));   // living AC
  layers.push(navLayer(`screen_floor_${Math.ceil(roomNum / 25)}`, 'Back to floor', 14, 11, 4));
  tile.layers = layers;
  const tiles = [
    tile,
    dynTextTile(0, 9, 'Living °F'),
    dynTextTile(4, 9, 'Bedroom °F'),
    dynTextTile(8, 9, 'A/C hi °F'),
    dynTextTile(12, 9, 'A/C lo °F'),
    alarmListTile(0, 10, 16, 2),
  ];
  return layoutScreen(id, 100 + roomNum, `Rm ${roomNum}`, tiles, { navHidden: true });
}

function buildPoolScreen() {
  const tile = bgTile(`${AL_SVG}/pool_detail.svg`, 0, 0, 16, 9);
  tile.layers.push(navLayer('screen_overview', 'Overview', 0, 11, 4));
  tile.layers.push(flashLayer('red', 1, 1, 14, 5, 2));
  return layoutScreen('screen_pool', 5, 'Pool', [
    tile,
    alarmListTile(0, 10, 16, 2),
  ]);
}

function buildMechScreen() {
  const tile = bgTile(`${AL_SVG}/mechanical_detail.svg`, 0, 0, 16, 9);
  tile.layers.push(navLayer('screen_overview', 'Overview', 0, 11, 4));
  tile.layers.push(flashLayer('red', 1, 1, 14, 4, 2));
  tile.layers.push(flashLayer('amber', 3, 6, 10, 2, 3));
  return layoutScreen('screen_mech', 6, 'Mechanical', [
    tile,
    alarmListTile(0, 10, 16, 2),
  ]);
}

function buildBindings(screens) {
  const bindings = [];
  const overview = screens.find((s) => s.id === 'screen_overview');
  if (overview) {
    const zones = [
      { hc: 2, hr: 1, flash: 'ALF_FL3_ALM' },
      { hc: 2, hr: 3, flash: 'ALF_FL2_ALM' },
      { hc: 2, hr: 5, flash: 'ALF_FL1_ALM' },
      { hc: 5, hr: 8, flash: 'ALF_POOL_ALM' },
      { hc: 12, hr: 8, flash: 'ALF_MECH_ALM' },
    ];
    for (const z of zones) {
      bindings.push(flashBinding('screen_overview', 0, 0, 2, z.flash, 'red'));
    }
  }
  for (let f = 1; f <= 3; f++) {
    const sid = `screen_floor_${f}`;
    const start = (f - 1) * 25 + 1;
    for (let i = 1; i <= 25; i++) {
      const roomNum = start + i - 1;
      bindings.push(flashBinding(sid, 0, 0, 2, `${rmPrefix(roomNum)}_ANY_ALM`, 'red'));
    }
  }
  for (let n = 1; n <= 75; n++) {
    const sid = `screen_rm_${pad3(n)}`;
    const p = rmPrefix(n);
    bindings.push(flashBinding(sid, 0, 0, 2, `${p}_BATH_ALM`, 'red'));
    bindings.push(flashBinding(sid, 0, 0, 2, `${p}_STOVE_ALM`, 'amber'));
    bindings.push(flashBinding(sid, 0, 0, 2, `${p}_AC_FAIL_ALM`, 'red'));
    bindings.push(textBinding(sid, 0, 9, 0, `${p}_LIV_TEMP`, 'fixed1'));
    bindings.push(textBinding(sid, 4, 9, 0, `${p}_BED_TEMP`, 'fixed1'));
    bindings.push(textBinding(sid, 8, 9, 0, `${p}_AC_HI`, 'fixed1'));
    bindings.push(textBinding(sid, 12, 9, 0, `${p}_AC_LO`, 'fixed1'));
    bindings.push(svgTextBinding(sid, 0, 0, 0, 'val_liv_temp', `${p}_LIV_TEMP`, 'fixed1'));
    bindings.push(svgTextBinding(sid, 0, 0, 0, 'val_bed_temp', `${p}_BED_TEMP`, 'fixed1'));
    bindings.push(svgTextBinding(sid, 0, 0, 0, 'val_ac_hi', `${p}_AC_HI`, 'fixed1'));
    bindings.push(svgTextBinding(sid, 0, 0, 0, 'val_ac_lo', `${p}_AC_LO`, 'fixed1'));
    bindings.push(svgTextBinding(sid, 0, 0, 0, 'val_stove', `${p}_STOVE_ON`, 'bool'));
    bindings.push(svgTextBinding(sid, 0, 0, 0, 'val_pan_leak', `${p}_AC_PAN_LEAK`, 'bool'));
  }
  bindings.push(flashBinding('screen_pool', 0, 0, 2, 'POOL_ANY_ALM', 'red'));
  bindings.push(svgTextBinding('screen_pool', 0, 0, 0, 'pool_temp', 'POOL_TEMP', 'fixed1'));
  bindings.push(svgTextBinding('screen_pool', 0, 0, 0, 'pool_ph', 'POOL_PH', 'fixed2'));
  bindings.push(svgTextBinding('screen_pool', 0, 0, 0, 'pool_orp', 'POOL_ORP', 'int'));
  bindings.push(svgTextBinding('screen_pool', 0, 0, 0, 'pool_flow', 'POOL_FLOW', 'fixed1'));
  bindings.push(svgTextBinding('screen_pool', 0, 0, 0, 'pool_pump', 'POOL_PUMP_RUN', 'bool'));
  bindings.push(svgTextBinding('screen_pool', 0, 0, 0, 'pool_heater', 'POOL_HEATER_ON', 'bool'));
  bindings.push(svgTextBinding('screen_pool', 0, 0, 0, 'pool_level', 'POOL_LEVEL_OK', 'bool'));
  bindings.push(svgTextBinding('screen_pool', 0, 0, 0, 'pool_filter', 'POOL_FILTER_OK', 'bool'));
  bindings.push(flashBinding('screen_mech', 0, 0, 2, 'MECH_ANY_ALM', 'red'));
  for (let w = 1; w <= 3; w++) {
    bindings.push(svgTextBinding('screen_mech', 0, 0, 0, `wh${w}_temp`, `MECH_WH${w}_TEMP`, 'fixed1'));
    bindings.push(svgTextBinding('screen_mech', 0, 0, 0, `wh${w}_kwh`, `MECH_WH${w}_KWH`, 'fixed1'));
    bindings.push(svgTextBinding('screen_mech', 0, 0, 0, `wh${w}_kw`, `MECH_WH${w}_KW`, 'fixed2'));
  }
  bindings.push(svgTextBinding('screen_mech', 0, 0, 0, 'wh_flow', 'MECH_WH_FLOW', 'fixed1'));
  return bindings;
}

function buildStProgram() {
  const lines = [
    '(* Assisted living facility — area alarms, stove excess-on timers, simulation *)',
    '',
    'IF NOT SIM_ENABLE THEN',
    '  SIM_ENABLE := TRUE;',
    'END_IF;',
    '',
    '(* --- Pool & mechanical simulation --- *)',
    'POOL_PUMP_RUN := TRUE;',
    'POOL_HEATER_ON := POOL_TEMP < 88.0;',
    'POOL_LEVEL_OK := TRUE;',
    'POOL_FILTER_OK := TRUE;',
    'MECH_WH1_KW := 4.5;',
    'MECH_WH2_KW := 3.8;',
    'MECH_WH3_KW := 5.1;',
    '',
  ];
  for (let n = 1; n <= 75; n++) {
    const p = rmPrefix(n);
    lines.push(`(* Room ${n} *)`);
    lines.push(`${p}_STOVE_TMR(IN := ${p}_STOVE_ON, PT := T#30m);`);
    lines.push(`${p}_STOVE_ALM := ${p}_STOVE_TMR.Q;`);
    lines.push(`${p}_BATH_ALM := ${p}_BATH_TS_LEAK OR ${p}_TOILET_LEAK;`);
    lines.push(`${p}_AC_FAIL_ALM := ${p}_AC_PAN_LEAK OR ${p}_AC_BLOWER_FLT OR ${p}_AC_COND_FAN_FLT OR ${p}_AC_COMP_FLT`);
    lines.push(`  OR (${p}_AC_HI > 350.0) OR (${p}_AC_LO < 30.0);`);
    lines.push(`${p}_ANY_ALM := ${p}_STOVE_ALM OR ${p}_BATH_ALM OR ${p}_AC_FAIL_ALM;`);
    lines.push('');
  }
  lines.push('POOL_ANY_ALM := NOT POOL_LEVEL_OK OR NOT POOL_FILTER_OK OR POOL_TEMP > 95.0 OR POOL_TEMP < 80.0;');
  lines.push('MECH_ANY_ALM := MECH_WH1_KW > 12.0 OR MECH_WH2_KW > 12.0 OR MECH_WH3_KW > 12.0 OR MECH_WH_FLOW < 0.1;');
  lines.push('');
  for (let f = 1; f <= 3; f++) {
    const start = (f - 1) * 25 + 1;
    const end = start + 24;
    const parts = [];
    for (let n = start; n <= end; n++) parts.push(`${rmPrefix(n)}_ANY_ALM`);
    lines.push(`ALF_FL${f}_ALM := ${parts.join(' OR ')};`);
  }
  lines.push('ALF_POOL_ALM := POOL_ANY_ALM;');
  lines.push('MECH_ANY_ALM := MECH_ANY_ALM OR MECH_WH1_TEMP > 145.0 OR MECH_WH2_TEMP > 145.0 OR MECH_WH3_TEMP > 145.0;');
  lines.push('ALF_MECH_ALM := MECH_ANY_ALM;');
  lines.push('');
  return lines.join('\n');
}

function main() {
  fs.mkdirSync(SVG_DIR, { recursive: true });
  const floorSvgs = [
    writeFloorSvg(1, 1, 25),
    writeFloorSvg(2, 26, 50),
    writeFloorSvg(3, 51, 75),
  ];
  const screens = [
    buildOverviewScreen(),
    buildFloorScreen(1, 1, floorSvgs[0]),
    buildFloorScreen(2, 26, floorSvgs[1]),
    buildFloorScreen(3, 51, floorSvgs[2]),
    buildPoolScreen(),
    buildMechScreen(),
  ];
  for (let n = 1; n <= 75; n++) screens.push(buildRoomScreen(n));
  const tags = facilityTags();
  const bindings = buildBindings(screens);
  const st = buildStProgram();
  fs.writeFileSync(OUT_ST, st, 'utf8');
  const est = {
    format: 'mooreview-est',
    version: 1,
    savedAt: new Date().toISOString(),
    project: { name: 'assisted-living' },
    tags,
    drivers: [],
    program: st,
    activeProgram: 'logic/assisted_living.st',
    settings: {
      project: { name: 'assisted-living' },
      scanMs: 100,
      graphMaxPoints: 600,
      graphPens: [],
      activeProgram: 'logic/assisted_living.st',
      hmi: {
        activeScreen: 'screen_overview',
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
        },
        screens,
        bindings,
      },
      mongoLogger: {
        uri: 'mongodb://127.0.0.1:27017',
        db: 'mooreview',
        collection: 'tag_logs',
        edgeCollection: 'edge_inference',
        sampleIntervalMs: 5000,
      },
      remoteExecution: false,
      mqttParc: {
        enabled: false,
        brokerUrl: 'mqtt://127.0.0.1:1883',
        topicPrefix: 'mooreview/v1',
      },
    },
  };
  fs.writeFileSync(OUT_EST, JSON.stringify(est, null, 2), 'utf8');
  console.log(`Generated ${OUT_EST}`);
  console.log(`  tags: ${tags.length}, screens: ${screens.length}, bindings: ${bindings.length}`);
  console.log(`Generated ${OUT_ST}`);
}

main();
