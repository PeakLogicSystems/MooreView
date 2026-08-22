'use strict';

/**
 * Assisted living facility scale — room count, floors, wings, villas.
 * Override: node generate-est.js --rooms 2000
 *           ALF_TOTAL_ROOMS=2000 node generate-est.js
 */

const { roomTagId, maxRoomNumber, roomTagPadWidth } = require('./room-ids');
const { COMMISSIONING_PROPERTY_IDS } = require('../../src/settings/nextcenturyPropertyIds');

const DEFAULT_TOTAL_ROOMS = 200;
const MAX_SUPPORTED_ROOMS = 2000;
/** Legacy layout: one HMI screen per floor with perimeter art (≤ this many rooms / floor). */
const LEGACY_MAX_ROOMS_PER_FLOOR = 100;
/** Campus layout: rooms per wing detail screen (5×5 grid). */
const ROOMS_PER_WING = 25;
/** Max rooms on one floor (room numbering uses floor×100 + index). */
const MAX_ROOMS_PER_FLOOR = 99;
const TAGS_PER_ROOM = 10;
const NC_BINDINGS_PER_ROOM = 5;

const F1_OFFICE_NUM = 125;
const ALF_PROPERTY_ID = 40100;

const VILLA_UNITS_PER_BUILDING = 25;
const VILLA_BUILDING_COUNT = 3;
const VILLA_SCREEN_BASE = 23;

function villaDefinitions(totalRooms) {
  const base = totalRooms > 400 ? 10001 : 501;
  const names = ['Villa North', 'Villa East', 'Villa South'];
  const slugs = ['villa-north', 'villa-east', 'villa-south'];
  const rects = [
    { x: 40, y: 88, w: 148, h: 128 },
    { x: 868, y: 200, w: 148, h: 128 },
    { x: 40, y: 520, w: 148, h: 128 },
  ];
  return names.map((name, i) => ({
    id: `villa${i + 1}`,
    name,
    slug: slugs[i],
    screen: VILLA_SCREEN_BASE + i,
    screenId: `screen_${VILLA_SCREEN_BASE + i}`,
    alarmTag: `ALF_VILLA${i + 1}_ALM`,
    baseRoomNum: base + i * 100,
    unitCount: VILLA_UNITS_PER_BUILDING,
    propertyId: 40101 + i,
    overviewRect: rects[i],
  }));
}

function parseTotalRooms(argv = process.argv) {
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--rooms' && argv[i + 1]) {
      const n = Number(argv[++i]);
      if (Number.isFinite(n) && n > 0) return Math.min(MAX_SUPPORTED_ROOMS, Math.trunc(n));
    }
  }
  const env = Number(process.env.ALF_TOTAL_ROOMS);
  if (Number.isFinite(env) && env > 0) return Math.min(MAX_SUPPORTED_ROOMS, Math.trunc(env));
  return DEFAULT_TOTAL_ROOMS;
}

function computeFloorCount(totalRooms) {
  const n = Math.max(1, Math.trunc(totalRooms));
  return Math.max(1, Math.ceil(n / MAX_ROOMS_PER_FLOOR));
}

/** Even-ish split across floors (e.g. 2000 → 20 × 100). */
function distributeRooms(totalRooms, floors) {
  const n = Math.max(1, Math.trunc(totalRooms));
  const f = Math.max(1, Math.trunc(floors));
  const base = Math.floor(n / f);
  const rem = n % f;
  const counts = [];
  for (let i = 0; i < f; i += 1) {
    counts.push(base + (i < rem ? 1 : 0));
  }
  return counts;
}

function usesCampusLayout(totalRooms, roomsOnFloor) {
  const floors = roomsOnFloor?.length || computeFloorCount(totalRooms);
  if (floors > 3) return true;
  return (roomsOnFloor || []).some((c) => c > LEGACY_MAX_ROOMS_PER_FLOOR);
}

function wingsOnFloor(roomCount) {
  return Math.max(1, Math.ceil(roomCount / ROOMS_PER_WING));
}

function roomNumberFor(floorNum, indexOnFloor) {
  return floorNum * 100 + indexOnFloor;
}

function roomsOnFloorList(floorNum, roomsOnFloor) {
  const count = roomsOnFloor[floorNum - 1];
  const out = [];
  for (let i = 1; i <= count; i += 1) out.push(roomNumberFor(floorNum, i));
  return out;
}

function roomsInWing(floorNum, wingIndex, roomsOnFloor) {
  const all = roomsOnFloorList(floorNum, roomsOnFloor);
  const start = (wingIndex - 1) * ROOMS_PER_WING;
  return all.slice(start, start + ROOMS_PER_WING);
}

function allMainTowerRooms(roomsOnFloor) {
  const out = [];
  for (let f = 1; f <= roomsOnFloor.length; f += 1) {
    out.push(...roomsOnFloorList(f, roomsOnFloor));
  }
  return out;
}

function villaRoomNums(villa) {
  const out = [];
  for (let i = 0; i < villa.unitCount; i += 1) {
    out.push(villa.baseRoomNum + i);
  }
  return out;
}

function allVillaRooms(villas) {
  return villas.flatMap(villaRoomNums);
}

function villaRoomRangeLabel(villa) {
  const rooms = villaRoomNums(villa);
  if (!rooms.length) return villa.name;
  return `${rooms[0]}–${rooms[rooms.length - 1]}`;
}

function floorRoomRangeLabel(floorNum, roomsOnFloor) {
  const list = roomsOnFloorList(floorNum, roomsOnFloor);
  if (!list.length) return `Floor ${floorNum}`;
  return `${list[0]}–${list[list.length - 1]}`;
}

function wingRoomRangeLabel(floorNum, wingIndex, roomsOnFloor) {
  const list = roomsInWing(floorNum, wingIndex, roomsOnFloor);
  if (!list.length) return `Wing ${wingIndex}`;
  return `${list[0]}–${list[list.length - 1]}`;
}

function recommendMaxTags(totalResidentialUnits) {
  const roomTags = totalResidentialUnits * TAGS_PER_ROOM;
  const facilityHeadroom = 512;
  const total = roomTags + facilityHeadroom;
  return Math.ceil((total * 1.05) / 256) * 256;
}

function buildFacilityConfig(totalRooms = parseTotalRooms()) {
  const capped = Math.min(MAX_SUPPORTED_ROOMS, Math.max(1, Math.trunc(totalRooms)));
  const floors = computeFloorCount(capped);
  const roomsOnFloor = distributeRooms(capped, floors);
  const villas = villaDefinitions(capped);
  const villaUnits = villas.reduce((n, v) => n + v.unitCount, 0);
  const totalResidentialUnits = capped + villaUnits;
  const campusLayout = usesCampusLayout(capped, roomsOnFloor);
  const maxWingsPerFloor = Math.max(...roomsOnFloor.map(wingsOnFloor));
  const towerRooms = allMainTowerRooms(roomsOnFloor);
  const villaRooms = allVillaRooms(villas);
  const padWidth = Math.max(
    roomTagPadWidth(maxRoomNumber(towerRooms)),
    roomTagPadWidth(maxRoomNumber(villaRooms)),
  );
  return {
    floors,
    totalRooms: capped,
    roomsOnFloor,
    maxRoomsPerFloor: MAX_ROOMS_PER_FLOOR,
    roomsPerWing: ROOMS_PER_WING,
    campusLayout,
    maxWingsPerFloor,
    villas,
    villaBuildingCount: VILLA_BUILDING_COUNT,
    villaUnitsPerBuilding: VILLA_UNITS_PER_BUILDING,
    totalVillaUnits: villaUnits,
    totalResidentialUnits,
    includesInteriorOffice: !campusLayout && roomsOnFloor[0] <= 24,
    f1OfficeNum: F1_OFFICE_NUM,
    roomTagPadWidth: padWidth,
    recommendMaxTags: recommendMaxTags(totalResidentialUnits),
    /** NC API poll list — commissioning IDs, not villa HMI placeholders (40101+). */
    propertyIds: [...COMMISSIONING_PROPERTY_IDS],
  };
}

module.exports = {
  DEFAULT_TOTAL_ROOMS,
  MAX_SUPPORTED_ROOMS,
  LEGACY_MAX_ROOMS_PER_FLOOR,
  ROOMS_PER_WING,
  MAX_ROOMS_PER_FLOOR,
  TAGS_PER_ROOM,
  NC_BINDINGS_PER_ROOM,
  F1_OFFICE_NUM,
  ALF_PROPERTY_ID,
  VILLA_UNITS_PER_BUILDING,
  VILLA_BUILDING_COUNT,
  VILLA_SCREEN_BASE,
  parseTotalRooms,
  computeFloorCount,
  distributeRooms,
  usesCampusLayout,
  wingsOnFloor,
  roomNumberFor,
  roomsOnFloorList,
  roomsInWing,
  allMainTowerRooms,
  villaRoomNums,
  allVillaRooms,
  villaRoomRangeLabel,
  floorRoomRangeLabel,
  wingRoomRangeLabel,
  recommendMaxTags,
  buildFacilityConfig,
  roomTagId,
};
