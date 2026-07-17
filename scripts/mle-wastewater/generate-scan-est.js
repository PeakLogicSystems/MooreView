'use strict';

/** Create MooreVIEW project with s::can recirculating analyzer tags. */
const fs = require('fs');
const path = require('path');
const { buildScanTags, getProjectConfig } = require('./mle-scan-tags');

const ROOT = path.join(__dirname, '../..');

function writeEst(projectId, dstName, progHeader) {
  const CFG = getProjectConfig(projectId);
  const SRC = path.join(ROOT, 'data/projects/mle-wastewater.est.json');
  const DST = path.join(ROOT, 'data/projects', dstName);
  const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  data.savedAt = new Date().toISOString();
  data.project = { name: CFG.mooreviewProject || dstName.replace('.est.json', '') };
  if (data.settings?.project) data.settings.project.name = data.project.name;

  const newTags = buildScanTags(CFG);
  const existing = new Set(data.tags.map((t) => t.id));
  for (const t of newTags) {
    if (!existing.has(t.id)) data.tags.push(t);
  }

  if (data.program && !data.program.startsWith(progHeader.slice(0, 20))) {
    data.program = progHeader + data.program;
  }

  fs.writeFileSync(DST, JSON.stringify(data, null, 2));
  console.log(`Wrote ${DST} (${data.tags.length} tags, +${newTags.length} scan tags)`);
}

const id = process.argv[2] || 'mle-poc-50gpd';
const map = {
  'mle-poc-50gpd': ['mle-poc-50gpd.est.json', '(* MLE POC — 50 GPD · s::can recirc loop · AI-ready *)\r\n'],
  'mle-poc-5gpm': ['mle-poc-50gpd.est.json', '(* MLE POC — 50 GPD · s::can recirc loop · AI-ready *)\r\n'],
  'pasco-rv-120kgpd': ['pasco-rv-mle.est.json', '(* Pasco RV — 120K GPD · s::can 6-port loop · AI-ready *)\r\n'],
  'mle-2000gpd': ['mle-wastewater.est.json', '(* MLE 2K GPD · s::can recirc loop · AI-ready *)\r\n'],
};
const [file, header] = map[id] || map['mle-poc-50gpd'];
writeEst(id, file, header);
