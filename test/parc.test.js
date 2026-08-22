'use strict';

const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function loadDeviceRegistry() {
  delete require.cache[require.resolve('../src/config')];
  delete require.cache[require.resolve('../src/persistence')];
  delete require.cache[require.resolve('../src/parc/deviceRegistry')];
  return require('../src/parc/deviceRegistry');
}

describe('DeviceRegistry', () => {
  it('ingests report and lists device', () => {
    const { DeviceRegistry } = loadDeviceRegistry();
    const reg = new DeviceRegistry();
    reg.updateSettings({ enabled: true });
    const r = reg.ingestReport({
      deviceId: 'test-01',
      name: 'Test Device',
      platform: 'rpi-aarch64',
      reportIntervalSec: 120,
      runtime: { running: true, scanMs: 100 },
      tags: [{ id: 'DI1', type: 'BOOL', value: true }],
      driverHealth: [],
    });
    assert.equal(r.ok, true);
    assert.equal(r.nextReportSec, 120);
    const row = reg.listDevices().find((d) => d.deviceId === 'test-01');
    assert.ok(row);
    assert.equal(row.tagCount, 1);
  });

  it('debounces parc.json saves during telemetry ingest', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-parc-debounce-'));
    process.env.MOOREVIEW_DATA = dir;
    mock.timers.enable({ apis: ['setTimeout'] });

    const { DeviceRegistry, SAVE_DEBOUNCE_MS } = loadDeviceRegistry();
    const reg = new DeviceRegistry();
    reg.updateSettings({ enabled: true });

    reg.ingestReport({ deviceId: 'deb-01', tags: [{ id: 'DI1', type: 'BOOL', value: true }] });
    reg.ingestReport({ deviceId: 'deb-02', tags: [{ id: 'DI2', type: 'BOOL', value: false }] });

    const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'parc.json'), 'utf8'));
    assert.equal(onDisk.devices['deb-02'], undefined);

    mock.timers.tick(SAVE_DEBOUNCE_MS);

    const flushed = JSON.parse(fs.readFileSync(path.join(dir, 'parc.json'), 'utf8'));
    assert.equal(flushed.devices['deb-01'].tags.length, 1);
    assert.equal(flushed.devices['deb-02'].tags.length, 1);

    mock.timers.reset();
    delete process.env.MOOREVIEW_DATA;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('attach pauses reports', () => {
    const { DeviceRegistry } = loadDeviceRegistry();
    const reg = new DeviceRegistry();
    reg.updateSettings({ enabled: true });
    reg.ingestReport({ deviceId: 'dbg-01', tags: [] });
    reg.attach('dbg-01', { host: '192.168.1.50', port: 3080 });
    const cfg = reg.reporterConfig('dbg-01');
    assert.equal(cfg.pauseReports, true);
    const ack = reg.ingestReport({ deviceId: 'dbg-01', tags: [] });
    assert.equal(ack.pauseReports, true);
    reg.detach('dbg-01');
    const ack2 = reg.ingestReport({ deviceId: 'dbg-01', tags: [] });
    assert.equal(ack2.pauseReports, false);
  });

  it('markDeviceOffline clears attach and sets meta.online false', () => {
    const { DeviceRegistry } = loadDeviceRegistry();
    const reg = new DeviceRegistry();
    reg.updateSettings({ enabled: true });
    reg.ingestReport({
      deviceId: 'off-01',
      tags: [],
      runtime: { running: true },
    });
    reg.attach('off-01', { host: '192.168.1.50', port: 3080 });
    const offline = reg.markDeviceOffline('off-01');
    assert.equal(offline.meta.online, false);
    assert.equal(offline.runtime.running, false);
    assert.equal(offline.attach.active, false);
    assert.equal(reg.reporterConfig('off-01').pauseReports, false);
  });

  it('markDeviceOnline clears offline meta', () => {
    const { DeviceRegistry } = loadDeviceRegistry();
    const reg = new DeviceRegistry();
    reg.updateSettings({ enabled: true });
    reg.ingestReport({ deviceId: 'on-01', tags: [] });
    reg.markDeviceOffline('on-01');
    const online = reg.markDeviceOnline('on-01');
    assert.equal(online.meta.online, true);
  });

  it('clears mqttAuthFailed on successful mqttAuth report', () => {
    const { DeviceRegistry } = loadDeviceRegistry();
    const reg = new DeviceRegistry();
    reg.updateSettings({ enabled: true });
    reg.ingestReport({
      deviceId: 'auth-01',
      tags: [],
      mqttAuthFailed: true,
    });
    assert.equal(reg.getDevice('auth-01').meta.mqttAuthFailed, true);
    reg.ingestReport({
      deviceId: 'auth-01',
      tags: [],
      mqttAuth: true,
    });
    assert.equal(reg.getDevice('auth-01').meta.mqttAuthFailed, false);
  });

  it('clears mqttAuthFailed when body has mqttAuthFailed false', () => {
    const { DeviceRegistry } = loadDeviceRegistry();
    const reg = new DeviceRegistry();
    reg.updateSettings({ enabled: true });
    reg.ingestReport({ deviceId: 'auth-02', tags: [], mqttAuthFailed: true });
    reg.ingestReport({ deviceId: 'auth-02', tags: [], mqttAuthFailed: false });
    assert.equal(reg.getDevice('auth-02').meta.mqttAuthFailed, false);
  });

  it('triggers recovery hook after telemetry following offline', () => {
    const { DeviceRegistry, setParcRecoveryHook } = loadDeviceRegistry();
    const reg = new DeviceRegistry();
    reg.updateSettings({ enabled: true });
    const calls = [];
    setParcRecoveryHook((deviceId, opts) => calls.push({ deviceId, opts }));
    reg.ingestReport({ deviceId: 'rec-01', tags: [] });
    reg.markDeviceOffline('rec-01');
    reg.ingestReport({ deviceId: 'rec-01', tags: [{ id: 'DI1', type: 'BOOL', value: true }] });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].deviceId, 'rec-01');
    assert.equal(calls[0].opts.reason, 'telemetry');
    setParcRecoveryHook(null);
  });
});
