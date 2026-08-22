#!/usr/bin/env node
'use strict';

/**
 * Generate hvac-rtu-opta.est.json — single rooftop unit on Opta + D1608E.
 *
 * Usage:
 *   node scripts/hvac-rtu-opta/generate-est.js
 */

const fs = require('fs');
const path = require('path');
const { EST_FORMAT } = require('../../src/project/estFile');
const { PROJECT, buildRtuTags, buildDrivers, buildSettings } = require('./project-data');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DEFAULT = path.join(ROOT, 'data', 'projects', 'hvac-rtu-opta.est.json');
const FIXTURE_TAGS = path.join(ROOT, 'st', 'fixtures', 'tags.hvac_rtu_opta.json');
const FIXTURE_DRIVERS = path.join(ROOT, 'st', 'fixtures', 'drivers.hvac_rtu_opta.json');
const FIXTURE_STARTER = path.join(ROOT, 'st', 'fixtures', 'hvac_rtu_opta_starter.json');

function buildStarter() {
  return {
    mode: 'rtu',
    starterProject: PROJECT.name,
    onboardingDoc: 'scripts/hvac-rtu-opta/README.md',
    devices: [
      {
        role: 'rtu',
        deviceId: process.env.RTU_DEVICE_ID || 'hvac_rtu_01',
        driverId: 'opta_rtu',
        expansion: 'D1608E',
        mcsa: '/mcsa',
        mcsaPreset: 'hvac-rtu',
        env: '/ahu-env',
      },
    ],
  };
}

function main() {
  const out = OUT_DEFAULT;
  const drivers = buildDrivers();
  const tags = buildRtuTags('opta_rtu');
  const settings = buildSettings();

  const est = {
    format: EST_FORMAT,
    version: 1,
    savedAt: new Date().toISOString(),
    project: { name: PROJECT.name },
    tags,
    drivers,
    program: PROJECT.programFile,
    activeProgram: PROJECT.programFile,
    settings,
  };

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(est, null, 2)}\n`, 'utf8');
  fs.writeFileSync(FIXTURE_TAGS, `${JSON.stringify(tags, null, 2)}\n`, 'utf8');
  fs.writeFileSync(FIXTURE_DRIVERS, `${JSON.stringify(drivers, null, 2)}\n`, 'utf8');
  fs.writeFileSync(FIXTURE_STARTER, `${JSON.stringify(buildStarter(), null, 2)}\n`, 'utf8');

  console.log(`Wrote ${out}`);
  console.log(`  Tags: ${tags.length}`);
  console.log(`  Driver: opta_rtu (${drivers[0].deviceId})`);
  console.log(`  I1–I6 MCSA blower/fan/comp · X1_IRAW1–4 NTC · X1_IRAW5 leak analog`);
}

main();
