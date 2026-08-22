'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const persistence = require('../src/persistence');
const { ScanEngine } = require('../src/runtime/scanEngine');

function mockTagStore() {
  return { list: () => [] };
}

function mockDriverManager(remoteEnabled) {
  const configs = [{ id: 'opta_st_01', type: 'mqtt_parc', enabled: true, remoteExecution: true }];
  const instances = new Map([['opta_st_01', { connected: true }]]);
  return {
    configs,
    instances,
    list: () => configs,
    hasConnectedRtu: () => false,
    rebuild: async () => {},
    readAll: async () => {},
    writeAll: async () => {},
    _settingsRemote: remoteEnabled,
  };
}

describe('scanEngine remote execution', () => {
  it('_findRemoteDriver respects settings.remoteExecution', () => {
    const orig = persistence.readJson;
    persistence.readJson = (file, def) => {
      if (file === 'settings.json') return { scanMs: 100, remoteExecution: false };
      return orig(file, def);
    };
    try {
      const engine = new ScanEngine(mockTagStore(), mockDriverManager(), null);
      engine.loadSettings();
      assert.equal(engine.remoteExecution, false);
      assert.equal(engine._findRemoteDriver(), null);
    } finally {
      persistence.readJson = orig;
    }
  });

  it('_findRemoteDriver returns mqtt_parc when remoteExecution on', () => {
    const orig = persistence.readJson;
    persistence.readJson = (file, def) => {
      if (file === 'settings.json') return { scanMs: 100, remoteExecution: true };
      return orig(file, def);
    };
    try {
      const dm = mockDriverManager(true);
      const engine = new ScanEngine(mockTagStore(), dm, null);
      engine.loadSettings();
      assert.equal(engine._findRemoteDriver(), dm.instances.get('opta_st_01'));
    } finally {
      persistence.readJson = orig;
    }
  });

  it('start throws when remoteExecution on but no mqtt_parc driver', async () => {
    const orig = persistence.readJson;
    const programStore = require('../src/programs/programStore');
    const origRead = programStore.readActive;
    persistence.readJson = (file, def) => {
      if (file === 'settings.json') return { scanMs: 100, remoteExecution: true };
      return orig(file, def);
    };
    programStore.readActive = () => 'PROGRAM TestProg; END_PROGRAM';
    try {
      const dm = {
        configs: [{ id: 'mock1', type: 'mock', enabled: true }],
        instances: new Map(),
        list: () => dm.configs,
        hasConnectedRtu: () => false,
        rebuild: async () => {},
      };
      const engine = new ScanEngine(mockTagStore(), dm, null);
      await assert.rejects(
        () => engine.start(),
        (e) => /no mqtt_parc driver/i.test(e.message),
      );
    } finally {
      persistence.readJson = orig;
      programStore.readActive = origRead;
    }
  });
});
