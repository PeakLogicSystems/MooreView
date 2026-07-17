#!/usr/bin/env node
'use strict';

/**
 * Seed generic IOT-LINK appliance config into MOOREVIEW_DATA.
 * Usage: node deploy/iot-link/seed-generic-config.js [--force]
 */
require('../../src/loadEnv');

const persistence = require('../../src/persistence');
const { seedIotLinkGenericConfig } = require('../../src/appliance/iotLinkGenericSeed');

const force = process.argv.includes('--force');

(async () => {
  try {
    const configStore = require('../../src/configStore');
    await configStore.init();
    const result = await seedIotLinkGenericConfig(persistence, { force });
    if (!result.seeded) {
      console.log(`[seed-generic] skipped: ${result.reason} (use --force)`);
      process.exit(0);
    }
    console.log('[seed-generic] project:', 'iot-link');
    console.log('[seed-generic] activeProgram: (none — blank workspace)');
    console.log('[seed-generic] rs485:', result.rs485Ports);
    console.log('[seed-generic] drivers:', JSON.stringify(result.drivers, null, 2));
  } catch (e) {
    console.error('[seed-generic] failed:', e.message || e);
    process.exit(1);
  }
})();
