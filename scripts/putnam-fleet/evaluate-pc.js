#!/usr/bin/env node
'use strict';

/**
 * Prepare Putnam County fleet for MooreVIEW PC evaluation.
 *
 * Usage:
 *   node scripts/putnam-fleet/evaluate-pc.js
 *   node scripts/putnam-fleet/evaluate-pc.js --sim
 */

const { spawn } = require('child_process');
const path = require('path');
const { PLANT, LIFT_STATIONS } = require('./fleet-data');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = process.env.PORT || process.env.MOOREVIEW_PORT || 3090;

function runNode(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: false,
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`))));
  });
}

function printGuide() {
  console.log('');
  console.log('=== Putnam County Utilities — MooreVIEW evaluation ===');
  console.log('');
  console.log('Cloud build (Putnam = MLE plant only):');
  console.log('  1. cp deploy/cloud/.env.putnam.example .env  (set MONGODB_URI, MOSQUITTO_PASS)');
  console.log('  2. npm run putnam-fleet:seed-cloud');
  console.log('  3. npm run start:cloud');
  console.log('  4. Sign in as org putnam-county-utilities → Project → putnam-mle-plant');
  console.log('');
  console.log('Projects (Project → Open project…):');
  console.log('  • putnam-mle-plant     — Putnam MLE WWTP (cloud Studio + IOT-LINK edge via cloudRemote)');
  console.log(`      3D map: http://127.0.0.1:${PORT}/samples/mle-wastewater-ortho-3d.html`);
  console.log('  • putnam-county-cloud  — optional fleet rollup (6 lift stations; not deployed for Putnam)');
  console.log(`      3D map: http://127.0.0.1:${PORT}/samples/putnam-county-fleet-3d.html`);
  console.log('');
  console.log(`Fleet: ${LIFT_STATIONS.length} lift stations + 1 MLE plant (${PLANT.gatewayId})`);
  console.log('');
  console.log('Quick start (three terminals):');
  console.log('  1. npm run mqtt:start');
  console.log('  2. npm run start:cloud   (or npm start on appliance)');
  console.log('  3. npm run putnam-fleet:sim');
  console.log('');
  console.log('Then in the browser:');
  console.log(`  • http://127.0.0.1:${PORT} → Project → putnam-mle-plant`);
  console.log('  • System setup → Enable MQTT Parc hub → broker mqtt://127.0.0.1:1883');
  console.log('  • Drivers → for each mqtt_parc driver: Sync tags from device');
  console.log('  • HMI home screen opens the Putnam fleet 3D map with live status');
  console.log('');
  console.log('Sim scenarios:');
  console.log('  npm run putnam-fleet:sim');
  console.log('  npm run putnam-fleet:sim -- --alarm');
  console.log('  npm run putnam-fleet:sim -- --alarm-device mv_pcu_mosquito_01');
  console.log('  npm run putnam-fleet:sim -- --scenario high_level');
  console.log('');
  console.log('Manifest: st/fixtures/fleet_putnam_county.json');
  console.log('CSV import: st/fixtures/fleet_import_putnam.csv');
  console.log('');
}

async function main() {
  const sim = process.argv.includes('--sim');
  await runNode(path.join(__dirname, 'generate-artifacts.js'));
  printGuide();
  if (sim) {
    console.log('Starting Putnam fleet telemetry sim…');
    await runNode(path.join(__dirname, 'publish-eval-telemetry.js'), ['--alarm']);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
