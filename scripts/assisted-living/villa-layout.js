'use strict';

/** Villa outbuilding floor-plan geometry (5×5 unit grid). */

const VILLA_GRID = { cols: 5, rows: 5, gap: 8, margin: 72, unitW: 152, unitH: 108 };

function planVillaUnitRect(unitIndex) {
  const col = (unitIndex - 1) % VILLA_GRID.cols;
  const row = Math.floor((unitIndex - 1) / VILLA_GRID.cols);
  const x = VILLA_GRID.margin + col * (VILLA_GRID.unitW + VILLA_GRID.gap);
  const y = VILLA_GRID.margin + row * (VILLA_GRID.unitH + VILLA_GRID.gap);
  return { x, y, w: VILLA_GRID.unitW, h: VILLA_GRID.unitH };
}

function villaSvgViewBox() {
  const w = VILLA_GRID.margin * 2
    + VILLA_GRID.cols * VILLA_GRID.unitW
    + (VILLA_GRID.cols - 1) * VILLA_GRID.gap;
  const h = VILLA_GRID.margin * 2
    + VILLA_GRID.rows * VILLA_GRID.unitH
    + (VILLA_GRID.rows - 1) * VILLA_GRID.gap
    + 48;
  return { w, h };
}

module.exports = {
  VILLA_GRID,
  planVillaUnitRect,
  villaSvgViewBox,
};
