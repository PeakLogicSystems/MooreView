'use strict';

const fs = require('fs');
const path = require('path');

const estDash = path.join(__dirname, '../views/dashboard.ejs');
const scadaPath = path.join(__dirname, '../../mooreview-cloud/views/scada-dashboard.ejs');

const est = fs.readFileSync(estDash, 'utf8');
const start = est.indexOf('  <!-- Cameras popup -->');
const end = est.indexOf('  <div class="app-popup view-hidden" data-popup="hw-wizard"');
if (start < 0 || end < 0) {
  console.error('Cameras block markers not found in dashboard.ejs');
  process.exit(1);
}
const block = est.slice(start, end).trimEnd();

let scada = fs.readFileSync(scadaPath, 'utf8');
if (scada.includes('data-popup="cameras"')) {
  console.log('Cameras popup already present in scada-dashboard.ejs');
  process.exit(0);
}
const marker = '  <div class="app-popup view-hidden program-shell-stub" data-popup="program"';
if (!scada.includes(marker)) {
  console.error('Insertion marker not found in scada-dashboard.ejs');
  process.exit(1);
}
scada = scada.replace(marker, `${block}\n\n${marker}`);
fs.writeFileSync(scadaPath, scada, 'utf8');
console.log('Inserted cameras popup into scada-dashboard.ejs');
