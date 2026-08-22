#!/usr/bin/env node
'use strict';

/**
 * Generate facility-hvac-iot-link.est.json — IoT-Link site project.
 *
 * Usage:
 *   node scripts/facility-hvac-iot-link/generate-est.js
 *   node scripts/facility-hvac-iot-link/generate-est.js --out data/projects/facility-hvac-iot-link.est.json
 */

const fs = require('fs');
const path = require('path');
const { buildFromPreset } = require('../../src/devices/devicePresets');
const {
  buildEzMeterPqDerivedTags,
  defaultEzMeterSemanticMap,
} = require('../../src/facilities/ezmeterPq');
const { applySemanticMap } = require('../assisted-living/ezmeter-map');
const { EST_FORMAT } = require('../../src/project/estFile');
const {
  PROJECT,
  buildAhuTags,
  buildCondTags,
  buildSiteTags,
  buildDrivers,
  buildSettings,
  tag,
} = require('./project-data');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DEFAULT = path.join(ROOT, 'data', 'projects', 'facility-hvac-iot-link.est.json');
const FIXTURE_TAGS = path.join(ROOT, 'st', 'fixtures', 'tags.facility_hvac_iot_link.json');
const FIXTURE_DRIVERS = path.join(ROOT, 'st', 'fixtures', 'drivers.facility_hvac_iot_link.json');
const FIXTURE_STARTER = path.join(ROOT, 'st', 'fixtures', 'facility_hvac_iot_link_starter.json');

function parseArgs() {
  const args = process.argv.slice(2);
  let out = OUT_DEFAULT;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--out' && args[i + 1]) {
      out = path.resolve(args[i + 1]);
      i += 1;
    }
  }
  return { out };
}

function pqThresholdTags() {
  return [
    tag('MECH_PQ_CFG_NOM_V', { label: 'PQ nominal voltage V', type: 'REAL', value: 240, default: 240 }),
    tag('MECH_PQ_CFG_UV_V', { label: 'PQ undervoltage V', type: 'REAL', value: 216, default: 216 }),
    tag('MECH_PQ_CFG_OV_V', { label: 'PQ overvoltage V', type: 'REAL', value: 264, default: 264 }),
    tag('MECH_PQ_CFG_LOW_PF', { label: 'PQ low PF', type: 'REAL', value: 0.85, default: 0.85 }),
    tag('MECH_PQ_CFG_FREQ_MIN', { label: 'PQ min Hz', type: 'REAL', value: 59.5, default: 59.5 }),
    tag('MECH_PQ_CFG_FREQ_MAX', { label: 'PQ max Hz', type: 'REAL', value: 60.5, default: 60.5 }),
    tag('MECH_PQ_CFG_IMBAL_PCT', { label: 'PQ imbalance %', type: 'REAL', value: 5, default: 5 }),
    tag('MECH_PQ_CFG_LOAD_I', { label: 'PQ loaded I A', type: 'REAL', value: 5, default: 5 }),
    tag('DDS_METER_KWH_PREV', { label: 'Previous kWh', type: 'REAL', value: 0 }),
  ];
}

function buildStarter() {
  return {
    mode: 'facility',
    starterProject: PROJECT.name,
    onboardingDoc: 'scripts/facility-hvac-iot-link/README.md',
    devices: [
      {
        role: 'ahu',
        deviceId: process.env.AHU_DEVICE_ID || 'hvac_ahu_01',
        driverId: 'opta_ahu',
        expansion: 'D1608E',
        calibrate: { ct: '/ct-cal', env: '/ahu-env' },
        deployProgram: PROJECT.programFile,
      },
      {
        role: 'condenser',
        deviceId: process.env.COND_DEVICE_ID || 'hvac_cond_01',
        driverId: 'opta_cond',
        mcsa: '/mcsa',
        expansion: 'D1608E',
        mcsaPreset: 'facility-condenser',
        units: 2,
      },
    ],
    ezMeter: { driverId: 'dds_rgb', baud: 19200, slaveId: 1, serial: '/dev/ttyLP6' },
  };
}

function main() {
  const { out } = parseArgs();
  const drivers = buildDrivers();
  const dds = drivers.find((d) => d.id === 'dds_rgb');

  const { tags: meterTags } = buildFromPreset('ezmeter_dds_rgb_2025', {
    driverId: 'dds_rgb',
    serialPort: dds.serialPort,
    baud: dds.baud,
    slaveId: dds.slaveId,
  });

  let tags = [
    ...buildSiteTags(),
    ...buildAhuTags('opta_ahu'),
    ...buildCondTags('opta_cond'),
    ...meterTags,
    ...buildEzMeterPqDerivedTags(),
    ...pqThresholdTags(),
    tag('MECH_METER_KWH', {
      label: 'Site meter kWh',
      type: 'REAL',
      role: 'input',
      graphEnabled: true,
      value: 0,
      driverId: 'dds_rgb',
      driverAddress: { table: 'holding', address: 16, wordWidth: 32 },
      scale: 0.001,
    }),
  ];

  tags = applySemanticMap(tags, 'dds_rgb');

  const settings = buildSettings();
  settings.assistedLiving.ezMeter.semanticMap = defaultEzMeterSemanticMap();

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
  console.log(`  Drivers: ${drivers.length} (opta_ahu, opta_cond, dds_rgb)`);
  console.log(`  Program: ${PROJECT.programFile}`);
  console.log(`  AHU: /ct-cal I1–I4 fan CT; /ahu-env I5–I8 NTC + X1_IRAW1–2 leak analog`);
  console.log(`  Cond (one opta): /mcsa I1–I8 fan+comp CT + D1608E X1_IRAW1–4 NTC (dual unit)`);
}

main();
