#!/usr/bin/env node
'use strict';

/**
 * Prepare ATU cloud fleet sites for MooreVIEW PC evaluation.
 *
 * Usage:
 *   node scripts/atu-fleet/evaluate-pc.js
 *   node scripts/atu-fleet/evaluate-pc.js --sim
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { SITE_PROFILES, profilesCatalog } = require('./fleet-data');

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
  const cat = profilesCatalog();
  console.log('');
  console.log('=== ATU sites — MooreVIEW PC evaluation ===');
  console.log('');
  console.log('Projects (open from Project library after npm run start:cloud):');
  for (const [key, p] of Object.entries(SITE_PROFILES)) {
    console.log(`  • ${p.cloudProject}  — ${p.name} (${p.designGpd} GPD, ${p.devices.length} devices)`);
    console.log(`      3D map: http://127.0.0.1:${PORT}${p.facility3dUrl}`);
  }
  console.log('');
  console.log('Quick start (three terminals):');
  console.log('  1. npm run mqtt:start');
  console.log('  2. npm run start:cloud');
  console.log('  3. npm run atu-fleet:sim -- --profile commercial');
  console.log('');
  console.log('Then in the browser:');
  console.log(`  • http://127.0.0.1:${PORT} → Project → atu-cloud-commercial (or atu-cloud-residential)`);
  console.log('  • System setup → Enable MQTT Parc hub → broker mqtt://127.0.0.1:1883');
  console.log('  • Drivers → for each mqtt_parc driver: Sync tags from device');
  console.log('  • HMI home screen opens 3D fleet map with live alarm colors');
  console.log('');
  console.log('Sim scenarios:');
  console.log('  npm run atu-fleet:sim -- --profile residential');
  console.log('  npm run atu-fleet:sim -- --profile commercial --alarm');
  console.log('  npm run atu-fleet:sim -- --profile commercial --alarm-device mv_atu_harbor_q2');
  console.log('  npm run atu-fleet:sim -- --profile commercial --scenario tpo_on');
  console.log('');
  console.log('Catalog: st/fixtures/fleet_atu_profiles.json');
  console.log(`Profiles: ${Object.keys(cat.profiles).join(', ')}`);
  console.log('');
  const envExample = path.join(ROOT, 'deploy', 'pc', '.env.atu-eval.example');
  if (fs.existsSync(envExample)) {
    console.log(`Optional PC env: copy ${path.relative(ROOT, envExample)} → .env`);
  }
  console.log('');
}

async function main() {
  const sim = process.argv.includes('--sim');
  const profile = process.argv.includes('--profile')
    ? process.argv[process.argv.indexOf('--profile') + 1]
    : 'commercial';

  await runNode(path.join(__dirname, 'generate-artifacts.js'));
  printGuide();

  if (sim) {
    console.log(`Starting telemetry sim (profile=${profile})…`);
    await runNode(path.join(__dirname, 'publish-eval-telemetry.js'), ['--profile', profile, '--alarm']);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
