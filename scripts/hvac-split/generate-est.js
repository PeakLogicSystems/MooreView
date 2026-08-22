'use strict';

const fs = require('fs');
const path = require('path');
const { MAX_TAGS } = require('../../src/config');
const {
  ROOT,
  SINGLE_SPLIT_TAGS,
  DOUBLE_SPLIT_TAGS,
  mqttParcDriver,
  writeCondenserSvg,
  writeAirHandlerSvg,
  writeSystemOverviewSvg,
  singleSplitBindings,
  doubleSplitBindings,
  screenLayout,
} = require('../hvac-split/shared-data');

function writeDoubleAirHandlerSvg(outPath) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 520" width="1024" height="520">
  <rect width="1024" height="520" fill="#f8fafc"/>
  <text x="512" y="36" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="20" font-weight="600" fill="#0f172a">Dual air handlers</text>
  <rect x="40" y="60" width="440" height="380" rx="8" fill="#e0e7ff" stroke="#4f46e5" stroke-width="2"/>
  <text x="260" y="92" text-anchor="middle" font-size="15" font-weight="600" fill="#312e81">AHU 1</text>
  <text x="60" y="140" font-size="12" fill="#334155">Supply °F</text>
  <text id="val_ahu1_supply" x="420" y="140" text-anchor="end" font-family="Consolas,monospace" font-size="22" fill="#0f172a">—</text>
  <text x="60" y="180" font-size="12" fill="#334155">Return °F</text>
  <text id="val_ahu1_return" x="420" y="180" text-anchor="end" font-family="Consolas,monospace" font-size="22" fill="#0f172a">—</text>
  <text x="60" y="230" font-size="12" fill="#334155">Pan leak</text>
  <circle id="lamp_ahu1_pan" cx="420" cy="226" r="10" fill="#64748b"/>
  <rect x="60" y="360" width="400" height="44" rx="4" fill="#fee2e2" stroke="#ef4444"/>
  <circle id="lamp_ahu1_alm" cx="84" cy="382" r="10" fill="#64748b"/>
  <text x="102" y="387" font-size="12" fill="#991b1b">AHU1 alarm</text>
  <rect x="544" y="60" width="440" height="380" rx="8" fill="#e0e7ff" stroke="#4f46e5" stroke-width="2"/>
  <text x="764" y="92" text-anchor="middle" font-size="15" font-weight="600" fill="#312e81">AHU 2</text>
  <text x="564" y="140" font-size="12" fill="#334155">Supply °F</text>
  <text id="val_ahu2_supply" x="924" y="140" text-anchor="end" font-family="Consolas,monospace" font-size="22" fill="#0f172a">—</text>
  <text x="564" y="180" font-size="12" fill="#334155">Return °F</text>
  <text id="val_ahu2_return" x="924" y="180" text-anchor="end" font-family="Consolas,monospace" font-size="22" fill="#0f172a">—</text>
  <text x="564" y="230" font-size="12" fill="#334155">Pan leak</text>
  <circle id="lamp_ahu2_pan" cx="924" cy="226" r="10" fill="#64748b"/>
  <rect x="564" y="360" width="400" height="44" rx="4" fill="#fee2e2" stroke="#ef4444"/>
  <circle id="lamp_ahu2_alm" cx="588" cy="382" r="10" fill="#64748b"/>
  <text x="606" y="387" font-size="12" fill="#991b1b">AHU2 alarm</text>
</svg>`;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, svg, 'utf8');
}

function buildEst(config) {
  const {
    projectId,
    projectName,
    variant,
    tagsFn,
    bindingsFn,
    stRel,
    stPath,
    deviceId,
    html3d,
    svgDir,
  } = config;

  fs.mkdirSync(svgDir, { recursive: true });
  const svgBase = `/hmi/svg/demos/${projectId}`;
  writeSystemOverviewSvg(path.join(svgDir, 'system_overview.svg'), variant);

  if (variant === 'double') {
    writeDoubleAirHandlerSvg(path.join(svgDir, 'air_handlers.svg'));
    writeCondenserSvg(path.join(svgDir, 'condenser_1.svg'), 'cond1', 'Condenser 1');
    writeCondenserSvg(path.join(svgDir, 'condenser_2.svg'), 'cond2', 'Condenser 2');
  } else {
    writeAirHandlerSvg(path.join(svgDir, 'air_handler.svg'), '', 'Air Handler');
    writeCondenserSvg(path.join(svgDir, 'condenser.svg'), '', 'Outdoor Condenser');
  }

  const tags = tagsFn();
  if (tags.length > MAX_TAGS) {
    throw new Error(`Tag count ${tags.length} exceeds MAX_TAGS ${MAX_TAGS}`);
  }

  const program = fs.readFileSync(stPath, 'utf8');
  const screens = variant === 'double'
    ? [
      screenLayout('screen_1', '3D Overview', 1, null),
      screenLayout('screen_2', 'System Overview', 2, `${svgBase}/system_overview.svg`),
      screenLayout('screen_3', 'Air Handlers', 3, `${svgBase}/air_handlers.svg`, { displayMaxWidth: 1200 }),
      screenLayout('screen_4', 'Condenser 1', 4, `${svgBase}/condenser_1.svg`, { displayMaxWidth: 480 }),
      screenLayout('screen_5', 'Condenser 2', 5, `${svgBase}/condenser_2.svg`, { displayMaxWidth: 480 }),
    ]
    : [
      screenLayout('screen_1', '3D Overview', 1, null),
      screenLayout('screen_2', 'System Overview', 2, `${svgBase}/system_overview.svg`),
      screenLayout('screen_3', 'Air Handler', 3, `${svgBase}/air_handler.svg`, { displayMaxWidth: 480 }),
      screenLayout('screen_4', 'Condenser', 4, `${svgBase}/condenser.svg`, { displayMaxWidth: 480 }),
    ];

  const GRID = { cols: 16, rows: 12, cellWidth: 64, cellHeight: 64 };
  return {
    format: 'mooreview-est',
    version: 1,
    savedAt: new Date().toISOString(),
    project: { name: projectId },
    tags,
    drivers: mqttParcDriver(projectId, deviceId, projectName, stRel),
    program,
    activeProgram: stRel,
    settings: {
      project: { name: projectId },
      scanMs: 100,
      activeProgram: stRel,
      remoteExecution: true,
      mqttParc: {
        enabled: true,
        brokerUrl: 'mqtt://127.0.0.1:1883',
        topicPrefix: 'mooreview/v1',
      },
      demoFeatures: { hmiTestMode: true },
      hvacSplit: {
        variant,
        firmware: 'arduino-opta-mqtt-st v2.3.81',
        mcsaPreset: variant === 'double' ? 'dual-cond-facility' : 'hvac-rtu',
        ahuEnv: true,
      },
      hmi: {
        activeScreen: 'screen_1',
        testMode: false,
        layout: {
          gridCols: GRID.cols,
          gridRows: GRID.rows,
          cellWidth: GRID.cellWidth,
          cellHeight: GRID.cellHeight,
          gridSize: GRID.cols,
          width: GRID.cols * GRID.cellWidth,
          height: GRID.rows * GRID.cellHeight,
          displayMaxWidth: 1024,
          displayMaxHeight: 768,
          fit: 'contain',
          showGridChrome: false,
          showLiveStatus: true,
          composerMode: '3d',
          facility3dUrl: html3d,
          areaPopupScreens: screens.filter((s) => s.svg).map((s) => s.id),
        },
        screens,
        bindings: bindingsFn(),
      },
    },
  };
}

function main() {
  const variant = process.argv.includes('--double') ? 'double' : 'single';
  const projectId = variant === 'double' ? 'opta-double-split-hvac' : 'opta-split-hvac';
  const projectName = variant === 'double' ? 'Opta Double Split HVAC' : 'Opta Split HVAC';
  const stRel = variant === 'double' ? 'logic/opta_double_split_hvac.st' : 'logic/opta_split_hvac.st';
  const stPath = path.join(ROOT, 'st', ...stRel.split('/'));
  const outEst = path.join(ROOT, 'data', 'projects', `${projectId}.est.json`);
  const svgDir = path.join(ROOT, 'public', 'hmi', 'svg', 'demos', projectId);
  const html3d = `/samples/${projectId}-ortho-3d.html`;

  const est = buildEst({
    projectId,
    projectName,
    variant,
    tagsFn: variant === 'double' ? DOUBLE_SPLIT_TAGS : SINGLE_SPLIT_TAGS,
    bindingsFn: variant === 'double' ? doubleSplitBindings : singleSplitBindings,
    stRel,
    stPath,
    deviceId: variant === 'double' ? 'opta_hvac_double_01' : 'opta_hvac_split_01',
    html3d,
    svgDir,
  });

  fs.mkdirSync(path.dirname(outEst), { recursive: true });
  fs.writeFileSync(outEst, `${JSON.stringify(est, null, 2)}\n`, 'utf8');
  console.log(`Generated ${outEst}`);
  console.log(`  Tags: ${est.tags.length} / ${MAX_TAGS}`);
  console.log(`  Screens: ${est.settings.hmi.screens.length}`);
  console.log(`  Bindings: ${est.settings.hmi.bindings.length}`);
  console.log(`  3D: ${html3d}`);
  console.log(`  Program: st/${stRel}`);
}

if (require.main === module) main();

module.exports = { buildEst, writeDoubleAirHandlerSvg, main };
