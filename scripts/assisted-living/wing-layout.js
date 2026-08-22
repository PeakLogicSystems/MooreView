'use strict';

/** 5×5 wing / villa unit grid for floor-plan SVG and hotspots. */
const WING_GRID = { cols: 5, rows: 5, gap: 8, margin: 72, unitW: 152, unitH: 108 };

function planWingUnitRect(unitIndex) {
  const col = (unitIndex - 1) % WING_GRID.cols;
  const row = Math.floor((unitIndex - 1) / WING_GRID.cols);
  const x = WING_GRID.margin + col * (WING_GRID.unitW + WING_GRID.gap);
  const y = WING_GRID.margin + row * (WING_GRID.unitH + WING_GRID.gap);
  return { x, y, w: WING_GRID.unitW, h: WING_GRID.unitH };
}

function wingSvgViewBox() {
  const w = WING_GRID.margin * 2
    + WING_GRID.cols * WING_GRID.unitW
    + (WING_GRID.cols - 1) * WING_GRID.gap;
  const h = WING_GRID.margin * 2
    + WING_GRID.rows * WING_GRID.unitH
    + (WING_GRID.rows - 1) * WING_GRID.gap
    + 24;
  return { w, h };
}

module.exports = {
  WING_GRID,
  planWingUnitRect,
  wingSvgViewBox,
};
