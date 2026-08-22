'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildFromPreset, listPresets } = require('../src/devices/devicePresets');

describe('DFRobot RS485 sensor templates', () => {
  it('lists all DFRobot templates', () => {
    const ids = [
      'dfrobot_sen0706_ec',
      'dfrobot_sen0709_orp',
      'dfrobot_sen0710_turbidity',
      'dfrobot_sen0711_ammonia_ph',
      'dfrobot_sen0712_chlorine',
      'dfrobot_sen0681_do',
    ];
    for (const id of ids) {
      const p = listPresets().find((x) => x.id === id);
      assert.ok(p, id);
      assert.equal(p.transport, 'modbus_rtu');
      assert.equal(p.sharedBus, false);
    }
  });

  it('builds SEN0709 ORP map', () => {
    const { driver, tags } = buildFromPreset('dfrobot_sen0709_orp', { serialPort: 'COM5' });
    assert.equal(driver.id, 'df_sen0709');
    assert.equal(driver.baud, 4800);
    assert.equal(driver.slaveId, 1);
    assert.equal(driver.serialPort, 'COM5');
    const orp = tags.find((t) => t.id === 'ORP_MV');
    assert.equal(orp.driverAddress.address, 0);
    assert.equal(orp.signed, true);
    assert.equal(tags.find((t) => t.id === 'ORP_TEMP_C').scale, 0.1);
  });

  it('builds SEN0710 turbidity map', () => {
    const { tags } = buildFromPreset('dfrobot_sen0710_turbidity');
    assert.equal(tags.find((t) => t.id === 'TURB_NTU').scale, 0.1);
    assert.equal(tags.find((t) => t.id === 'TURB_TEMP_C').driverAddress.address, 1);
  });

  it('builds SEN0711 ammonia / pH map', () => {
    const { tags } = buildFromPreset('dfrobot_sen0711_ammonia_ph');
    assert.equal(tags.length, 3);
    assert.equal(tags.find((t) => t.id === 'NH3_MG_L').scale, 0.01);
    assert.equal(tags.find((t) => t.id === 'NH3_PH').driverAddress.address, 1);
  });

  it('builds SEN0706 EC map', () => {
    const { driver, tags } = buildFromPreset('dfrobot_sen0706_ec');
    assert.equal(driver.id, 'df_sen0706');
    assert.equal(tags.length, 4);
    assert.equal(tags.find((t) => t.id === 'EC_US_CM').scale, 0.1);
    assert.equal(tags.find((t) => t.id === 'EC_TEMP_C').driverAddress.address, 1);
    assert.equal(tags.find((t) => t.id === 'EC_TDS_PPM').driverAddress.address, 3);
  });

  it('builds SEN0712 residual chlorine map', () => {
    const { driver, tags } = buildFromPreset('dfrobot_sen0712_chlorine');
    assert.equal(driver.id, 'df_sen0712');
    assert.equal(tags.length, 1);
    const cl = tags.find((t) => t.id === 'CL_MG_L');
    assert.equal(cl.driverAddress.address, 0);
    assert.equal(cl.scale, 0.01);
  });

  it('builds SEN0681 dissolved oxygen float map', () => {
    const { tags } = buildFromPreset('dfrobot_sen0681_do');
    const sat = tags.find((t) => t.id === 'DO_SAT_PCT');
    assert.equal(sat.driverAddress.encoding, 'float32');
    assert.equal(sat.driverAddress.address, 0);
    assert.equal(sat.scale, 100);
    assert.equal(tags.find((t) => t.id === 'DO_MG_L').driverAddress.address, 2);
    assert.equal(tags.find((t) => t.id === 'DO_TEMP_C').driverAddress.address, 4);
  });

  it('builds local pool chemistry RS-485 profile (SEN0711 + SEN0712 → PH_AI / ORP_AI)', () => {
    const listed = listPresets().find((p) => p.id === 'dfrobot_pool_chemistry');
    assert.ok(listed);
    assert.equal(listed.transport, 'modbus_rtu');
    assert.equal(listed.defaults.baud, 4800);
    const { driver, tags } = buildFromPreset('dfrobot_pool_chemistry', { serialPort: 'COM7' });
    assert.equal(driver.id, 'pool_chem_rtu');
    assert.equal(driver.baud, 4800);
    assert.equal(driver.serialPort, 'COM7');
    assert.equal(tags.find((t) => t.id === 'PH_AI').driverAddress.slaveId, 1);
    assert.equal(tags.find((t) => t.id === 'PH_AI').driverAddress.address, 1);
    assert.equal(tags.find((t) => t.id === 'ORP_AI').driverAddress.slaveId, 2);
    assert.equal(tags.find((t) => t.id === 'WATER_TEMP_C').scale, 0.1);
    assert.ok(tags.find((t) => t.id === 'NH3_MG_L'));
  });

  it('lists Edge101 MQTT Parc controller template', () => {
    const p = listPresets().find((x) => x.id === 'dfrobot_edge101_parc');
    assert.ok(p, 'dfrobot_edge101_parc');
    assert.equal(p.transport, 'mqtt_parc');
    assert.equal(p.vendor, 'DFRobot');
    assert.equal(p.stationType, 'pool_chemistry');
  });

  it('builds pool chemistry Dragino profile (SEN0711 + SEN0712)', () => {
    const { getPreset } = require('../src/devices/devicePresets');
    const p = getPreset('dfrobot_pool_chemistry_dragino');
    assert.ok(p);
    assert.equal(p.stationType, 'pool_chemistry');
    assert.equal(p.defaults.baud, 4800);
    assert.deepEqual(p.dragino.pollBlocks.map((b) => b.slaveId), [1, 2]);

    const { driver, tags } = buildFromPreset('dfrobot_pool_chemistry_dragino');
    assert.equal(driver.id, 'dragino_pool_chem');
    assert.equal(tags.length, 4);
    assert.equal(tags.find((t) => t.id === 'PH_PV').driverAddress.slaveId, 1);
    assert.equal(tags.find((t) => t.id === 'PH_PV').driverAddress.address, 1);
    assert.equal(tags.find((t) => t.id === 'PH_PV').wordWidth, 16);
    assert.equal(tags.find((t) => t.id === 'CL_PV').driverAddress.slaveId, 2);
    assert.equal(tags.find((t) => t.id === 'WATER_TEMP_C').scale, 0.1);
  });
});
