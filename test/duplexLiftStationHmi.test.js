'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { repairCompositeBindings, explodeCompositeToEdit, listHmiComposites } = require('../src/hmi/hmiComposites');

const ROOT = path.resolve(__dirname, '..');
const EST = path.join(ROOT, 'data', 'projects', 'duplex-lift-station.est.json');
const PUBLIC = path.join(ROOT, 'public');

describe('duplex lift station HMI bindings', () => {
  it('explodeCompositeToEdit expands duplexls manifest into full-grid tile', () => {
    const manifest = listHmiComposites(PUBLIC)
      .find((c) => c.composite?.id === 'duplexls')?.composite;
    assert.ok(manifest?.parts?.length);
    const tile = explodeCompositeToEdit(manifest, 0, 0, {
      colSpan: 16,
      rowSpan: 13,
    });
    assert.equal(tile.compositeId, 'duplexls');
    assert.equal(tile.layers.length, manifest.parts.length);
    assert.equal(tile.layers[0].svg, manifest.parts[0].svg);
  });

  it('project has 3D overview and DUPLEXLS control screen only', () => {
    const est = JSON.parse(fs.readFileSync(EST, 'utf8'));
    assert.equal(est.settings.hmi.screens.length, 2);
    assert.equal(est.settings.hmi.screens[0].id, 'screen_1');
    assert.equal(est.settings.hmi.screens[1].id, 'screen_2');
    assert.deepEqual(est.settings.hmi.layout.areaPopupScreens, ['screen_2']);
    assert.ok(!est.settings.hmi.screens.some((s) => s.id === 'screen_3'));
  });

  it('DUPLEXLS screen uses duplexls composite tile', () => {
    const est = JSON.parse(fs.readFileSync(EST, 'utf8'));
    const screen = est.settings.hmi.screens.find((s) => s.id === 'screen_2');
    assert.ok(screen);
    assert.equal(screen.name, 'DUPLEXLS');
    assert.equal(screen.svg, '/hmi/svg/library/lift-station-faceplates/mooreview/duplexls.svg');
    assert.equal(screen.tiles.length, 1);
    assert.equal(screen.tiles[0].compositeId, 'duplexls');
    assert.equal(screen.tiles[0].layers[0].svg, screen.svg);
    assert.equal(screen.tiles[0].colSpan, 16);
    assert.equal(screen.tiles[0].rowSpan, 13);
  });

  it('repairCompositeBindings applies duplexls pump and station bindings on screen_2', () => {
    const est = JSON.parse(fs.readFileSync(EST, 'utf8'));
    const hmi = {
      screens: est.settings.hmi.screens,
      bindings: JSON.parse(JSON.stringify(est.settings.hmi.bindings)),
    };
    repairCompositeBindings(hmi, PUBLIC);
    const find = (elementId, property = 'fill') => hmi.bindings.find(
      (b) => b.screenId === 'screen_2' && b.elementId === elementId && b.property === property,
    );
    assert.equal(find('t1_1_z0__btn_p1_start')?.tagId, 'MOTOR1_START');
    assert.equal(find('t1_1_z0__btn_p2_start')?.tagId, 'MOTOR2_START');
    assert.equal(find('t1_1_z0__btn_p1_stop')?.tagId, 'MOTOR1_STOP');
    assert.equal(find('t1_1_z0__btn_p2_stop')?.tagId, 'MOTOR2_STOP');
    assert.equal(find('t1_1_z0__btn_p1_auto', 'fill5')?.interaction, 'hoaMode');
    assert.equal(find('t1_1_z0__btn_p1_auto', 'fill5')?.hoaValue, 0);
    assert.equal(find('t1_1_z0__btn_p1_hand', 'fill5')?.hoaValue, 2);
    assert.equal(find('t1_1_z0__lamp_phase_fault')?.tagId, 'PHASE_FAULT');
    assert.equal(find('t1_1_z0__lamp_status', 'fill5')?.tagId, 'STATION_STA');
    assert.equal(find('t1_1_z0__val_tank_level', 'text')?.tagId, 'TANK_LVL');
  });

  it('duplexls composite manifest lists overview bindings', () => {
    const lift = listHmiComposites(PUBLIC)
      .find((c) => c.composite?.id === 'duplexls')?.composite;
    assert.ok(lift, 'duplexls composite');
    assert.equal(lift.parts[0].svg, '/hmi/svg/library/lift-station-faceplates/mooreview/duplexls.svg');
    assert.ok(lift.defaultBindings.some((b) => b.elementId === 'btn_p1_start' && b.interaction === 'pulse'));
    assert.ok(lift.defaultBindings.some((b) => b.elementId === 'lamp_phase_fault' && b.tagRole === 'phaseFault'));
    assert.ok(lift.defaultBindings.some((b) => b.elementId === 'lamp_status' && b.tagRole === 'stationSta'));
  });

  it('pump command bindings declare pulse interaction', () => {
    const est = JSON.parse(fs.readFileSync(EST, 'utf8'));
    for (const suffix of ['btn_p1_start', 'btn_p1_stop', 'btn_p2_start', 'btn_p2_stop']) {
      const b = est.settings.hmi.bindings.find(
        (x) => x.screenId === 'screen_2' && x.elementId === `t1_1_z0__${suffix}`,
      );
      assert.ok(b, `missing t1_1_z0__${suffix}`);
      assert.equal(b.interaction, 'pulse', `${b.elementId} should be pulse`);
    }
  });
});
