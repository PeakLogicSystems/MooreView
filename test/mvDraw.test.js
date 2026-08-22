'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { blankMvDrawDoc, normalizeMvDraw, validateMvDraw, MV_DRAW_FORMAT } = require('../mv-draw/src/mvDrawFormat');
const { pixelsPerUnitFromTwoPoint, formatDistance } = require('../mv-draw/src/scale');
const { listSymbols, portWorld, resolveHandle, getSymbol } = require('../mv-draw/src/symbolLibrary');
const { buildMvDrawDxf } = require('../mv-draw/src/exportDxf');

describe('mvDrawFormat', () => {
  it('blank doc validates', () => {
    const doc = blankMvDrawDoc({ name: 'test-site' });
    assert.equal(validateMvDraw(doc), null);
    assert.equal(doc.format, MV_DRAW_FORMAT);
  });

  it('normalizes nodes and edges', () => {
    const doc = normalizeMvDraw({
      nodes: [{ type: 'd_box', x: 10, y: 20 }],
      edges: [{ from: 'n1:inlet', to: 'n2:outlet' }],
    });
    assert.equal(doc.nodes.length, 1);
    assert.equal(doc.edges.length, 1);
    assert.equal(doc.nodes[0].type, 'd_box');
  });
});

describe('mvDraw scale', () => {
  it('computes pixels per unit from two points', () => {
    const ppu = pixelsPerUnitFromTwoPoint([0, 0], [100, 0], 50);
    assert.equal(ppu, 2);
  });

  it('formats distance', () => {
    assert.match(formatDistance('ft', 12.4), /12\.4 ft/);
  });
});

describe('mvDraw symbols', () => {
  it('lists septic and ATU/lift symbols', () => {
    const syms = listSymbols();
    assert.ok(syms.some((s) => s.type === 'septic_tank_1000'));
    assert.ok(syms.some((s) => s.type === 'treatment_tank_1250'));
    assert.ok(syms.some((s) => s.type === 'trash_tank_1250_2comp'));
    assert.ok(syms.some((s) => s.type === 'dosing_tank_1500'));
    assert.ok(syms.some((s) => s.type === 'integrated_mle_tank_125k'));
    assert.ok(syms.some((s) => s.type === 'lift_simplex'));
    assert.ok(syms.some((s) => s.type === 'lift_duplex'));
    assert.ok(syms.some((s) => s.type === 'atu_single'));
    assert.ok(syms.some((s) => s.type === 'atu_dual'));
    assert.ok(syms.some((s) => s.type === 'atu_quad_dual_duplex'));
    assert.ok(syms.some((s) => s.type === 'drip_irrigation_4leg'));
    assert.ok(syms.some((s) => s.type === 'drip_leg'));
    const single = syms.find((s) => s.type === 'atu_single');
    assert.equal(single.trains, 1);
    assert.equal(single.tpoCount, 1);
    assert.equal(single.shape, 'atu_control_panel');
    const dual = syms.find((s) => s.type === 'atu_dual');
    assert.equal(dual.trains, 2);
    assert.equal(dual.tpoCount, 2);
    const quad = syms.find((s) => s.type === 'atu_quad_dual_duplex');
    assert.equal(quad.trains, 4);
    assert.equal(quad.tpoCount, 4);
    assert.equal(quad.shape, 'atu_control_panel');
  });

  it('trash tank 2-compartment symbol has inlet, outlet, and vent ports', () => {
    const syms = listSymbols();
    const trash = syms.find((s) => s.type === 'trash_tank_1250_2comp');
    assert.ok(trash);
    assert.equal(trash.capacityGal, 1250);
    assert.equal(trash.compartments, 2);
    const node = { id: 't1', type: 'trash_tank_1250_2comp', x: 0, y: 0, rotation: 0 };
    const inlet = portWorld(node, 'inlet');
    const outlet = portWorld(node, 'outlet');
    const vent = portWorld(node, 'vent');
    assert.ok(inlet);
    assert.ok(outlet);
    assert.ok(vent);
    assert.ok(inlet.x < outlet.x);
    assert.ok(vent.y > inlet.y);
  });

  it('dosing tank symbol has inlet, dose, return, and electrical ports', () => {
    const syms = listSymbols();
    const dose = syms.find((s) => s.type === 'dosing_tank_1500');
    assert.ok(dose);
    assert.equal(dose.capacityGal, 1500);
    assert.equal(dose.pumps, 2);
    const node = { id: 'd1', type: 'dosing_tank_1500', x: 0, y: 0, rotation: 0 };
    const inlet = portWorld(node, 'inlet');
    const doseOut = portWorld(node, 'dose');
    const ret = portWorld(node, 'return');
    const elec = portWorld(node, 'electrical');
    assert.ok(inlet);
    assert.ok(doseOut);
    assert.ok(ret);
    assert.ok(elec);
    assert.ok(inlet.x < doseOut.x);
    assert.ok(ret.y < inlet.y);
    assert.ok(elec.y > inlet.y);
  });

  it('quad ATU symbol has inlet/outlet ports', () => {
    const node = { id: 'p1', type: 'atu_quad_dual_duplex', x: 0, y: 0, rotation: 0 };
    const inlet = portWorld(node, 'inlet');
    const outlet = portWorld(node, 'outlet');
    const elec = portWorld(node, 'electrical');
    assert.ok(inlet);
    assert.ok(outlet);
    assert.ok(elec);
    assert.ok(inlet.x < outlet.x);
  });

  it('single and dual ATU panels have electrical port', () => {
    for (const type of ['atu_single', 'atu_dual']) {
      const node = { id: 'a1', type, x: 0, y: 0, rotation: 0 };
      assert.ok(portWorld(node, 'inlet'));
      assert.ok(portWorld(node, 'outlet'));
      assert.ok(portWorld(node, 'electrical'));
    }
  });

  it('drip irrigation 4-leg symbol has supply, return, and leg ports', () => {
    const syms = listSymbols();
    const drip = syms.find((s) => s.type === 'drip_irrigation_4leg');
    assert.ok(drip);
    assert.equal(drip.legCount, 4);
    assert.equal(drip.ports.length, 6);
    const node = { id: 'd1', type: 'drip_irrigation_4leg', x: 0, y: 0, rotation: 0 };
    const supply = portWorld(node, 'supply');
    const ret = portWorld(node, 'return');
    const leg1 = portWorld(node, 'leg1');
    const leg4 = portWorld(node, 'leg4');
    assert.ok(supply);
    assert.ok(ret);
    assert.ok(leg1);
    assert.ok(leg4);
    assert.ok(supply.x < ret.x);
    assert.ok(leg1.y < supply.y);
    assert.ok(leg4.x > leg1.x);
  });

  it('resolves port world position', () => {
    const node = { id: 't1', type: 'septic_tank_1000', x: 0, y: 0, rotation: 0 };
    const inlet = portWorld(node, 'inlet');
    assert.ok(inlet);
    const h = resolveHandle('t1:inlet', [node]);
    assert.equal(h.x, inlet.x);
  });

  it('circle tank ports attach on drawn outline not bounding box', () => {
    const node = { id: 't1', type: 'treatment_tank_1250', x: 0, y: 0, rotation: 0 };
    const sym = getSymbol('treatment_tank_1250');
    const r = Math.min(sym.width, sym.height) * 0.44;
    const inlet = portWorld(node, 'inlet');
    const outlet = portWorld(node, 'outlet');
    assert.ok(Math.abs(inlet.x + r) < 0.02);
    assert.ok(Math.abs(inlet.y) < 0.02);
    assert.ok(Math.abs(outlet.x - r) < 0.02);
    assert.ok(Math.abs(outlet.y) < 0.02);
  });

  it('integrated MLE tank ports follow circular outline with rotation', () => {
    const node = { id: 'm1', type: 'integrated_mle_tank_125k', x: 5, y: 5, rotation: 90 };
    const sym = getSymbol('integrated_mle_tank_125k');
    const r = Math.min(sym.width, sym.height) * 0.46;
    const influent = portWorld(node, 'influent');
    assert.ok(Math.abs(influent.x - 5) < 0.05);
    assert.ok(Math.abs(influent.y - (5 - r)) < 0.05);
    const effluent = portWorld(node, 'effluent');
    assert.ok(Math.abs(effluent.x - 5) < 0.05);
    assert.ok(Math.abs(effluent.y - (5 + r)) < 0.05);
  });

  it('lift station ports attach at wet-well edge not outer box corner', () => {
    const node = { id: 'ls1', type: 'lift_simplex', x: 0, y: 0, rotation: 0 };
    const sym = getSymbol('lift_simplex');
    const mn = Math.min(sym.width, sym.height);
    const wrx = mn * 0.18;
    const wcx = sym.width * -0.28;
    const inlet = portWorld(node, 'inlet');
    const outlet = portWorld(node, 'outlet');
    assert.ok(Math.abs(inlet.x - (wcx - wrx)) < 0.02);
    assert.ok(Math.abs(outlet.x - sym.width / 2) < 0.02);
  });

  it('lists electrical single-line symbols with line/load ports', () => {
    const syms = listSymbols();
    const sld = syms.filter((s) => s.group === 'Electrical single line');
    assert.ok(sld.length >= 10);
    assert.ok(sld.some((s) => s.type === 'sld_breaker'));
    assert.ok(sld.some((s) => s.type === 'sld_fuse'));
    assert.ok(sld.some((s) => s.type === 'sld_no_contact'));
    assert.ok(sld.some((s) => s.type === 'sld_nc_contact'));
    assert.ok(sld.some((s) => s.type === 'sld_coil'));
    assert.ok(sld.some((s) => s.type === 'sld_dc_supply'));
    assert.ok(sld.some((s) => s.type === 'sld_opta'));
    assert.ok(sld.some((s) => s.type === 'sld_expansion_d1608e'));
    assert.ok(sld.some((s) => s.type === 'sld_expansion_a0602'));
    assert.ok(sld.some((s) => s.type === 'sld_motor'));
    assert.ok(sld.some((s) => s.type === 'sld_light'));
    assert.ok(sld.some((s) => s.type === 'sld_horn'));
    assert.ok(sld.some((s) => s.type === 'sld_transformer'));
    assert.ok(sld.some((s) => s.type === 'sld_ats'));
    const breaker = getSymbol('sld_breaker');
    assert.equal(breaker.shape, 'sld_breaker');
    assert.ok(breaker.ports.some((p) => p.id === 'line'));
    assert.ok(breaker.ports.some((p) => p.id === 'load'));
  });

  it('SLD breaker line port is above load port', () => {
    const node = { id: 'b1', type: 'sld_breaker', x: 0, y: 0, rotation: 0 };
    const line = portWorld(node, 'line');
    const load = portWorld(node, 'load');
    assert.ok(line);
    assert.ok(load);
    assert.ok(line.y > load.y);
    assert.ok(Math.abs(line.x - load.x) < 0.02);
  });

  it('SLD ATS has normal, emergency, and load ports', () => {
    const node = { id: 'a1', type: 'sld_ats', x: 0, y: 0, rotation: 0 };
    const normal = portWorld(node, 'normal');
    const emergency = portWorld(node, 'emergency');
    const load = portWorld(node, 'load');
    assert.ok(normal);
    assert.ok(emergency);
    assert.ok(load);
    assert.ok(normal.x < emergency.x);
    assert.ok(load.y < normal.y);
  });

  it('SLD Opta exposes every panel terminal as a wire port', () => {
    const opta = getSymbol('sld_opta');
    assert.ok(opta);
    assert.equal(opta.shape, 'sld_opta');
    assert.equal(opta.width, 50);
    assert.equal(opta.height, 45);
    assert.equal(opta.ports.length, 19);
    const node = { id: 'o1', type: 'sld_opta', x: 0, y: 0, rotation: 0 };
    assert.ok(portWorld(node, 'ai1'));
    assert.ok(portWorld(node, 'rs485_b'));
    assert.ok(portWorld(node, 'r1'));
    assert.ok(portWorld(node, 'r4'));
    assert.ok(portWorld(node, 'exp'));
    assert.ok(portWorld(node, 'dc_plus_1'));
    assert.ok(portWorld(node, 'dc_plus_2'));
    assert.ok(portWorld(node, 'com_1'));
    assert.ok(portWorld(node, 'com_2'));
    assert.equal(portWorld(node, 'exp').x, opta.width / 2);
    assert.equal(portWorld(node, 'exp').y, 0);
    assert.ok(portWorld(node, 'dc_plus_1').y > portWorld(node, 'r1').y);
    assert.ok(portWorld(node, 'com_2').y > portWorld(node, 'r1').y);
    assert.equal(portWorld(node, 'ai1').y, portWorld(node, 'rs485_b').y);
    assert.ok(portWorld(node, 'r1').y < portWorld(node, 'ai1').y);
    const d1608 = getSymbol('sld_expansion_d1608e');
    assert.equal(d1608.expansion, 'D1608E');
    assert.equal(d1608.width, 50);
    assert.equal(d1608.height, 45);
    assert.equal(d1608.slot, 1);
    assert.ok(d1608.ports.some((p) => p.id === 'bus_w'));
    assert.ok(d1608.ports.some((p) => p.id === 'bus_e'));
    assert.ok(d1608.ports.some((p) => p.id === 'dc_plus_1'));
    assert.ok(d1608.ports.some((p) => p.id === 'com_2'));
    const dNode = { id: 'd1', type: 'sld_expansion_d1608e', x: 60, y: 0, rotation: 0 };
    assert.equal(portWorld(dNode, 'bus_w').x, 60 - d1608.width / 2);
    assert.equal(portWorld(dNode, 'bus_e').x, 60 + d1608.width / 2);
    assert.equal(portWorld(dNode, 'bus_w').y, portWorld(dNode, 'bus_e').y);
    assert.ok(portWorld(dNode, 'dc_plus_1').y > portWorld(dNode, 'x1_r1').y);
    assert.ok(d1608.ports.some((p) => p.id === 'x1_i1'));
    assert.ok(d1608.ports.some((p) => p.id === 'x1_i16'));
    assert.ok(d1608.ports.some((p) => p.id === 'x1_r8'));
    const a0602 = getSymbol('sld_expansion_a0602');
    assert.equal(a0602.expansion, 'A0602');
    assert.equal(a0602.width, 50);
    assert.equal(a0602.height, 45);
    assert.equal(a0602.slot, 2);
    assert.ok(a0602.ports.some((p) => p.id === 'x2_ai8'));
    assert.ok(a0602.ports.some((p) => p.id === 'x2_pwm4'));
    assert.ok(a0602.ports.some((p) => p.id === 'x2_pwm1' && p.label === 'AO1'));
    assert.ok(a0602.ports.some((p) => p.id === 'x2_pwm4' && p.label === 'AO4'));
    const aNode = { id: 'a1', type: 'sld_expansion_a0602', x: 90, y: 0, rotation: 0 };
    assert.ok(portWorld(aNode, 'x2_pwm1'));
    assert.ok(portWorld(aNode, 'x2_pwm4'));
    assert.ok(portWorld(aNode, 'dc_plus_1').y > portWorld(aNode, 'x2_pwm1').y);
    assert.ok(portWorld(aNode, 'x2_ai1').y > portWorld(aNode, 'x2_pwm1').y);
    assert.ok(a0602.ports.some((p) => p.id === 'dc_plus_1'));
    assert.ok(a0602.ports.some((p) => p.id === 'com_2'));
    const dc = getSymbol('sld_dc_supply');
    assert.ok(dc.ports.some((p) => p.id === 'ac_l'));
    assert.ok(dc.ports.some((p) => p.id === 'dc_plus'));
  });

  it('SLD ports are recognized as electric handles', () => {
    const { isElectricPort } = require('../public/js/mvDrawEdgePath');
    assert.ok(isElectricPort('line'));
    assert.ok(isElectricPort('load'));
    assert.ok(isElectricPort('primary'));
    assert.ok(isElectricPort('secondary'));
    assert.ok(isElectricPort('bond'));
    assert.ok(isElectricPort('c1'));
    assert.ok(isElectricPort('exp'));
    assert.ok(isElectricPort('bus_w'));
    assert.ok(isElectricPort('bus_e'));
    assert.ok(isElectricPort('dc_plus_1'));
    assert.ok(isElectricPort('com_2'));
    assert.ok(isElectricPort('x1_i16'));
    assert.ok(isElectricPort('x2_pwm1'));
    assert.ok(isElectricPort('rs485_b'));
    assert.ok(!isElectricPort('inlet'));
  });
});

describe('mvDraw extents', () => {
  const { normalizeExtents, extentsFromCorners, formatExtentsSize, drawingBounds } = require('../mv-draw/src/extents');
  const { boundsOf } = require('../mv-draw/src/exportPdf');

  it('normalizes corner pair to min/max', () => {
    const ext = extentsFromCorners([10, 20], [110, 80], 'Site');
    assert.equal(ext.minX, 10);
    assert.equal(ext.maxY, 80);
    assert.equal(ext.label, 'Site');
  });

  it('prefers extents for export bounds', () => {
    const b = drawingBounds({
      extents: { minX: 0, minY: 0, maxX: 200, maxY: 150 },
      nodes: [{ type: 'd_box', x: 50, y: 50, rotation: 0 }],
      edges: [],
    }, boundsOf);
    assert.equal(b.fromExtents, true);
    assert.equal(b.maxX, 202);
  });

  it('swaps sheet extents for portrait export', () => {
    const { exportPlotExtents } = require('../mv-draw/src/extents');
    const plot = exportPlotExtents({
      units: 'ft',
      extents: {
        minX: 0,
        minY: 0,
        maxX: 360,
        maxY: 240,
        sheetSize: 'D',
        worldPerInch: 10,
      },
    }, { orientation: 'portrait' });
    assert.equal(plot.maxX - plot.minX, 240);
    assert.equal(plot.maxY - plot.minY, 360);
    assert.equal(plot.orientation, 'portrait');
  });

  it('formats size label', () => {
    assert.match(formatExtentsSize({ minX: 0, minY: 0, maxX: 100, maxY: 50 }, 'ft'), /100\.0 × 50\.0 ft/);
  });
});

describe('mvDraw edge path', () => {
  const { edgePathPoints, nearestSegmentOnPath } = require('../mv-draw/src/edgePath');

  it('builds orthogonal path from ports when no bend vertices', () => {
    const nodes = [
      { id: 'n1', type: 'd_box', x: 0, y: 0, rotation: 0 },
      { id: 'n2', type: 'd_box', x: 20, y: 0, rotation: 0 },
    ];
    const pts = edgePathPoints({ from: 'n1:inlet', to: 'n2:leg1', points: [] }, nodes);
    assert.ok(pts.length >= 2);
    for (let i = 0; i < pts.length - 1; i++) {
      const horiz = Math.abs(pts[i][1] - pts[i + 1][1]) < 0.05;
      const vert = Math.abs(pts[i][0] - pts[i + 1][0]) < 0.05;
      assert.ok(horiz || vert);
    }
  });

  it('routes orthogonally when ports differ in X and Y', () => {
    const nodes = [
      { id: 'n1', type: 'lift_simplex', x: 0, y: 20, rotation: 0 },
      { id: 'n2', type: 'lift_duplex', x: 40, y: 0, rotation: 0 },
    ];
    const pts = edgePathPoints({ from: 'n1:outlet', to: 'n2:inlet', points: [] }, nodes);
    assert.ok(pts.length >= 3);
    for (let i = 0; i < pts.length - 1; i++) {
      const horiz = Math.abs(pts[i][1] - pts[i + 1][1]) < 0.05;
      const vert = Math.abs(pts[i][0] - pts[i + 1][0]) < 0.05;
      assert.ok(horiz || vert, `segment ${i} should be axis-aligned`);
    }
    assert.deepEqual(pts[0], pts[0]);
    assert.ok(Math.abs(pts[pts.length - 1][0] - pts[pts.length - 1][0]) < 100);
  });

  it('prefers vertical-first when dy exceeds dx (stacked lifts to trunk)', () => {
    const nodes = [
      { id: 'n1', type: 'lift_simplex', x: -160, y: 150, rotation: 0 },
      { id: 'n2', type: 'lift_duplex', x: -110, y: 90, rotation: 0 },
    ];
    const pts = edgePathPoints({ from: 'n1:outlet', to: 'n2:inlet', points: [] }, nodes);
    assert.ok(pts.length >= 3);
    assert.ok(Math.abs(pts[0][1] - pts[1][1]) < 0.05, 'first leg should be horizontal along outlet face');
    assert.ok(Math.abs(pts[pts.length - 2][1] - pts[pts.length - 1][1]) < 0.05, 'final leg should be horizontal into west inlet');
  });

  it('exits along rotated port direction after symbol rotation', () => {
    const nodes = [
      { id: 'n1', type: 'lift_simplex', x: 0, y: 0, rotation: 90 },
      { id: 'n2', type: 'lift_duplex', x: 30, y: 0, rotation: 0 },
    ];
    const { portWorld } = require('../mv-draw/src/symbolLibrary');
    const outlet = portWorld(nodes[0], 'outlet');
    assert.equal(outlet.dir, 'n');
    const pts = edgePathPoints({ from: 'n1:outlet', to: 'n2:inlet', points: [] }, nodes);
    assert.ok(pts.length >= 2);
    assert.ok(Math.abs(pts[0][0] - pts[1][0]) < 0.05, 'rotated north outlet should exit vertically first');
  });

  it('inserts bend vertices between ports', () => {
    const nodes = [
      { id: 'n1', type: 'd_box', x: 0, y: 0, rotation: 0 },
      { id: 'n2', type: 'd_box', x: 20, y: 10, rotation: 0 },
    ];
    const pts = edgePathPoints({
      from: 'n1:inlet',
      to: 'n2:leg1',
      points: [[10, 5], [10, 10]],
    }, nodes);
    assert.equal(pts.length, 4);
    assert.deepEqual(pts[1], [10, 5]);
    assert.deepEqual(pts[2], [10, 10]);
  });

  it('finds nearest segment for bend insertion', () => {
    const path = [[0, 0], [10, 0], [10, 10], [20, 10]];
    const ins = nearestSegmentOnPath(path, 10, 5);
    assert.ok(ins);
    assert.equal(ins.segmentIndex, 1);
    assert.equal(ins.point[0], 10);
    assert.equal(ins.point[1], 5);
  });
});

describe('mvDraw dxf export', () => {
  it('emits DXF entities', () => {
    const dxf = buildMvDrawDxf({
      nodes: [{ id: 'n1', type: 'd_box', x: 5, y: 5, rotation: 0 }],
      edges: [],
    });
    assert.match(dxf, /SECTION/);
    assert.match(dxf, /LWPOLYLINE/);
    assert.match(dxf, /EOF/);
  });

  it('emits extents rectangle on EXTENTS layer', () => {
    const dxf = buildMvDrawDxf({
      extents: { minX: 0, minY: 0, maxX: 100, maxY: 80 },
      nodes: [],
      edges: [],
    });
    assert.match(dxf, /EXTENTS/);
  });

  it('swaps plot extents for portrait DXF export', () => {
    const { exportPlotExtents } = require('../mv-draw/src/extents');
    const doc = {
      units: 'ft',
      extents: {
        minX: 0,
        minY: 0,
        maxX: 360,
        maxY: 240,
        sheetSize: 'D',
        worldPerInch: 10,
      },
      nodes: [],
      edges: [],
    };
    const plot = exportPlotExtents(doc, { orientation: 'portrait' });
    const dxf = buildMvDrawDxf(doc, { orientation: 'portrait' });
    assert.equal(plot.maxX - plot.minX, 240);
    assert.equal(plot.maxY - plot.minY, 360);
    assert.ok(dxf.includes(plot.minX.toFixed(4)));
    assert.ok(dxf.includes(plot.maxY.toFixed(4)));
  });

  it('emits LWPOLYLINE for polyline pipe runs', () => {
    const dxf = buildMvDrawDxf({
      nodes: [
        { id: 'n1', type: 'd_box', x: 0, y: 0, rotation: 0 },
        { id: 'n2', type: 'd_box', x: 30, y: 0, rotation: 0 },
      ],
      edges: [{
        from: 'n1:leg1',
        to: 'n2:inlet',
        points: [[15, 8], [15, -4]],
      }],
    });
    assert.match(dxf, /LWPOLYLINE/);
    assert.match(dxf, /PIPING/);
  });
});

describe('mvDraw pdf export', () => {
  const { buildMvDrawPdf, maxLabelCharsForWidth, nodePdfCaption } = require('../mv-draw/src/exportPdf');
  const { getSymbol } = require('../mv-draw/src/symbolLibrary');

  it('builds a PDF buffer for a simple layout', async () => {
    const buf = await buildMvDrawPdf({
      name: 'Test layout',
      nodes: [{ id: 'n1', type: 'd_box', x: 5, y: 5, rotation: 0, label: 'Distribution box' }],
      edges: [],
    });
    assert.ok(Buffer.isBuffer(buf));
    assert.ok(buf.length > 500);
    assert.equal(buf.subarray(0, 4).toString(), '%PDF');
  });

  it('uses wide label width so captions do not break one character per line', () => {
    const narrowSymPt = 8;
    const chars = maxLabelCharsForWidth(narrowSymPt, 8);
    assert.ok(chars >= 12, `expected at least 12 chars per line, got ${chars}`);
  });

  it('skips built-in symbol captions under the shape', () => {
    const sym = getSymbol('lift_simplex');
    assert.equal(nodePdfCaption({ type: 'lift_simplex', label: '' }, sym), '');
  });

  it('uses portrait page dimensions when requested', async () => {
    const buf = await buildMvDrawPdf({
      name: 'Portrait test',
      extents: { minX: 0, minY: 0, maxX: 360, maxY: 240, sheetSize: 'D', worldPerInch: 10 },
      nodes: [],
      edges: [],
    }, { orientation: 'portrait' });
    assert.ok(buf.length > 500);
    assert.equal(buf.subarray(0, 4).toString(), '%PDF');
    const mediaBox = buf.toString('latin1').match(/\/MediaBox\s*\[\s*([^\]]+)\]/);
    assert.ok(mediaBox);
    assert.equal(mediaBox[1].trim(), '0 0 1728 2592');
  });

  it('uses letter landscape when no sheet extents are set', async () => {
    const buf = await buildMvDrawPdf({
      name: 'Letter landscape',
      nodes: [{ id: 'n1', type: 'd_box', x: 5, y: 5, rotation: 0 }],
      edges: [],
    }, { orientation: 'landscape' });
    const mediaBox = buf.toString('latin1').match(/\/MediaBox\s*\[\s*([^\]]+)\]/);
    assert.ok(mediaBox);
    assert.equal(mediaBox[1].trim(), '0 0 792 612');
  });
});
