#!/usr/bin/env node
'use strict';
require('/opt/mooreview/src/loadEnv');
const fs = require('fs');
const patch = JSON.parse(fs.readFileSync('/tmp/patch-mqtt-settings.json', 'utf8'));

(async () => {
  const configStore = require('/opt/mooreview/src/configStore');
  await configStore.init();
  const persistence = require('/opt/mooreview/src/persistence');
  const prev = persistence.readJson('settings.json', {});
  const next = {
    ...prev,
    mqttParc: {
      ...(prev.mqttParc || {}),
      ...patch.mqttParc,
    },
  };
  persistence.writeJson('settings.json', next);
  await persistence.flushConfig();
  console.log(JSON.stringify(next.mqttParc, null, 2));
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
