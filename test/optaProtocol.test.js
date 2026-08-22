'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  APP_VERSION,
  OPTA_PROTOCOL_VERSION,
  semverCompare,
  checkOptaDeviceStatus,
  clientDeployMeta,
  clientHeaders,
} = require('../src/drivers/optaProtocol');

describe('optaProtocol', () => {
  it('exports matching client meta', () => {
    assert.equal(clientDeployMeta().protocolVersion, OPTA_PROTOCOL_VERSION);
    assert.equal(clientDeployMeta().clientVersion, APP_VERSION);
    assert.ok(Number(clientDeployMeta().clientTimeUnix) > 1577836800);
    assert.equal(clientHeaders()['X-MV-Protocol-Version'], String(OPTA_PROTOCOL_VERSION));
    assert.ok(Number(clientHeaders()['X-MV-Client-Time']) > 1577836800);
    const named = clientDeployMeta({ programName: 'logic/demo.st' });
    assert.equal(named.programName, 'logic/demo.st');
  });

  it('accepts matching device status', () => {
    const r = checkOptaDeviceStatus({
      ok: true,
      protocolVersion: OPTA_PROTOCOL_VERSION,
      firmwareVersion: APP_VERSION,
    });
    assert.equal(r.ok, true);
    assert.equal(r.errors.length, 0);
  });

  it('rejects protocol mismatch', () => {
    const r = checkOptaDeviceStatus({
      ok: true,
      protocolVersion: 99,
      firmwareVersion: APP_VERSION,
    });
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /Protocol mismatch/);
  });

  it('warns when firmware version fields missing', () => {
    const r = checkOptaDeviceStatus({ ok: true });
    assert.equal(r.ok, true);
    assert.ok(r.warnings.some((w) => /protocolVersion/.test(w)));
    assert.ok(r.warnings.some((w) => /firmwareVersion/.test(w)));
  });

  it('semverCompare orders versions', () => {
    assert.ok(semverCompare('2.3.7', '2.3.6') > 0);
    assert.ok(semverCompare('2.3.7', '2.3.7') === 0);
    assert.ok(semverCompare('2.2.0', '2.3.7') < 0);
  });
});
