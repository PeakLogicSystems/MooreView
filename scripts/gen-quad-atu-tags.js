'use strict';
const fs = require('fs');
const path = require('path');
const altFb = (id, label) => ({
  id, label, type: 'ALT', role: 'fb', mode: 'ALT2', preset: 2, value: 0,
  fb: { enabled: false, onlineIds: ['', '', '', ''], unitOutIds: ['', '', '', ''], leadSelIds: ['', '', '', ''], lagSelIds: ['', '', '', ''], lag2SelIds: ['', '', '', ''], levelInputMode: 'digital', levelControlEnabled: false, leadIndex: 0, lagIndex: -1, activeUnit: 0 },
});
const tpoBlock = (n) => {
  const p = `TPO${n}`;
  return [
    { id: `${p}_EN`, label: `${p} enable`, type: 'BOOL', role: 'memory', value: false },
    { id: `${p}_OFFLINE`, label: `${p} offline`, type: 'BOOL', role: 'memory', value: false },
    { id: `${p}_24HR`, label: `${p} 24hr`, type: 'BOOL', role: 'memory', value: true },
    { id: `${p}_OUT`, label: `${p} out`, type: 'BOOL', role: 'memory', value: false },
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
};
const sfx = (n) => (n === 1 ? '' : String(n));
const tags = [];
for (let u = 1; u <= 4; u++) {
  tags.push(altFb(`ALT${u}`, `ATU-${u} alternator`));
}
for (let u = 1; u <= 4; u++) {
  const s = sfx(u);
  tags.push({ id: `ALT_OFF${s}`, label: `ATU-${u} off`, type: 'BOOL', role: 'memory', value: false });
  tags.push({ id: `LVL_HIGH${s}`, label: `ATU-${u} high`, type: 'BOOL', role: 'input', value: false });
  tags.push({ id: `LVL_LAG${s}`, label: `ATU-${u} lag`, type: 'BOOL', role: 'input', value: false });
  tags.push({ id: `ALT_BUMP${s}`, label: `ATU-${u} rotate`, type: 'BOOL', role: 'memory', value: false });
  tags.push({ id: `LEAD_RUN${s}`, label: `ATU-${u} lead`, type: 'BOOL', role: 'memory', value: false });
  tags.push({ id: `ALT_FAULT${s}`, label: `ATU-${u} fault`, type: 'BOOL', role: 'memory', value: false });
}
for (let m = 1; m <= 8; m++) {
  tags.push({ id: `MOTOR${m}_ONLINE`, label: `Pump ${m} online`, type: 'BOOL', role: 'input', value: true });
  tags.push({ id: `MOTOR${m}_RUN`, label: `Pump ${m} run`, type: 'BOOL', role: 'output', value: false });
}
for (let n = 1; n <= 4; n++) tags.push(...tpoBlock(n));
// fix ALT_OFF id (empty suffix for unit 1)
const off = tags.find((t) => t.id === 'ALT_OFF');
if (off) off.id = 'ALT_OFF';
const bump = tags.find((t) => t.id === 'ALT_BUMP');
// ALT_OFF1 was created - fix unit 1 naming to match ST
for (const t of tags) {
  if (t.id === 'ALT_OFF1') t.id = 'ALT_OFF';
  if (t.id === 'LVL_HIGH1') t.id = 'LVL_HIGH';
  if (t.id === 'LVL_LAG1') t.id = 'LVL_LAG';
  if (t.id === 'ALT_BUMP1') t.id = 'ALT_BUMP';
  if (t.id === 'LEAD_RUN1') t.id = 'LEAD_RUN';
  if (t.id === 'ALT_FAULT1') t.id = 'ALT_FAULT';
}
const out = path.join(__dirname, '..', 'st', 'fixtures', 'tags.quad_atu.json');
fs.writeFileSync(out, JSON.stringify(tags, null, 2));
console.log('wrote', out, tags.length, 'tags');
