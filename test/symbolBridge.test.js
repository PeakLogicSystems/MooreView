'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  listMvDrawHmiAssets,
  listBridgedHmiSymbols,
  isMvDrawAssetPath,
  mvDrawAssetPath,
  buildMvDrawPreviewSvg,
  hmiSymbolTypeFromPath,
} = require('../mv-draw/src/symbolBridge');
const { listHmiAssets } = require('../src/hmi/hmiConfig');

describe('symbolBridge', () => {
  it('exports MV Draw symbols for Composer as @mvdraw assets', () => {
    const assets = listMvDrawHmiAssets();
    assert.ok(assets.length >= 20);
    assert.ok(assets.every((a) => a.type === 'mvdraw'));
    assert.ok(assets.every((a) => isMvDrawAssetPath(a.path)));
    assert.ok(assets.some((a) => a.path === mvDrawAssetPath('septic_tank_1000')));
    assert.ok(assets.every((a) => a.group === 'Site plan (MV Draw)'));
  });

  it('bridges HMI process-equipment assets into MV Draw symbol shape', () => {
    const publicRoot = path.join(__dirname, '..', 'public');
    const hmiAssets = listHmiAssets(publicRoot);
    const bridged = listBridgedHmiSymbols(hmiAssets);
    assert.ok(bridged.length > 100);
    assert.ok(bridged.some((s) => s.shape === 'hmi_image' && s.hmiSvg));
    assert.ok(bridged.some((s) => String(s.group).startsWith('HMI —')));
    const tank = bridged.find((s) => s.hmiGroup === 'Tanks & vessels');
    assert.ok(tank);
    assert.equal(tank.type, hmiSymbolTypeFromPath(tank.hmiSvg));
  });

  it('builds preview SVG for MV Draw symbols', () => {
    const svg = buildMvDrawPreviewSvg({ type: 'cleanout', label: 'Cleanout', width: 2, height: 2, fill: '#fbbf24', stroke: '#92400e' });
    assert.match(svg, /<svg/);
    assert.match(svg, /Cleanout/);
  });
});
