'use strict';

const { portWorldPosition } = require('../../public/js/mvDrawPorts');

/** Evenly spaced circuit outlets along the bottom (and second row when count > 10). */
function buildPowerPanelPorts(count, width, height) {
  const ports = [];
  const margin = 0.75;
  const rows = count <= 10 ? 1 : 2;
  const perRow = Math.ceil(count / rows);
  const rowOffsets = rows === 1 ? [0] : [0, Math.min(height * 0.16, 1.2)];
  let idx = 0;
  for (let r = 0; r < rows && idx < count; r += 1) {
    const n = Math.min(perRow, count - idx);
    const step = (width - margin * 2) / (n + 1);
    for (let i = 0; i < n; i += 1) {
      idx += 1;
      ports.push({
        id: `c${idx}`,
        x: margin + step * (i + 1),
        y: rowOffsets[r],
        dir: 's',
      });
    }
  }
  return ports;
}

function powerPanelSymbol(circuits, width, height) {
  return {
    type: `power_panel_${circuits}`,
    label: `Power panel — ${circuits} circuits`,
    group: 'Power panels',
    shape: 'power_panel',
    circuits,
    width,
    height,
    ports: buildPowerPanelPorts(circuits, width, height),
    fill: '#fde68a',
    stroke: '#92400e',
  };
}

/** Septic / site-plan symbol definitions. Dimensions in real-world units (ft). */
const SYMBOLS = [
  {
    type: 'septic_tank_1000',
    label: 'Septic tank 1000 gal',
    group: 'Tanks',
    width: 8,
    height: 5,
    ports: [
      { id: 'inlet', x: 0, y: 2.5, dir: 'w' },
      { id: 'outlet', x: 8, y: 2.5, dir: 'e' },
    ],
    fill: '#94a3b8',
    stroke: '#334155',
  },
  {
    type: 'pump_chamber',
    label: 'Pump chamber',
    group: 'Tanks',
    width: 6,
    height: 4,
    ports: [
      { id: 'inlet', x: 0, y: 2, dir: 'w' },
      { id: 'outlet', x: 6, y: 2, dir: 'e' },
      { id: 'electrical', x: 3, y: 0, dir: 'n' },
    ],
    fill: '#64748b',
    stroke: '#1e293b',
  },
  {
    type: 'treatment_tank_1250',
    label: 'Treatment tank 1,250 gal',
    group: 'Tanks',
    shape: 'treatment_tank',
    capacityGal: 1250,
    width: 6,
    height: 6,
    ports: [
      { id: 'inlet', x: 0, y: 3, dir: 'w' },
      { id: 'outlet', x: 6, y: 3, dir: 'e' },
      { id: 'vent', x: 3, y: 6, dir: 'n' },
    ],
    fill: '#22c55e',
    stroke: '#166534',
  },
  {
    type: 'trash_tank_1250_2comp',
    label: 'Trash tank 1,250 gal (2-compartment)',
    group: 'Tanks',
    shape: 'trash_tank_2comp',
    capacityGal: 1250,
    compartments: 2,
    width: 12,
    height: 6,
    ports: [
      { id: 'inlet', x: 0, y: 3, dir: 'w' },
      { id: 'outlet', x: 12, y: 3, dir: 'e' },
      { id: 'vent', x: 6, y: 6, dir: 'n' },
    ],
    fill: '#78716c',
    stroke: '#44403c',
  },
  {
    type: 'dosing_tank_1500',
    label: 'Dosing tank 1,500 gal (2 pumps)',
    group: 'Tanks',
    shape: 'dosing_tank_duplex',
    capacityGal: 1500,
    pumps: 2,
    width: 8,
    height: 7,
    ports: [
      { id: 'inlet', x: 0, y: 3.5, dir: 'w' },
      { id: 'dose', x: 8, y: 3.5, dir: 'e' },
      { id: 'return', x: 4, y: 0, dir: 's' },
      { id: 'electrical', x: 6.4, y: 7, dir: 'n' },
    ],
    fill: '#38bdf8',
    stroke: '#0369a1',
  },
  {
    type: 'integrated_mle_tank_125k',
    label: 'Integrated MLE tank 125K gal',
    group: 'Tanks',
    shape: 'integrated_mle_tank',
    capacityGal: 125000,
    width: 30,
    height: 30,
    ports: [
      { id: 'influent', x: 0, y: 15, dir: 'w' },
      { id: 'effluent', x: 30, y: 15, dir: 'e' },
      { id: 'recycle', x: 15, y: 0, dir: 'n' },
      { id: 'was', x: 15, y: 30, dir: 's' },
    ],
    fill: '#64748b',
    stroke: '#334155',
  },
  {
    type: 'lift_simplex',
    label: 'Simplex lift station',
    group: 'Lift & ATU panels',
    shape: 'simplex_lift',
    pumps: 1,
    width: 7,
    height: 7,
    ports: [
      { id: 'inlet', x: 0, y: 3.5, dir: 'w' },
      { id: 'outlet', x: 7, y: 3.5, dir: 'e' },
      { id: 'electrical', x: 5.8, y: 7, dir: 'n' },
    ],
    fill: '#64748b',
    stroke: '#1e293b',
  },
  {
    type: 'lift_duplex',
    label: 'Duplex lift station',
    group: 'Lift & ATU panels',
    shape: 'duplex_lift',
    pumps: 2,
    width: 9,
    height: 9,
    ports: [
      { id: 'inlet', x: 0, y: 4.5, dir: 'w' },
      { id: 'outlet', x: 9, y: 4.5, dir: 'e' },
      { id: 'electrical', x: 7.2, y: 9, dir: 'n' },
    ],
    fill: '#64748b',
    stroke: '#334155',
  },
  {
    type: 'atu_single',
    label: 'Single ATU control panel (duplex + TPO)',
    group: 'Lift & ATU panels',
    shape: 'atu_control_panel',
    trains: 1,
    tpoCount: 1,
    width: 8,
    height: 8,
    ports: [
      { id: 'inlet', x: 0, y: 4, dir: 'w' },
      { id: 'outlet', x: 8, y: 4, dir: 'e' },
      { id: 'electrical', x: 6.6, y: 8, dir: 'n' },
    ],
    fill: '#dcfce7',
    stroke: '#15803d',
  },
  {
    type: 'atu_dual',
    label: 'Dual ATU control panel (2 duplex + TPO)',
    group: 'Lift & ATU panels',
    shape: 'atu_control_panel',
    trains: 2,
    tpoCount: 2,
    width: 11,
    height: 8,
    ports: [
      { id: 'inlet', x: 0, y: 4, dir: 'w' },
      { id: 'outlet', x: 11, y: 4, dir: 'e' },
      { id: 'electrical', x: 9.2, y: 8, dir: 'n' },
    ],
    fill: '#dcfce7',
    stroke: '#15803d',
  },
  {
    type: 'atu_quad_dual_duplex',
    label: 'Quad ATU control panel (4 duplex + TPO)',
    group: 'Lift & ATU panels',
    shape: 'atu_control_panel',
    trains: 4,
    tpoCount: 4,
    width: 16,
    height: 9,
    ports: [
      { id: 'inlet', x: 0, y: 4.5, dir: 'w' },
      { id: 'outlet', x: 16, y: 4.5, dir: 'e' },
      { id: 'electrical', x: 13.4, y: 9, dir: 'n' },
    ],
    fill: '#dcfce7',
    stroke: '#15803d',
  },
  powerPanelSymbol(5, 7, 5),
  powerPanelSymbol(10, 12, 5),
  powerPanelSymbol(20, 18, 7),
  powerPanelSymbol(40, 32, 8),
  {
    type: 'd_box',
    label: 'Distribution box',
    group: 'Distribution',
    width: 3,
    height: 3,
    ports: [
      { id: 'inlet', x: 0, y: 1.5, dir: 'w' },
      { id: 'leg1', x: 3, y: 0.5, dir: 'e' },
      { id: 'leg2', x: 3, y: 1.5, dir: 'e' },
      { id: 'leg3', x: 3, y: 2.5, dir: 'e' },
    ],
    fill: '#cbd5e1',
    stroke: '#475569',
  },
  {
    type: 'leach_trench',
    label: 'Leach trench',
    group: 'Drainfield',
    width: 40,
    height: 3,
    ports: [
      { id: 'head', x: 0, y: 1.5, dir: 'w' },
      { id: 'tail', x: 40, y: 1.5, dir: 'e' },
    ],
    fill: '#86efac',
    stroke: '#166534',
  },
  {
    type: 'drip_drainfield',
    label: 'Drip drainfield',
    group: 'Drainfield',
    shape: 'drip_field',
    width: 30,
    height: 12,
    ports: [
      { id: 'supply', x: 0, y: 6, dir: 'w' },
    ],
    fill: '#4ade80',
    stroke: '#166534',
  },
  {
    type: 'drip_irrigation_4leg',
    label: 'Drip irrigation — 4 legs + return',
    group: 'Drainfield',
    shape: 'drip_irrigation_4leg',
    legCount: 4,
    width: 28,
    height: 22,
    ports: [
      { id: 'supply', x: 0, y: 18, dir: 'w' },
      { id: 'return', x: 28, y: 18, dir: 'e' },
      { id: 'leg1', x: 4, y: 0, dir: 's' },
      { id: 'leg2', x: 10, y: 0, dir: 's' },
      { id: 'leg3', x: 18, y: 0, dir: 's' },
      { id: 'leg4', x: 24, y: 0, dir: 's' },
    ],
    fill: '#4ade80',
    stroke: '#166534',
  },
  {
    type: 'drip_leg',
    label: 'Drip leg / lateral',
    group: 'Drainfield',
    shape: 'drip_leg',
    width: 35,
    height: 2.5,
    ports: [
      { id: 'head', x: 0, y: 1.25, dir: 'w' },
      { id: 'tail', x: 35, y: 1.25, dir: 'e' },
    ],
    fill: '#86efac',
    stroke: '#15803d',
  },
  {
    type: 'cleanout',
    label: 'Cleanout',
    group: 'Piping',
    width: 2,
    height: 2,
    ports: [
      { id: 'pipe', x: 1, y: 2, dir: 's' },
    ],
    fill: '#fbbf24',
    stroke: '#92400e',
  },
  {
    type: 'building',
    label: 'Building / structure',
    group: 'Site',
    width: 20,
    height: 16,
    ports: [
      { id: 'sewer', x: 10, y: 16, dir: 's' },
    ],
    fill: '#e2e8f0',
    stroke: '#64748b',
  },
];

const BY_TYPE = new Map(SYMBOLS.map((s) => [s.type, s]));

function listSymbols() {
  return SYMBOLS.map(({
    type, label, group, width, height, ports, fill, stroke, shape, capacityGal, pumps, trains, moduleGal, tpoCount, legCount, compartments, circuits,
  }) => ({
    type, label, group, width, height, ports, fill, stroke, shape,
    capacityGal, pumps, trains, moduleGal, tpoCount, legCount, compartments, circuits,
  }));
}

function getSymbol(type) {
  return BY_TYPE.get(type) || null;
}

/** World-space port position for a placed node. */
function portWorld(node, portId) {
  const sym = getSymbol(node.type);
  if (!sym) return null;
  const port = sym.ports.find((p) => p.id === portId);
  if (!port) return null;
  return portWorldPosition(node, sym, port);
}

/** Resolve "nodeId:portId" handle string. */
function resolveHandle(handle, nodes) {
  const s = String(handle || '');
  const i = s.indexOf(':');
  if (i < 0) return null;
  const nodeId = s.slice(0, i);
  const portId = s.slice(i + 1);
  const node = nodes.find((n) => n.id === nodeId);
  if (!node || !portId) return null;
  const pt = portWorld(node, portId);
  if (!pt) return null;
  return { node, portId, ...pt };
}

module.exports = {
  listSymbols,
  getSymbol,
  portWorld,
  resolveHandle,
  buildPowerPanelPorts,
};
