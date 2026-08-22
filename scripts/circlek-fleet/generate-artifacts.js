#!/usr/bin/env node
'use strict';

/**
 * C-store Opta Parc cloud fleet artifacts.
 *
 * Primary (portable SaaS): empty starter — import after creating a tenant.
 * Optional demo: pre-loaded Circle K Florida sample (--demo).
 *
 * Usage:
 *   node scripts/circlek-fleet/generate-artifacts.js
 *   node scripts/circlek-fleet/generate-artifacts.js --demo
 *   node scripts/circlek-fleet/generate-artifacts.js --fleet
 */

const fs = require('fs');
const path = require('path');
const { buildFromPreset } = require('../../src/devices/devicePresets');
const { liftStationLogicTagsFromFixture } = require('../../src/devices/tagBuilders');
const {
  explodeCompositeToEdit,
  listHmiComposites,
  compositeBindingElementId,
} = require('../../src/hmi/hmiComposites');
const {
  STARTER,
  FLEET,
  OPERATOR,
  MQTT_PARC_BROKER,
  FLEET_MAP_CENTER,
  LIFT_STATIONS,
  buildPdmBlock,
  starterManifest,
  sampleFleetManifest,
  fleetFleetManifest,
  fleetCsvLines,
  generateFloridaFleet,
} = require('./fleet-data');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public');
const WITH_DEMO = process.argv.includes('--demo');
const WITH_FLEET = process.argv.includes('--fleet');
const MAX_HMI_FACEPLATES = 24;

const OUT_STARTER_MANIFEST = path.join(ROOT, 'st', 'fixtures', 'cstore_opta_parc_starter.json');
const OUT_SAMPLE_MANIFEST = path.join(ROOT, 'st', 'fixtures', 'fleet_circle_k_florida.json');
const OUT_CSV = path.join(ROOT, 'st', 'fixtures', 'fleet_import_circle_k.csv');
const OUT_STARTER_EST = path.join(ROOT, 'data', 'projects', `${STARTER.projectId}.est.json`);
const OUT_DEMO_EST = path.join(ROOT, 'data', 'projects', 'circle-k-florida-demo.est.json');
const OUT_FLEET_MANIFEST = path.join(ROOT, 'st', 'fixtures', 'fleet_circle_k_florida_500.json');
const OUT_FLEET_CSV = path.join(ROOT, 'st', 'fixtures', 'fleet_import_circle_k_500.csv');
const OUT_FLEET_EST = path.join(ROOT, 'data', 'projects', `${FLEET.projectId}.est.json`);
const OUT_FLEET_ST = path.join(ROOT, 'st', 'logic', 'circle_k_florida_fleet_rollup.st');
const OUT_FLEET_3D = path.join(ROOT, 'public', 'samples', 'circle-k-florida-fleet-3d.html');
const OUT_STARTER_ST = path.join(ROOT, 'st', 'logic', 'cstore_opta_parc_fleet_rollup.st');
const OUT_DEMO_ST = path.join(ROOT, 'st', 'logic', 'circle_k_fleet_rollup.st');
const OUT_ENV = path.join(ROOT, 'deploy', 'cloud', '.env.cstore-opta-parc.example');
const OUT_3D = path.join(ROOT, 'public', 'samples', 'cstore-opta-parc-fleet-3d.html');

const LIFT_HMI_GRID = { cols: 16, rows: 13, cellWidth: 64, cellHeight: 64 };
const DUPLEXLS_SVG = '/hmi/svg/library/lift-station-faceplates/mooreview/duplexls.svg';
const DUPLEXLS_OVERVIEW = { width: 1150, height: 620 };
const DUPLEXLS_VIEWPORT = { displayMaxWidth: 1229, displayMaxHeight: 922, scale: 120 };

function baseTag(id, extra = {}) {
  return {
    id,
    label: extra.label || id,
    type: extra.type || 'BOOL',
    role: extra.role || 'memory',
    driverId: null,
    driverAddress: null,
    default: extra.type === 'REAL' ? (extra.default ?? 0) : extra.type === 'INT' ? (extra.default ?? 0) : (extra.default ?? false),
    scale: 1,
    offset: 0,
    alarmsEnabled: !!extra.alarmsEnabled,
    alarmOuterLow: null,
    alarmInnerLow: null,
    alarmInnerHigh: null,
    alarmOuterHigh: null,
    alarmCondition: extra.alarmCondition ?? (extra.type === 'BOOL' && extra.alarmsEnabled ? 'on' : null),
    readonly: false,
    preset: 0,
    mode: 'TON',
    arrayLen: 1,
    value: extra.type === 'BOOL' ? (extra.default ?? false) : (extra.default ?? 0),
    quality: 'GOOD',
    wordWidth: 16,
    signed: true,
    forceInput: false,
    forceOutput: false,
    graphEnabled: !!extra.graphEnabled,
    dirty: false,
    alarmLevel: null,
    fb: {},
  };
}

function prefixTags(tags, prefix, driverId) {
  return tags.map((t) => ({
    ...t,
    id: `${prefix}_${t.id}`,
    driverId,
    label: t.label ? `${prefix} ${t.label}` : `${prefix}_${t.id}`,
  }));
}

function prefixLogicTags(tags, prefix) {
  return tags.map((t) => ({
    ...t,
    id: `${prefix}_${t.id}`,
    driverId: null,
    label: t.label ? `${prefix} ${t.label}` : `${prefix}_${t.id}`,
  }));
}

function monitoredStations(stations) {
  return stations.filter((s) => s.monitored !== false);
}

function logicFixtureForStation(station) {
  // All monitored sites use duplex logic tags so @composite/duplexls bindings resolve.
  return 'tags.duplex_lift_station.json';
}

function resolveFaceplateStations(stations, maxFaceplates) {
  const active = monitoredStations(stations);
  if (maxFaceplates === 'all' || maxFaceplates === Infinity || maxFaceplates < 0) return active;
  if (maxFaceplates === 0) return [];
  return active.slice(0, maxFaceplates);
}

function wantsFaceplates(maxFaceplates) {
  if (maxFaceplates === 0) return false;
  if (maxFaceplates === 'all' || maxFaceplates === Infinity || maxFaceplates < 0) return true;
  return maxFaceplates > 0;
}

function buildLiftDrivers(stations) {
  return monitoredStations(stations).map((s) => {
    const built = buildFromPreset(s.templateId, {
      driverId: s.driverId,
      deviceId: s.deviceId,
    });
    return {
      ...built.driver,
      name: s.name,
      templateId: s.templateId,
      activeProgram: s.defaultProgram,
      stationType: s.stationType,
      deviceId: s.deviceId,
      product: s.product,
      hasCt: s.hasCt,
      tagPrefix: s.tagPrefix,
      storeNumber: s.storeNumber,
      locationClass: s.locationClass,
      remoteExecution: true,
    };
  });
}

function buildLiftIoTags(stations) {
  const out = [];
  for (const s of monitoredStations(stations)) {
    const { tags } = buildFromPreset(s.templateId, {
      driverId: s.driverId,
      deviceId: s.deviceId,
    });
    out.push(...prefixTags(tags.filter((t) => t.driverAddress), s.tagPrefix, s.driverId));
    const ioIds = new Set(out.map((t) => t.id));
    out.push(...prefixLogicTags(
      liftStationLogicTagsFromFixture(logicFixtureForStation(s)),
      s.tagPrefix,
    ).filter((t) => !ioIds.has(t.id)));
  }
  return out;
}

function buildSimplexStationLogicLines(station) {
  const p = station.tagPrefix;
  const alarmTag = station.alarmTag;
  return [
    '',
    `(* ${station.name} — simplex septic; DUPLEXLS faceplate via duplex tag aliases *)`,
    `IF ${p}_X1_I1 THEN TurnON(${p}_LVL_HIGH); ELSE TurnOFF(${p}_LVL_HIGH); END_IF;`,
    `IF NOT ${p}_X1_I4 THEN TurnON(${p}_LVL_OFF); ELSE TurnOFF(${p}_LVL_OFF); END_IF;`,
    `IF ${p}_X1_I2 THEN TurnON(${p}_LVL_LEAD); ELSE TurnOFF(${p}_LVL_LEAD); END_IF;`,
    `IF ${p}_X1_I3 THEN TurnON(${p}_LVL_LAG); ELSE TurnOFF(${p}_LVL_LAG); END_IF;`,
    `IF ${p}_X1_I1 THEN SetReal(${p}_TANK_LVL, 88.0);`,
    `ELSIF ${p}_X1_I3 THEN SetReal(${p}_TANK_LVL, 55.0);`,
    `ELSIF ${p}_X1_I2 THEN SetReal(${p}_TANK_LVL, 42.0);`,
    `ELSIF NOT ${p}_X1_I4 THEN SetReal(${p}_TANK_LVL, 15.0);`,
    `ELSE SetReal(${p}_TANK_LVL, 30.0); END_IF;`,
    `IF ${p}_X1_I5 THEN TurnON(${p}_MOTOR1_RUN); ELSE TurnOFF(${p}_MOTOR1_RUN); END_IF;`,
    `TurnOFF(${p}_MOTOR2_RUN);`,
    `IF ${p}_X1_I6 THEN TurnON(${p}_PHASE_FAULT); ELSE TurnOFF(${p}_PHASE_FAULT); END_IF;`,
    `IF ${p}_X1_I6 THEN TurnON(${alarmTag}); ELSE TurnOFF(${alarmTag}); END_IF;`,
    `IF ${alarmTag} THEN TurnON(${station.fleetAlarmTag}); ELSE TurnOFF(${station.fleetAlarmTag}); END_IF;`,
    `IF ${alarmTag} THEN SetInt(${p}_STATION_STA, 1);`,
    `ELSIF ${p}_X1_I1 THEN SetInt(${p}_STATION_STA, 2);`,
    `ELSE SetInt(${p}_STATION_STA, 0); END_IF;`,
  ];
}

function buildStationLogicLines(station) {
  if (station.stationType === 'simplex') return buildSimplexStationLogicLines(station);
  return buildLiftStationLogicLines(station);
}

function buildLiftStationLogicLines(station) {
  const p = station.tagPrefix;
  const alarmTag = station.alarmTag;
  return [
    '',
    `(* ${station.name} — derive level + station alarm from Opta Parc I/O *)`,
    `IF ${p}_X1_I1 THEN TurnON(${p}_LVL_HIGH); ELSE TurnOFF(${p}_LVL_HIGH); END_IF;`,
    `IF ${p}_X1_I2 THEN TurnON(${p}_LVL_LEAD); ELSE TurnOFF(${p}_LVL_LEAD); END_IF;`,
    `IF ${p}_X1_I3 THEN TurnON(${p}_LVL_LAG); ELSE TurnOFF(${p}_LVL_LAG); END_IF;`,
    `IF NOT ${p}_X1_I4 THEN TurnON(${p}_LVL_OFF); ELSE TurnOFF(${p}_LVL_OFF); END_IF;`,
    `IF ${p}_X1_I1 THEN SetReal(${p}_TANK_LVL, 92.0);`,
    `ELSIF ${p}_X1_I3 THEN SetReal(${p}_TANK_LVL, 68.0);`,
    `ELSIF ${p}_X1_I2 THEN SetReal(${p}_TANK_LVL, 45.0);`,
    `ELSIF NOT ${p}_X1_I4 THEN SetReal(${p}_TANK_LVL, 12.0);`,
    'END_IF;',
    `IF ${p}_X1_I1 OR ${p}_X1_I7 OR ${p}_X1_I10 OR ${p}_ALT_FAULT THEN TurnON(${alarmTag}); ELSE TurnOFF(${alarmTag}); END_IF;`,
    `IF ${p}_X1_I5 THEN TurnON(${p}_MOTOR1_RUN); ELSE TurnOFF(${p}_MOTOR1_RUN); END_IF;`,
    `IF ${p}_X1_I6 THEN TurnON(${p}_MOTOR2_RUN); ELSE TurnOFF(${p}_MOTOR2_RUN); END_IF;`,
    `IF ${p}_X1_I7 THEN TurnON(${p}_PHASE_FAULT); ELSE TurnOFF(${p}_PHASE_FAULT); END_IF;`,
    `IF ${p}_X1_I8 THEN TurnON(${p}_GEN_RUN); ELSE TurnOFF(${p}_GEN_RUN); END_IF;`,
    `IF ${p}_X1_I10 THEN TurnON(${p}_GEN_FAULT); ELSE TurnOFF(${p}_GEN_FAULT); END_IF;`,
    `IF ${alarmTag} THEN TurnON(${station.fleetAlarmTag}); ELSE TurnOFF(${station.fleetAlarmTag}); END_IF;`,
    `IF ${alarmTag} THEN SetInt(${p}_STATION_STA, 1);`,
    `ELSIF ${p}_X1_I1 THEN SetInt(${p}_STATION_STA, 2);`,
    `ELSE SetInt(${p}_STATION_STA, 0); END_IF;`,
  ];
}

function tagIdForCompositeRole(manifest, role, tagPrefix) {
  const spec = manifest.tagRoles?.[role] || {};
  const p = String(tagPrefix || '').trim();
  const id = String(spec.tagId || '').trim();
  if (spec.pick === 'tagId' && id) return id.startsWith(`${p}_`) ? id : `${p}_${id}`;
  if (spec.pick === 'firstAlt') return `${p}_${spec.tagId || 'ALT1'}`;
  return '';
}

function buildPrefixedCompositeBindings(screenId, col, row, manifest, tagPrefix) {
  return (manifest.defaultBindings || []).map((def) => ({
    screenId,
    elementId: compositeBindingElementId(col, row, manifest, def),
    tagId: tagIdForCompositeRole(manifest, def.tagRole || 'pv', tagPrefix),
    property: def.property,
    onValue: def.onValue ?? '#22c55e',
    offValue: def.offValue ?? '#94a3b8',
    format: def.format || '',
    min: def.min != null ? def.min : 0,
    max: def.max != null ? def.max : 100,
    classOn: 'hmi-on',
    classOff: 'hmi-off',
    ...(def.tagField ? { tagField: def.tagField } : {}),
    ...(def.interaction ? { interaction: def.interaction } : {}),
    ...(def.hoaValue != null ? { hoaValue: def.hoaValue } : {}),
    ...(def.pumpIndex != null ? { pumpIndex: def.pumpIndex } : {}),
    ...(def.colors ? { colors: def.colors.slice() } : {}),
    ...(def.flashStates ? { flashStates: def.flashStates.slice() } : {}),
  }));
}

function liftStationScreenLayout(id, number, station, duplexManifest) {
  const shortName = String(station.name || station.slug).split('—').pop()?.trim() || station.slug;
  const suffix = station.monitorType === 'septic' ? 'DUPLEXLS · septic' : 'DUPLEXLS';
  return {
    id,
    number,
    isHome: false,
    inheritProjectLayout: false,
    name: `${shortName} (${suffix})`,
    svg: DUPLEXLS_SVG,
    tiles: [explodeCompositeToEdit(duplexManifest, 0, 0, {
      colSpan: LIFT_HMI_GRID.cols,
      rowSpan: LIFT_HMI_GRID.rows,
      compositeTagPrefix: station.tagPrefix,
    })],
    gridCols: LIFT_HMI_GRID.cols,
    gridRows: LIFT_HMI_GRID.rows,
    cellWidth: LIFT_HMI_GRID.cellWidth,
    cellHeight: LIFT_HMI_GRID.cellHeight,
    gridSize: LIFT_HMI_GRID.cols,
    width: DUPLEXLS_OVERVIEW.width,
    height: DUPLEXLS_OVERVIEW.height,
    naturalWidth: DUPLEXLS_OVERVIEW.width,
    naturalHeight: DUPLEXLS_OVERVIEW.height,
    displayMaxWidth: DUPLEXLS_VIEWPORT.displayMaxWidth,
    displayMaxHeight: DUPLEXLS_VIEWPORT.displayMaxHeight,
    scale: DUPLEXLS_VIEWPORT.scale,
    background: '#1a1a1a',
    fit: 'contain',
  };
}

function buildFleet3dScreen(fleet3dUrl = STARTER.fleet3dUrl, title = 'C-Store Lift Fleet (3D)') {
  return {
    id: 'screen_fleet_3d',
    number: 1,
    isHome: true,
    name: title,
    tiles: [],
    facility3dUrl: fleet3dUrl,
    inheritProjectLayout: false,
  };
}

function buildLiftFleetHmi(stations, opts = {}) {
  const fleet3dUrl = opts.fleet3dUrl || STARTER.fleet3dUrl;
  const fleetAlarmTag = opts.fleetAlarmTag || STARTER.fleetAlarmTag;
  const maxFaceplates = opts.maxFaceplates != null ? opts.maxFaceplates : MAX_HMI_FACEPLATES;
  const screenTitle = opts.fleetScreenTitle || 'C-Store Lift Fleet (3D)';
  const composites = listHmiComposites(PUBLIC);
  const duplexManifest = composites.find((c) => c.composite?.id === 'duplexls')?.composite;
  if (!duplexManifest && wantsFaceplates(maxFaceplates)) throw new Error('Missing duplexls composite manifest');

  const screens = [buildFleet3dScreen(fleet3dUrl, screenTitle)];
  const bindings = [{
    screenId: 'screen_fleet_3d',
    elementId: 'fleet_alm',
    tagId: fleetAlarmTag,
    property: 'fill',
    onValue: '#ef4444',
    offValue: '#22c55e',
  }];

  const faceplateStations = resolveFaceplateStations(stations, maxFaceplates);
  let num = 2;
  for (const station of faceplateStations) {
    const screenId = `screen_ck_${station.slug}`;
    screens.push(liftStationScreenLayout(screenId, num, station, duplexManifest));
    bindings.push(...buildPrefixedCompositeBindings(screenId, 0, 0, duplexManifest, station.tagPrefix));
    num += 1;
  }

  return { screens, bindings };
}

function buildFleetTags(stations, opts = {}) {
  const fleetAlarmTag = opts.fleetAlarmTag || STARTER.fleetAlarmTag;
  const active = monitoredStations(stations);
  const tags = [
    baseTag(fleetAlarmTag, {
      label: 'Fleet — any store lift alarm',
      alarmsEnabled: true,
      alarmCondition: 'on',
    }),
    baseTag('FLEET_STORE_COUNT', {
      label: 'Commissioned store count',
      type: 'INT',
      default: active.length,
    }),
  ];
  for (const s of active) {
    tags.push(baseTag(s.fleetAlarmTag, {
      label: `${s.name} — alarm`,
      alarmsEnabled: true,
      alarmCondition: 'on',
    }));
  }
  return tags;
}

function buildFleetProgram(stations, opts = {}) {
  const fleetTag = opts.fleetAlarmTag || STARTER.fleetAlarmTag;
  const active = monitoredStations(stations);
  if (!active.length) {
    return [
      '(* C-store Opta Parc fleet — add drivers from Parc registry, then extend rollup *)',
      `TurnOFF(${fleetTag});`,
    ].join('\n');
  }
  const fleetOr = active.map((s) => s.fleetAlarmTag).join(' OR ');
  const perStation = active.flatMap((s) => buildStationLogicLines(s));
  return [
    '(* C-store Opta Parc fleet rollup *)',
    ...perStation,
    '',
    `IF ${fleetOr} THEN TurnON(${fleetTag}); ELSE TurnOFF(${fleetTag}); END_IF;`,
  ].join('\n');
}

function buildEstProject(stations, opts = {}) {
  const projectName = opts.projectName || STARTER.projectName;
  const rollupProgram = opts.rollupProgram || STARTER.rollupProgram;
  const manifestBlock = opts.manifestBlock || starterManifest();
  const settingsKey = opts.settingsKey || 'cstoreOptaParc';
  const fleetAlarmTag = opts.fleetAlarmTag || STARTER.fleetAlarmTag;
  const fleet3dUrl = opts.fleet3dUrl || STARTER.fleet3dUrl;
  const maxFaceplates = opts.maxFaceplates != null ? opts.maxFaceplates : MAX_HMI_FACEPLATES;
  const active = monitoredStations(stations);
  const pdm = active.length ? buildPdmBlock(active) : {
    assetTags: {},
    assetContext: {},
    windowMin: 15,
    failureThreshold: 0.35,
    buildEnabled: true,
    buildIntervalHours: 24,
    liftModelId: 'lift-submersible-v2',
    forecastMethods: ['starts_analytics', 'run_amps_creep', 'mcsa_onnx'],
    featuresCollection: 'pdm_features',
  };
  const liftHmi = buildLiftFleetHmi(stations, {
    fleetAlarmTag,
    fleet3dUrl,
    maxFaceplates,
    fleetScreenTitle: opts.fleetScreenTitle,
  });
  const hmiOpts = { fleetAlarmTag };

  return {
    format: 'mooreview-est',
    version: 1,
    savedAt: new Date().toISOString(),
    project: { name: projectName },
    tags: [...buildFleetTags(stations, hmiOpts), ...buildLiftIoTags(stations)],
    drivers: buildLiftDrivers(stations),
    program: buildFleetProgram(stations, hmiOpts),
    activeProgram: rollupProgram,
    settings: {
      project: { name: projectName },
      scanMs: 1000,
      activeProgram: rollupProgram,
      remoteExecution: true,
      startup: {
        mode: 'saved_project',
        projectId: projectName,
        promptOnBoot: false,
      },
      mqttParc: {
        enabled: true,
        brokerUrl: MQTT_PARC_BROKER,
        topicPrefix: 'mooreview/v1',
        globalSiteKey: 1,
      },
      [settingsKey]: manifestBlock,
      pdm,
      hmi: {
        activeScreen: 'screen_fleet_3d',
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
          composerMode: 'list',
        },
        screens: liftHmi.screens,
        bindings: liftHmi.bindings,
      },
    },
  };
}

function buildCloudEnv() {
  return `# MooreVIEW Cloud — C-store Opta Parc (portable multi-tenant SaaS)
# Copy to deploy/cloud/.env for runtime 3090 + Mosquitto, OR merge into /etc/mooreview/runtime.env
# Do NOT set MOOREVIEW_TENANT_ID on multi-tenant SaaS (:3100) — create customers in /admin/tenants

MOOREVIEW_PORT=3090
MOOREVIEW_DEPLOYMENT=cloud

MONGODB_URI=mongodb://mongodb:27017
MOOREVIEW_CONFIG_URI=mongodb://mongodb:27017
MOOREVIEW_CONFIG_DB=mooreview_config
MONGODB_DB=mooreview

MOOREVIEW_MQTT_BROKER=mqtt://mosquitto:1883
MOSQUITTO_ALLOW_ANONYMOUS=false
MOSQUITTO_USER=mooreview
MOSQUITTO_PASS=change-me

MQTT_PARC_BROKER=${MQTT_PARC_BROKER}

# After SaaS install (port 3100): create tenant → import cstore-opta-parc-starter.est.zip
# Enable runtime 3090: deploy/cloud/debian/enable-runtime-3090.sh
# Onboarding: docs/CSTORE_OPTA_PARC_CLOUD.md
# Field Opta: docs/OPTA_PARC_CLOUD.md
`;
}

function buildFleet3dHtml(stations, opts = {}) {
  const pinOnly = opts.pinOnly ?? stations.length > 50;
  const center = opts.center || FLEET_MAP_CENTER;
  const title = opts.title || 'Circle K Florida Fleet';
  const subtitle = opts.subtitle || 'Opta Parc cloud — phase 1 lift/septic; phase 2 IoT-Link HVAC-R (planned)';
  const monitored = monitoredStations(stations);
  const screenBySlug = new Map(monitored.map((s, i) => [s.slug, i + 2]));
  const lifts = stations.map((s) => ({
    name: s.name,
    slug: s.slug,
    storeNumber: s.storeNumber,
    type: s.stationType || 'unmonitored',
    monitorType: s.monitorType || null,
    monitored: s.monitored !== false,
    lat: s.lat,
    lng: s.lng,
    driverId: s.driverId,
    deviceId: s.deviceId,
    alarmTag: s.alarmTag,
    levelTag: s.levelTag,
    hmiScreenNumber: screenBySlug.get(s.slug) || null,
  }));

  const fleetJson = JSON.stringify({
    tenant: null,
    operator: stations.length ? OPERATOR.name : 'C-store fleet',
    center,
    pinOnly,
    lifts,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <script src="/samples/mv-live-api.js"></script>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; font-family: "Segoe UI", system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
    #canvas-wrap { position: absolute; inset: 0; }
    canvas { display: block; width: 100%; height: 100%; }
    .panel { position: absolute; z-index: 10; background: rgba(15, 23, 42, 0.92); border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 10px; backdrop-filter: blur(8px); padding: 14px 16px; font-size: 13px; line-height: 1.45; }
    #title-panel { top: 14px; left: 14px; max-width: 440px; }
    #title-panel h1 { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
    #title-panel p { color: #94a3b8; font-size: 12px; }
    #mv-status { top: 14px; left: 50%; transform: translateX(-50%); font-size: 12px; padding: 8px 14px; }
    #mv-status.ok { border-color: rgba(34, 197, 94, 0.45); color: #86efac; }
    #mv-status.err { border-color: rgba(239, 68, 68, 0.45); color: #fca5a5; }
    #empty-hint { top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; max-width: 420px; display: none; }
    #fleet-list { bottom: 14px; right: 14px; width: 320px; max-height: 40vh; overflow: auto; }
    #fleet-list ul { list-style: none; margin-top: 8px; }
    #fleet-list li { font-size: 12px; padding: 4px 0; border-bottom: 1px solid rgba(148,163,184,0.12); display: flex; justify-content: space-between; gap: 8px; cursor: pointer; }
    #fleet-list .alm { color: #f87171; font-weight: 600; }
    #fleet-list .ok { color: #86efac; }
    #fleet-list .off { color: #64748b; }
  </style>
</head>
<body>
  <div id="canvas-wrap"></div>
  <div id="mv-status" class="panel err">MV live: connecting…</div>
  <div id="title-panel" class="panel">
    <h1 id="fleet-title">${title}</h1>
    <p id="fleet-sub">${subtitle}</p>
  </div>
  <div id="empty-hint" class="panel">
    <strong>No stores on map yet</strong>
    <p style="margin-top:8px;color:#94a3b8">Commission an Opta at the store, then bulk-add from the Parc registry with a stable position ID (store slug).</p>
  </div>
  <div id="fleet-list" class="panel"><strong>Fleet</strong><ul id="fleet-items"></ul></div>
  <script type="importmap">{ "imports": { "three": "/vendor/three/build/three.module.js", "three/addons/": "/vendor/three/examples/jsm/" } }</script>
  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    import { buildLiftStation, applyLiftStationLevel } from './lift-station-3d.js';

    const FLEET = ${fleetJson};
    const wrap = document.getElementById('canvas-wrap');
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(wrap.clientWidth, wrap.clientHeight);
    renderer.setClearColor(0x0f172a);
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, wrap.clientWidth / wrap.clientHeight, 0.1, 4000);
    camera.position.set(0, 80, 120);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(40, 80, 30);
    scene.add(sun);

    function latLngToScene(lat, lng) {
      const lat0 = FLEET.center.lat;
      const lng0 = FLEET.center.lng;
      return { x: (lng - lng0) * 4200, z: -(lat - lat0) * 4200 };
    }

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(800, 800),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const tagCache = {};
    const liftMeshes = [];

    if (!FLEET.lifts.length) {
      document.getElementById('empty-hint').style.display = 'block';
    }

    for (const st of FLEET.lifts) {
      const pos = latLngToScene(st.lat, st.lng);
      const group = new THREE.Group();
      group.position.set(pos.x, 0, pos.z);
      group.userData = { fleetMeta: st };
      const pinColor = st.monitored === false ? 0x64748b : (st.type === 'simplex' ? 0x38bdf8 : 0xf97316);
      const pin = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.6, FLEET.pinOnly ? 8 : 10, 10),
        new THREE.MeshStandardMaterial({ color: pinColor }),
      );
      pin.position.y = FLEET.pinOnly ? 4 : 5;
      group.add(pin);
      if (!FLEET.pinOnly && st.monitored !== false) {
        const modelType = st.type === 'simplex' ? 'simplex' : 'duplex';
        const model = buildLiftStation(modelType, { scale: 1.4 });
        model.position.y = 0.5;
        group.add(model);
        group.userData.liftModel = model;
      }
      scene.add(group);
      liftMeshes.push(group);
    }

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    function tagVal(tagId) {
      const t = tagCache[tagId];
      return t ? (t.value ?? t.v ?? t) : null;
    }

    function refreshFleetList() {
      const ul = document.getElementById('fleet-items');
      ul.innerHTML = '';
      for (const st of FLEET.lifts) {
        const li = document.createElement('li');
        const alm = tagVal(st.alarmTag);
        const status = alm === true || alm === 1 ? 'alm' : (tagCache[st.alarmTag] ? 'ok' : 'off');
        li.innerHTML = \`<span>\${st.storeNumber || st.slug}</span><span class="\${status}">\${status === 'alm' ? 'ALARM' : status === 'ok' ? 'OK' : '—'}</span>\`;
        ul.appendChild(li);
      }
      for (const g of liftMeshes) {
        const st = g.userData.fleetMeta;
        const alm = tagVal(st.alarmTag);
        g.children[0].material.color.setHex((alm === true || alm === 1) ? 0xef4444 : 0xf97316);
        const lvl = tagVal(st.levelTag);
        if (g.userData.liftModel && typeof lvl === 'number') applyLiftStationLevel(g.userData.liftModel, lvl);
      }
    }

    if (window.MvLiveApi) {
      const api = new window.MvLiveApi({ pollMs: 2000 });
      api.onTags((tags) => {
        Object.assign(tagCache, tags);
        document.getElementById('mv-status').textContent = 'MV live: connected';
        document.getElementById('mv-status').className = 'panel ok';
        refreshFleetList();
      });
      api.onError(() => {
        document.getElementById('mv-status').textContent = 'MV live: offline';
        document.getElementById('mv-status').className = 'panel err';
      });
      api.start();
    }
    refreshFleetList();
  </script>
</body>
</html>
`;
}

function main() {
  for (const dir of [
    path.dirname(OUT_STARTER_MANIFEST),
    path.dirname(OUT_STARTER_EST),
    path.dirname(OUT_STARTER_ST),
    path.dirname(OUT_ENV),
    path.dirname(OUT_3D),
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const starterEst = buildEstProject([]);
  const starterProgram = buildFleetProgram([]);

  fs.writeFileSync(OUT_STARTER_MANIFEST, `${JSON.stringify(starterManifest(), null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_SAMPLE_MANIFEST, `${JSON.stringify(sampleFleetManifest(), null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_CSV, `${fleetCsvLines().join('\n')}\n`, 'utf8');
  fs.writeFileSync(OUT_STARTER_ST, `${starterProgram}\n`, 'utf8');
  fs.writeFileSync(OUT_STARTER_EST, `${JSON.stringify(starterEst, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_ENV, buildCloudEnv(), 'utf8');
  fs.writeFileSync(OUT_3D, buildFleet3dHtml([]), 'utf8');

  const written = [
    path.relative(ROOT, OUT_STARTER_MANIFEST),
    path.relative(ROOT, OUT_SAMPLE_MANIFEST),
    path.relative(ROOT, OUT_CSV),
    path.relative(ROOT, OUT_STARTER_EST),
    path.relative(ROOT, OUT_STARTER_ST),
    path.relative(ROOT, OUT_ENV),
    path.relative(ROOT, OUT_3D),
  ];

  if (WITH_DEMO) {
    const demoEst = buildEstProject(LIFT_STATIONS, {
      projectName: 'circle-k-florida-demo',
      rollupProgram: 'logic/circle_k_fleet_rollup.st',
      manifestBlock: sampleFleetManifest(),
      settingsKey: 'circlekFleetDemo',
    });
    fs.writeFileSync(OUT_DEMO_ST, `${buildFleetProgram(LIFT_STATIONS)}\n`, 'utf8');
    fs.writeFileSync(OUT_DEMO_EST, `${JSON.stringify(demoEst, null, 2)}\n`, 'utf8');
    fs.writeFileSync(OUT_3D, buildFleet3dHtml(LIFT_STATIONS, {
      title: 'Circle K Florida — Demo Fleet',
      subtitle: '12 reference stores — Opta Parc cloud lift monitoring',
    }), 'utf8');
    written.push(path.relative(ROOT, OUT_DEMO_EST), path.relative(ROOT, OUT_DEMO_ST));
  }

  if (WITH_FLEET) {
    const allStores = generateFloridaFleet();
    const monitored = monitoredStations(allStores);
    const fleetEst = buildEstProject(allStores, {
      projectName: FLEET.projectName,
      rollupProgram: FLEET.rollupProgram,
      manifestBlock: fleetFleetManifest(allStores),
      settingsKey: 'circlekFloridaFleet',
      fleetAlarmTag: FLEET.fleetAlarmTag,
      fleet3dUrl: FLEET.fleet3dUrl,
      maxFaceplates: 'all',
      fleetScreenTitle: 'Circle K Florida Fleet (3D)',
    });
    fs.writeFileSync(OUT_FLEET_MANIFEST, `${JSON.stringify(fleetFleetManifest(allStores), null, 2)}\n`, 'utf8');
    fs.writeFileSync(OUT_FLEET_CSV, `${fleetCsvLines(allStores).join('\n')}\n`, 'utf8');
    fs.writeFileSync(OUT_FLEET_ST, `${buildFleetProgram(allStores, { fleetAlarmTag: FLEET.fleetAlarmTag })}\n`, 'utf8');
    fs.writeFileSync(OUT_FLEET_EST, `${JSON.stringify(fleetEst, null, 2)}\n`, 'utf8');
    fs.writeFileSync(OUT_FLEET_3D, buildFleet3dHtml(allStores, {
      title: 'Circle K Florida — 500 Store Fleet',
      subtitle: `${monitored.length} monitored lift/septic · ${allStores.length - monitored.length} unmonitored · phase 2 IoT-Link planned`,
      pinOnly: true,
    }), 'utf8');
    written.push(
      path.relative(ROOT, OUT_FLEET_MANIFEST),
      path.relative(ROOT, OUT_FLEET_CSV),
      path.relative(ROOT, OUT_FLEET_EST),
      path.relative(ROOT, OUT_FLEET_ST),
      path.relative(ROOT, OUT_FLEET_3D),
    );
  }

  console.log('C-store Opta Parc fleet artifacts written:');
  for (const rel of written) console.log(`  ${rel}`);
  console.log(`  Starter: empty project (${STARTER.projectId}) — import after creating tenant`);
  if (WITH_DEMO) console.log(`  Demo: ${LIFT_STATIONS.length} Circle K sample stores`);
  else console.log('  Tip: run with --demo to also generate circle-k-florida-demo');
  if (WITH_FLEET) {
    const fleet = generateFloridaFleet();
    console.log(`  Fleet: ${fleet.length} stores (${monitoredStations(fleet).length} monitored lift/septic)`);
  } else console.log('  Tip: run with --fleet to generate circle-k-florida-fleet (500 stores)');
}

if (require.main === module) main();

module.exports = {
  buildEstProject,
  buildFleetProgram,
  buildCloudEnv,
  buildFleet3dHtml,
};
