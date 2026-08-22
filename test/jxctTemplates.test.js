'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildFromPreset, listPresets, getPreset } = require('../src/devices/devicePresets');

describe('JXCT device templates', () => {
  it('lists NPK template', () => {
    const p = listPresets().find((x) => x.id === 'jxct_npk_jxbs3001');
    assert.ok(p);
    assert.equal(p.transport, 'modbus_rtu');
    assert.equal(p.sharedBus, false);
  });

  it('lists Dragino Modbus→MQTT profile for 7-in-1 sensor', () => {
    const p = getPreset('jxct_npk_jxbs3001_dragino');
    assert.ok(p);
    assert.equal(p.transport, 'modbus_rtu');
    assert.ok(p.dragino);
    assert.equal(p.dragino.bindAs, 'mqtt_parc');
    assert.equal(p.dragino.reportIntervalSec, 300);
  });

  it('builds Dragino ×4 profile with per-slave prefixed tags', () => {
    const p = getPreset('jxct_npk_jxbs3001_dragino_x4');
    assert.ok(p);
    assert.equal(p.aiCount, 28);
    assert.deepEqual(p.dragino.pollBlocks.map((b) => b.slaveId), [1, 2, 3, 4]);

    const { tags } = buildFromPreset('jxct_npk_jxbs3001_dragino_x4');
    assert.equal(tags.length, 28);
    assert.equal(tags.find((t) => t.id === 'S1_SOIL_PH').driverAddress.slaveId, 1);
    assert.equal(tags.find((t) => t.id === 'S2_SOIL_MOIST_PCT').driverAddress.slaveId, 2);
    assert.equal(tags.find((t) => t.id === 'S3_SOIL_TEMP_C').driverAddress.address, 19);
    assert.equal(tags.find((t) => t.id === 'S4_K_MG_KG').driverAddress.slaveId, 4);
    assert.equal(tags.find((t) => t.id === 'S4_K_MG_KG').driverAddress.address, 32);
  });

  it('builds JXBS-3001-NPK-RS 7-in-1 map', () => {
    const { driver, tags } = buildFromPreset('jxct_npk_jxbs3001', { serialPort: 'COM6' });
    assert.equal(driver.id, 'jxct_npk');
    assert.equal(driver.baud, 9600);
    assert.equal(driver.slaveId, 1);
    assert.equal(driver.serialPort, 'COM6');
    assert.equal(tags.length, 7);
    assert.equal(tags.find((t) => t.id === 'SOIL_PH').driverAddress.address, 6);
    assert.equal(tags.find((t) => t.id === 'SOIL_PH').scale, 0.01);
    assert.equal(tags.find((t) => t.id === 'SOIL_PH').wordWidth, 16);
    assert.equal(tags.find((t) => t.id === 'SOIL_MOIST_PCT').driverAddress.address, 18);
    assert.equal(tags.find((t) => t.id === 'SOIL_TEMP_C').scale, 0.1);
    assert.equal(tags.find((t) => t.id === 'SOIL_EC_US_CM').driverAddress.address, 21);
    assert.equal(tags.find((t) => t.id === 'N_MG_KG').driverAddress.address, 30);
    assert.equal(tags.find((t) => t.id === 'P_MG_KG').driverAddress.address, 31);
    assert.equal(tags.find((t) => t.id === 'K_MG_KG').driverAddress.address, 32);
    assert.equal(tags.every((t) => t.driverAddress.table === 'holding'), true);
  });
});
