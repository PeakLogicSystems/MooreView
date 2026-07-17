'use strict';

const fs = require('fs');
const path = require('path');

const FIXTURE_DIR = path.join(__dirname, '..', 'st', 'fixtures');

function altBlock(id, label, motorBase) {
  const m1 = motorBase;
  const m2 = motorBase + 1;
  return [
    {
      id,
      label,
      type: 'ALT',
      role: 'fb',
      mode: 'ALT2',
      preset: 2,
      value: 0,
      fb: {
        enabled: false,
        onlineIds: ['', '', '', ''],
        unitOutIds: ['', '', '', ''],
        leadSelIds: ['', '', '', ''],
        lagSelIds: ['', '', '', ''],
        lag2SelIds: ['', '', '', ''],
        levelInputMode: 'digital',
        levelControlEnabled: false,
        leadIndex: 0,
        lagIndex: -1,
        activeUnit: 0,
      },
    },
    { id: `SYS_RUN${id === 'ALT1' ? '' : id.replace('ALT', '')}`, label: `Run ${label}`, type: 'BOOL', role: 'memory', value: false },
    { id: `ALT_OFF${id === 'ALT1' ? '' : id.replace('ALT', '')}`, label: `Off ${label}`, type: 'BOOL', role: 'memory', value: false },
    { id: `LVL_HIGH${id === 'ALT1' ? '' : id.replace('ALT', '')}`, label: `High ${label}`, type: 'BOOL', role: 'memory', value: false },
    { id: `LVL_LAG${id === 'ALT1' ? '' : id.replace('ALT', '')}`, label: `Lag ${label}`, type: 'BOOL', role: 'memory', value: false },
    { id: `ALT_BUMP${id === 'ALT1' ? '' : id.replace('ALT', '')}`, label: `Bump ${label}`, type: 'BOOL', role: 'memory', value: false },
    { id: `MOTOR${m1}_ONLINE`, label: `Pump ${m1} online`, type: 'BOOL', role: 'memory', value: true },
    { id: `MOTOR${m2}_ONLINE`, label: `Pump ${m2} online`, type: 'BOOL', role: 'memory', value: true },
    { id: `MOTOR${m1}_RUN`, label: `Pump ${m1} run`, type: 'BOOL', role: 'memory', value: false },
    { id: `MOTOR${m2}_RUN`, label: `Pump ${m2} run`, type: 'BOOL', role: 'memory', value: false },
    { id: `LEAD_RUN${id === 'ALT1' ? '' : id.replace('ALT', '')}`, label: `Lead ${label}`, type: 'BOOL', role: 'memory', value: false },
    { id: `ALT_FAULT${id === 'ALT1' ? '' : id.replace('ALT', '')}`, label: `Fault ${label}`, type: 'BOOL', role: 'memory', value: false },
  ];
}

function tpoBlock(n) {
  const p = `TPO${n}`;
  return [
    { id: `${p}_EN`, label: `${p} enable`, type: 'BOOL', role: 'memory', value: true },
    { id: `${p}_OFFLINE`, label: `${p} offline`, type: 'BOOL', role: 'memory', value: false },
    { id: `${p}_24HR`, label: `${p} 24hr`, type: 'BOOL', role: 'memory', value: true },
    { id: `${p}_OUT`, label: `${p} output`, type: 'BOOL', role: 'memory', value: false },
    { id: `${p}_GAP`, label: `${p} gap`, type: 'BOOL', role: 'memory', value: false },
    { id: `${p}_STA`, label: `${p} status`, type: 'INT', role: 'memory', value: 0, wordWidth: 16 },
    { id: `${p}_TOD`, label: `${p} TOD`, type: 'INT', role: 'memory', value: 0, wordWidth: 16 },
    { id: `${p}_TOD_STEP`, label: `${p} step`, type: 'INT', role: 'memory', value: 1, wordWidth: 16 },
    { id: `${p}_START`, label: `${p} start`, type: 'INT', role: 'memory', value: 0, wordWidth: 16 },
    { id: `${p}_END`, label: `${p} end`, type: 'INT', role: 'memory', value: 1440, wordWidth: 16 },
    { id: `${p}_ON_MIN`, label: `${p} on min`, type: 'INT', role: 'memory', value: 30, wordWidth: 16 },
    { id: `${p}_OFF_MIN`, label: `${p} off min`, type: 'INT', role: 'memory', value: 120, wordWidth: 16 },
    { id: `${p}_PULSE_REM`, label: `${p} pulse rem`, type: 'INT', role: 'memory', value: 0, wordWidth: 16 },
  ];
}

function buildAtuTags(units) {
  const tags = [];
  for (let u = 1; u <= units; u += 1) {
    const altId = `ALT${u}`;
    tags.push(...altBlock(altId, `duplex ${u}`, (u - 1) * 2 + 1));
    tags.push(...tpoBlock(u));
  }
  return tags;
}

function writeFixture(name, units) {
  const out = path.join(FIXTURE_DIR, name);
  fs.writeFileSync(out, `${JSON.stringify(buildAtuTags(units), null, 2)}\n`);
  console.log('wrote', out);
}

if (require.main === module) {
  writeFixture('tags.dual_atu.json', 2);
  writeFixture('tags.quad_atu.json', 4);
}

module.exports = { buildAtuTags, altBlock, tpoBlock };
