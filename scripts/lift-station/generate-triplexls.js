#!/usr/bin/env node
'use strict';

/**
 * Generate TRIPLEXLS HMI composite from DUPLEXLS (3 pumps + LAG2 float).
 * Usage: node scripts/lift-station/generate-triplexls.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DUPLEX_JSON = path.join(ROOT, 'public/hmi/svg/composites/duplexls.json');
const DUPLEX_SVG = path.join(ROOT, 'public/hmi/svg/library/lift-station-faceplates/mooreview/duplexls.svg');
const OUT_JSON = path.join(ROOT, 'public/hmi/svg/composites/triplexls.json');
const OUT_SVG = path.join(ROOT, 'public/hmi/svg/library/lift-station-faceplates/mooreview/triplexls.svg');

function motor3BindingsFromPump2(defaultBindings) {
  return defaultBindings
    .filter((b) => /p2|motor2/i.test(b.elementId) || /motor2/i.test(b.tagRole || ''))
    .map((b) => {
      const out = { ...b };
      out.elementId = b.elementId.replace(/p2/g, 'p3');
      if (b.tagRole) out.tagRole = b.tagRole.replace(/motor2/g, 'motor3');
      return out;
    });
}

function buildTriplexManifest(duplex) {
  const motor3Roles = {
    motor3Run: { pick: 'tagId', tagId: 'MOTOR3_RUN', types: ['BOOL'] },
    motor3Hoa: { pick: 'tagId', tagId: 'MOTOR3_HOA', types: ['INT'] },
    motor3Starts: { pick: 'tagId', tagId: 'MOTOR3_STARTS', types: ['INT'] },
    motor3Hrs: { pick: 'tagId', tagId: 'MOTOR3_HRS', types: ['REAL'] },
    motor3Start: { pick: 'tagId', tagId: 'MOTOR3_START', types: ['BOOL'] },
    motor3Stop: { pick: 'tagId', tagId: 'MOTOR3_STOP', types: ['BOOL'] },
  };
  return {
    ...duplex,
    id: 'triplexls',
    label: 'TRIPLEXLS (triplex lift station overview)',
    preview: '/hmi/svg/library/lift-station-faceplates/mooreview/triplexls.svg',
    tagRoles: {
      ...duplex.tagRoles,
      lvlLag2: { pick: 'tagId', tagId: 'LVL_LAG2', types: ['BOOL'] },
      ...motor3Roles,
    },
    parts: duplex.parts.map((p) => ({
      ...p,
      svg: '/hmi/svg/library/lift-station-faceplates/mooreview/triplexls.svg',
    })),
    defaultBindings: [
      ...duplex.defaultBindings,
      {
        elementId: 'lamp_float_lag2',
        property: 'fill',
        tagRole: 'lvlLag2',
        onValue: '#ff8800',
        offValue: '#333333',
      },
      ...motor3BindingsFromPump2(duplex.defaultBindings),
    ],
  };
}

function shiftSvgBlock(svg, blockStart, blockEnd, dx) {
  const chunk = svg.slice(blockStart, blockEnd);
  return chunk.replace(/\bx="(\d+)"/g, (_, n) => `x="${Number(n) + dx}"`)
    .replace(/translate\((\d+)/g, (_, n) => `translate(${Number(n) + dx}`);
}

function buildTriplexSvg(duplexSvg) {
  let svg = duplexSvg
    .replace(/viewBox="0 0 1150 620"/, 'viewBox="0 0 1385 620"')
    .replace(/width="1150"/, 'width="1385"')
    .replace(/>DUPLEXLS</, '>TRIPLEXLS<')
    .replace(/<rect x="15" y="15" width="870"/, '<rect x="15" y="15" width="1105"');

  const pump2Start = svg.indexOf('<!-- ==================== PUMP MOTOR 2');
  const stationStart = svg.indexOf('<!-- ==================== STATION & STATUS');
  if (pump2Start < 0 || stationStart < 0) throw new Error('duplexls.svg layout markers missing');

  const pump2Block = svg.slice(pump2Start, stationStart);
  let pump3Block = pump2Block
    .replace(/PUMP MOTOR 2/g, 'PUMP MOTOR 3')
    .replace(/p2_/g, 'p3_')
    .replace(/Pump 2/g, 'Pump 3')
    .replace(/PUMP 2/g, 'PUMP 3')
    .replace(/x="445"/g, 'x="680"')
    .replace(/x="460"/g, 'x="695"')
    .replace(/x="525"/g, 'x="760"')
    .replace(/x="530"/g, 'x="765"')
    .replace(/x="590"/g, 'x="825"')
    .replace(/x="470"/g, 'x="705"')
    .replace(/x="487"/g, 'x="722"')
    .replace(/x="550"/g, 'x="785"')
    .replace(/x="555"/g, 'x="790"')
    .replace(/x="615"/g, 'x="850"')
    .replace(/x="630"/g, 'x="865"')
    .replace(/x="495" y="221"/g, 'x="730" y="221"');

  svg = `${svg.slice(0, stationStart)}${pump3Block}${svg.slice(stationStart)}`;
  svg = svg.replace(
    /<!-- ==================== STATION & STATUS ==================== -->[\s\S]*$/,
    (station) => station
      .replace(/\bx="680"/g, 'x="915"')
      .replace(/\bx="695"/g, 'x="930"')
      .replace(/translate\(695,/g, 'translate(930,'),
  );

  const lag2Float = `
  <g transform="translate(90, 310)">
    <circle id="lamp_float_lag2" cx="12" cy="0" r="10" fill="#333" stroke="#ff8800" stroke-width="2" />
    <line x1="-15" y1="0" x2="2" y2="0" stroke="#ff8800" stroke-width="2" />
    <text x="30" y="4" class="label">LAG2 START</text>
  </g>`;
  svg = svg.replace(
    '<g transform="translate(90, 360)">',
    `${lag2Float}\n  <g transform="translate(90, 360)">`,
  );

  return svg;
}

function main() {
  const duplex = JSON.parse(fs.readFileSync(DUPLEX_JSON, 'utf8'));
  const duplexSvg = fs.readFileSync(DUPLEX_SVG, 'utf8');
  const triplex = buildTriplexManifest(duplex);
  const triplexSvg = buildTriplexSvg(duplexSvg);
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(triplex, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_SVG, triplexSvg, 'utf8');
  console.log(`Wrote ${path.relative(ROOT, OUT_JSON)} (${triplex.defaultBindings.length} bindings)`);
  console.log(`Wrote ${path.relative(ROOT, OUT_SVG)}`);
}

main();
