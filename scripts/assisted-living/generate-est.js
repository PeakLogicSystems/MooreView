#!/usr/bin/env node
'use strict';

/**
 * Generates assisted-living MooreVIEW project:
 * - data/projects/assisted-living.est.json
 * - st/logic/assisted_living_facility.st
 * - public/hmi/svg/demos/assisted-living/floor_N_plan.svg (PNG-ready SVG)
 */

const fs = require('fs');
const path = require('path');
const { MAX_TAGS } = require('../../src/config');
const {
  DEFAULT_POOLS,
  MAX_FILTER_PUMPS,
  MAX_SITE_FILTER_PUMPS,
  poolTagPrefix,
  normalizePools,
  normalizeFilterPumpCount,
} = require('../../src/settings/assistedLivingSettings');
const { NC_DRIVER_ID, DEVICES, buildSemanticMap, applySemanticMap } = require('./nextcentury-map');
const {
  F1_OFFICE_NUM,
  ROOMS_PER_WING,
  buildFacilityConfig,
  parseTotalRooms,
  villaRoomNums,
  allVillaRooms,
  villaRoomRangeLabel,
  roomsOnFloorList,
  roomsInWing,
  allMainTowerRooms,
  wingsOnFloor,
  floorRoomRangeLabel,
  wingRoomRangeLabel,
  roomTagId,
} = require('./facility-config');
const {
  floorHubScreenId,
  floorHubScreenNumber,
  wingScreenId,
  wingScreenNumber,
} = require('./alf-screen-plan');
const { planWingUnitRect, wingSvgViewBox } = require('./wing-layout');
const { planVillaUnitRect, villaSvgViewBox } = require('./villa-layout');

const FACILITY = buildFacilityConfig(parseTotalRooms());
const FLOORS = FACILITY.floors;
const ROOMS_ON_FLOOR = FACILITY.roomsOnFloor;
const VILLA_BUILDINGS = FACILITY.villas;
const ROOM_PAD = FACILITY.roomTagPadWidth;

function includesInteriorOffice() {
  return FACILITY.includesInteriorOffice;
}

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_EST = path.join(ROOT, 'data', 'projects', 'assisted-living.est.json');
const OUT_ST = path.join(ROOT, 'st', 'logic', 'assisted_living_facility.st');
const NC_DRIVERS = path.join(ROOT, 'st', 'fixtures', 'drivers.nextcentury.json');
const SVG_DIR = path.join(ROOT, 'public', 'hmi', 'svg', 'demos', 'assisted-living');

const MAX_SCREENS = 500;
const GRID = { cols: 16, rows: 12, cellWidth: 64, cellHeight: 64 };

const FILTER_SLOTS_PER_DAY = 6;
const FILTER_SCHEDULE_DAYS = 7;
const POOL_SCHEDULE_SCREEN_BASE = 50;
const FILTER_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SCHEDULE_MARGIN = 20;
const SCHEDULE_PUMP_PANEL_W = 728;
const SCHEDULE_PUMP_PANEL_GAP = 16;

function scheduleSvgTotalWidth() {
  return (
    SCHEDULE_MARGIN * 2
    + MAX_FILTER_PUMPS * SCHEDULE_PUMP_PANEL_W
    + (MAX_FILTER_PUMPS - 1) * SCHEDULE_PUMP_PANEL_GAP
  );
}

function scheduleContentWidth() {
  return scheduleSvgTotalWidth() - SCHEDULE_MARGIN * 2;
}
const SCHEDULE_HEADER_H = 96;
const SCHEDULE_PUMP_SETUP_H = 80;
const SCHEDULE_DAY_BLOCK_H = 292;
const SCHEDULE_DAY_LABEL_W = 92;
const SCHEDULE_SLOT_CELL_H = 118;
const SCHEDULE_SLOT_GAP = 16;
const SCHEDULE_FONT_TIME = 40;
const SCHEDULE_FONT_PCT = 32;
const SCHEDULE_FONT_DAY = 28;
const SCHEDULE_FONT_SLOT = 18;

function schedulePumpPanelHeight() {
  return 88 + FILTER_SCHEDULE_DAYS * SCHEDULE_DAY_BLOCK_H + 20;
}

function scheduleContentStartY() {
  return SCHEDULE_HEADER_H + SCHEDULE_PUMP_SETUP_H;
}

function scheduleSvgTotalHeight() {
  return scheduleContentStartY() + schedulePumpPanelHeight() + 16;
}

function poolFilterScheduleSvgPath(poolIndex) {
  return `/hmi/svg/demos/assisted-living/pool_filter_schedule_${poolIndex}.svg`;
}

function filterPumpCount(pool) {
  return normalizeFilterPumpCount(pool?.filterPumpCount, 1);
}

function poolFilterScheduleScreenId(index) {
  return `screen_${POOL_SCHEDULE_SCREEN_BASE + index}`;
}

function defaultFilterSlotTime(slot) {
  return [360, 600, 840, 1020, 0, 0][slot - 1] ?? 0;
}

function defaultFilterSlotPct(slot) {
  return [80, 65, 70, 50, 0, 0][slot - 1] ?? 0;
}

function buildFilterPumpTagsForPool(pool) {
  const p = poolTagPrefix(pool);
  const count = filterPumpCount(pool);
  const tags = [
    baseTag(`${p}_CFG_FP_CNT`, {
      label: `${pool.name} filter pump count`,
      type: 'INT',
      role: 'memory',
      default: count,
      value: count,
      wordWidth: 16,
    }),
  ];
  for (let n = 2; n <= MAX_FILTER_PUMPS; n++) {
    tags.push(baseTag(`${p}_CFG_FP${n}`, {
      label: `${pool.name} filter pump ${n} enabled`,
      role: 'memory',
      default: count >= n,
      value: count >= n,
    }));
  }
  for (let n = 1; n <= MAX_FILTER_PUMPS; n++) {
    tags.push(
      baseTag(`${p}_FP${n}_PCT`, {
        label: `${pool.name} FP${n} TPO feed %`,
        type: 'REAL',
        role: 'memory',
        graphEnabled: true,
        default: n === 1 ? 65 : 0,
      }),
      baseTag(`${p}_FP${n}_RUN`, {
        label: `${pool.name} FP${n} running`,
        role: 'input',
        graphEnabled: true,
        default: n === 1,
      }),
      baseTag(`${p}_FP${n}_FLT`, {
        label: `${pool.name} FP${n} fault`,
        role: 'input',
        alarmsEnabled: true,
        alarmCondition: 'on',
      }),
      baseTag(`${p}_FP${n}_MODE`, {
        label: `${pool.name} FP${n} mode 0=single 1=sequence`,
        type: 'INT',
        role: 'memory',
        default: 1,
        wordWidth: 16,
      }),
      baseTag(`${p}_FP${n}_CFG_SEQ`, {
        label: `${pool.name} FP${n} sequenced mode`,
        role: 'memory',
        default: true,
        value: true,
      }),
      baseTag(`${p}_FP${n}_CFG_SS`, {
        label: `${pool.name} FP${n} single-speed mode`,
        role: 'memory',
        default: false,
        value: false,
      }),
      baseTag(`${p}_FP${n}_SS_PCT`, {
        label: `${pool.name} FP${n} single speed %`,
        type: 'INT',
        role: 'memory',
        default: 65,
        wordWidth: 16,
      }),
    );
    for (let d = 0; d < FILTER_SCHEDULE_DAYS; d++) {
      for (let s = 1; s <= FILTER_SLOTS_PER_DAY; s++) {
        tags.push(
          baseTag(`${p}_FP${n}_D${d}_S${s}_T`, {
            label: `${pool.name} FP${n} ${FILTER_DAY_LABELS[d]} slot ${s} start`,
            type: 'INT',
            role: 'memory',
            default: defaultFilterSlotTime(s),
            wordWidth: 16,
          }),
          baseTag(`${p}_FP${n}_D${d}_S${s}_P`, {
            label: `${pool.name} FP${n} ${FILTER_DAY_LABELS[d]} slot ${s} %`,
            type: 'INT',
            role: 'memory',
            default: defaultFilterSlotPct(s),
            wordWidth: 16,
          }),
        );
      }
    }
  }
  return tags;
}

/** HMI element ids use 1-based tile coords (matches hmi.js layerElementIdFromTile). */
function bindEl(col, row, z, suffix) {
  return `t${Number(col) + 1}_${Number(row) + 1}_z${Number(z) || 0}__${suffix}`;
}

const BIND_Z0 = (suffix) => bindEl(0, 0, 0, suffix);
const BIND_Z2 = (suffix) => bindEl(0, 0, 2, suffix);

function clientRoomNum(floor, indexOnFloor) {
  return floor * 100 + indexOnFloor;
}

function roomsOnFloor(floorNum) {
  return roomsOnFloorList(floorNum, ROOMS_ON_FLOOR);
}

function allClientRooms() {
  return [...allMainTowerRooms(ROOMS_ON_FLOOR), ...allVillaRooms(VILLA_BUILDINGS)];
}

function padRoom(n) {
  return String(n).padStart(ROOM_PAD, '0');
}

function roomId(n) {
  return roomTagId(n, ROOM_PAD);
}

function floorOfRoom(n) {
  const num = Number(n);
  if (num >= 100) return Math.floor(num / 100);
  return 1;
}

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
    preset: extra.preset ?? (extra.type === 'TIMER' ? 2700000 : extra.type === 'COUNTER' ? 999999 : 0),
    mode: extra.mode ?? (extra.type === 'TIMER' ? 'TON' : extra.type === 'COUNTER' ? 'CTU' : 'TON'),
    arrayLen: 1,
    value: extra.value ?? (extra.type === 'BOOL' ? false : 0),
    quality: 'GOOD',
    wordWidth: 16,
    signed: true,
    forceInput: false,
    forceOutput: false,
    graphEnabled: !!extra.graphEnabled,
    dirty: false,
    alarmLevel: null,
    fb: extra.type === 'TIMER' || extra.type === 'COUNTER' ? {
      elapsed: 0, done: false, input: false, running: false, reset: false,
    } : {},
  };
}

function buildRoomTags(roomNum) {
  const p = roomId(roomNum);
  const fl = floorOfRoom(roomNum);
  return [
    baseTag(`${p}_ALM`, { label: `Room ${roomNum} area alarm`, role: 'memory' }),
    baseTag(`${p}_BATH_MID_LEAK`, { label: `Rm${roomNum} bath mid leak`, role: 'input', alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag(`${p}_TOILET_LEAK`, { label: `Rm${roomNum} toilet leak`, role: 'input', alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag(`${p}_STOVE_ON`, { label: `Rm${roomNum} stove on`, role: 'input', graphEnabled: true }),
    baseTag(`${p}_STOVE_EXCESS`, { label: `Rm${roomNum} stove excess ON`, role: 'memory', alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag(`${p}_STOVE_TMR`, { label: `Rm${roomNum} stove timer`, type: 'TIMER', role: 'fb', preset: 2700000 }),
    baseTag(`${p}_AC_PAN_LEAK`, { label: `Rm${roomNum} A/C pan leak`, role: 'input', alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag(`${p}_AC_BLOWER_FLT`, { label: `Rm${roomNum} A/C blower`, role: 'input', alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag(`${p}_LIV_TEMP`, { label: `Rm${roomNum} living temp`, type: 'REAL', role: 'input', graphEnabled: true, alarmsEnabled: true, alarmInnerLow: 65, alarmInnerHigh: 80, alarmOuterLow: 60, alarmOuterHigh: 85 }),
    baseTag(`${p}_BED_TEMP`, { label: `Rm${roomNum} bedroom temp`, type: 'REAL', role: 'input', graphEnabled: true, alarmsEnabled: true, alarmInnerLow: 65, alarmInnerHigh: 80, alarmOuterLow: 60, alarmOuterHigh: 85 }),
  ];
}

function buildFloorCondenserTags(floorNum) {
  const p = `FL${floorNum}`;
  return [
    baseTag(`${p}_COND_FAN_FLT`, { label: `Fl${floorNum} condenser fan`, role: 'input', alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag(`${p}_COND_COMP_FLT`, { label: `Fl${floorNum} compressor`, role: 'input', alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag(`${p}_COND_HI_TEMP`, { label: `Fl${floorNum} cond hi °F`, type: 'REAL', role: 'input', graphEnabled: true, alarmsEnabled: true, alarmInnerHigh: 130, alarmOuterHigh: 150 }),
    baseTag(`${p}_COND_LO_TEMP`, { label: `Fl${floorNum} cond lo °F`, type: 'REAL', role: 'input', graphEnabled: true, alarmsEnabled: true, alarmInnerLow: 45, alarmOuterLow: 38 }),
    baseTag(`${p}_COND_ALM`, { label: `Fl${floorNum} condenser alarm`, role: 'memory' }),
    baseTag(`ALF_FL${floorNum}_ALM`, { label: `Floor ${floorNum} summary alarm`, role: 'memory' }),
  ];
}

function buildPoolTagsForPool(pool) {
  const p = poolTagPrefix(pool);
  const useOrp = pool.sanitizer !== 'cl2';
  const isSalt = pool.waterType === 'salt';
  return [
    baseTag(`${p}_CFG_USE_ORP`, { label: `${pool.name} — ORP sanitizer`, role: 'memory', default: useOrp, value: useOrp }),
    baseTag(`${p}_CFG_USE_CL2`, { label: `${pool.name} — CL2 sanitizer`, role: 'memory', default: !useOrp, value: !useOrp }),
    baseTag(`${p}_CFG_SALT`, { label: `${pool.name} — salt water`, role: 'memory', default: isSalt, value: isSalt }),
    baseTag(`${p}_CFG_FRESH`, { label: `${pool.name} — fresh water`, role: 'memory', default: !isSalt, value: !isSalt }),
    baseTag(`${p}_PH`, { label: `${pool.name} pH`, type: 'REAL', role: 'input', graphEnabled: true, alarmsEnabled: true, alarmInnerLow: 7.2, alarmInnerHigh: 7.6, alarmOuterLow: 7.0, alarmOuterHigh: 7.8, default: 7.4 }),
    baseTag(`${p}_ORP`, { label: `${pool.name} ORP mV`, type: 'REAL', role: 'input', graphEnabled: true, alarmsEnabled: true, alarmInnerLow: 650, alarmInnerHigh: 750, default: 650 }),
    baseTag(`${p}_CL2`, { label: `${pool.name} CL2 ppm`, type: 'REAL', role: 'input', graphEnabled: true, alarmsEnabled: true, alarmInnerLow: 1.0, alarmInnerHigh: 3.0, default: 1.5 }),
    baseTag(`${p}_COND`, { label: `${pool.name} conductivity ppm`, type: 'REAL', role: 'input', graphEnabled: true, alarmsEnabled: true, alarmInnerLow: 2500, alarmOuterLow: 2200, default: isSalt ? 3200 : 0 }),
    baseTag(`${p}_TEMP`, { label: `${pool.name} water temp °F`, type: 'REAL', role: 'input', graphEnabled: true, alarmsEnabled: true, alarmInnerLow: 84, alarmInnerHigh: 92, default: 88 }),
    baseTag(`${p}_CL2_PUMP_PCT`, { label: `${pool.name} CL2 TPO feed %`, type: 'REAL', role: 'memory', graphEnabled: true, default: 0 }),
    baseTag(`${p}_ACID_PUMP_PCT`, { label: `${pool.name} acid TPO feed %`, type: 'REAL', role: 'memory', graphEnabled: true, default: 0 }),
    baseTag(`${p}_ECL_PCT`, { label: `${pool.name} ECL TPO feed %`, type: 'REAL', role: 'memory', graphEnabled: true, default: isSalt ? 35 : 0 }),
    baseTag(`${p}_BW_STA`, { label: `${pool.name} backwash step`, type: 'INT', role: 'memory', default: 0 }),
    baseTag(`${p}_BW_BUSY`, { label: `${pool.name} backwash active`, role: 'memory', default: false }),
    baseTag(`${p}_BW_CMD`, { label: `${pool.name} backwash start`, role: 'memory', default: false }),
    baseTag(`${p}_ECL_RUN`, { label: `${pool.name} electro-chlorinator run`, role: 'input', graphEnabled: true, default: isSalt }),
    baseTag(`${p}_FLOW_OK`, { label: `${pool.name} flow OK`, role: 'input', alarmsEnabled: true, alarmCondition: 'off', default: true }),
    ...buildFilterPumpTagsForPool(pool),
  ];
}

function buildPoolTags(pools = DEFAULT_POOLS) {
  const tags = [baseTag('ALF_POOL_ALM', { label: 'Pool area alarm', role: 'memory', alarmsEnabled: true, alarmCondition: 'on' })];
  for (const pool of pools) tags.push(...buildPoolTagsForPool(pool));
  return tags;
}

/** screen_5 = primary pool; additional pools/spas from screen_26 (23–25 = villas). */
function poolScreenId(index) {
  if (index === 0) return 'screen_5';
  return `screen_${26 + index - 1}`;
}

function poolAreaTile(alarmTag = 'ALF_POOL_ALM', poolIndex = 0) {
  return {
    col: 0,
    row: 0,
    colSpan: GRID.cols,
    rowSpan: GRID.rows,
    layers: [
      { kind: 'staticImage', z: 0, svg: '/hmi/svg/demos/assisted-living/pool_room.svg' },
      detailAreaFlashLayer(alarmTag),
      { kind: 'navButton', z: 4, targetScreenId: 'screen_1', label: 'Overview', hotspotCol: 0, hotspotRow: 0, hotspotColSpan: 2, hotspotRowSpan: 1 },
      {
        kind: 'navButton',
        z: 4,
        targetScreenId: poolFilterScheduleScreenId(poolIndex),
        label: 'Schedules',
        hotspotCol: 14,
        hotspotRow: 0,
        hotspotColSpan: 2,
        hotspotRowSpan: 1,
      },
    ],
  };
}

function poolScheduleAreaTile(poolIndex) {
  return {
    col: 0,
    row: 0,
    colSpan: GRID.cols,
    rowSpan: GRID.rows,
    layers: [
      { kind: 'staticImage', z: 0, svg: poolFilterScheduleSvgPath(poolIndex), assetFit: 'scroll' },
      {
        kind: 'navButton',
        z: 4,
        targetScreenId: poolScreenId(poolIndex),
        label: 'Back',
        hotspotCol: 0,
        hotspotRow: 0,
        hotspotColSpan: 2,
        hotspotRowSpan: 1,
      },
    ],
  };
}

function poolScheduleScreenLayout(poolIndex, pool) {
  const totalW = scheduleSvgTotalWidth();
  const totalH = scheduleSvgTotalHeight();
  const cellW = Math.round(totalW / GRID.cols);
  const cellH = Math.round(totalH / GRID.rows);
  return {
    ...screenLayout(
      poolFilterScheduleScreenId(poolIndex),
      `${pool.name} — filter schedules`,
      POOL_SCHEDULE_SCREEN_BASE + poolIndex,
      { tiles: [poolScheduleAreaTile(poolIndex)] },
    ),
    width: totalW,
    height: totalH,
    cellWidth: cellW,
    cellHeight: cellH,
    displayMaxWidth: totalW,
    displayMaxHeight: Math.min(4096, totalH),
    naturalWidth: totalW,
    naturalHeight: totalH,
  };
}

/** Default false = electric kW meters; true = gas flow meter for HWH bank. */
const DEFAULT_MECH_WH_GAS = false;

function buildMechanicalTags(mechWhGas = DEFAULT_MECH_WH_GAS) {
  return [
    baseTag('MECH_CFG_GAS_WH', { label: 'Mechanical — gas water heaters', role: 'memory', default: mechWhGas, value: mechWhGas }),
    baseTag('MECH_CFG_ELEC_WH', { label: 'Mechanical — electric water heaters', role: 'memory', default: !mechWhGas, value: !mechWhGas }),
    baseTag('MECH_FLOW_GPM', { label: 'DHW supply flow GPM', type: 'REAL', role: 'input', graphEnabled: true, alarmsEnabled: true, alarmInnerLow: 8, alarmOuterLow: 5, default: 12 }),
    baseTag('MECH_METER_KWH', { label: 'Site electric meter kWh total (NC)', type: 'REAL', role: 'input', graphEnabled: true, default: 0 }),
    baseTag('MECH_METER_INTERVAL_KWH', { label: 'Site electric meter interval kWh (NC)', type: 'REAL', role: 'input', graphEnabled: true, default: 0 }),
    baseTag('MECH_TOTAL_KW', { label: 'HWH bank electric kW (sim)', type: 'REAL', role: 'input', graphEnabled: true, alarmsEnabled: true, alarmInnerHigh: 36, alarmOuterHigh: 45, default: 12.5 }),
    baseTag('MECH_GAS_CFM', { label: 'HWH bank gas flow CFM', type: 'REAL', role: 'input', graphEnabled: true, alarmsEnabled: true, alarmInnerLow: 15, alarmOuterLow: 8, default: 42 }),
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
  ];
}

/** Option B — one HMI screen per support fixture (screens 8–21). */
const RESTROOM_FIXTURES = [
  { screen: 8, prefix: 'COMM_GF_LOUNGE_R1', name: 'GF Lounge RR 1' },
  { screen: 9, prefix: 'COMM_GF_LOUNGE_R2', name: 'GF Lounge RR 2' },
  { screen: 10, prefix: 'COMM_GF_ACT_R1', name: 'GF Activity RR 1' },
  { screen: 11, prefix: 'COMM_GF_ACT_R2', name: 'GF Activity RR 2' },
  { screen: 12, prefix: 'COMM_F2_LOUNGE_R1', name: 'F2 Lounge RR 1' },
  { screen: 13, prefix: 'COMM_F2_LOUNGE_R2', name: 'F2 Lounge RR 2' },
  { screen: 14, prefix: 'COMM_F3_LOUNGE_R1', name: 'F3 Lounge RR 1' },
  { screen: 15, prefix: 'COMM_F3_LOUNGE_R2', name: 'F3 Lounge RR 2' },
];

const NURSE_FIXTURES = [
  { screen: 16, prefix: 'NRS_GF_BATH', name: 'GF Nurse bath', kind: 'bath' },
  { screen: 17, prefix: 'NRS_GF_SINK', name: 'GF Nurse sink', kind: 'sink' },
  { screen: 18, prefix: 'NRS_F2_BATH', name: 'F2 Nurse bath', kind: 'bath' },
  { screen: 19, prefix: 'NRS_F2_SINK', name: 'F2 Nurse sink', kind: 'sink' },
  { screen: 20, prefix: 'NRS_F3_BATH', name: 'F3 Nurse bath', kind: 'bath' },
  { screen: 21, prefix: 'NRS_F3_SINK', name: 'F3 Nurse sink', kind: 'sink' },
];

/** Commercial kitchen equipment tags (single summary screen_7). */
const KITCHEN_EQUIPMENT = [
  { prefix: 'KITCH_FREEZER', name: 'Walk-in freezer', kind: 'freezer' },
  { prefix: 'KITCH_REEFER', name: 'Walk-in reefer', kind: 'reefer' },
  { prefix: 'KITCH_SINK1', name: 'Kitchen sink 1', kind: 'sink' },
  { prefix: 'KITCH_SINK2', name: 'Kitchen sink 2', kind: 'sink' },
  { prefix: 'KITCH_SINK3', name: 'Kitchen sink 3', kind: 'sink' },
  { prefix: 'KITCH_SINK4', name: 'Kitchen sink 4', kind: 'sink' },
  { prefix: 'KITCH_SINK5', name: 'Kitchen sink 5', kind: 'sink' },
  { prefix: 'KITCH_SINK6', name: 'Kitchen sink 6', kind: 'sink' },
];

function buildRestroomFixtureTags(prefix, label) {
  return [
    baseTag(`${prefix}_ALM`, { label: `${label} area alarm`, role: 'memory' }),
    baseTag(`${prefix}_SINK_LEAK`, { label: `${label} sink leak`, role: 'input', alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag(`${prefix}_TOILET_LEAK`, { label: `${label} toilet leak`, role: 'input', alarmsEnabled: true, alarmCondition: 'on' }),
  ];
}

function buildNurseBathFixtureTags(prefix, label) {
  return [
    baseTag(`${prefix}_ALM`, { label: `${label} area alarm`, role: 'memory' }),
    baseTag(`${prefix}_BATH_MID_LEAK`, { label: `${label} bath mid leak`, role: 'input', alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag(`${prefix}_TOILET_LEAK`, { label: `${label} toilet leak`, role: 'input', alarmsEnabled: true, alarmCondition: 'on' }),
  ];
}

function buildNurseSinkFixtureTags(prefix, label) {
  return [
    baseTag(`${prefix}_ALM`, { label: `${label} area alarm`, role: 'memory' }),
    baseTag(`${prefix}_SINK_LEAK`, { label: `${label} sink leak`, role: 'input', alarmsEnabled: true, alarmCondition: 'on' }),
  ];
}

function buildKitchenSinkFixtureTags(prefix, label) {
  return buildNurseSinkFixtureTags(prefix, label);
}

function buildKitchenFreezerFixtureTags(prefix, label) {
  return [
    baseTag(`${prefix}_ALM`, { label: `${label} area alarm`, role: 'memory' }),
    baseTag(`${prefix}_TEMP`, { label: `${label} air temp`, type: 'REAL', role: 'input', graphEnabled: true, default: -5, alarmsEnabled: true, alarmInnerHigh: 5, alarmOuterHigh: 10 }),
    baseTag(`${prefix}_LEAK`, { label: `${label} floor melt leak`, role: 'input', alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag(`${prefix}_DOOR`, { label: `${label} door ajar`, role: 'input', alarmsEnabled: true, alarmCondition: 'on' }),
  ];
}

function buildKitchenReeferFixtureTags(prefix, label) {
  return [
    baseTag(`${prefix}_ALM`, { label: `${label} area alarm`, role: 'memory' }),
    baseTag(`${prefix}_TEMP`, { label: `${label} air temp`, type: 'REAL', role: 'input', graphEnabled: true, default: 38, alarmsEnabled: true, alarmInnerHigh: 42, alarmOuterHigh: 45 }),
    baseTag(`${prefix}_LEAK`, { label: `${label} floor melt leak`, role: 'input', alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag(`${prefix}_DOOR`, { label: `${label} door ajar`, role: 'input', alarmsEnabled: true, alarmCondition: 'on' }),
  ];
}

function buildKitchenEquipmentTags() {
  const tags = [baseTag('ALF_KITCH_ALM', { label: 'Kitchen area alarm', role: 'memory', alarmsEnabled: true, alarmCondition: 'on' })];
  for (const f of KITCHEN_EQUIPMENT) {
    if (f.kind === 'sink') tags.push(...buildKitchenSinkFixtureTags(f.prefix, f.name));
    else if (f.kind === 'freezer') tags.push(...buildKitchenFreezerFixtureTags(f.prefix, f.name));
    else tags.push(...buildKitchenReeferFixtureTags(f.prefix, f.name));
  }
  return tags;
}

function buildSupportFixtureTags() {
  const tags = [];
  for (const f of RESTROOM_FIXTURES) tags.push(...buildRestroomFixtureTags(f.prefix, f.name));
  for (const f of NURSE_FIXTURES) {
    if (f.kind === 'sink') tags.push(...buildNurseSinkFixtureTags(f.prefix, f.name));
    else tags.push(...buildNurseBathFixtureTags(f.prefix, f.name));
  }
  return tags;
}

function fixturePopupScreenIds(pools = DEFAULT_POOLS) {
  const ids = ['screen_6', 'screen_7', `screen_${CONFERENCE.screen}`];
  for (let i = 0; i < pools.length; i++) ids.push(poolScreenId(i));
  for (const f of RESTROOM_FIXTURES) ids.push(`screen_${f.screen}`);
  for (const f of NURSE_FIXTURES) ids.push(`screen_${f.screen}`);
  return ids;
}

/** Bottom alarm strip on full-screen area detail tiles (pool / mech / kitchen). */
function detailAreaFlashLayer(tagId) {
  return {
    kind: 'flashOverlay',
    z: 2,
    color: 'red',
    tagId,
    hotspotCol: 0,
    hotspotRow: 10,
    hotspotColSpan: GRID.cols,
    hotspotRowSpan: 2,
  };
}

function fixtureAreaTile(svgPath, alarmTag) {
  return {
    col: 0, row: 0, colSpan: 16, rowSpan: 12,
    layers: [
      { kind: 'staticImage', z: 0, svg: svgPath },
      detailAreaFlashLayer(alarmTag),
      {
        kind: 'navButton', z: 4, targetScreenId: 'screen_1', label: 'Overview',
        hotspotCol: 0, hotspotRow: 0, hotspotColSpan: 2, hotspotRowSpan: 1,
      },
    ],
  };
}

function restroomBindings(screenId, prefix) {
  return [
    { screenId, elementId: 't1_1_z2__flash_overlay', tagId: `${prefix}_ALM`, property: 'flashState', onValue: 'red', offValue: 'hidden' },
    { screenId, elementId: 't1_1_z0__lamp_sink', tagId: `${prefix}_SINK_LEAK`, property: 'fill', onValue: '#ef4444', offValue: '#64748b' },
    { screenId, elementId: 't1_1_z0__lamp_toilet', tagId: `${prefix}_TOILET_LEAK`, property: 'fill', onValue: '#ef4444', offValue: '#64748b' },
    { screenId, elementId: 't1_1_z0__lamp_area_alm', tagId: `${prefix}_ALM`, property: 'fill', onValue: '#ef4444', offValue: '#64748b' },
  ];
}

function nurseBathBindings(screenId, prefix) {
  return [
    { screenId, elementId: 't1_1_z2__flash_overlay', tagId: `${prefix}_ALM`, property: 'flashState', onValue: 'red', offValue: 'hidden' },
    { screenId, elementId: 't1_1_z0__lamp_bath_mid', tagId: `${prefix}_BATH_MID_LEAK`, property: 'fill', onValue: '#ef4444', offValue: '#64748b' },
    { screenId, elementId: 't1_1_z0__lamp_toilet', tagId: `${prefix}_TOILET_LEAK`, property: 'fill', onValue: '#ef4444', offValue: '#64748b' },
    { screenId, elementId: 't1_1_z0__lamp_area_alm', tagId: `${prefix}_ALM`, property: 'fill', onValue: '#ef4444', offValue: '#64748b' },
  ];
}

function nurseSinkBindings(screenId, prefix) {
  return [
    { screenId, elementId: 't1_1_z2__flash_overlay', tagId: `${prefix}_ALM`, property: 'flashState', onValue: 'red', offValue: 'hidden' },
    { screenId, elementId: 't1_1_z0__lamp_sink_leak', tagId: `${prefix}_SINK_LEAK`, property: 'fill', onValue: '#ef4444', offValue: '#64748b' },
    { screenId, elementId: 't1_1_z0__lamp_area_alm', tagId: `${prefix}_ALM`, property: 'fill', onValue: '#ef4444', offValue: '#64748b' },
  ];
}

function kitchenColdStorageBindings(screenId, prefix, idPrefix) {
  return [
    { screenId, elementId: `t1_1_z0__val_${idPrefix}_temp`, tagId: `${prefix}_TEMP`, property: 'text', format: 'fixed1' },
    { screenId, elementId: `t1_1_z0__lamp_${idPrefix}_leak`, tagId: `${prefix}_LEAK`, property: 'fill', onValue: '#ef4444', offValue: '#64748b' },
    { screenId, elementId: `t1_1_z0__lamp_${idPrefix}_door`, tagId: `${prefix}_DOOR`, property: 'fill', onValue: '#f97316', offValue: '#64748b' },
    { screenId, elementId: `t1_1_z0__lamp_${idPrefix}_alm`, tagId: `${prefix}_ALM`, property: 'fill', onValue: '#ef4444', offValue: '#64748b' },
  ];
}

function kitchenSummaryBindings() {
  const sid = 'screen_7';
  const bindings = [
    { screenId: sid, elementId: 't1_1_z2__flash_overlay', tagId: 'ALF_KITCH_ALM', property: 'flashState', onValue: 'red', offValue: 'hidden' },
    ...kitchenColdStorageBindings(sid, 'KITCH_FREEZER', 'freezer'),
    ...kitchenColdStorageBindings(sid, 'KITCH_REEFER', 'reefer'),
    { screenId: sid, elementId: 't1_1_z0__lamp_area_alm', tagId: 'ALF_KITCH_ALM', property: 'fill', onValue: '#ef4444', offValue: '#64748b' },
    { screenId: sid, elementId: 't1_1_z0__lamp_kitch_alm', tagId: 'ALF_KITCH_ALM', property: 'fill', onValue: '#ef4444', offValue: '#64748b' },
  ];
  for (let i = 1; i <= 6; i++) {
    bindings.push({
      screenId: sid,
      elementId: `t1_1_z0__lamp_sink${i}_leak`,
      tagId: `KITCH_SINK${i}_SINK_LEAK`,
      property: 'fill',
      onValue: '#ef4444',
      offValue: '#64748b',
    });
  }
  return bindings;
}

const CONFERENCE = { screen: 22, prefix: 'ADM_CONF', name: 'Conference Room' };

function buildConferenceTags() {
  const p = CONFERENCE.prefix;
  return [
    baseTag(`${p}_ALM`, { label: 'Conference area alarm', role: 'memory' }),
    baseTag(`${p}_SMOKE`, { label: 'Conference smoke', role: 'input', alarmsEnabled: true, alarmCondition: 'on' }),
    baseTag(`${p}_CO2`, { label: 'Conference CO₂ ppm', type: 'REAL', role: 'input', graphEnabled: true, alarmsEnabled: true, alarmInnerHigh: 1200, alarmOuterHigh: 1500 }),
  ];
}

function buildVillaAlarmTags() {
  const tags = [];
  for (const v of VILLA_BUILDINGS) {
    tags.push(baseTag(v.alarmTag, {
      label: `${v.name} — any unit alarm`,
      alarmsEnabled: true,
      alarmCondition: 'on',
    }));
  }
  tags.push(baseTag('ALF_VILLAS_ALM', {
    label: 'All villas — any unit alarm',
    alarmsEnabled: true,
    alarmCondition: 'on',
  }));
  return tags;
}

function buildAllTags(mechWhGas = DEFAULT_MECH_WH_GAS, pools = DEFAULT_POOLS, semanticMap) {
  const tags = [];
  for (const roomNum of allClientRooms()) tags.push(...buildRoomTags(roomNum));
  if (includesInteriorOffice()) tags.push(...buildRoomTags(F1_OFFICE_NUM));
  for (let f = 1; f <= FLOORS; f++) tags.push(...buildFloorCondenserTags(f));
  tags.push(
    ...buildVillaAlarmTags(),
    ...buildPoolTags(pools),
    ...buildMechanicalTags(mechWhGas),
    ...buildKitchenEquipmentTags(),
    ...buildSupportFixtureTags(),
    ...buildConferenceTags(),
  );
  return applySemanticMap(tags, semanticMap);
}

function screenLayout(id, name, number, extra = {}) {
  return {
    id,
    number,
    isHome: number === 1,
    name,
    svg: '/hmi/svg/demos/demo_process.svg',
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

function bgTile(svgPath, colSpan = GRID.cols, rowSpan = GRID.rows) {
  return {
    col: 0,
    row: 0,
    colSpan,
    rowSpan,
    layers: [{ kind: 'staticImage', z: 0, svg: svgPath }],
  };
}

const PERIM = {
  ox: 72,
  oy: 96,
  ow: 880,
  oh: 580,
  depth: 92,
  gap: 6,
};

/** Distribute client rooms clockwise: north → east → south → west. */
function perimeterSideCounts(roomCount) {
  const base = Math.floor(roomCount / 4);
  const rem = roomCount % 4;
  return {
    north: base + (rem > 0 ? 1 : 0),
    east: base + (rem > 1 ? 1 : 0),
    south: base + (rem > 2 ? 1 : 0),
    west: base + (rem > 3 ? 1 : 0),
  };
}

function perimeterSideSlot(indexOnFloor, roomCount) {
  const s = perimeterSideCounts(roomCount);
  let i = indexOnFloor - 1;
  if (i < s.north) return { side: 'north', slot: i, ...s };
  i -= s.north;
  if (i < s.east) return { side: 'east', slot: i, ...s };
  i -= s.east;
  if (i < s.south) return { side: 'south', slot: i, ...s };
  return { side: 'west', slot: i - s.south, ...s };
}

function planInnerBox() {
  const ix = PERIM.ox + PERIM.depth;
  const iy = PERIM.oy + PERIM.depth;
  return {
    ix,
    iy,
    iw: PERIM.ow - 2 * PERIM.depth,
    ih: PERIM.oh - 2 * PERIM.depth,
  };
}

/** Ground-floor interior service rooms (office 125 + conference + nurse core). */
function planF1InteriorRects() {
  const { ix, iy, iw, ih } = planInnerBox();
  const coreW = 340;
  const coreH = 200;
  const cx = ix + (iw - coreW) / 2;
  const cy = iy + (ih - coreH) / 2;
  return {
    office: { x: cx, y: cy, w: 155, h: 110 },
    conference: { x: cx + 165, y: cy, w: 175, h: 110 },
    core: { x: cx + 30, y: cy + 118, w: 280, h: 72 },
  };
}

function planOfficeRect() {
  return planF1InteriorRects().office;
}

function planConferenceRect() {
  return planF1InteriorRects().conference;
}

/** Client suites on building perimeter — corridor and core on the inside. */
function planRoomRect(floorNum, indexOnFloor) {
  const roomCount = ROOMS_ON_FLOOR[floorNum - 1];
  const { side, slot, north, east, south, west } = perimeterSideSlot(indexOnFloor, roomCount);
  const { ix, iy, iw, ih } = planInnerBox();

  if (side === 'north') {
    const slotW = iw / north;
    const w = slotW - PERIM.gap;
    return { x: ix + slot * slotW + PERIM.gap / 2, y: PERIM.oy, w, h: PERIM.depth };
  }
  if (side === 'east') {
    const slotH = ih / east;
    const h = slotH - PERIM.gap;
    return {
      x: PERIM.ox + PERIM.ow - PERIM.depth,
      y: iy + slot * slotH + PERIM.gap / 2,
      w: PERIM.depth,
      h,
    };
  }
  if (side === 'south') {
    const slotW = iw / south;
    const w = slotW - PERIM.gap;
    const si = south - 1 - slot;
    return {
      x: ix + si * slotW + PERIM.gap / 2,
      y: PERIM.oy + PERIM.oh - PERIM.depth,
      w,
      h: PERIM.depth,
    };
  }
  const slotH = ih / west;
  const h = slotH - PERIM.gap;
  const si = west - 1 - slot;
  return {
    x: PERIM.ox,
    y: iy + si * slotH + PERIM.gap / 2,
    w: PERIM.depth,
    h,
  };
}

function roomPlanPos(floorNum, indexOnFloor) {
  const { x, y } = planRoomRect(floorNum, indexOnFloor);
  return { x, y };
}

function roomLabelSvg(x, y, w, h, roomNum) {
  const fontSize = h < 28 ? 11 : (w < 40 ? 12 : 18);
  return `  <text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="middle" font-family="Segoe UI,sans-serif" font-size="${fontSize}" fill="#1e3a8a">${roomNum}</text>\n`;
}

/** Map an SVG rect to HMI tile anchor + fractional hotspot bounds (must match floor-plan art). */
function rectToHotspotGrid(rect) {
  const { x, y, w, h } = rect;
  const col = Math.max(0, Math.min(GRID.cols - 1, Math.floor(x / GRID.cellWidth)));
  const row = Math.max(0, Math.min(GRID.rows - 1, Math.floor(y / GRID.cellHeight)));
  const colEnd = Math.min(GRID.cols, Math.ceil((x + w) / GRID.cellWidth));
  const rowEnd = Math.min(GRID.rows, Math.ceil((y + h) / GRID.cellHeight));
  return {
    col,
    row,
    colSpan: Math.max(1, colEnd - col),
    rowSpan: Math.max(1, rowEnd - row),
    hotspotCol: x / GRID.cellWidth,
    hotspotRow: y / GRID.cellHeight,
    hotspotColSpan: w / GRID.cellWidth,
    hotspotRowSpan: h / GRID.cellHeight,
    centerCol: (x + w / 2) / GRID.cellWidth,
    centerRow: (y + h / 2) / GRID.cellHeight,
  };
}

function roomHotspotGrid(floorNum, indexOnFloor) {
  return rectToHotspotGrid(planRoomRect(floorNum, indexOnFloor));
}

function floorPlanCorridorSvg(floorNum) {
  const { ix, iy, iw, ih } = planInnerBox();
  let interior = '';
  if (floorNum === 1) {
    const { conference, core } = planF1InteriorRects();
    if (includesInteriorOffice()) {
      const { office } = planF1InteriorRects();
      interior = `  <rect id="room_${F1_OFFICE_NUM}" x="${office.x}" y="${office.y}" width="${office.w}" height="${office.h}" rx="4" fill="#cbd5e1" stroke="#64748b" stroke-width="1.5"/>
  <text x="${office.x + office.w / 2}" y="${office.y + 48}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="14" font-weight="600" fill="#334155">Office ${F1_OFFICE_NUM}</text>
  <text x="${office.x + office.w / 2}" y="${office.y + 68}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="11" fill="#475569">Administration</text>
`;
    }
    interior += `  <rect id="zone_conf" x="${conference.x}" y="${conference.y}" width="${conference.w}" height="${conference.h}" rx="4" fill="#e9d5ff" stroke="#9333ea" stroke-width="1.5"/>
  <text x="${conference.x + conference.w / 2}" y="${conference.y + 48}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="14" font-weight="600" fill="#581c87">Conference</text>
  <text x="${conference.x + conference.w / 2}" y="${conference.y + 68}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="11" fill="#6b21a8">Meeting room</text>
  <rect x="${core.x}" y="${core.y}" width="${core.w}" height="${core.h}" rx="4" fill="#fde68a" stroke="#ca8a04" stroke-width="1.5"/>
  <text x="${core.x + core.w / 2}" y="${core.y + 32}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="12" fill="#854d0e">Elev · Nurse · Stairs</text>
  <text x="${core.x + core.w / 2}" y="${core.y + 52}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="11" fill="#92400e">Kitchen / dining on Facility Overview</text>
`;
  } else {
    const cx = ix + (iw - 240) / 2;
    const cy = iy + (ih - 130) / 2;
    interior = `  <rect x="${cx}" y="${cy}" width="240" height="130" rx="4" fill="#fde68a" stroke="#ca8a04" stroke-width="1.5"/>
  <text x="${cx + 120}" y="${cy + 58}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="12" fill="#854d0e">Elev · Nurse · Stairs</text>
`;
  }
  return `  <rect x="${PERIM.ox}" y="${PERIM.oy}" width="${PERIM.ow}" height="${PERIM.oh}" rx="8" fill="none" stroke="#64748b" stroke-width="2.5"/>
  <rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" rx="6" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="10 6"/>
  <text x="${ix + iw / 2}" y="${iy + 22}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="13" fill="#64748b">Interior corridor — suites on exterior walls</text>
${interior}`;
}

function hotspotLayerFields(grid) {
  return {
    hotspotCol: grid.hotspotCol,
    hotspotRow: grid.hotspotRow,
    hotspotColSpan: grid.hotspotColSpan,
    hotspotRowSpan: grid.hotspotRowSpan,
    centerCol: grid.centerCol,
    centerRow: grid.centerRow,
  };
}

/** One room = one hotspot region + one flash overlay on the full-plan background tile. */
function roomHotspotLayers(roomNum, grid, alarmTag) {
  return [
    {
      kind: 'roomHotspot',
      z: 1,
      roomNum,
      label: `Room ${roomNum}`,
      ...hotspotLayerFields(grid),
    },
    {
      kind: 'flashOverlay',
      z: 2,
      color: 'red',
      tagId: alarmTag,
      overlaySuffix: `flash_rm${roomNum}`,
      ...hotspotLayerFields(grid),
    },
  ];
}

function villaHotspotGrid(unitIndex) {
  return rectToHotspotGrid(planVillaUnitRect(unitIndex));
}

function villaTiles(villa) {
  const layers = [
    { kind: 'staticImage', z: 0, svg: `/hmi/svg/demos/assisted-living/${villa.slug}_plan.svg` },
  ];
  const rooms = villaRoomNums(villa);
  for (let i = 0; i < rooms.length; i += 1) {
    const roomNum = rooms[i];
    layers.push(...roomHotspotLayers(roomNum, villaHotspotGrid(i + 1), `${roomId(roomNum)}_ALM`));
  }
  layers.push(
    detailAreaFlashLayer(villa.alarmTag),
    { kind: 'alarmList', z: 3, alarmList: { showAcked: false } },
    {
      kind: 'navButton', z: 4, targetScreenId: 'screen_1', label: 'Overview',
      hotspotCol: 0, hotspotRow: 0, hotspotColSpan: 2, hotspotRowSpan: 1,
    },
  );
  return [{
    col: 0,
    row: 0,
    colSpan: GRID.cols,
    rowSpan: GRID.rows,
    layers,
  }];
}

function wingHotspotGrid(unitIndex) {
  return rectToHotspotGrid(planWingUnitRect(unitIndex));
}

function wingTiles(floorNum, wingIndex) {
  const slug = `floor_${floorNum}_wing_${wingIndex}`;
  const layers = [
    { kind: 'staticImage', z: 0, svg: `/hmi/svg/demos/assisted-living/${slug}.svg` },
  ];
  const rooms = roomsInWing(floorNum, wingIndex, ROOMS_ON_FLOOR);
  for (let i = 0; i < rooms.length; i += 1) {
    const roomNum = rooms[i];
    layers.push(...roomHotspotLayers(roomNum, wingHotspotGrid(i + 1), `${roomId(roomNum)}_ALM`));
  }
  layers.push({
    kind: 'navButton', z: 4, targetScreenId: floorHubScreenId(floorNum), label: `Floor ${floorNum}`,
    hotspotCol: 0, hotspotRow: 0, hotspotColSpan: 2, hotspotRowSpan: 1,
  });
  return [{
    col: 0, row: 0, colSpan: GRID.cols, rowSpan: GRID.rows, layers,
  }];
}

function planHubWingRect(wingIndex, wingCount) {
  const cols = wingCount <= 2 ? wingCount : 2;
  const col = (wingIndex - 1) % cols;
  const row = Math.floor((wingIndex - 1) / cols);
  const gap = 24;
  const margin = 80;
  const cellW = (1024 - margin * 2 - gap * (cols - 1)) / cols;
  const rows = Math.ceil(wingCount / cols);
  const cellH = (640 - margin - gap * (rows - 1)) / rows;
  return {
    x: margin + col * (cellW + gap),
    y: 100 + row * (cellH + gap),
    w: cellW,
    h: cellH,
  };
}

function floorHubTiles(floorNum) {
  const wingCount = wingsOnFloor(ROOMS_ON_FLOOR[floorNum - 1]);
  const layers = [
    { kind: 'staticImage', z: 0, svg: `/hmi/svg/demos/assisted-living/floor_${floorNum}_hub.svg` },
  ];
  for (let w = 1; w <= wingCount; w += 1) {
    const rect = planHubWingRect(w, wingCount);
    const g = rectToHotspotGrid(rect);
    const range = wingRoomRangeLabel(floorNum, w, ROOMS_ON_FLOOR);
    layers.push({
      kind: 'pageHotspot',
      z: 1,
      targetScreenId: wingScreenId(floorNum, w),
      label: `Wing ${w} (${range})`,
      ...hotspotLayerFields(g),
    });
    layers.push({
      kind: 'flashOverlay',
      z: 2,
      color: 'red',
      tagId: `ALF_FL${floorNum}_ALM`,
      overlaySuffix: `flash_fl${floorNum}_w${w}`,
      ...hotspotLayerFields(g),
    });
  }
  layers.push({
    kind: 'navButton', z: 4, targetScreenId: 'screen_1', label: 'Overview',
    hotspotCol: 0, hotspotRow: 0, hotspotColSpan: 2, hotspotRowSpan: 1,
  });
  return [{
    col: 0, row: 0, colSpan: GRID.cols, rowSpan: GRID.rows, layers,
  }];
}

function floorTiles(floorNum) {
  const layers = [
    { kind: 'staticImage', z: 0, svg: `/hmi/svg/demos/assisted-living/floor_${floorNum}_plan.svg` },
  ];
  const roomList = roomsOnFloor(floorNum);
  for (let i = 0; i < roomList.length; i++) {
    const roomNum = roomList[i];
    layers.push(...roomHotspotLayers(roomNum, roomHotspotGrid(floorNum, i + 1), `${roomId(roomNum)}_ALM`));
  }
  if (floorNum === 1) {
    if (includesInteriorOffice()) {
      layers.push(...roomHotspotLayers(F1_OFFICE_NUM, rectToHotspotGrid(planOfficeRect()), `${roomId(F1_OFFICE_NUM)}_ALM`));
    }
    const cg = rectToHotspotGrid(planConferenceRect());
    layers.push(
      {
        kind: 'pageHotspot',
        z: 1,
        targetScreenId: `screen_${CONFERENCE.screen}`,
        label: CONFERENCE.name,
        ...hotspotLayerFields(cg),
      },
      {
        kind: 'flashOverlay',
        z: 2,
        color: 'red',
        tagId: `${CONFERENCE.prefix}_ALM`,
        overlaySuffix: 'flash_adm_conf',
        ...hotspotLayerFields(cg),
      },
    );
  }
  return [{
    col: 0,
    row: 0,
    colSpan: GRID.cols,
    rowSpan: GRID.rows,
    layers,
  }];
}

function buildOverviewZones() {
  const flLabel = (f) => floorRoomRangeLabel(f, ROOMS_ON_FLOOR);
  const zones = [
    { overlaySuffix: 'flash_pool', label: 'Therapy Pool (exterior)', nav: 'screen_5', alm: 'ALF_POOL_ALM', rect: { x: 48, y: 280, w: 168, h: 200 } },
    { overlaySuffix: 'flash_kitchen', label: 'Kitchen', nav: 'screen_7', alm: 'ALF_KITCH_ALM', rect: { x: 320, y: 420, w: 120, h: 100 } },
    { overlaySuffix: 'flash_mech', label: 'Mechanical', nav: 'screen_6', alm: 'ALF_MECH_ALM', rect: { x: 640, y: 420, w: 120, h: 100 } },
  ];
  if (FACILITY.campusLayout) {
    zones.push({
      overlaySuffix: 'flash_tower',
      label: `Main tower (${FACILITY.totalRooms} rooms · ${FLOORS} floors)`,
      nav: floorHubScreenId(1),
      alm: 'ALF_FL1_ALM',
      rect: { x: 284, y: 104, w: 656, h: 280 },
    });
    zones.push({
      overlaySuffix: 'flash_dining',
      label: 'Dining & Lounge',
      nav: floorHubScreenId(1),
      alm: '',
      rect: { x: 460, y: 420, w: 160, h: 100 },
    });
  } else {
    zones.push(
      { overlaySuffix: 'flash_fl3', label: `Floor 3 (${flLabel(3)})`, nav: 'screen_4', alm: 'ALF_FL3_ALM', rect: { x: 284, y: 104, w: 656, h: 88 } },
      { overlaySuffix: 'flash_fl2', label: `Floor 2 (${flLabel(2)})`, nav: 'screen_3', alm: 'ALF_FL2_ALM', rect: { x: 284, y: 204, w: 656, h: 88 } },
      { overlaySuffix: 'flash_fl1', label: `Floor 1 (${flLabel(1)})`, nav: 'screen_2', alm: 'ALF_FL1_ALM', rect: { x: 284, y: 304, w: 656, h: 88 } },
      { overlaySuffix: 'flash_dining', label: 'Dining & Lounge', nav: 'screen_2', alm: '', rect: { x: 460, y: 420, w: 160, h: 100 } },
    );
  }
  for (const v of VILLA_BUILDINGS) {
    zones.push({
      overlaySuffix: `flash_${v.slug}`,
      label: `${v.name} (${villaRoomRangeLabel(v)})`,
      nav: v.screenId,
      alm: v.alarmTag,
      rect: v.overviewRect,
    });
  }
  return zones;
}

function overviewFloorNavButtons() {
  if (!FACILITY.campusLayout) {
    return [
      { label: 'Floor 1', targetScreenId: 'screen_2', hotspotCol: 6, hotspotColSpan: 2 },
      { label: 'Floor 2', targetScreenId: 'screen_3', hotspotCol: 8, hotspotColSpan: 2 },
      { label: 'Floor 3', targetScreenId: 'screen_4', hotspotCol: 10, hotspotColSpan: 2 },
    ];
  }
  const out = [];
  for (let f = 1; f <= FLOORS; f += 1) {
    out.push({
      label: `F${f}`,
      targetScreenId: floorHubScreenId(f),
      hotspotCol: ((f - 1) % 8) * 2,
      hotspotColSpan: 2,
      hotspotRow: 4 + Math.floor((f - 1) / 8),
    });
  }
  return out;
}

/** Bottom-row nav buttons on facility overview (grid mode). */
const OVERVIEW_SERVICE_NAV = [
  { label: 'Pool', targetScreenId: 'screen_5', hotspotCol: 0, hotspotColSpan: 2 },
  { label: 'Kitchen', targetScreenId: 'screen_7', hotspotCol: 2, hotspotColSpan: 2 },
  { label: 'Mechanical', targetScreenId: 'screen_6', hotspotCol: 4, hotspotColSpan: 2 },
  ...overviewFloorNavButtons(),
];

/** Villa outbuildings — second nav row on facility overview. */
const OVERVIEW_VILLA_NAV = VILLA_BUILDINGS.map((v, i) => ({
  label: v.name.replace(/^Villa /, ''),
  targetScreenId: v.screenId,
  hotspotCol: i * 4,
  hotspotColSpan: 4,
}));

function overviewTiles() {
  const layers = [
    { kind: 'staticImage', z: 0, svg: '/hmi/svg/demos/assisted-living/facility_overview.svg' },
  ];
  for (const z of buildOverviewZones()) {
    const g = rectToHotspotGrid(z.rect);
    layers.push({
      kind: 'pageHotspot',
      z: 1,
      targetScreenId: z.nav,
      label: z.label,
      ...hotspotLayerFields(g),
    });
    if (z.alm) {
      layers.push({
        kind: 'flashOverlay',
        z: 2,
        color: 'red',
        tagId: z.alm,
        overlaySuffix: z.overlaySuffix,
        ...hotspotLayerFields(g),
      });
    }
  }
  for (const nav of OVERVIEW_SERVICE_NAV) {
    layers.push({
      kind: 'navButton',
      z: 4,
      targetScreenId: nav.targetScreenId,
      label: nav.label,
      hotspotRow: nav.hotspotRow != null ? nav.hotspotRow : GRID.rows - 2,
      hotspotRowSpan: 1,
      hotspotCol: nav.hotspotCol,
      hotspotColSpan: nav.hotspotColSpan,
    });
  }
  for (const nav of OVERVIEW_VILLA_NAV) {
    layers.push({
      kind: 'navButton',
      z: 4,
      targetScreenId: nav.targetScreenId,
      label: nav.label,
      hotspotRow: GRID.rows - 1,
      hotspotRowSpan: 1,
      hotspotCol: nav.hotspotCol,
      hotspotColSpan: nav.hotspotColSpan,
    });
  }
  return [{
    col: 0,
    row: 0,
    colSpan: GRID.cols,
    rowSpan: GRID.rows,
    layers,
  }];
}

function buildResidentialScreens() {
  if (!FACILITY.campusLayout) {
    const legacy = [];
    for (let f = 1; f <= FLOORS; f += 1) {
      legacy.push(screenLayout(`screen_${f + 1}`, `Floor ${f}`, f + 1, { tiles: floorTiles(f) }));
    }
    return legacy;
  }
  const out = [];
  for (let f = 1; f <= FLOORS; f += 1) {
    out.push(screenLayout(
      floorHubScreenId(f),
      `Floor ${f} (${floorRoomRangeLabel(f, ROOMS_ON_FLOOR)})`,
      floorHubScreenNumber(f),
      { tiles: floorHubTiles(f) },
    ));
    const wingCount = wingsOnFloor(ROOMS_ON_FLOOR[f - 1]);
    for (let w = 1; w <= wingCount; w += 1) {
      const range = wingRoomRangeLabel(f, w, ROOMS_ON_FLOOR);
      out.push(screenLayout(
        wingScreenId(f, w),
        `F${f} Wing ${w} (${range})`,
        wingScreenNumber(f, w),
        { tiles: wingTiles(f, w) },
      ));
    }
  }
  return out;
}

function buildScreens(pools = DEFAULT_POOLS) {
  const primaryPool = pools[0] || DEFAULT_POOLS[0];
  const screens = [
    screenLayout('screen_1', 'Facility Overview', 1, { tiles: overviewTiles() }),
    ...buildResidentialScreens(),
    screenLayout(poolScreenId(0), primaryPool.name, 5, { tiles: [poolAreaTile('ALF_POOL_ALM', 0)] }),
    screenLayout('screen_6', 'Mechanical', 6, {
      tiles: [{
        col: 0, row: 0, colSpan: 16, rowSpan: 12,
        layers: [
          { kind: 'staticImage', z: 0, svg: '/hmi/svg/demos/assisted-living/mechanical_room.svg' },
          detailAreaFlashLayer('ALF_MECH_ALM'),
          { kind: 'alarmList', z: 3, alarmList: { showAcked: false } },
          { kind: 'navButton', z: 4, targetScreenId: 'screen_1', label: 'Overview', hotspotCol: 0, hotspotRow: 0, hotspotColSpan: 2, hotspotRowSpan: 1 },
        ],
      }],
    }),
    screenLayout('screen_7', 'Kitchen', 7, {
      tiles: [{
        col: 0, row: 0, colSpan: 16, rowSpan: 12,
        layers: [
          { kind: 'staticImage', z: 0, svg: '/hmi/svg/demos/assisted-living/kitchen_room.svg' },
          detailAreaFlashLayer('ALF_KITCH_ALM'),
          { kind: 'alarmList', z: 3, alarmList: { showAcked: false } },
          { kind: 'navButton', z: 4, targetScreenId: 'screen_1', label: 'Overview', hotspotCol: 0, hotspotRow: 0, hotspotColSpan: 2, hotspotRowSpan: 1 },
        ],
      }],
    }),
    ...RESTROOM_FIXTURES.map((f) => screenLayout(`screen_${f.screen}`, f.name, f.screen, {
      tiles: [fixtureAreaTile('/hmi/svg/demos/assisted-living/support_restroom.svg', `${f.prefix}_ALM`)],
    })),
    ...NURSE_FIXTURES.map((f) => screenLayout(`screen_${f.screen}`, f.name, f.screen, {
      tiles: [fixtureAreaTile(
        f.kind === 'sink'
          ? '/hmi/svg/demos/assisted-living/nurse_sink.svg'
          : '/hmi/svg/demos/assisted-living/nurse_bath.svg',
        `${f.prefix}_ALM`,
      )],
    })),
    screenLayout(`screen_${CONFERENCE.screen}`, CONFERENCE.name, CONFERENCE.screen, {
      tiles: [fixtureAreaTile('/hmi/svg/demos/assisted-living/conference_room.svg', `${CONFERENCE.prefix}_ALM`)],
    }),
    ...VILLA_BUILDINGS.map((v) => screenLayout(v.screenId, v.name, v.screen, {
      tiles: villaTiles(v),
    })),
  ];
  for (let i = 1; i < pools.length; i++) {
    const pool = pools[i];
    screens.push(screenLayout(
      poolScreenId(i),
      pool.name,
      23 + i - 1,
      { tiles: [poolAreaTile('ALF_POOL_ALM', i)] },
    ));
  }
  for (let i = 0; i < pools.length; i++) {
    screens.push(poolScheduleScreenLayout(i, pools[i]));
  }
  return screens;
}

function conferenceBindings(screenId, prefix) {
  return [
    { screenId, elementId: 't1_1_z2__flash_overlay', tagId: `${prefix}_ALM`, property: 'flashState', onValue: 'red', offValue: 'hidden' },
    { screenId, elementId: 't1_1_z0__lamp_smoke', tagId: `${prefix}_SMOKE`, property: 'fill', onValue: '#ef4444', offValue: '#64748b' },
    { screenId, elementId: 't1_1_z0__val_co2', tagId: `${prefix}_CO2`, property: 'text', format: 'fixed0' },
    { screenId, elementId: 't1_1_z0__lamp_area_alm', tagId: `${prefix}_ALM`, property: 'fill', onValue: '#ef4444', offValue: '#64748b' },
  ];
}

function mechVisBinding(elementId, tagId) {
  return {
    screenId: 'screen_6',
    elementId,
    tagId,
    property: 'visibility',
    onValue: '1',
    offValue: '0',
  };
}

function poolVisBinding(screenId, elementId, tagId) {
  return {
    screenId,
    elementId,
    tagId,
    property: 'visibility',
    onValue: '1',
    offValue: '0',
  };
}

const POOL_BW_FILL5 = ['#64748b', '#2563eb', '#06b6d4', '#f59e0b', '#22c55e'];
const POOL_MAIN_SCHED_DAY = 1;

function filterPumpOverviewBindings(pool, screenId) {
  const p = poolTagPrefix(pool);
  const z = 't1_1_z0__';
  const bindings = [];
  const tpoPct = (suffix, tag) => ({
    screenId,
    elementId: `${z}${suffix}`,
    tagId: `${p}_${tag}`,
    property: 'text',
    format: 'fixed0',
    min: 0,
    max: 100,
  });
  const hhmmEdit = (suffix, tag) => ({
    screenId,
    elementId: `${z}${suffix}`,
    tagId: `${p}_${tag}`,
    property: 'text',
    format: 'hhmm',
    interaction: 'edit',
    min: 0,
    max: 1439,
  });
  const pctEdit = (suffix, tag) => ({
    screenId,
    elementId: `${z}${suffix}`,
    tagId: `${p}_${tag}`,
    property: 'text',
    format: 'int',
    interaction: 'edit',
    min: 0,
    max: 100,
  });

  for (let n = 1; n <= MAX_FILTER_PUMPS; n++) {
    bindings.push(
      tpoPct(`fp${n}_pct`, `FP${n}_PCT`),
      { screenId, elementId: `${z}fp${n}_run`, tagId: `${p}_FP${n}_RUN`, property: 'fill', onValue: '#22c55e', offValue: '#64748b' },
      pctEdit(`fp${n}_ss_pct`, `FP${n}_SS_PCT`),
      poolVisBinding(screenId, `${z}grp_fp${n}_ss`, `${p}_FP${n}_CFG_SS`),
      poolVisBinding(screenId, `${z}grp_fp${n}_seq`, `${p}_FP${n}_CFG_SEQ`),
    );
    for (let s = 1; s <= FILTER_SLOTS_PER_DAY; s++) {
      bindings.push(
        hhmmEdit(`fp${n}_s${s}_t`, `FP${n}_D${POOL_MAIN_SCHED_DAY}_S${s}_T`),
        pctEdit(`fp${n}_s${s}_p`, `FP${n}_D${POOL_MAIN_SCHED_DAY}_S${s}_P`),
      );
    }
    if (n > 1) bindings.push(poolVisBinding(screenId, `${z}grp_fp${n}`, `${p}_CFG_FP${n}`));
  }
  return bindings;
}

function poolScheduleBindings(pool, screenId) {
  const p = poolTagPrefix(pool);
  const z = 't1_1_z0__';
  const bindings = [{
    screenId,
    elementId: `${z}sch_fp_cnt`,
    tagId: `${p}_CFG_FP_CNT`,
    property: 'text',
    format: 'int',
  }];
  const hhmmEdit = (suffix, tag) => ({
    screenId,
    elementId: `${z}${suffix}`,
    tagId: `${p}_${tag}`,
    property: 'text',
    format: 'hhmm',
    interaction: 'edit',
    min: 0,
    max: 1439,
  });
  const pctEdit = (suffix, tag) => ({
    screenId,
    elementId: `${z}${suffix}`,
    tagId: `${p}_${tag}`,
    property: 'text',
    format: 'int',
    interaction: 'edit',
    min: 0,
    max: 100,
  });

  for (let n = 1; n <= MAX_FILTER_PUMPS; n++) {
    for (let d = 0; d < FILTER_SCHEDULE_DAYS; d++) {
      for (let s = 1; s <= FILTER_SLOTS_PER_DAY; s++) {
        bindings.push(
          hhmmEdit(`sch_fp${n}_d${d}_s${s}_t`, `FP${n}_D${d}_S${s}_T`),
          pctEdit(`sch_fp${n}_d${d}_s${s}_p`, `FP${n}_D${d}_S${s}_P`),
        );
      }
    }
    if (n > 1) bindings.push(poolVisBinding(screenId, `${z}grp_sch_fp${n}`, `${p}_CFG_FP${n}`));
  }
  return bindings;
}

function poolOverviewBindings(pool, screenId) {
  const p = poolTagPrefix(pool);
  const z = 't1_1_z0__';
  const tpoPct = (suffix, tag) => ({
    screenId,
    elementId: `${z}${suffix}`,
    tagId: `${p}_${tag}`,
    property: 'text',
    format: 'fixed0',
    min: 0,
    max: 100,
  });
  return [
    { screenId, elementId: `${z}flow_lamp`, tagId: `${p}_FLOW_OK`, property: 'fill', onValue: '#22c55e', offValue: '#ef4444' },
    { screenId, elementId: `${z}ph_pv`, tagId: `${p}_PH`, property: 'text', format: 'fixed1' },
    { screenId, elementId: `${z}orp_pv`, tagId: `${p}_ORP`, property: 'text', format: 'int' },
    { screenId, elementId: `${z}cl2_pv`, tagId: `${p}_CL2`, property: 'text', format: 'fixed2' },
    { screenId, elementId: `${z}cond_pv`, tagId: `${p}_COND`, property: 'text', format: 'int' },
    { screenId, elementId: `${z}wat_temp_pv`, tagId: `${p}_TEMP`, property: 'text', format: 'fixed1' },
    tpoPct('cl2_pump_pct', 'CL2_PUMP_PCT'),
    tpoPct('acid_pump_pct', 'ACID_PUMP_PCT'),
    tpoPct('ecl_pct', 'ECL_PCT'),
    ...filterPumpOverviewBindings(pool, screenId),
    { screenId, elementId: `${z}ecl_run_lamp`, tagId: `${p}_ECL_RUN`, property: 'fill', onValue: '#22c55e', offValue: '#64748b' },
    {
      screenId,
      elementId: `${z}bw_state`,
      tagId: `${p}_BW_STA`,
      property: 'text',
      format: 'poolBwSta',
      min: 0,
      max: 4,
      colors: POOL_BW_FILL5,
    },
    {
      screenId,
      elementId: `${z}bw_step_lamp`,
      tagId: `${p}_BW_STA`,
      property: 'fill5',
      min: 0,
      max: 4,
      colors: POOL_BW_FILL5,
    },
    { screenId, elementId: `${z}btn_bw_normal`, tagId: `${p}_BW_BUSY`, property: 'fill', onValue: '#cbd5e1', offValue: '#64748b' },
    { screenId, elementId: `${z}btn_bw_backwash`, tagId: `${p}_BW_BUSY`, property: 'fill', onValue: '#64748b', offValue: '#cbd5e1' },
    { screenId, elementId: `${z}btn_bw_start`, tagId: `${p}_BW_CMD`, property: 'fill', onValue: '#2563eb', offValue: '#94a3b8' },
    poolVisBinding(screenId, `${z}grp_san_orp`, `${p}_CFG_USE_ORP`),
    poolVisBinding(screenId, `${z}grp_san_cl2`, `${p}_CFG_USE_CL2`),
    poolVisBinding(screenId, `${z}grp_salt_cond`, `${p}_CFG_SALT`),
    poolVisBinding(screenId, `${z}grp_feed_fresh`, `${p}_CFG_FRESH`),
    poolVisBinding(screenId, `${z}grp_ecl`, `${p}_CFG_SALT`),
    { screenId, elementId: `${z}lamp_pool_alm`, tagId: 'ALF_POOL_ALM', property: 'fill', onValue: '#ef4444', offValue: '#64748b' },
  ];
}

function poolRoomFilterPumpRowsSvg() {
  const rowH = 58;
  const baseY = 248;
  const slotX0 = 318;
  const slotW = 76;
  let rows = '';
  for (let n = 1; n <= MAX_FILTER_PUMPS; n++) {
    const y = baseY + (n - 1) * rowH;
    const wrapStart = n > 1 ? `<g id="grp_fp${n}">` : '';
    const wrapEnd = n > 1 ? '</g>' : '';
    let slots = '';
    for (let s = 1; s <= FILTER_SLOTS_PER_DAY; s++) {
      const sx = slotX0 + (s - 1) * slotW;
      slots += `
      <text id="fp${n}_s${s}_t" x="${sx + 28}" y="${y + 36}" text-anchor="middle" font-family="Consolas,monospace" font-size="11" fill="#0f172a">00:00</text>
      <text id="fp${n}_s${s}_p" x="${sx + 28}" y="${y + 50}" text-anchor="middle" font-family="Consolas,monospace" font-size="11" fill="#475569">0%</text>`;
    }
    rows += `${wrapStart}
  <rect x="100" y="${y}" width="800" height="${rowH - 6}" rx="6" fill="#f8fafc" stroke="#64748b" stroke-width="1.2"/>
  <text x="118" y="${y + 22}" font-size="11" font-weight="700" fill="#334155">Pump ${n}</text>
  <circle id="fp${n}_run" cx="118" cy="${y + 42}" r="8" fill="#64748b"/>
  <text x="148" y="${y + 24}" font-size="9" fill="#64748b">TPO</text>
  <text id="fp${n}_pct" x="148" y="${y + 44}" font-family="Consolas,monospace" font-size="16" fill="#0f172a">0</text>
  <text x="182" y="${y + 44}" font-size="11" fill="#64748b">%</text>
  <g id="grp_fp${n}_ss">
    <text x="228" y="${y + 24}" font-size="9" fill="#64748b">Single</text>
    <text id="fp${n}_ss_pct" x="228" y="${y + 44}" font-family="Consolas,monospace" font-size="16" fill="#0f172a">65</text>
    <text x="262" y="${y + 44}" font-size="11" fill="#64748b">%</text>
  </g>
  <g id="grp_fp${n}_seq">
  <text x="${slotX0}" y="${y + 18}" font-size="8" font-weight="600" fill="#94a3b8">S1</text>
  <text x="${slotX0 + slotW}" y="${y + 18}" font-size="8" font-weight="600" fill="#94a3b8">S2</text>
  <text x="${slotX0 + slotW * 2}" y="${y + 18}" font-size="8" font-weight="600" fill="#94a3b8">S3</text>
  <text x="${slotX0 + slotW * 3}" y="${y + 18}" font-size="8" font-weight="600" fill="#94a3b8">S4</text>
  <text x="${slotX0 + slotW * 4}" y="${y + 18}" font-size="8" font-weight="600" fill="#94a3b8">S5</text>
  <text x="${slotX0 + slotW * 5}" y="${y + 18}" font-size="8" font-weight="600" fill="#94a3b8">S6</text>
  ${slots}
  </g>${wrapEnd}`;
  }
  return rows;
}

function poolSchedulePanelSvg(n, panelX, y) {
  const contentW = SCHEDULE_PUMP_PANEL_W;
  const panelH = schedulePumpPanelHeight();
  const wrapStart = n > 1 ? `<g id="grp_sch_fp${n}">` : '';
  const wrapEnd = n > 1 ? '</g>' : '';
  const slotsAreaW = contentW - SCHEDULE_DAY_LABEL_W - 16;
  const cellW = Math.floor((slotsAreaW - SCHEDULE_SLOT_GAP * 2) / 3);
  const cellH = SCHEDULE_SLOT_CELL_H;
  const slotColX = (col) => panelX + SCHEDULE_DAY_LABEL_W + col * (cellW + SCHEDULE_SLOT_GAP);
  const titleX = panelX + contentW / 2;
  let days = '';
  for (let d = 0; d < FILTER_SCHEDULE_DAYS; d++) {
    const dy = y + 72 + d * SCHEDULE_DAY_BLOCK_H;
    const bg = d % 2 === 0 ? '#f8fafc' : '#eef2f7';
    days += `<rect x="${panelX + 4}" y="${dy}" width="${contentW - 8}" height="${SCHEDULE_DAY_BLOCK_H - 10}" rx="10" fill="${bg}" stroke="#cbd5e1" stroke-width="1.5"/>`;
    days += `<text x="${panelX + SCHEDULE_DAY_LABEL_W / 2 + 4}" y="${dy + 40}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="${SCHEDULE_FONT_DAY}" font-weight="700" fill="#0f172a">${FILTER_DAY_LABELS[d]}</text>`;
    for (let s = 1; s <= FILTER_SLOTS_PER_DAY; s++) {
      const col = (s - 1) % 3;
      const row = Math.floor((s - 1) / 3);
      const cx = slotColX(col);
      const cy = dy + 14 + row * (cellH + SCHEDULE_SLOT_GAP);
      days += `
      <rect x="${cx}" y="${cy}" width="${cellW}" height="${cellH}" rx="10" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>
      <text x="${cx + cellW / 2}" y="${cy + 24}" text-anchor="middle" font-size="${SCHEDULE_FONT_SLOT}" font-weight="700" fill="#64748b">S${s}</text>
      <text id="sch_fp${n}_d${d}_s${s}_t" x="${cx + cellW / 2}" y="${cy + 62}" text-anchor="middle" font-family="Consolas,monospace" font-size="${SCHEDULE_FONT_TIME}" font-weight="700" fill="#0f172a">06:00</text>
      <text id="sch_fp${n}_d${d}_s${s}_p" x="${cx + cellW / 2}" y="${cy + 102}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="${SCHEDULE_FONT_PCT}" font-weight="700" fill="#0369a1">80%</text>`;
    }
  }
  return `${wrapStart}
  <rect x="${panelX}" y="${y}" width="${contentW}" height="${panelH}" rx="14" fill="#ffffff" stroke="#475569" stroke-width="2.5"/>
  <text x="${titleX}" y="${y + 36}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="30" font-weight="700" fill="#0f172a">Filter pump ${n}</text>
  <text x="${titleX}" y="${y + 58}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="18" fill="#64748b">Tap time or % to edit</text>
  ${days}${wrapEnd}`;
}

function schedulePumpSetupBarSvg() {
  const y = SCHEDULE_HEADER_H;
  const h = SCHEDULE_PUMP_SETUP_H - 8;
  const totalW = scheduleSvgTotalWidth();
  const contentW = scheduleContentWidth();
  return `
  <rect x="${SCHEDULE_MARGIN}" y="${y}" width="${contentW}" height="${h}" rx="12" fill="#ffffff" stroke="#475569" stroke-width="2"/>
  <text x="${SCHEDULE_MARGIN + 20}" y="${y + 34}" font-size="24" font-weight="700" fill="#334155">Filter pumps on this body</text>
  <text x="${SCHEDULE_MARGIN + 20}" y="${y + 58}" font-size="17" fill="#64748b">Count set in Project → Area configuration (max ${MAX_SITE_FILTER_PUMPS} site-wide)</text>
  <rect x="${totalW - SCHEDULE_MARGIN - 108}" y="${y + 14}" width="96" height="52" rx="10" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/>
  <text id="sch_fp_cnt" x="${totalW - SCHEDULE_MARGIN - 60}" y="${y + 50}" text-anchor="middle" font-family="Consolas,monospace" font-size="40" font-weight="700" fill="#0f172a">1</text>`;
}

function buildPoolFilterScheduleSvg() {
  const y = scheduleContentStartY();
  const totalW = scheduleSvgTotalWidth();
  const totalH = scheduleSvgTotalHeight();
  const panels = [];
  for (let p = 1; p <= MAX_FILTER_PUMPS; p++) {
    const panelX = SCHEDULE_MARGIN + (p - 1) * (SCHEDULE_PUMP_PANEL_W + SCHEDULE_PUMP_PANEL_GAP);
    panels.push(poolSchedulePanelSvg(p, panelX, y));
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">
  <rect width="${totalW}" height="${totalH}" fill="#f1f5f9"/>
  <text id="sched_title" x="${totalW / 2}" y="40" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="34" font-weight="700" fill="#0f172a">Weekly filter schedules</text>
  <text x="${totalW / 2}" y="72" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="20" fill="#64748b">Pump count in Project → Area configuration &#183; schedules side by side &#183; 7 days &#183; 6 starts/day</text>
  ${schedulePumpSetupBarSvg()}
  ${panels.join('\n')}
</svg>`;
  return { svg, totalH, totalW };
}

function writePoolFilterScheduleSvgs(pools) {
  for (let i = 0; i < pools.length; i++) {
    const { svg } = buildPoolFilterScheduleSvg();
    fs.writeFileSync(path.join(SVG_DIR, `pool_filter_schedule_${i}.svg`), svg, 'utf8');
  }
}

function writePoolRoomSvg() {
  const filterRows = poolRoomFilterPumpRowsSvg();
  const bwY = 248 + MAX_FILTER_PUMPS * 58 + 8;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768" width="1024" height="768">
  <rect width="1024" height="768" fill="#f1f5f9"/>
  <text id="pool_title" x="512" y="36" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="22" font-weight="600" fill="#0f172a">Pool / Spa</text>
  <text x="512" y="54" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="11" fill="#64748b">Chemistry &#183; pump count in Project → Area configuration &#183; weekly schedules on Schedules screen</text>

  <text x="48" y="84" font-size="10" font-weight="600" fill="#334155">FLOW</text>
  <circle id="flow_lamp" cx="48" cy="102" r="10" fill="#64748b" stroke="#334155" stroke-width="2"/>

  <rect x="100" y="72" width="800" height="68" rx="8" fill="#f8fafc" stroke="#475569" stroke-width="1.5"/>
  <text x="168" y="94" text-anchor="middle" font-size="10" font-weight="600" fill="#64748b">pH</text>
  <text id="ph_pv" x="168" y="118" text-anchor="middle" font-family="Consolas,monospace" font-size="20" fill="#0f172a">&#8212;</text>
  <g id="grp_san_orp">
    <text x="288" y="94" text-anchor="middle" font-size="10" font-weight="600" fill="#64748b">ORP mV</text>
    <text id="orp_pv" x="288" y="118" text-anchor="middle" font-family="Consolas,monospace" font-size="20" fill="#0f172a">&#8212;</text>
  </g>
  <g id="grp_san_cl2">
    <text x="288" y="94" text-anchor="middle" font-size="10" font-weight="600" fill="#64748b">CL2 ppm</text>
    <text id="cl2_pv" x="288" y="118" text-anchor="middle" font-family="Consolas,monospace" font-size="20" fill="#0f172a">&#8212;</text>
  </g>
  <g id="grp_salt_cond">
    <text x="432" y="94" text-anchor="middle" font-size="10" font-weight="600" fill="#64748b">Cond ppm</text>
    <text id="cond_pv" x="432" y="118" text-anchor="middle" font-family="Consolas,monospace" font-size="20" fill="#0f172a">&#8212;</text>
  </g>
  <text x="576" y="94" text-anchor="middle" font-size="10" font-weight="600" fill="#64748b">Water &#176;F</text>
  <text id="wat_temp_pv" x="576" y="118" text-anchor="middle" font-family="Consolas,monospace" font-size="20" fill="#0f172a">&#8212;</text>

  <g id="grp_feed_fresh">
    <rect x="100" y="148" width="240" height="56" rx="6" fill="#ecfdf5" stroke="#059669" stroke-width="1.5"/>
    <text x="220" y="168" text-anchor="middle" font-size="11" font-weight="600" fill="#047857">CL2 TPO feed</text>
    <text id="cl2_pump_pct" x="220" y="192" text-anchor="middle" font-family="Consolas,monospace" font-size="18" fill="#0f172a">0</text>
  </g>
  <rect x="352" y="148" width="240" height="56" rx="6" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/>
  <text x="472" y="168" text-anchor="middle" font-size="11" font-weight="600" fill="#92400e">Acid TPO feed</text>
  <text id="acid_pump_pct" x="472" y="192" text-anchor="middle" font-family="Consolas,monospace" font-size="18" fill="#0f172a">0</text>
  <g id="grp_ecl">
    <rect x="604" y="148" width="296" height="56" rx="6" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.5"/>
    <text x="752" y="168" text-anchor="middle" font-size="11" font-weight="600" fill="#0369a1">ECL TPO feed</text>
    <text id="ecl_pct" x="720" y="192" font-family="Consolas,monospace" font-size="18" fill="#0f172a">0</text>
    <circle id="ecl_run_lamp" cx="820" cy="188" r="8" fill="#64748b"/>
  </g>

  <text x="100" y="228" font-size="11" font-weight="700" fill="#475569">FILTER PUMPS — today&#8217;s 6-slot sequence (Mon) or single-speed %</text>
  ${filterRows}

  <g id="bw_panel">
    <rect x="100" y="${bwY}" width="800" height="96" rx="8" fill="#f1f5f9" stroke="#64748b" stroke-width="1.5"/>
    <text x="512" y="${bwY + 20}" text-anchor="middle" font-size="11" font-weight="600" fill="#475569">BACKWASH SEQUENCE</text>
    <circle id="bw_step_lamp" cx="160" cy="${bwY + 48}" r="14" fill="#64748b" stroke="#334155" stroke-width="2"/>
    <text id="bw_state" x="160" y="${bwY + 78}" text-anchor="middle" font-size="10" font-weight="700" fill="#334155">IDLE</text>
    <g id="btn_bw_normal" transform="translate(580, ${bwY + 28})">
      <rect width="72" height="22" rx="11" fill="#64748b"/>
      <text x="36" y="15" text-anchor="middle" font-size="9" font-weight="700" fill="#ffffff">NORMAL</text>
    </g>
    <g id="btn_bw_backwash" transform="translate(580, ${bwY + 56})">
      <rect width="72" height="22" rx="11" fill="#cbd5e1"/>
      <text x="36" y="15" text-anchor="middle" font-size="9" font-weight="700" fill="#475569">BACKWASH</text>
    </g>
    <g id="btn_bw_start" transform="translate(680, ${bwY + 40})">
      <rect width="56" height="32" rx="6" fill="#94a3b8" stroke="#475569" stroke-width="1.5"/>
      <text x="28" y="20" text-anchor="middle" font-size="10" font-weight="700" fill="#ffffff">START</text>
    </g>
  </g>

  <rect x="80" y="700" width="864" height="52" rx="6" fill="#fee2e2" stroke="#ef4444" stroke-width="1"/>
  <circle id="lamp_pool_alm" cx="120" cy="726" r="12" fill="#64748b"/>
  <text x="150" y="732" font-family="Segoe UI,sans-serif" font-size="14" fill="#991b1b">Area alarm summary</text>
</svg>`;
  fs.writeFileSync(path.join(SVG_DIR, 'pool_room.svg'), svg, 'utf8');
}

function mechanicalBindings() {
  const sid = 'screen_6';
  const z = 't1_1_z0__';
  const wh = (n) => [
    { screenId: sid, elementId: `${z}val_wh${n}_kw`, tagId: `MECH_WH${n}_KW`, property: 'text', format: 'fixed1' },
    { screenId: sid, elementId: `${z}val_wh${n}_temp`, tagId: `MECH_WH${n}_TEMP`, property: 'text', format: 'fixed1' },
    { screenId: sid, elementId: `${z}lamp_wh${n}_run`, tagId: `MECH_WH${n}_RUN`, property: 'fill', onValue: '#22c55e', offValue: '#64748b' },
    { screenId: sid, elementId: `${z}lamp_wh${n}_alm`, tagId: `MECH_WH${n}_ALM`, property: 'fill', onValue: '#ef4444', offValue: '#64748b' },
  ];
  return [
    { screenId: sid, elementId: 't1_1_z2__flash_overlay', tagId: 'ALF_MECH_ALM', property: 'flashState', onValue: 'red', offValue: 'hidden' },
    { screenId: sid, elementId: `${z}val_flow_gpm`, tagId: 'MECH_FLOW_GPM', property: 'text', format: 'fixed1' },
    { screenId: sid, elementId: `${z}val_total_kw`, tagId: 'MECH_METER_KWH', property: 'text', format: 'fixed0' },
    { screenId: sid, elementId: `${z}val_meter_interval`, tagId: 'MECH_METER_INTERVAL_KWH', property: 'text', format: 'fixed1' },
    { screenId: sid, elementId: `${z}val_gas_cfm`, tagId: 'MECH_GAS_CFM', property: 'text', format: 'fixed1' },
    ...wh(1),
    ...wh(2),
    ...wh(3),
    { screenId: sid, elementId: `${z}lamp_mech_alm`, tagId: 'ALF_MECH_ALM', property: 'fill', onValue: '#ef4444', offValue: '#64748b' },
    mechVisBinding(`${z}grp_energy_elec`, 'MECH_CFG_ELEC_WH'),
    mechVisBinding(`${z}grp_wh_elec`, 'MECH_CFG_ELEC_WH'),
    mechVisBinding(`${z}grp_energy_gas`, 'MECH_CFG_GAS_WH'),
  ];
}

/** Kitchen panel in resident room faceplates — labels left, lamps right (no overlap). */
function roomKitchenPanelSvg(x, y, w, h) {
  const titleX = x + w / 2;
  const labelX = x + 20;
  const lampX = x + w - 36;
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#ffedd5" stroke="#ea580c" stroke-width="2"/>
  <text x="${titleX}" y="${y + 30}" text-anchor="middle" font-size="16" font-weight="600" fill="#9a3412">Kitchen</text>
  <text x="${labelX}" y="${y + 68}" font-size="12" fill="#334155">Stove ON</text>
  <circle id="lamp_stove_on" cx="${lampX}" cy="${y + 64}" r="10" fill="#64748b"/>
  <text x="${labelX}" y="${y + 108}" font-size="12" fill="#334155">Excess ON (&gt;45 min)</text>
  <circle id="lamp_stove_excess" cx="${lampX}" cy="${y + 104}" r="10" fill="#64748b"/>`;
}

function roomCommonPanelsSvg() {
  return `
  <rect x="40" y="70" width="300" height="220" rx="6" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/>
  <text x="190" y="100" text-anchor="middle" font-size="16" font-weight="600" fill="#1e40af">Living Room</text>
  <text x="60" y="130" font-size="13" fill="#334155">Temp &#176;F</text>
  <text id="val_liv_temp" x="190" y="165" text-anchor="middle" font-family="Consolas,monospace" font-size="28" fill="#0f172a">&#8212;</text>
  <rect x="360" y="70" width="300" height="220" rx="6" fill="#e9d5ff" stroke="#9333ea" stroke-width="2"/>
  <text x="510" y="100" text-anchor="middle" font-size="16" font-weight="600" fill="#581c87">Bedroom</text>
  <text x="380" y="130" font-size="13" fill="#334155">Temp &#176;F</text>
  <text id="val_bed_temp" x="510" y="165" text-anchor="middle" font-family="Consolas,monospace" font-size="28" fill="#0f172a">&#8212;</text>
  ${roomKitchenPanelSvg(680, 70, 300, 220)}
  <rect x="40" y="310" width="460" height="200" rx="6" fill="#ccfbf1" stroke="#0d9488" stroke-width="2"/>
  <text x="270" y="340" text-anchor="middle" font-size="16" font-weight="600" fill="#115e59">Bathroom</text>
  <text x="60" y="375" font-size="12" fill="#334155">Tub / shower leak</text>
  <circle id="lamp_bath_mid" cx="380" cy="370" r="10" fill="#64748b"/>
  <text x="60" y="415" font-size="12" fill="#334155">Toilet leak</text>
  <circle id="lamp_toilet" cx="380" cy="410" r="10" fill="#64748b"/>
  <rect x="520" y="310" width="460" height="200" rx="6" fill="#e0e7ff" stroke="#4f46e5" stroke-width="2"/>
  <text x="750" y="340" text-anchor="middle" font-size="16" font-weight="600" fill="#312e81">Room A/C Unit</text>
  <text x="540" y="375" font-size="12" fill="#334155">Condensate pan leak</text>
  <circle id="lamp_ac_pan" cx="720" cy="370" r="10" fill="#64748b"/>
  <text x="540" y="415" font-size="12" fill="#334155">Blower failure</text>
  <circle id="lamp_ac_blower" cx="720" cy="410" r="10" fill="#64748b"/>`;
}

function writeRoomInteriorSvg() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 530" width="1024" height="530">
  <rect width="1024" height="530" fill="#f8fafc"/>
  <text id="lbl_room_title" x="512" y="42" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="26" font-weight="600" fill="#0f172a">Resident Room</text>
  ${roomCommonPanelsSvg()}
  <rect x="40" y="470" width="940" height="44" rx="4" fill="#fee2e2" stroke="#ef4444" stroke-width="1"/>
  <circle id="lamp_room_alm" cx="70" cy="492" r="12" fill="#64748b"/>
  <text x="95" y="497" font-size="14" fill="#991b1b">Room area alarm</text>
</svg>`;
  fs.writeFileSync(path.join(SVG_DIR, 'room_interior.svg'), svg, 'utf8');
}

function writeRoomDetailSvg() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768" width="1024" height="768">
  <rect width="1024" height="768" fill="#f8fafc"/>
  <text id="lbl_room_title" x="512" y="42" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="26" font-weight="600" fill="#0f172a">Resident Room</text>
  ${roomCommonPanelsSvg()}
  <rect x="40" y="530" width="940" height="200" rx="6" fill="#f1f5f9" stroke="#64748b" stroke-width="2"/>
  <text x="512" y="560" text-anchor="middle" font-size="16" font-weight="600" fill="#334155">Roof-Mount Condenser (per floor)</text>
  <text x="60" y="600" font-size="12" fill="#334155">Fan failure</text>
  <circle id="lamp_cond_fan" cx="160" cy="595" r="10" fill="#64748b"/>
  <text x="220" y="600" font-size="12" fill="#334155">Compressor failure</text>
  <circle id="lamp_cond_comp" cx="360" cy="595" r="10" fill="#64748b"/>
  <text x="420" y="600" font-size="12" fill="#334155">Hi side temp</text>
  <text id="val_cond_hi" x="520" y="603" font-family="Consolas,monospace" font-size="16" fill="#0f172a">&#8212;</text>
  <text x="580" y="600" font-size="12" fill="#334155">Lo side temp</text>
  <text id="val_cond_lo" x="680" y="603" font-family="Consolas,monospace" font-size="16" fill="#0f172a">&#8212;</text>
  <circle id="lamp_cond_alm" cx="860" cy="595" r="10" fill="#64748b"/>
  <text x="878" y="600" font-size="12" fill="#334155">Cond alarm</text>
  <rect x="40" y="640" width="940" height="50" rx="4" fill="#fee2e2" stroke="#ef4444" stroke-width="1"/>
  <circle id="lamp_room_alm" cx="70" cy="668" r="12" fill="#64748b"/>
  <text x="95" y="673" font-size="14" fill="#991b1b">Room area alarm</text>
</svg>`;
  fs.writeFileSync(path.join(SVG_DIR, 'room_detail.svg'), svg, 'utf8');
}

function writeKitchenRoomSvg() {
  const coldPanel = (cx, title, idPrefix, stroke, fill, titleFill) => `
  <rect x="${cx - 140}" y="90" width="280" height="320" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
  <text x="${cx}" y="125" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="18" font-weight="600" fill="${titleFill}">${title}</text>
  <text x="${cx - 70}" y="168" font-size="13" fill="#334155">Air temp &#176;F</text>
  <text id="val_${idPrefix}_temp" x="${cx}" y="198" text-anchor="middle" font-family="Consolas,monospace" font-size="26" fill="#0f172a">&#8212;</text>
  <text x="${cx - 70}" y="248" font-size="13" fill="#334155">Slab / pan leak</text>
  <circle id="lamp_${idPrefix}_leak" cx="${cx}" cy="268" r="12" fill="#64748b"/>
  <text x="${cx - 70}" y="308" font-size="13" fill="#334155">Door ajar</text>
  <circle id="lamp_${idPrefix}_door" cx="${cx}" cy="328" r="12" fill="#64748b"/>
  <circle id="lamp_${idPrefix}_alm" cx="${cx}" cy="378" r="12" fill="#64748b"/>
  <text x="${cx + 18}" y="384" font-size="12" fill="#334155">Zone alarm</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768" width="1024" height="768">
  <rect width="1024" height="768" fill="#f1f5f9"/>
  <text x="512" y="48" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="26" font-weight="600" fill="#0f172a">Commercial Kitchen &#8212; Cold Storage &amp; Prep Line</text>
  ${coldPanel(200, 'Walk-in Freezer', 'freezer', '#4338ca', '#e0e7ff', '#312e81')}
  ${coldPanel(512, 'Walk-in Reefer', 'reefer', '#2563eb', '#dbeafe', '#1e3a8a')}
  <rect x="684" y="90" width="280" height="320" rx="8" fill="#ffedd5" stroke="#ea580c" stroke-width="2"/>
  <text x="824" y="125" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="18" font-weight="600" fill="#9a3412">Cooking Line &#8212; 6 Sinks</text>
  <text x="710" y="168" font-size="12" fill="#334155">Sink leak indicators</text>
  <circle id="lamp_sink1_leak" cx="730" cy="200" r="10" fill="#64748b"/>
  <text x="748" y="205" font-size="11" fill="#334155">1</text>
  <circle id="lamp_sink2_leak" cx="790" cy="200" r="10" fill="#64748b"/>
  <text x="808" y="205" font-size="11" fill="#334155">2</text>
  <circle id="lamp_sink3_leak" cx="850" cy="200" r="10" fill="#64748b"/>
  <text x="868" y="205" font-size="11" fill="#334155">3</text>
  <circle id="lamp_sink4_leak" cx="730" cy="250" r="10" fill="#64748b"/>
  <text x="748" y="255" font-size="11" fill="#334155">4</text>
  <circle id="lamp_sink5_leak" cx="790" cy="250" r="10" fill="#64748b"/>
  <text x="808" y="255" font-size="11" fill="#334155">5</text>
  <circle id="lamp_sink6_leak" cx="850" cy="250" r="10" fill="#64748b"/>
  <text x="868" y="255" font-size="11" fill="#334155">6</text>
  <rect x="684" y="680" width="280" height="44" rx="4" fill="#fee2e2" stroke="#ef4444" stroke-width="1"/>
  <circle id="lamp_kitch_alm" cx="714" cy="702" r="12" fill="#64748b"/>
  <text x="736" y="708" font-size="13" fill="#991b1b">Kitchen area alarm</text>
  <rect x="60" y="680" width="592" height="44" rx="6" fill="#fee2e2" stroke="#ef4444" stroke-width="1"/>
  <circle id="lamp_area_alm" cx="90" cy="702" r="12" fill="#64748b"/>
  <text x="112" y="708" font-family="Segoe UI,sans-serif" font-size="14" fill="#991b1b">Area alarm summary</text>
</svg>`;
  fs.writeFileSync(path.join(SVG_DIR, 'kitchen_room.svg'), svg, 'utf8');
}

function writeMechanicalRoomSvg() {
  const whPanel = (cx, n) => `
  <g id="wh${n}_panel">
    <rect x="${cx - 130}" y="300" width="260" height="340" rx="8" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
    <text x="${cx}" y="340" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="18" font-weight="600" fill="#92400e">Water Heater ${n}</text>
    <text x="${cx}" y="368" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="13" fill="#78350f">120 gal domestic</text>
    <circle id="lamp_wh${n}_run" cx="${cx}" cy="400" r="18" fill="#64748b"/>
    <text x="${cx}" y="440" text-anchor="middle" font-size="13" fill="#334155">Running</text>
    <text id="val_wh${n}_temp" x="${cx}" y="500" text-anchor="middle" font-family="Consolas,monospace" font-size="22" fill="#0f172a">— °F</text>
    <text x="${cx}" y="528" text-anchor="middle" font-size="12" fill="#64748b">Outlet temp</text>
    <circle id="lamp_wh${n}_alm" cx="${cx}" cy="580" r="14" fill="#64748b"/>
    <text x="${cx}" y="615" text-anchor="middle" font-size="12" fill="#334155">Temp alarm</text>
  </g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768" width="1024" height="768">
  <rect width="1024" height="768" fill="#f1f5f9"/>
  <text x="512" y="44" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="26" font-weight="600" fill="#0f172a">Mechanical Room — 3× 120 gal DHW Heaters</text>
  <text x="512" y="68" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="13" fill="#64748b">Common DHW flow · electric kW or gas CFM (Project → Area configuration)</text>
  <rect x="312" y="88" width="400" height="96" rx="8" fill="#e0f2fe" stroke="#0284c7" stroke-width="2"/>
  <text x="512" y="118" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="14" font-weight="600" fill="#0369a1">DHW supply flow meter</text>
  <text x="512" y="138" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="12" fill="#0c4a6e">Feeds all three water heaters</text>
  <text id="val_flow_gpm" x="512" y="168" text-anchor="middle" font-family="Consolas,monospace" font-size="28" fill="#0f172a">— GPM</text>
  <g id="grp_energy_elec">
    <rect x="112" y="196" width="800" height="118" rx="8" fill="#fef9c3" stroke="#ca8a04" stroke-width="2"/>
    <text x="512" y="224" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="14" font-weight="600" fill="#854d0e">Electric power meter — Next Century</text>
    <text x="280" y="252" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="12" fill="#713f12">Total kWh</text>
    <text x="744" y="252" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="12" fill="#713f12">Last 10 min kWh</text>
    <text id="val_total_kw" x="280" y="288" text-anchor="middle" font-family="Consolas,monospace" font-size="24" fill="#0f172a">—</text>
    <text id="val_meter_interval" x="744" y="288" text-anchor="middle" font-family="Consolas,monospace" font-size="24" fill="#0f172a">—</text>
  </g>
  <g id="grp_energy_gas">
    <rect x="112" y="196" width="800" height="88" rx="8" fill="#ffedd5" stroke="#ea580c" stroke-width="2"/>
    <text x="512" y="224" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="14" font-weight="600" fill="#9a3412">Gas flow meter</text>
    <text x="512" y="244" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="12" fill="#7c2d12">Total gas flow — 3× gas HWH bank</text>
    <text id="val_gas_cfm" x="512" y="272" text-anchor="middle" font-family="Consolas,monospace" font-size="24" fill="#0f172a">— CFM</text>
  </g>
  ${whPanel(210, 1)}
  ${whPanel(512, 2)}
  ${whPanel(814, 3)}
  <g id="grp_wh_elec">
    <text id="val_wh1_kw" x="210" y="660" text-anchor="middle" font-family="Consolas,monospace" font-size="20" fill="#0f172a">— kW</text>
    <text x="210" y="684" text-anchor="middle" font-size="11" fill="#64748b">Heater kW</text>
    <text id="val_wh2_kw" x="512" y="660" text-anchor="middle" font-family="Consolas,monospace" font-size="20" fill="#0f172a">— kW</text>
    <text x="512" y="684" text-anchor="middle" font-size="11" fill="#64748b">Heater kW</text>
    <text id="val_wh3_kw" x="814" y="660" text-anchor="middle" font-family="Consolas,monospace" font-size="20" fill="#0f172a">— kW</text>
    <text x="814" y="684" text-anchor="middle" font-size="11" fill="#64748b">Heater kW</text>
  </g>
  <rect x="80" y="700" width="864" height="52" rx="6" fill="#fee2e2" stroke="#ef4444" stroke-width="1"/>
  <circle id="lamp_mech_alm" cx="120" cy="726" r="12" fill="#64748b"/>
  <text x="150" y="732" font-family="Segoe UI,sans-serif" font-size="14" fill="#991b1b">Area alarm summary</text>
</svg>`;
  fs.writeFileSync(path.join(SVG_DIR, 'mechanical_room.svg'), svg, 'utf8');
}

function writeConferenceRoomSvg() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 530" width="1024" height="530">
  <rect width="1024" height="530" fill="#f8fafc"/>
  <text id="lbl_title" x="512" y="42" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="26" font-weight="600" fill="#0f172a">Conference Room</text>
  <rect x="80" y="80" width="864" height="320" rx="8" fill="#f3e8ff" stroke="#9333ea" stroke-width="2"/>
  <text x="512" y="120" text-anchor="middle" font-size="18" font-weight="600" fill="#581c87">Ground-floor meeting room</text>
  <rect x="280" y="170" width="464" height="120" rx="6" fill="#ddd6fe" stroke="#7c3aed" stroke-width="1.5"/>
  <text x="512" y="240" text-anchor="middle" font-size="14" fill="#5b21b6">Conference table</text>
  <text x="120" y="200" font-size="14" fill="#334155">Smoke detector</text>
  <circle id="lamp_smoke" cx="420" cy="195" r="14" fill="#64748b"/>
  <text x="120" y="260" font-size="14" fill="#334155">CO₂ ppm</text>
  <text id="val_co2" x="420" y="265" font-size="16" font-weight="600" fill="#0f172a">850</text>
  <rect x="80" y="420" width="864" height="44" rx="4" fill="#fee2e2" stroke="#ef4444" stroke-width="1"/>
  <circle id="lamp_area_alm" cx="110" cy="442" r="14" fill="#64748b"/>
  <text x="140" y="448" font-size="14" fill="#991b1b">Area alarm</text>
</svg>`;
  fs.writeFileSync(path.join(SVG_DIR, 'conference_room.svg'), svg, 'utf8');
}

function buildBindings(screens, pools = DEFAULT_POOLS) {
  const bindings = [];
  for (const z of buildOverviewZones()) {
    if (!z.alm) continue;
    bindings.push({
      screenId: 'screen_1',
      elementId: `t1_1_z2__${z.overlaySuffix}`,
      tagId: z.alm,
      property: 'flashState',
      onValue: 'red',
      offValue: 'hidden',
    });
  }

  for (let f = 1; f <= FLOORS; f++) {
    if (FACILITY.campusLayout) {
      const wingCount = wingsOnFloor(ROOMS_ON_FLOOR[f - 1]);
      for (let w = 1; w <= wingCount; w += 1) {
        const sid = wingScreenId(f, w);
        for (const roomNum of roomsInWing(f, w, ROOMS_ON_FLOOR)) {
          bindings.push({
            screenId: sid,
            elementId: `t1_1_z2__flash_rm${roomNum}`,
            tagId: `${roomId(roomNum)}_ALM`,
            property: 'flashState',
            onValue: 'red',
            offValue: 'hidden',
          });
        }
      }
      continue;
    }
    const sid = `screen_${f + 1}`;
    for (const roomNum of roomsOnFloor(f)) {
      bindings.push({
        screenId: sid,
        elementId: `t1_1_z2__flash_rm${roomNum}`,
        tagId: `${roomId(roomNum)}_ALM`,
        property: 'flashState',
        onValue: 'red',
        offValue: 'hidden',
      });
    }
    if (f === 1) {
      const f1Extras = [
        {
          screenId: sid,
          elementId: 't1_1_z2__flash_adm_conf',
          tagId: `${CONFERENCE.prefix}_ALM`,
          property: 'flashState',
          onValue: 'red',
          offValue: 'hidden',
        },
      ];
      if (includesInteriorOffice()) {
        f1Extras.unshift({
          screenId: sid,
          elementId: `t1_1_z2__flash_rm${F1_OFFICE_NUM}`,
          tagId: `${roomId(F1_OFFICE_NUM)}_ALM`,
          property: 'flashState',
          onValue: 'red',
          offValue: 'hidden',
        });
      }
      bindings.push(...f1Extras);
    }
  }

  for (const v of VILLA_BUILDINGS) {
    for (const roomNum of villaRoomNums(v)) {
      bindings.push({
        screenId: v.screenId,
        elementId: `t1_1_z2__flash_rm${roomNum}`,
        tagId: `${roomId(roomNum)}_ALM`,
        property: 'flashState',
        onValue: 'red',
        offValue: 'hidden',
      });
    }
    bindings.push({
      screenId: v.screenId,
      elementId: 't1_1_z2__flash_overlay',
      tagId: v.alarmTag,
      property: 'flashState',
      onValue: 'red',
      offValue: 'hidden',
    });
  }

  for (let i = 0; i < pools.length; i++) {
    const sid = poolScreenId(i);
    if (i === 0) {
      bindings.push({
        screenId: sid,
        elementId: 't1_1_z2__flash_overlay',
        tagId: 'ALF_POOL_ALM',
        property: 'flashState',
        onValue: 'red',
        offValue: 'hidden',
      });
    }
    bindings.push(...poolOverviewBindings(pools[i], sid));
  }

  for (let i = 0; i < pools.length; i++) {
    bindings.push(...poolScheduleBindings(pools[i], poolFilterScheduleScreenId(i)));
  }

  bindings.push(
    ...mechanicalBindings(),
    ...kitchenSummaryBindings(),
  );

  for (const f of RESTROOM_FIXTURES) {
    bindings.push(...restroomBindings(`screen_${f.screen}`, f.prefix));
  }
  for (const f of NURSE_FIXTURES) {
    const sid = `screen_${f.screen}`;
    if (f.kind === 'sink') bindings.push(...nurseSinkBindings(sid, f.prefix));
    else bindings.push(...nurseBathBindings(sid, f.prefix));
  }
  bindings.push(...conferenceBindings(`screen_${CONFERENCE.screen}`, CONFERENCE.prefix));

  return bindings;
}

function buildStProgram(pools = DEFAULT_POOLS) {
  const lines = [
    '(* Assisted Living Facility — client rooms 101+, pool, mechanical *)',
    '(* Stove excess: 45 min ON timer per room *)',
    '',
  ];

  for (const roomNum of allClientRooms()) {
    const p = roomId(roomNum);
    lines.push(
      `TimerInput(${p}_STOVE_TMR, ${p}_STOVE_ON);`,
      `IF TimerDone(${p}_STOVE_TMR) THEN TurnON(${p}_STOVE_EXCESS); ELSE TurnOFF(${p}_STOVE_EXCESS); END_IF;`,
      `IF ${p}_BATH_MID_LEAK OR ${p}_TOILET_LEAK OR ${p}_STOVE_EXCESS OR ${p}_AC_PAN_LEAK OR ${p}_AC_BLOWER_FLT THEN TurnON(${p}_ALM); ELSE TurnOFF(${p}_ALM); END_IF;`,
    );
  }
  if (includesInteriorOffice()) {
    const p = roomId(F1_OFFICE_NUM);
    lines.push(
      `TimerInput(${p}_STOVE_TMR, ${p}_STOVE_ON);`,
      `IF TimerDone(${p}_STOVE_TMR) THEN TurnON(${p}_STOVE_EXCESS); ELSE TurnOFF(${p}_STOVE_EXCESS); END_IF;`,
      `IF ${p}_BATH_MID_LEAK OR ${p}_TOILET_LEAK OR ${p}_STOVE_EXCESS OR ${p}_AC_PAN_LEAK OR ${p}_AC_BLOWER_FLT THEN TurnON(${p}_ALM); ELSE TurnOFF(${p}_ALM); END_IF;`,
    );
  }

  lines.push('');
  for (let f = 1; f <= FLOORS; f++) {
    const p = `FL${f}`;
    lines.push(
      `IF ${p}_COND_FAN_FLT OR ${p}_COND_COMP_FLT THEN TurnON(${p}_COND_ALM); ELSE TurnOFF(${p}_COND_ALM); END_IF;`,
    );
    const parts = roomsOnFloor(f).map((r) => `${roomId(r)}_ALM`);
    if (f === 1) {
      if (includesInteriorOffice()) parts.push(`${roomId(F1_OFFICE_NUM)}_ALM`);
      parts.push(`${CONFERENCE.prefix}_ALM`);
    }
    parts.push(`${p}_COND_ALM`);
    lines.push(`IF ${parts.join(' OR ')} THEN TurnON(ALF_FL${f}_ALM); ELSE TurnOFF(ALF_FL${f}_ALM); END_IF;`);
  }

  lines.push('');
  for (const v of VILLA_BUILDINGS) {
    const parts = villaRoomNums(v).map((r) => `${roomId(r)}_ALM`);
    lines.push(`IF ${parts.join(' OR ')} THEN TurnON(${v.alarmTag}); ELSE TurnOFF(${v.alarmTag}); END_IF;`);
  }
  if (VILLA_BUILDINGS.length) {
  lines.push(
    `IF ${VILLA_BUILDINGS.map((v) => v.alarmTag).join(' OR ')} THEN TurnON(ALF_VILLAS_ALM); ELSE TurnOFF(ALF_VILLAS_ALM); END_IF;`,
  );
  }

  lines.push(
    '',
    '(* Mechanical — 3× 120 gal DHW; gas or electric meters via MECH_CFG_GAS_WH *)',
    'IF MECH_CFG_GAS_WH THEN TurnOFF(MECH_CFG_ELEC_WH); ELSE TurnON(MECH_CFG_ELEC_WH); END_IF;',
    'IF MECH_WH1_TEMP > 140.0 THEN TurnON(MECH_WH1_ALM); ELSE TurnOFF(MECH_WH1_ALM); END_IF;',
    'IF MECH_WH2_TEMP > 140.0 THEN TurnON(MECH_WH2_ALM); ELSE TurnOFF(MECH_WH2_ALM); END_IF;',
    'IF MECH_WH3_TEMP > 140.0 THEN TurnON(MECH_WH3_ALM); ELSE TurnOFF(MECH_WH3_ALM); END_IF;',
    'IF MECH_CFG_GAS_WH THEN',
    '  IF MECH_WH1_ALM OR MECH_WH2_ALM OR MECH_WH3_ALM OR MECH_FLOW_GPM < 5.0 OR MECH_GAS_CFM < 8.0 THEN TurnON(ALF_MECH_ALM); ELSE TurnOFF(ALF_MECH_ALM); END_IF;',
    'ELSE',
    '  IF MECH_WH1_ALM OR MECH_WH2_ALM OR MECH_WH3_ALM OR MECH_FLOW_GPM < 5.0 OR MECH_TOTAL_KW > 45.0 THEN TurnON(ALF_MECH_ALM); ELSE TurnOFF(ALF_MECH_ALM); END_IF;',
    'END_IF;',
  );

  const poolAlmParts = [];
  for (const pool of pools) {
    const p = poolTagPrefix(pool);
    poolAlmParts.push(`NOT ${p}_FLOW_OK`);
    for (let n = 1; n <= filterPumpCount(pool); n++) poolAlmParts.push(`${p}_FP${n}_FLT`);
  }
  lines.push(
    `IF ${poolAlmParts.join(' OR ')} THEN TurnON(ALF_POOL_ALM); ELSE TurnOFF(ALF_POOL_ALM); END_IF;`,
  );

  for (const f of RESTROOM_FIXTURES) {
    const p = f.prefix;
    lines.push(`IF ${p}_SINK_LEAK OR ${p}_TOILET_LEAK THEN TurnON(${p}_ALM); ELSE TurnOFF(${p}_ALM); END_IF;`);
  }
  for (const f of NURSE_FIXTURES) {
    const p = f.prefix;
    if (f.kind === 'sink') {
      lines.push(`IF ${p}_SINK_LEAK THEN TurnON(${p}_ALM); ELSE TurnOFF(${p}_ALM); END_IF;`);
    } else {
      lines.push(`IF ${p}_BATH_MID_LEAK OR ${p}_TOILET_LEAK THEN TurnON(${p}_ALM); ELSE TurnOFF(${p}_ALM); END_IF;`);
    }
  }
  for (const f of KITCHEN_EQUIPMENT) {
    const p = f.prefix;
    if (f.kind === 'sink') {
      lines.push(`IF ${p}_SINK_LEAK THEN TurnON(${p}_ALM); ELSE TurnOFF(${p}_ALM); END_IF;`);
    } else if (f.kind === 'freezer') {
      lines.push(`IF ${p}_TEMP > 5.0 OR ${p}_LEAK OR ${p}_DOOR THEN TurnON(${p}_ALM); ELSE TurnOFF(${p}_ALM); END_IF;`);
    } else {
      lines.push(`IF ${p}_TEMP > 42.0 OR ${p}_LEAK OR ${p}_DOOR THEN TurnON(${p}_ALM); ELSE TurnOFF(${p}_ALM); END_IF;`);
    }
  }
  lines.push(
    'IF KITCH_FREEZER_ALM OR KITCH_REEFER_ALM OR KITCH_SINK1_ALM OR KITCH_SINK2_ALM OR KITCH_SINK3_ALM OR KITCH_SINK4_ALM OR KITCH_SINK5_ALM OR KITCH_SINK6_ALM THEN TurnON(ALF_KITCH_ALM); ELSE TurnOFF(ALF_KITCH_ALM); END_IF;',
    `IF ${CONFERENCE.prefix}_SMOKE OR ${CONFERENCE.prefix}_CO2 > 1200.0 THEN TurnON(${CONFERENCE.prefix}_ALM); ELSE TurnOFF(${CONFERENCE.prefix}_ALM); END_IF;`,
  );

  return `${lines.join('\n')}\n`;
}

function writeVillaPlanSvg(villa) {
  const rooms = villaRoomNums(villa);
  const { w, h } = villaSvgViewBox();
  let rects = '';
  for (let i = 0; i < rooms.length; i += 1) {
    const roomNum = rooms[i];
    const { x, y, w: uw, h: uh } = planVillaUnitRect(i + 1);
    rects += `  <rect id="room_${roomNum}" x="${x}" y="${y}" width="${uw}" height="${uh}" rx="4" fill="#bbf7d0" stroke="#16a34a" stroke-width="1.5"/>\n`;
    rects += `  <text x="${x + uw / 2}" y="${y + uh / 2}" text-anchor="middle" dominant-baseline="middle" font-family="Segoe UI,sans-serif" font-size="16" fill="#14532d">${roomNum}</text>\n`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="#f0fdf4"/>
  <text x="${w / 2}" y="40" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="24" font-weight="600" fill="#14532d">${villa.name} — Outbuilding</text>
  <text x="${w / 2}" y="62" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="13" fill="#166534">${villa.unitCount} units · ${villaRoomRangeLabel(villa)}</text>
${rects}</svg>`;
  fs.writeFileSync(path.join(SVG_DIR, `${villa.slug}_plan.svg`), svg, 'utf8');
}

function f1LayoutNote() {
  const r1 = floorRoomRangeLabel(1, ROOMS_ON_FLOOR);
  return includesInteriorOffice()
    ? `Perimeter suites ${r1} · interior office ${F1_OFFICE_NUM} &amp; conference · kitchen/dining on overview.`
    : `Perimeter suites ${r1} · conference &amp; nurse core · kitchen/dining on overview.`;
}

function writeWingPlanSvg(floorNum, wingIndex) {
  const slug = `floor_${floorNum}_wing_${wingIndex}`;
  const rooms = roomsInWing(floorNum, wingIndex, ROOMS_ON_FLOOR);
  const { w, h } = wingSvgViewBox();
  let rects = '';
  for (let i = 0; i < rooms.length; i += 1) {
    const roomNum = rooms[i];
    const { x, y, w: uw, h: uh } = planWingUnitRect(i + 1);
    rects += `  <rect id="room_${roomNum}" x="${x}" y="${y}" width="${uw}" height="${uh}" rx="4" fill="#dbeafe" stroke="#3b82f6" stroke-width="1.5"/>\n`;
    rects += roomLabelSvg(x, y, uw, uh, roomNum);
  }
  const range = wingRoomRangeLabel(floorNum, wingIndex, ROOMS_ON_FLOOR);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="#f1f5f9"/>
  <text x="${w / 2}" y="40" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="24" font-weight="600" fill="#0f172a">Floor ${floorNum} — Wing ${wingIndex}</text>
  <text x="${w / 2}" y="62" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="13" fill="#64748b">Rooms ${range}</text>
${rects}</svg>`;
  fs.writeFileSync(path.join(SVG_DIR, `${slug}.svg`), svg, 'utf8');
}

function writeFloorHubSvg(floorNum) {
  const wingCount = wingsOnFloor(ROOMS_ON_FLOOR[floorNum - 1]);
  let wingRects = '';
  for (let w = 1; w <= wingCount; w += 1) {
    const { x, y, w: rw, h: rh } = planHubWingRect(w, wingCount);
    const range = wingRoomRangeLabel(floorNum, w, ROOMS_ON_FLOOR);
    wingRects += `  <rect id="wing_${w}" x="${x}" y="${y}" width="${rw}" height="${rh}" rx="8" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/>\n`;
    wingRects += `  <text x="${x + rw / 2}" y="${y + rh / 2 - 8}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="18" font-weight="600" fill="#1e3a8a">Wing ${w}</text>\n`;
    wingRects += `  <text x="${x + rw / 2}" y="${y + rh / 2 + 16}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="13" fill="#1e40af">${range}</text>\n`;
  }
  const range = floorRoomRangeLabel(floorNum, ROOMS_ON_FLOOR);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768" width="1024" height="768">
  <rect width="1024" height="768" fill="#f1f5f9"/>
  <text x="512" y="48" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="26" font-weight="600" fill="#0f172a">Floor ${floorNum}</text>
  <text x="512" y="72" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="14" fill="#64748b">${range} · ${wingCount} wings × up to ${ROOMS_PER_WING} rooms</text>
${wingRects}</svg>`;
  fs.writeFileSync(path.join(SVG_DIR, `floor_${floorNum}_hub.svg`), svg, 'utf8');
}

function writeFacilityOverviewSvg() {
  const towerMid = FACILITY.campusLayout
    ? `Main tower — ${FACILITY.totalRooms} rooms · ${FLOORS} floors · wing navigation`
    : null;
  const f1Label = includesInteriorOffice()
    ? `Floor 1 — suites ${floorRoomRangeLabel(1, ROOMS_ON_FLOOR)} · office ${F1_OFFICE_NUM} · conference`
    : `Floor 1 — ${FACILITY.totalRooms}-room perimeter · suites ${floorRoomRangeLabel(1, ROOMS_ON_FLOOR)}`;
  const floorBands = FACILITY.campusLayout
    ? `  <rect x="284" y="104" width="656" height="280" rx="8" fill="#93c5fd" stroke="#2563eb" stroke-width="2"/>
  <text x="612" y="200" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="20" fill="#1e3a8a">${towerMid}</text>
  <text x="612" y="230" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="13" fill="#1e40af">Use floor buttons or open Floor 1 hub</text>`
    : `  <rect x="284" y="104" width="656" height="88" rx="4" fill="#93c5fd" stroke="#2563eb" stroke-width="1.5"/>
  <text x="612" y="152" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="17" fill="#1e3a8a">Floor 3 — perimeter suites ${floorRoomRangeLabel(3, ROOMS_ON_FLOOR)}</text>
  <rect x="284" y="204" width="656" height="88" rx="4" fill="#93c5fd" stroke="#2563eb" stroke-width="1.5"/>
  <text x="612" y="252" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="17" fill="#1e3a8a">Floor 2 — perimeter suites ${floorRoomRangeLabel(2, ROOMS_ON_FLOOR)}</text>
  <rect x="284" y="304" width="656" height="88" rx="4" fill="#93c5fd" stroke="#2563eb" stroke-width="1.5"/>
  <text x="612" y="352" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="17" fill="#1e3a8a">${f1Label}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768" width="1024" height="768">
  <rect width="1024" height="768" fill="#e2e8f0"/>
  <text x="512" y="48" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="26" font-weight="600" fill="#0f172a">Assisted Living — ${FACILITY.totalResidentialUnits} units</text>
  <text x="512" y="72" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="13" fill="#64748b">Main tower ${FACILITY.totalRooms} (${ROOMS_ON_FLOOR.join('+')}/floor) · 3 villas × ${FACILITY.villaUnitsPerBuilding} · Next Century</text>
  <!-- Exterior therapy pool (outside main footprint) -->
  <rect id="zone_pool" x="48" y="280" width="168" height="200" rx="8" fill="#67e8f9" stroke="#0891b2" stroke-width="2" stroke-dasharray="6 4"/>
  <text x="132" y="370" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="16" fill="#164e63">Therapy Pool</text>
  <text x="132" y="394" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="12" fill="#0e7490">Exterior — outside building</text>
${VILLA_BUILDINGS.map((v) => {
    const r = v.overviewRect;
    return `  <rect id="zone_${v.slug}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="8" fill="#bbf7d0" stroke="#16a34a" stroke-width="2"/>
  <text x="${r.x + r.w / 2}" y="${r.y + 44}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="14" font-weight="600" fill="#14532d">${v.name}</text>
  <text x="${r.x + r.w / 2}" y="${r.y + 64}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="11" fill="#166534">${v.unitCount} units</text>`;
  }).join('\n')}
  <path d="M 216 380 L 268 380" stroke="#0891b2" stroke-width="1.5" stroke-dasharray="4 3" fill="none"/>
  <!-- Main building -->
  <rect x="268" y="88" width="688" height="592" rx="10" fill="#cbd5e1" stroke="#64748b" stroke-width="3"/>
${floorBands}
  <rect x="320" y="420" width="120" height="100" rx="4" fill="#fdba74" stroke="#ea580c" stroke-width="1.5"/>
  <text x="380" y="475" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="13" fill="#7c2d12">Kitchen</text>
  <rect x="460" y="420" width="160" height="100" rx="4" fill="#86efac" stroke="#16a34a" stroke-width="1.5"/>
  <text x="540" y="475" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="13" fill="#14532d">Dining &amp; Lounge</text>
  <rect x="640" y="420" width="120" height="100" rx="4" fill="#94a3b8" stroke="#475569" stroke-width="1.5"/>
  <text x="700" y="465" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="13" fill="#0f172a">Mechanical</text>
  <text x="700" y="485" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="11" fill="#334155">3× HWH</text>
  <text x="612" y="560" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="12" fill="#475569">Ground-floor interior services (inside building only)</text>
  <rect x="284" y="580" width="656" height="84" rx="4" fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="8 5"/>
  <text x="612" y="628" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="11" fill="#2563eb">Perimeter ring — all client rooms face outward</text>
</svg>`;
  fs.writeFileSync(path.join(SVG_DIR, 'facility_overview.svg'), svg, 'utf8');
}

function writeFloorPlanSvg(floorNum) {
  const roomList = roomsOnFloor(floorNum);
  let rects = floorPlanCorridorSvg(floorNum);
  for (let i = 0; i < roomList.length; i++) {
    const roomNum = roomList[i];
    const { x, y, w, h } = planRoomRect(floorNum, i + 1);
    rects += `  <rect id="room_${roomNum}" x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#dbeafe" stroke="#3b82f6" stroke-width="1.5"/>\n`;
    rects += roomLabelSvg(x, y, w, h, roomNum);
  }
  const first = roomList[0];
  const last = roomList[roomList.length - 1];
  const layoutNote = floorNum === 1
    ? f1LayoutNote()
    : `Perimeter suites ${first}–${last} — interior corridor &amp; nurse core; residential only.`;
  const titleSuffix = floorNum === 1 && includesInteriorOffice()
    ? `Client Rooms ${first}–${last} · Office ${F1_OFFICE_NUM} · Conference`
    : `Client Rooms ${first}–${last}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768" width="1024" height="768">
  <rect width="1024" height="768" fill="#f1f5f9"/>
  <text x="512" y="40" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="24" font-weight="600" fill="#0f172a">Floor ${floorNum} — ${titleSuffix}</text>
  <text x="512" y="64" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="14" fill="#64748b">${layoutNote}</text>
${rects}</svg>`;
  fs.writeFileSync(path.join(SVG_DIR, `floor_${floorNum}_plan.svg`), svg, 'utf8');
}

function main() {
  const mechWhGas = DEFAULT_MECH_WH_GAS;
  const pools = normalizePools(DEFAULT_POOLS);
  const clientRooms = allClientRooms();
  const semanticMap = buildSemanticMap(clientRooms, { padWidth: ROOM_PAD });
  const tags = buildAllTags(mechWhGas, pools, semanticMap);
  if (tags.length > MAX_TAGS) {
    console.error(
      `Tag count ${tags.length} exceeds MAX_TAGS ${MAX_TAGS}. `
      + `Set MOOREVIEW_MAX_TAGS=${FACILITY.recommendMaxTags} (or higher) and re-run.`,
    );
    process.exit(1);
  }

  const screens = buildScreens(pools);
  if (screens.length > MAX_SCREENS) {
    console.error(`Screen count ${screens.length} exceeds MAX_SCREENS ${MAX_SCREENS}`);
    process.exit(1);
  }

  if (FACILITY.campusLayout) {
    for (let f = 1; f <= FLOORS; f += 1) {
      writeFloorHubSvg(f);
      const wingCount = wingsOnFloor(ROOMS_ON_FLOOR[f - 1]);
      for (let w = 1; w <= wingCount; w += 1) writeWingPlanSvg(f, w);
    }
  } else {
    for (let f = 1; f <= FLOORS; f += 1) writeFloorPlanSvg(f);
  }
  for (const v of VILLA_BUILDINGS) writeVillaPlanSvg(v);
  writeFacilityOverviewSvg();
  writePoolRoomSvg();
  writePoolFilterScheduleSvgs(pools);
  writeMechanicalRoomSvg();
  writeKitchenRoomSvg();
  writeRoomInteriorSvg();
  writeRoomDetailSvg();
  writeConferenceRoomSvg();

  const bindings = buildBindings(screens, pools);
  const program = buildStProgram(pools);
  fs.writeFileSync(OUT_ST, program, 'utf8');

  const ncDriverBase = JSON.parse(fs.readFileSync(NC_DRIVERS, 'utf8'));
  const drivers = ncDriverBase.map((d) => (
    d.id === NC_DRIVER_ID
      ? { ...d, propertyIds: FACILITY.propertyIds, autoSyncTags: true }
      : d
  ));

  const est = {
    format: 'mooreview-est',
    version: 1,
    savedAt: new Date().toISOString(),
    project: { name: 'assisted-living' },
    tags,
    drivers,
    program,
    activeProgram: 'logic/assisted_living_facility.st',
    settings: {
      project: { name: 'assisted-living' },
      scanMs: 100,
      activeProgram: 'logic/assisted_living_facility.st',
      remoteExecution: false,
      autoStartRuntime: true,
      demoFeatures: { hmiTestMode: true },
      assistedLiving: {
        mechWhGas: DEFAULT_MECH_WH_GAS,
        pools,
        facility: {
          totalRooms: FACILITY.totalRooms,
          roomsOnFloor: FACILITY.roomsOnFloor,
          floors: FACILITY.floors,
          driver: 'nextcentury',
          villas: VILLA_BUILDINGS.map((v) => ({
            id: v.id,
            name: v.name,
            slug: v.slug,
            screenId: v.screenId,
            alarmTag: v.alarmTag,
            baseRoomNum: v.baseRoomNum,
            unitCount: v.unitCount,
            propertyId: v.propertyId,
            roomRange: villaRoomRangeLabel(v),
          })),
          totalVillaUnits: FACILITY.totalVillaUnits,
          totalResidentialUnits: FACILITY.totalResidentialUnits,
          campusLayout: FACILITY.campusLayout,
        },
        nextCentury: {
          driverId: NC_DRIVER_ID,
          propertyIds: FACILITY.propertyIds,
          devices: DEVICES,
          semanticMap,
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
          composerMode: '3d',
          facility3dUrl: '/samples/assisted-living-ortho-3d.html',
          facilitySiteDxfUrl: '/samples/assisted-living-site-ortho.dxf',
          areaPopupScreens: fixturePopupScreenIds(pools),
          roomPopup: {
            enabled: true,
            roomSvg: '/hmi/svg/demos/assisted-living/room_interior.svg',
            condenserSvg: '/hmi/svg/demos/assisted-living/condenser_side.svg',
          },
        },
        screens,
        bindings,
      },
    },
  };

  fs.writeFileSync(OUT_EST, `${JSON.stringify(est, null, 2)}\n`, 'utf8');
  console.log(`Generated ${OUT_EST}`);
  console.log(`  Tags: ${tags.length} / ${MAX_TAGS}`);
  console.log(`  Screens: ${screens.length} / ${MAX_SCREENS}`);
  console.log(`  Bindings: ${bindings.length}`);
  console.log(`  ST: ${OUT_ST}`);
  console.log(`  Main tower rooms: ${allMainTowerRooms(ROOMS_ON_FLOOR).length} (${ROOMS_ON_FLOOR.join('+')} per floor)`);
  console.log(`  Villa units: ${FACILITY.totalVillaUnits} (${VILLA_BUILDINGS.length} outbuildings × ${FACILITY.villaUnitsPerBuilding})`);
  console.log(`  Total residential: ${FACILITY.totalResidentialUnits}`);
  console.log(`  Next Century semantic map: ${semanticMap.length} bindings (driver ${NC_DRIVER_ID})`);
  console.log(`  Property IDs: ${FACILITY.propertyIds.join(', ')}`);
}

main();
