#!/usr/bin/env node
'use strict';

/**
 * Generate Nexcomm inbound device templates from Nexus Cloud CSV exports.
 *
 * Source: st/fixtures/nexcomm-csv/*.csv  (copied from D:\nexcomm csv)
 * Output:
 *   st/fixtures/nexcomm-inbound/<product>.alignment.json
 *   src/devices/templates/nexcomm_<product>.json
 *
 * Usage: node scripts/nexcomm-csv/generate-inbound-templates.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CSV_DIR = path.join(ROOT, 'st', 'fixtures', 'nexcomm-csv');
const ALIGN_DIR = path.join(ROOT, 'st', 'fixtures', 'nexcomm-inbound');
const TPL_DIR = path.join(ROOT, 'src', 'devices', 'templates');

const PRODUCTS = {
  'nexcomm-lpl-lift-station': {
    id: 'nexcomm_lpl_lift_station',
    label: 'Nexcomm LiftPoint Light — lift station (CSV-matched)',
    model: 'LiftPoint Light lift station',
    liftProfileHint: 'liftpoint_light',
    stationType: 'dual_duplex',
    /** Hand-matched to liftpoint_light — do not overwrite with slug mqttJson */
    skipGenerate: true,
  },
  'nexcomm-lpl-res-atu': {
    id: 'nexcomm_lpl_res_atu',
    label: 'Nexcomm LiftPoint Light — residential dual ATU',
    model: 'LiftPoint Light residential ATU',
    stationType: 'dual_atu',
  },
  'nexcomm-lp-com-dual-atu': {
    id: 'nexcomm_lp_com_dual_atu',
    label: 'Nexcomm LiftPoint — commercial dual ATU',
    model: 'LiftPoint commercial dual ATU',
    stationType: 'dual_atu',
  },
  'nexcomm-com-lp-single-atu': {
    id: 'nexcomm_com_lp_single_atu',
    label: 'Nexcomm LiftPoint — commercial single ATU',
    model: 'LiftPoint commercial single ATU',
    stationType: 'single_atu',
  },
  'nexcomm-tcu-duplex': {
    id: 'nexcomm_tcu_duplex',
    label: 'Nexcomm TCU — duplex lift',
    model: 'TCU duplex',
    stationType: 'dual_duplex',
  },
  'nexcomm-tcu-dual-duplex': {
    id: 'nexcomm_tcu_dual_duplex',
    label: 'Nexcomm TCU — dual duplex',
    model: 'TCU dual duplex',
    stationType: 'dual_duplex',
  },
  'nexcomm-tcu-dual-atu': {
    id: 'nexcomm_tcu_dual_atu',
    label: 'Nexcomm TCU — dual ATU (register map)',
    model: 'TCU dual ATU',
    stationType: 'dual_atu',
  },
  'nexcomm-epi-agitator': {
    id: 'nexcomm_epi_agitator',
    label: 'Nexcomm EPI — agitator motors',
    model: 'EPI agitator',
    stationType: 'agitator',
  },
};

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === ',' && !inQ) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function slugify(label) {
  return String(label)
    .replace(/\s*\[[^\]]*\]\s*/g, ' ')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .replace(/_+/g, '_')
    .toUpperCase()
    .slice(0, 48) || 'FIELD';
}

function parseHeaderMeta(header) {
  const m = header.match(/^(.*?)\s*\[(\d+)\]\s*$/);
  if (m) {
    return { label: m[1].trim(), reg: Number(m[2]), raw: header };
  }
  return { label: header.trim(), reg: null, raw: header };
}

function inferType(samples) {
  const vals = samples.map((s) => String(s ?? '').trim()).filter((s) => s !== '');
  if (!vals.length) return 'REAL';
  const boolish = vals.every((v) => /^(0|1|on|off|true|false)$/i.test(v));
  if (boolish) return 'BOOL';
  const ints = vals.every((v) => /^-?\d+$/.test(v));
  if (ints) return 'INT';
  return 'REAL';
}

function uniqueId(base, used) {
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}_${n++}`;
  }
  used.add(id);
  return id;
}

function readProduct(csvPath) {
  const text = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 1) throw new Error(`empty csv: ${csvPath}`);
  const headers = parseCsvLine(lines[0]);
  const sampleRows = lines.slice(1, Math.min(lines.length, 6)).map(parseCsvLine);
  const used = new Set();
  const fields = [];

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!h || /^datelogged$/i.test(h)) continue;
    const meta = parseHeaderMeta(h);
    const samples = sampleRows.map((r) => r[i]);
    const type = inferType(samples);
    const id = uniqueId(slugify(meta.label), used);
    const jsonKey = id.toLowerCase();
    fields.push({
      id,
      label: meta.label,
      csvColumn: meta.raw,
      nexus: meta.label,
      reg: meta.reg,
      type,
      payloadTemplate: meta.reg && meta.reg >= 9000 && meta.reg < 9600
        ? null // filled below for EPI-style; otherwise json slug
        : `json:${jsonKey}`,
      sample: samples.find((s) => String(s ?? '').trim() !== '') ?? null,
    });
  }

  // EPI-style regs (9010–9530): use inputs/outputs index path when possible
  for (const f of fields) {
    if (f.reg != null && f.reg >= 9010 && f.reg <= 9200) {
      const idx = (f.reg - 9010) / 10;
      if (Number.isInteger(idx) && idx >= 0) {
        f.payloadTemplate = `json:inputs.${idx}.${f.reg}`;
      }
    } else if (f.reg != null && f.reg >= 9410 && f.reg <= 9530) {
      const idx = (f.reg - 9410) / 10;
      if (Number.isInteger(idx) && idx >= 0) {
        f.payloadTemplate = `json:outputs.${idx}.${f.reg}`;
      }
    } else if (f.reg != null && !f.payloadTemplate) {
      f.payloadTemplate = `json:reg.${f.reg}`;
    } else if (f.reg != null && f.payloadTemplate?.startsWith('json:') && f.reg < 9000) {
      f.payloadTemplate = `json:reg.${f.reg}`;
    }
  }

  return { headers, fields, rowCount: Math.max(0, lines.length - 1) };
}

function buildTemplate(meta, productKey, data) {
  const mqttFields = data.fields.map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    payloadTemplate: f.payloadTemplate,
    comment: f.reg != null
      ? `Nexus CSV: ${f.csvColumn} (reg ${f.reg})`
      : `Nexus CSV: ${f.csvColumn}`,
  }));

  return {
    id: meta.id,
    label: meta.label,
    vendor: 'Nexcomm',
    model: meta.model,
    transport: 'mqtt',
    sharedBus: false,
    driverId: meta.id.replace(/^nexcomm_/, 'nx_'),
    stationType: meta.stationType || undefined,
    defaults: {
      brokerUrl: 'mqtts://mqtt.mooreview.io:8883',
      serialNum: 'REPLACE_SERIAL',
      clientId: 'mooreview',
      subscribeQos: 0,
      publishQos: 0,
    },
    driver: {
      enabled: true,
      timeoutMs: 10000,
    },
    tags: {
      mqttJson: {
        serialFromDefaults: true,
        topicTemplate: '/devices/{serial}/messages/events/',
        fields: mqttFields,
      },
    },
    notes: [
      `Inbound tag map generated from st/fixtures/nexcomm-csv/${productKey}.csv (${data.rowCount} sample rows).`,
      'Set serialNum to normalized Nexcomm serial (no hyphens). Broker defaults to mqtts://mqtt.mooreview.io:8883.',
      'payloadTemplate json: keys are slug placeholders — align to live MQTT JSON or EPI register paths as needed.',
      meta.liftProfileHint
        ? `Related lift_station_epi profile hint: ${meta.liftProfileHint}.`
        : '',
      `Alignment table: st/fixtures/nexcomm-inbound/${productKey}.alignment.json`,
    ].filter(Boolean).join(' '),
  };
}

function main() {
  if (!fs.existsSync(CSV_DIR)) {
    console.error(`Missing ${CSV_DIR} — copy CSVs from D:\\nexcomm csv first`);
    process.exit(1);
  }
  fs.mkdirSync(ALIGN_DIR, { recursive: true });

  const summary = [];
  for (const [productKey, meta] of Object.entries(PRODUCTS)) {
    const csvPath = path.join(CSV_DIR, `${productKey}.csv`);
    if (!fs.existsSync(csvPath)) {
      console.warn(`skip missing ${csvPath}`);
      continue;
    }
    if (meta.skipGenerate) {
      console.log(`SKIP ${meta.id} (hand-matched — see nexcomm-inbound/${productKey}.alignment.json)`);
      summary.push({ productKey, templateId: meta.id, fields: 'matched', rows: '—' });
      continue;
    }
    const data = readProduct(csvPath);
    const alignment = {
      product: productKey,
      templateId: meta.id,
      sourceCsv: `st/fixtures/nexcomm-csv/${productKey}.csv`,
      rowCount: data.rowCount,
      fieldCount: data.fields.length,
      fields: data.fields,
    };
    const alignPath = path.join(ALIGN_DIR, `${productKey}.alignment.json`);
    fs.writeFileSync(alignPath, `${JSON.stringify(alignment, null, 2)}\n`);

    const tpl = buildTemplate(meta, productKey, data);
    const tplPath = path.join(TPL_DIR, `${meta.id}.json`);
    fs.writeFileSync(tplPath, `${JSON.stringify(tpl, null, 2)}\n`);

    summary.push({ productKey, templateId: meta.id, fields: data.fields.length, rows: data.rowCount });
    console.log(`OK  ${meta.id}  (${data.fields.length} tags, ${data.rowCount} rows)`);
  }

  const readme = path.join(ALIGN_DIR, 'README.md');
  fs.writeFileSync(readme, `# Nexcomm inbound alignments

Generated from \`st/fixtures/nexcomm-csv/\` (USB \`D:\\\\nexcomm csv\`).

| Product CSV | Template id | Tags |
|-------------|-------------|------|
${summary.map((s) => `| \`${s.productKey}.csv\` | \`${s.templateId}\` | ${s.fields} |`).join('\n')}

Regenerate:

\`\`\`bash
node scripts/nexcomm-csv/generate-inbound-templates.js
\`\`\`

Apply under **Drivers → Device template**. Set \`serialNum\` (normalized) and Mosquitto user/pass for \`mqtts://mqtt.mooreview.io:8883\`.
`);

  console.log(`\nWrote ${summary.length} templates + alignment maps`);
}

main();
