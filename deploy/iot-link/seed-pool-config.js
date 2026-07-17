#!/usr/bin/env node
'use strict';

/**
 * Seed IOT-LINK pool appliance config into MOOREVIEW_DATA.
 * Usage: node deploy/iot-link/seed-pool-config.js [--force]
 */
require('../../src/loadEnv');

const persistence = require('../../src/persistence');
const { seedIotLinkPoolConfig } = require('../../src/appliance/iotLinkPoolSeed');

const force = process.argv.includes('--force');

(async () => {
  try {
    const result = await seedIotLinkPoolConfig(persistence, { force });
    if (!result.seeded) {
      console.log(`[seed-pool] skipped: ${result.reason} (use --force)`);
      process.exit(0);
    }
    console.log('[seed-pool] activeProgram:', result.activeProgram);
    console.log('[seed-pool] tags:', result.tagCount);
    console.log('[seed-pool] drivers:', JSON.stringify(result.drivers, null, 2));
  } catch (e) {
    console.error('[seed-pool] failed:', e.message || e);
    process.exit(1);
  }
})();
