'use strict';

/**
 * Generate docs/projects/LIFT-STATION-OPTA-IO-MAP.md from opta-io-map-data.js
 * Usage: node scripts/lift-station/generate-io-map-md.js
 */

const fs = require('fs');
const path = require('path');
const { allVariants, configMatrixRows } = require('./opta-io-map-data');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'docs', 'projects', 'LIFT-STATION-OPTA-IO-MAP.md');

function table(headers, rows) {
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ];
  return lines.join('\n');
}

function renderVariant(map) {
  const chunks = [
    `## ${map.project}`,
    '',
    `| Field | Value |`,
    `|-------|-------|`,
    `| ST program | \`${map.program}\` |`,
    `| Cloud template | \`${map.template}\` |`,
    `| Pumps | ${map.pumps} |`,
    `| Floats | ${map.floats} |`,
    `| Alternator | ${map.alternator} |`,
    `| EZ Meter | ${map.ezmeter ? 'Yes' : 'No'} |`,
    map.flashFlags.length ? `| Flash flags | \`${map.flashFlags.join(' ')}\` |` : '',
    '',
    '### Hardware',
    '',
    ...map.hardware.map((h) => `- ${h}`),
    '',
    '### Wiring notes',
    '',
    ...map.wiringNotes.map((n) => `- ${n}`),
    '',
  ].filter(Boolean);

  for (const sec of map.sections) {
    chunks.push(`### ${sec.title}`, '');
    chunks.push(table(
      ['Terminal / tag', 'Point', 'Type', 'Channel', 'Logic tag', 'Description'],
      sec.rows,
    ));
    chunks.push('');
  }
  return chunks.join('\n');
}

function main() {
  const matrix = configMatrixRows();
  const md = [
    '# MooreVIEW Lift Station — Opta Physical I/O Map',
    '',
    '**Document version:** 1.0',
    '**Generated:** Run `npm run generate:lift-station-io-map-md` for build date',
    '**PDF:** `npm run build:lift-station-io-map-pdf`',
    '',
    'Unified physical I/O reference for **simplex** (Opta base + 2 CT), **duplex**, and **triplex** lift-station panels.',
    '',
    '---',
    '',
    '## Configuration matrix',
    '',
    table(
      ['Configuration', 'Pumps', 'Floats', 'ALT', 'ST program', 'Template', 'EZ Meter', 'R4 alarm'],
      matrix.map((r) => [
        r.config,
        String(r.pumps),
        String(r.floats),
        r.alternator,
        `\`${r.program}\``,
        `\`${r.template}\``,
        r.ezmeter,
        r.r4Alarm,
      ]),
    ),
    '',
    '### Shared conventions',
    '',
    '- **R4:** station alarm relay on **every** configuration (horn, strobe, or SCADA contact).',
    '- **Simplex:** Opta **base unit only** — 2 CT on I1/I2 (AI1/AI2); floats on I3–I8. No expansion.',
    '- **Duplex / triplex:** Opta base I1–I6 analog CT; D1608E slot 1 for floats and faults.',
    '- **Expansion slot 2 (A0602):** 8× 2-wire PT100 RTD on X2_AI1–X2_AI8 when RTD enabled on Opta /setup — optional.',
    '- **Control-panel UPS (generator panels):** AC-loss dry contact on **X1_I16** → `POWER_FAIL` (not facility/main power).',
    '- **Expansion DIs:** +24 V active (ON when float wet or contact made).',
    '',
    '---',
    '',
    ...allVariants().flatMap((v, i) => [
      renderVariant(v),
      i < allVariants().length - 1 ? '---\n' : '',
    ]),
    '## Related documents',
    '',
    '- [LIFT-STATION-PARC-CLOUD-BUILD.md](./LIFT-STATION-PARC-CLOUD-BUILD.md) — panel build and cloud commissioning',
    '- `npm run build:lift-station-io-map-pdf` → `MooreVIEW-Lift-Station-Opta-IO-Map.pdf`',
    '',
    '---',
    '',
    '*MooreVIEW · Lift Station Opta I/O Map v1.0*',
    '',
  ].join('\n');

  const generated = new Date().toISOString().slice(0, 10);
  const out = md.replace(
    /Run `npm run generate:lift-station-io-map-md` for build date/,
    generated,
  );
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, out, 'utf8');
  console.log(`Wrote ${OUT}`);
}

main();
