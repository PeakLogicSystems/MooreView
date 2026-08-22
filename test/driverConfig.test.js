'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeDriverConfig, driverUsesSerialPort } = require('../src/drivers/driverConfig');

describe('driverConfig', () => {
  it('strips stray COM fields from nextcentury driver', () => {
    const out = sanitizeDriverConfig({
      id: 'nc1',
      type: 'nextcentury',
      enabled: true,
      serialPort: 'COM8',
      baud: 9600,
      slaveId: 1,
      email: 'a@b.com',
      reportId: 'rt_4510',
    });
    assert.equal(out.serialPort, undefined);
    assert.equal(out.baud, undefined);
    assert.equal(out.email, 'a@b.com');
  });

  it('keeps modbus_rtu serial fields', () => {
    const out = sanitizeDriverConfig({
      id: 'rtu1',
      type: 'modbus_rtu',
      serialPort: 'COM3',
      baud: 9600,
      slaveId: 2,
    });
    assert.equal(out.serialPort, 'COM3');
    assert.equal(out.slaveId, 2);
  });

  it('driverUsesSerialPort', () => {
    assert.equal(driverUsesSerialPort('modbus_rtu'), true);
    assert.equal(driverUsesSerialPort('nextcentury'), false);
  });
});
