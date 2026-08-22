'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadHmiView() {
  const src = fs.readFileSync(path.join(__dirname, '../public/js/hmi.js'), 'utf8');
  const sandbox = {
    global: {},
    window: {},
    document: {
      createElement: () => ({
        style: {},
        appendChild() {},
        classList: { add() {}, remove() {} },
      }),
    },
  };
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  vm.runInNewContext(src, sandbox, { filename: 'hmi.js' });
  return sandbox.HmiView;
}

describe('resolveHandModePumpWrite', () => {
  const { resolveHandModePumpWrite, resolveHandModePumpDisplayValue } = loadHmiView();

  it('maps START/STOP to MOTORx_HAND when HOA is Hand (2)', () => {
    const start = resolveHandModePumpWrite('MOTOR1_START', true, 2);
    assert.equal(start.tagId, 'MOTOR1_HAND');
    assert.equal(start.value, true);
    assert.equal(start.hoaTag, 'MOTOR1_HOA');
    const stop = resolveHandModePumpWrite('MOTOR1_STOP', true, 2);
    assert.equal(stop.tagId, 'MOTOR1_HAND');
    assert.equal(stop.value, false);
    const p2 = resolveHandModePumpWrite('MOTOR2_START', true, 2);
    assert.equal(p2.tagId, 'MOTOR2_HAND');
    assert.equal(p2.value, true);
  });

  it('ignores release edge and non-hand HOA', () => {
    assert.equal(resolveHandModePumpWrite('MOTOR1_START', false, 2).skip, true);
    assert.equal(resolveHandModePumpWrite('MOTOR1_START', true, 0), null);
    assert.equal(resolveHandModePumpWrite('MOTOR1_START', true, 1), null);
    assert.equal(resolveHandModePumpWrite('ALT_BUMP', true, 2), null);
  });

  it('does not latch START/STOP fill from telemetry regardless of HOA', () => {
    const liveMap = {
      MOTOR1_HOA: { type: 'INT', value: 2 },
      MOTOR1_START: { type: 'BOOL', value: true },
      MOTOR1_STOP: { type: 'BOOL', value: true },
    };
    const startBinding = {
      tagId: 'MOTOR1_START',
      elementId: 'btn_p1_start',
      property: 'fill',
      interaction: 'pulse',
    };
    const stopBinding = {
      tagId: 'MOTOR2_STOP',
      elementId: 'btn_p2_stop',
      property: 'fill',
      interaction: 'pulse',
    };
    assert.equal(resolveHandModePumpDisplayValue(startBinding, liveMap), false);
    assert.equal(resolveHandModePumpDisplayValue(startBinding, {
      ...liveMap,
      MOTOR1_HOA: { type: 'INT', value: 0 },
    }), false);
    assert.equal(resolveHandModePumpDisplayValue(stopBinding, {
      MOTOR2_HOA: { type: 'INT', value: 1 },
      MOTOR2_STOP: { type: 'BOOL', value: true },
    }), false);
  });

  it('wires HOA mode buttons from interaction even when tag type is unknown', () => {
    const { isHoaModeButtonBinding } = loadHmiView();
    assert.equal(isHoaModeButtonBinding({
      tagId: 'MOTOR2_HOA',
      elementId: 't1_1_z0__btn_p2_hand',
      property: 'fill5',
      interaction: 'hoaMode',
      hoaValue: 2,
    }, ''), true);
  });
});
