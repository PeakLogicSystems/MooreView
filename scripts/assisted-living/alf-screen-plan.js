'use strict';

const { VILLA_SCREEN_BASE, VILLA_BUILDING_COUNT } = require('./facility-config');

/** Fixed low-number screens (match legacy assisted-living layout). */
const CORE = {
  overview: { id: 'screen_1', number: 1, name: 'Facility Overview' },
  pool: { id: 'screen_5', number: 5 },
  mechanical: { id: 'screen_6', number: 6, name: 'Mechanical' },
  kitchen: { id: 'screen_7', number: 7, name: 'Kitchen' },
  conference: { id: 'screen_22', number: 22, name: 'Conference Room' },
  poolScheduleBase: 50,
};

const RESTROOM_SCREENS = [8, 9, 10, 11, 12, 13, 14, 15];
const NURSE_SCREENS = [16, 17, 18, 19, 20, 21];

const FLOOR_HUB_BASE = 26;
const WING_SCREEN_BASE = 100;

function floorHubScreenId(floorNum) {
  return `screen_${FLOOR_HUB_BASE + floorNum - 1}`;
}

function floorHubScreenNumber(floorNum) {
  return FLOOR_HUB_BASE + floorNum - 1;
}

function wingScreenId(floorNum, wingIndex) {
  const wingsPerFloor = 16;
  const offset = (floorNum - 1) * wingsPerFloor + (wingIndex - 1);
  return `screen_${WING_SCREEN_BASE + offset}`;
}

function wingScreenNumber(floorNum, wingIndex) {
  const wingsPerFloor = 16;
  return WING_SCREEN_BASE + (floorNum - 1) * wingsPerFloor + (wingIndex - 1);
}

function reservedScreenIds(floorCount, wingsPerFloor) {
  const ids = new Set([
    CORE.overview.id,
    CORE.pool.id,
    CORE.mechanical.id,
    CORE.kitchen.id,
    CORE.conference.id,
    ...RESTROOM_SCREENS.map((n) => `screen_${n}`),
    ...NURSE_SCREENS.map((n) => `screen_${n}`),
    ...Array.from({ length: VILLA_BUILDING_COUNT }, (_, i) => `screen_${VILLA_SCREEN_BASE + i}`),
    `screen_${CORE.poolScheduleBase}`,
  ]);
  for (let f = 1; f <= floorCount; f += 1) {
    ids.add(floorHubScreenId(f));
    for (let w = 1; w <= wingsPerFloor; w += 1) ids.add(wingScreenId(f, w));
  }
  return ids;
}

module.exports = {
  CORE,
  RESTROOM_SCREENS,
  NURSE_SCREENS,
  FLOOR_HUB_BASE,
  WING_SCREEN_BASE,
  floorHubScreenId,
  floorHubScreenNumber,
  wingScreenId,
  wingScreenNumber,
  reservedScreenIds,
};
