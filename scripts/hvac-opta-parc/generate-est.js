#!/usr/bin/env node
'use strict';

/**
 * Generate consolidated OPTA Parc HVAC project (configs A–D).
 *
 * Usage:
 *   node scripts/hvac-opta-parc/generate-est.js
 */

const fs = require('fs');
const path = require('path');
const { MAX_TAGS } = require('../../src/config');
const { buildPdmSeedsFromPreset } = require('../../src/pdm/pdmAssetSeedFromTemplate');
const { normalizePdmSettings } = require('../../src/settings/pdmSettings');
const { getPreset } = require('../../src/devices/devicePresets');
const { PROJECT, MQTT_BROKER_URL, HVAC_CFG, CONFIG_META } = require('./project-data');

const ROOT = path.resolve(__dirname, '..', '..');
const MV_DRAW_DIR = path.join(ROOT, 'data', 'mv-draw', 'projects');
const FIXTURES_DIR = path.join(ROOT, 'st', 'fixtures');

function buildSettings(screens) {
  const preset = getPreset(PROJECT.templateIdMcsa) || getPreset(PROJECT.templateId);
  const installDate = new Date().toISOString().slice(0, 10);
  const pdmSeeds = buildPdmSeedsFromPreset(preset || { pdm: PROJECT.pdm }, {
    deviceId: process.env.OPTA_DEVICE_ID || 'hvac_opta_01',
    siteId: PROJECT.name,
    siteName: PROJECT.title,
    installDate,
    presetLabel: preset?.label || PROJECT.title,
  });

  return {
    project: { name: PROJECT.name },
    scanMs: 100,
    activeProgram: PROJECT.programFile,
    remoteExecution: false,
    autoStartRuntime: true,
    mqttParc: {
      enabled: true,
      brokerUrl: MQTT_BROKER_URL,
      topicPrefix: 'mooreview/v1',
      globalSiteKey: PROJECT.commissioning.mqttParc.globalSiteKey,
    },
    demoFeatures: { hmiTestMode: true },
    hvacOptaParc: {
      hvacCfgDefault: HVAC_CFG.AHU_SINGLE,
      configs: CONFIG_META,
      commissioning: PROJECT.commissioning,
      templates: {
        ahu: PROJECT.templateId,
        condenser: PROJECT.templateIdMcsa,
      },
    },
    pdm: normalizePdmSettings({
      assetContext: pdmSeeds.assetContext,
      assetTags: pdmSeeds.assetTags,
      windowMin: 5,
      failureThreshold: 0.3,
      simSeedDays: 180,
      buildEnabled: false,
    }),
    hmi: {
      activeScreen: 'screen_1',
      testMode: false,
      layout: {
        gridCols: 16,
        gridRows: 12,
        cellWidth: 64,
        cellHeight: 64,
        gridSize: 16,
        width: 1024,
        height: 768,
        displayMaxWidth: 1024,
        displayMaxHeight: 768,
        fit: 'contain',
        showGridChrome: false,
        showLiveStatus: true,
        composerMode: 'display',
        areaPopupScreens: ['screen_2', 'screen_3'],
      },
      screens,
      bindings: [],
    },
  };
}

function writeStarterFixture() {
  const starter = {
    mode: 'incremental',
    starterProject: PROJECT.name,
    onboardingDoc: PROJECT.commissioning.doc,
    bridgeMode: 'opta_parc_direct',
    mqttParcBroker: MQTT_BROKER_URL,
    product: 'arduino opta mqtt parc hvac',
    templateId: PROJECT.templateId,
    templateIdMcsa: PROJECT.templateIdMcsa,
    defaultProgram: PROJECT.programFile,
    commissioning: PROJECT.commissioning,
    configs: Object.entries(CONFIG_META).map(([value, meta]) => ({
      hvacCfg: Number(value),
      ...meta,
    })),
  };
  fs.writeFileSync(
    path.join(FIXTURES_DIR, PROJECT.starterFixture),
    `${JSON.stringify(starter, null, 2)}\n`,
    'utf8',
  );
}

function main() {
  const tags = PROJECT.buildTags();
  const drivers = PROJECT.buildDrivers();
  const screens = PROJECT.buildScreens();
  const programPath = path.join(ROOT, 'st', PROJECT.programFile);
  const program = fs.readFileSync(programPath, 'utf8');
  const outEst = path.join(ROOT, 'data', 'projects', `${PROJECT.name}.est.json`);
  const mvDraw = PROJECT.buildMvDraw();

  if (tags.length > MAX_TAGS) {
    console.error(`Tag count ${tags.length} exceeds MAX_TAGS ${MAX_TAGS}`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(outEst), { recursive: true });
  fs.mkdirSync(MV_DRAW_DIR, { recursive: true });
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });

  fs.writeFileSync(
    path.join(FIXTURES_DIR, PROJECT.tagsFixture),
    `${JSON.stringify(tags, null, 2)}\n`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(FIXTURES_DIR, PROJECT.driversFixture),
    `${JSON.stringify(drivers, null, 2)}\n`,
    'utf8',
  );
  writeStarterFixture();

  const est = {
    format: 'mooreview-est',
    version: 1,
    savedAt: new Date().toISOString(),
    project: { name: PROJECT.name },
    tags,
    drivers,
    program,
    activeProgram: PROJECT.programFile,
    settings: buildSettings(screens),
    mvDraw,
  };

  fs.writeFileSync(outEst, `${JSON.stringify(est, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(MV_DRAW_DIR, `${PROJECT.name}.mvdraw.json`),
    `${JSON.stringify(mvDraw, null, 2)}\n`,
    'utf8',
  );

  console.log(`Generated ${outEst}`);
  console.log(`  Title: ${PROJECT.title}`);
  console.log(`  Tags: ${tags.length} / ${MAX_TAGS}`);
  console.log(`  Drivers: ${drivers.length} (enable opta_hvac_02 for config D)`);
  console.log(`  Configs: A=${HVAC_CFG.AHU_SINGLE} B=${HVAC_CFG.COND_SINGLE} C=${HVAC_CFG.AHU_DUAL} D=${HVAC_CFG.COND_DUAL}`);
  console.log(`  Program: st/${PROJECT.programFile}`);
  console.log(`  Starter: st/fixtures/${PROJECT.starterFixture}`);
  console.log(`  WiFi setup: ${PROJECT.commissioning.wifiSetup.apUrl}`);
}

main();
