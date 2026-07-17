'use strict';

const fs = require('fs');
const path = require('path');

const est = path.join(__dirname, '../views/dashboard.ejs');
const cloud = path.join(__dirname, '../../mooreview-cloud/views/dashboard.ejs');

let text = fs.readFileSync(est, 'utf8');
if (text.includes('data-popup="cameras"')) {
  console.log('Cameras popup already present');
  process.exit(0);
}

const cloudLines = fs.readFileSync(cloud, 'utf8').split(/\r?\n/);
const block = `${cloudLines.slice(338, 593).join('\n')}\n\n`;
const marker = '  <div class="app-popup view-hidden" data-popup="hw-wizard"';
if (!text.includes(marker)) {
  console.error('hw-wizard marker not found');
  process.exit(1);
}
text = text.replace(marker, block + marker);
fs.writeFileSync(est, text, 'utf8');
console.log('Inserted cameras popup');
