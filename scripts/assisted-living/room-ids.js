'use strict';

/** Room tag id formatting — supports campus scale (4–5 digit room numbers). */

function roomTagPadWidth(maxRoomNum = 0) {
  const n = Math.trunc(Number(maxRoomNum) || 0);
  if (n >= 10000) return 5;
  if (n >= 1000) return 4;
  return 3;
}

function formatRoomNum(roomNum) {
  return String(Math.trunc(Number(roomNum)));
}

function roomTagId(roomNum, padWidth = roomTagPadWidth(roomNum)) {
  return `RM${formatRoomNum(roomNum).padStart(padWidth, '0')}`;
}

function maxRoomNumber(roomNums = []) {
  let max = 0;
  for (const n of roomNums) {
    const v = Math.trunc(Number(n));
    if (Number.isFinite(v) && v > max) max = v;
  }
  return max;
}

module.exports = {
  roomTagPadWidth,
  formatRoomNum,
  roomTagId,
  maxRoomNumber,
};
