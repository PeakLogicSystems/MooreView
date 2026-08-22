#!/usr/bin/env node
'use strict';

/**
 * Generate a standalone facility power-quality .est project using EZ Meter DDS-RGB Modbus.
 * Usage: node scripts/facilities/generate-ezmeter-pq-est.js [--out path/to/project.est.json]
 */

const fs = require('fs');
const path = require('path');
const { buildFromPreset } = require('../../src/devices/devicePresets');
const {
  buildEzMeterPqDerivedTags,
  defaultEzMeterSemanticMap,
  EZMETER_DRIVER_ID,
} = require('../../src/facilities/ezmeterPq');
const { applySemanticMap } = require('../assisted-living/ezmeter-map');

const ROOT = path.join(__dirname, '..', '..');
const OUT_DEFAULT = path.join(ROOT, 'st', 'fixtures', 'projects.ezmeter-facility-pq.json');
const PQ_ST = 'logic/ezmeter_facility_pq.st';

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

function main() {
  const { out } = parseArgs();
  const { driver, tags: meterTags } = buildFromPreset('ezmeter_dds_rgb_2025', {
    serialPort: process.env.MOOREVIEW_MODBUS_PORT || 'COM3',
    slaveId: Number(process.env.EZMETER_SLAVE_ID) || 1,
  });

  const pqTags = buildEzMeterPqDerivedTags();
  const mechSummary = [
    {
      id: 'MECH_METER_KWH',
      label: 'Site electric meter kWh total (EZ Meter)',
      type: 'REAL',
      role: 'input',
      graphEnabled: true,
      value: 0,
    },
    {
      id: 'MECH_METER_KWH_EXP',
      label: 'Site electric meter kWh export (EZ Meter)',
      type: 'REAL',
      role: 'input',
      graphEnabled: true,
      value: 0,
    },
    {
      id: 'ALF_MECH_ALM',
      label: 'Mechanical area alarm',
      type: 'BOOL',
      role: 'memory',
      value: false,
      alarmsEnabled: true,
      alarmCondition: 'on',
    },
  ];

  let tags = [...meterTags, ...pqTags, ...mechSummary];
  tags = applySemanticMap(tags, driver.id);

  const est = {
    format: 'mooreview-est',
    version: 1,
    savedAt: new Date().toISOString(),
    project: { name: 'ezmeter-facility-pq' },
    tags,
    drivers: [driver],
    program: PQ_ST,
    activeProgram: PQ_ST,
    settings: {
      project: { name: 'ezmeter-facility-pq' },
      scanMs: 1000,
      activeProgram: PQ_ST,
      remoteExecution: false,
      autoStartRuntime: false,
      assistedLiving: {
        facility: { driver: 'ezmeter' },
        ezMeter: {
          enabled: true,
          driverId: EZMETER_DRIVER_ID,
          semanticMap: defaultEzMeterSemanticMap(),
          nominalVoltage: 120,
          undervoltV: 108,
          overvoltV: 132,
          lowPf: 0.85,
          freqMinHz: 59.5,
          freqMaxHz: 60.5,
          vImbalancePct: 5,
          loadedCurrentA: 1,
        },
      },
    },
  };

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(est, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${out}`);
  console.log(`  Modbus tags: ${meterTags.length} (${driver.id} on ${driver.serialPort})`);
  console.log(`  PQ derived tags: ${pqTags.length}`);
  console.log(`  Semantic bindings: ${defaultEzMeterSemanticMap().length}`);
}

main();
