'use strict';

/**
 * Assisted-living campus site layout — shared by 3D ortho viewer and DXF export.
 * Derived from facility-config (main tower + 3 villa outbuildings).
 */

const {
  buildFacilityConfig,
  parseTotalRooms,
  villaRoomNums,
  villaRoomRangeLabel,
  F1_OFFICE_NUM,
} = require('./facility-config');

const ROOM_W = 4.0;
const ROOM_D = 5.5;
const VILLA_UNIT_W = 4.0;
const VILLA_UNIT_D = 5.5;
const VILLA_COLS = 5;
const VILLA_ROWS = 5;
const VILLA_GAP = 0.8;

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

function buildingHalfExtents(maxRoomsOnFloor) {
  const s = perimeterSideCounts(maxRoomsOnFloor);
  const maxSide = Math.max(s.north, s.east, s.south, s.west);
  const hw = Math.max(27, Math.ceil(maxSide * ROOM_W * 0.52));
  const hd = Math.max(23, Math.ceil(maxSide * ROOM_D * 0.46));
  return { hw, hd, sides: s };
}

function villaFootprint() {
  const w = VILLA_COLS * VILLA_UNIT_W + (VILLA_COLS - 1) * VILLA_GAP + 2;
  const d = VILLA_ROWS * VILLA_UNIT_D + (VILLA_ROWS - 1) * VILLA_GAP + 2;
  return { w, d };
}

function buildSiteLayout(totalRooms = parseTotalRooms()) {
  const facility = buildFacilityConfig(totalRooms);
  const maxPerFloor = Math.max(...facility.roomsOnFloor);
  const { hw, hd } = buildingHalfExtents(maxPerFloor);
  const villa = villaFootprint();
  const gap = 10;
  const slabW = hw * 2 + 8;
  const slabD = hd * 2 + 8;
  const siteW = slabW + villa.w * 2 + gap * 3;
  const siteD = slabD + villa.d + gap * 2;

  const villas = facility.villas.map((v) => {
    let cx = 0;
    let cz = 0;
    if (v.id === 'villa1') {
      cx = -(hw + villa.w / 2 + gap);
      cz = -(hd * 0.35);
    } else if (v.id === 'villa2') {
      cx = hw + villa.w / 2 + gap;
      cz = 0;
    } else if (v.id === 'villa3') {
      cx = -(hw + villa.w / 2 + gap);
      cz = hd * 0.55;
    }
    return {
      id: v.id,
      name: v.name,
      slug: v.slug,
      alarmTag: v.alarmTag,
      detailScreen: v.screenId,
      baseRoomNum: v.baseRoomNum,
      unitCount: v.unitCount,
      roomRange: villaRoomRangeLabel(v),
      roomNums: villaRoomNums(v),
      center: { x: cx, z: cz },
      footprint: { w: villa.w, d: villa.d },
    };
  });

  return {
    roomsOnFloor: facility.roomsOnFloor,
    totalRooms: facility.totalRooms,
    totalVillaUnits: facility.totalVillaUnits,
    totalResidentialUnits: facility.totalResidentialUnits,
    includesInteriorOffice: facility.includesInteriorOffice,
    f1OfficeNum: F1_OFFICE_NUM,
    building: { hw, hd, slabW, slabD, oz: -2 },
    pool: { x: -(hw + villa.w * 0.55 + gap), z: -2, w: 16, d: 14 },
    sitePad: { w: siteW, d: siteD, oz: -2 },
    gridSize: Math.max(120, Math.ceil(siteW + 20)),
    villas,
    roomW: ROOM_W,
    roomD: ROOM_D,
    villaUnitW: VILLA_UNIT_W,
    villaUnitD: VILLA_UNIT_D,
    villaCols: VILLA_COLS,
    villaRows: VILLA_ROWS,
    villaGap: VILLA_GAP,
  };
}

module.exports = {
  buildSiteLayout,
  perimeterSideCounts,
  buildingHalfExtents,
  villaFootprint,
};
