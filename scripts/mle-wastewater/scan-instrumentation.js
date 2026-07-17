'use strict';

/**
 * s::can recirculating optical analyzer package — per-phase sample ports and MooreVIEW tags.
 * Vendor: s::can (spectro::lyser, pH::lyser, con::sole, sam::spector sequencing).
 */

const SCAN_VENDOR = 's::can';

function singleTrainPorts(cfg) {
  return [
    {
      port: 1,
      valve: 'SV-101',
      phase: 'Influent',
      prefix: 'INF',
      params: ['BOD', 'COD', 'TSS', 'NH3', 'pH', 'SAC254'],
      notes: 'Carbon load · C:N ratio · shock detection',
    },
    {
      port: 2,
      valve: 'SV-102',
      phase: 'Pre-anoxic',
      prefix: 'ANOX',
      params: ['NO3', 'ORP', 'pH', 'TSS', 'COD'],
      notes: 'Denitrification · MLSS · residual carbon',
    },
    {
      port: 3,
      valve: 'SV-103',
      phase: 'IR stream',
      prefix: 'IR',
      params: ['NO3', 'pH'],
      notes: 'IR trim · nitrate in recycle',
    },
    {
      port: 4,
      valve: 'SV-104',
      phase: 'Aerobic outlet',
      prefix: 'AER',
      params: ['NH3', 'pH', 'TSS'],
      notes: 'Nitrification · plus dedicated AER_DO in basin',
    },
    {
      port: 5,
      valve: 'SV-105',
      phase: cfg?.layout === 'poc-tote' ? 'T-210 final effluent' : 'Final effluent',
      prefix: 'EFF',
      params: ['BOD', 'NO3', 'NH3', 'TSS', 'pH'],
      notes: cfg?.layout === 'poc-tote'
        ? 'Permit point · T-210 low-profile tank after IBC clarifier'
        : 'Permit compliance · IR PID feedback',
    },
  ];
}

function dualTrainPorts() {
  return [
    {
      port: 1,
      valve: 'SV-101',
      phase: 'Influent',
      prefix: 'INF',
      params: ['BOD', 'COD', 'TSS', 'NH3', 'pH', 'SAC254'],
      notes: 'Plant influent after EQ',
    },
    {
      port: 2,
      valve: 'SV-102',
      phase: 'Train 1 anoxic',
      prefix: 'T1_ANOX',
      params: ['NO3', 'ORP', 'pH', 'TSS', 'COD'],
      notes: 'Train 1 denitrification',
    },
    {
      port: 3,
      valve: 'SV-103',
      phase: 'Train 2 anoxic',
      prefix: 'T2_ANOX',
      params: ['NO3', 'ORP', 'pH', 'TSS', 'COD'],
      notes: 'Train 2 denitrification',
    },
    {
      port: 4,
      valve: 'SV-104',
      phase: 'IR common header',
      prefix: 'IR',
      params: ['NO3', 'pH'],
      notes: 'Shared IR sample per operating train',
    },
    {
      port: 5,
      valve: 'SV-105',
      phase: 'Aerobic blend',
      prefix: 'AER',
      params: ['NH3', 'pH', 'TSS'],
      notes: 'Combined aerobic outlet · AER_DO per train in basin',
    },
    {
      port: 6,
      valve: 'SV-106',
      phase: 'Final effluent',
      prefix: 'EFF',
      params: ['BOD', 'NO3', 'NH3', 'TSS', 'pH'],
      notes: 'FDEP permit point',
    },
  ];
}

function getScanPorts(cfg) {
  return cfg.layout === 'dual-125k' ? dualTrainPorts() : singleTrainPorts(cfg);
}

function tagId(prefix, param) {
  const map = { SAC254: 'SAC254', NH3: 'NH3', NO3: 'NO3', BOD: 'BOD', COD: 'COD', TSS: 'TSS', pH: 'PH', ORP: 'ORP' };
  return `${prefix}_${map[param] || param}`;
}

function getAllScanTags(cfg) {
  const tags = new Set([
    'SCAN_RUN',
    'SCAN_FAULT',
    'SCAN_ACTIVE_PORT',
    'SCAN_DWELL_MIN',
    'AER_DO',
    'AI_IR_SP',
    'AI_WAS_SP',
    'AI_DO_SP',
    'AI_AUTO',
    'AI_CARBON_LIM',
  ]);
  for (const p of getScanPorts(cfg)) {
    for (const param of p.params) tags.add(tagId(p.prefix, param));
  }
  return [...tags];
}

function getMeasurementTableRows(cfg) {
  const rows = [];
  for (const p of getScanPorts(cfg)) {
    for (const param of p.params) {
      const tag = tagId(p.prefix, param);
      let target = 'Historian + AI';
      if (param === 'BOD' && p.prefix === 'INF') target = `Track ~${cfg.influentBod} mg/L · C:N`;
      else if (param === 'BOD' && p.prefix === 'EFF') target = '≤10 mg/L permit';
      else if (param === 'TSS' && p.prefix === 'INF') target = `Track ~${cfg.influentTss} mg/L`;
      else if (param === 'NH3' && p.prefix === 'INF') target = `Track ~${cfg.influentNh3} mg/L`;
      else if (param === 'NO3' && p.prefix.includes('ANOX')) target = '<5 mg/L ideal';
      else if (param === 'NO3' && p.prefix === 'IR') target = '15–30 mg/L typical';
      else if (param === 'NO3' && p.prefix === 'EFF') target = '≤10 mg/L permit · IR PID';
      else if (param === 'NH3' && p.prefix === 'AER') target = '<1 mg/L';
      else if (param === 'NH3' && p.prefix === 'EFF') target = '<1 mg/L';
      else if (param === 'ORP') target = '-50 to +50 mV anoxic';
      else if (param === 'pH') target = '6.5–8.5';
      else if (param === 'TSS' && p.prefix.includes('ANOX')) target = cfg.anoxTssTarget;
      else if (param === 'COD' && p.prefix.includes('ANOX')) target = 'Residual carbon proxy';
      else if (param === 'SAC254') target = 'UV254 organic load';
      rows.push([tag, `${p.phase} (${p.valve})`, param, target, p.notes]);
    }
  }
  rows.push(['AER_DO', 'Aerobic basin (dedicated)', 'DO', '2.0 mg/L setpoint', 'Not on scan loop — continuous probe']);
  return rows;
}

function getAiInputRows(cfg) {
  return [
    ['INF_BOD', 'Influent carbon load; C:N vs TKN; carbon-limit alarm'],
    ['INF_COD', 'rbCOD proxy; supplemental carbon decision'],
    ['INF_BOD_TKN', 'Derived ratio — denitrification potential'],
    ['INF_TSS', 'Solids shock; normalize MLSS'],
    ['INF_NH3', 'Nitrogen load forecast'],
    ['INF_PH', 'pH inhibition / nitrifier stress'],
    ['ANOX_NO3 + ANOX_ORP', 'Denitrification state (single train)'],
    ['T1_ANOX_* / T2_ANOX_*', 'Per-train denitrification (dual layout)'],
    ['ANOX_COD', 'Residual carbon in anoxic — carbon limited?'],
    ['IR_NO3', 'IR effectiveness'],
    ['AER_NH3 + AER_DO', 'Nitrification health'],
    ['EFF_NO3 + EFF_NH3 + EFF_BOD', 'Permit feedback · model reward'],
    ['Phase pH (all ports)', 'Process stability across MLE phases'],
  ];
}

function getScanEquipmentDescription(cfg) {
  const ports = getScanPorts(cfg).length;
  return [
    `${SCAN_VENDOR} spectro::lyser V3 (UV-Vis) — BOD, COD, NO3, NH3, TSS, SAC254`,
    `${SCAN_VENDOR} pH::lyser + ORP in flow cell (anoxic ports)`,
    `${SCAN_VENDOR} con::sole controller + sam::spector ${ports}-port sequencer`,
    'Recirculating loop: P-SCAN · Y-strainer · 10L buffer · return to source',
    `${ports} sample taps (¼" SS) · ${cfg.scanDwellMin || 8} min dwell · full cycle ~${(cfg.scanDwellMin || 8) * ports} min`,
    'Weather-rated analyzer shelter · Modbus TCP to MooreVIEW',
  ];
}

function getScanCapex(cfg) {
  return cfg.scanPackageCapex || (cfg.layout === 'dual-125k' ? 85000 : 55000);
}

module.exports = {
  SCAN_VENDOR,
  getScanPorts,
  getAllScanTags,
  tagId,
  getMeasurementTableRows,
  getAiInputRows,
  getScanEquipmentDescription,
  getScanCapex,
};
