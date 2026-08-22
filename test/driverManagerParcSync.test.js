'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { DriverManager } = require('../src/drivers/index');
const { registry } = require('../src/parc/deviceRegistry');
const { TagStore } = require('../src/tags/tagStore');
const persistence = require('../src/persistence');

describe('DriverManager.syncParcTelemetry', () => {
  it('mirrors Parc registry into tag store for mqtt_parc driver', async () => {
    const driversBackup = persistence.readJson('drivers.json', null);
    const tagsBackup = persistence.readJson('tags.json', null);

    try {
      persistence.writeJson('drivers.json', [{
        id: 'opta_mqtt_st',
        type: 'mqtt_parc',
        enabled: true,
        deviceId: 'opta_st_01',
      }]);
      persistence.writeJson('tags.json', [
        { id: 'X1_I2', type: 'BOOL', role: 'input', value: false, quality: 'GOOD' },
        { id: 'R1', type: 'BOOL', role: 'output', value: false, quality: 'GOOD' },
      ]);

      registry.ingestReport({
        deviceId: 'opta_st_01',
        tags: [
          { id: 'X1_I2', type: 'BOOL', role: 'input', value: true, quality: 'GOOD' },
          { id: 'R1', type: 'BOOL', role: 'output', value: true, quality: 'GOOD' },
        ],
      });

      const tagStore = new TagStore();
      tagStore.load();
      const dm = new DriverManager(tagStore);
      await dm.rebuild();

      await dm.syncParcTelemetry();

      assert.equal(tagStore.get('X1_I2').value, true);
      assert.equal(tagStore.get('R1').value, true);
    } finally {
      if (driversBackup != null) persistence.writeJson('drivers.json', driversBackup);
      else persistence.writeJson('drivers.json', []);
      if (tagsBackup != null) persistence.writeJson('tags.json', tagsBackup);
      else persistence.writeJson('tags.json', []);
    }
  });
});
