#!/usr/bin/env node
'use strict';

/**
 * Generate Putnam County Utilities fleet artifacts:
 *   st/fixtures/fleet_putnam_county.json
 *   st/fixtures/fleet_import_putnam.csv
 *   data/projects/putnam-county-cloud.est.json
 *   data/projects/putnam-mle-plant.est.json
 *   data/projects/putnam-county.est.json
 *   deploy/iot-link/.env.putnam-mle.example
 *   deploy/cloud/.env.putnam.example
 *
 * Usage: npm run generate:putnam-fleet
 *        node scripts/putnam-fleet/generate-artifacts.js
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
  NEXUS_ACCOUNT,
  TENANT,
  PLANT,
  LIFT_STATIONS,
  stationTypeMeta,
  fleetManifest,
  fleetCsvLines,
} = require('./fleet-data');

const NEXUS_MQTT_BROKER = process.env.NEXUS_MQTT_BROKER || 'mqtt://127.0.0.1:1883';

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_MANIFEST = path.join(ROOT, 'st', 'fixtures', 'fleet_putnam_county.json');
const OUT_CSV = path.join(ROOT, 'st', 'fixtures', 'fleet_import_putnam.csv');
const OUT_CLOUD_EST = path.join(ROOT, 'data', 'projects', 'putnam-county-cloud.est.json');
const OUT_PLANT_EST = path.join(ROOT, 'data', 'projects', 'putnam-mle-plant.est.json');
const OUT_COMBINED_EST = path.join(ROOT, 'data', 'projects', 'putnam-county.est.json');
const OUT_IOT_ENV = path.join(ROOT, 'deploy', 'iot-link', '.env.putnam-mle.example');
const OUT_CLOUD_ENV = path.join(ROOT, 'deploy', 'cloud', '.env.putnam.example');
const MLE_EST = path.join(ROOT, 'data', 'projects', 'mle-wastewater.est.json');
const FLEET_3D = '/samples/putnam-county-fleet-3d.html';
const PUBLIC = path.join(ROOT, 'public');
const LIFT_HMI_GRID = { cols: 16, rows: 13, cellWidth: 64, cellHeight: 64 };
const DUPLEXLS_SVG = '/hmi/svg/library/lift-station-faceplates/mooreview/duplexls.svg';
const TRIPLEXLS_SVG = '/hmi/svg/library/lift-station-faceplates/mooreview/triplexls.svg';
const DUPLEXLS_OVERVIEW = { width: 1150, height: 620 };
const TRIPLEXLS_OVERVIEW = { width: 1385, height: 620 };
const DUPLEXLS_VIEWPORT = { displayMaxWidth: 1229, displayMaxHeight: 922, scale: 120 };
const TRIPLEXLS_VIEWPORT = { displayMaxWidth: 1385, displayMaxHeight: 922, scale: 110 };

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

function logicFixtureForStation(stationType) {
  return stationType === 'triplex'
    ? 'tags.triplex_lift_station.json'
    : 'tags.duplex_lift_station.json';
}

function buildMqttSimDriver() {
  return {
    id: 'mqtt_sim_putnam',
    type: 'mqtt_sim',
    enabled: true,
    brokerUrl: NEXUS_MQTT_BROKER,
    intervalMs: 5000,
    samplePath: 'st/fixtures/edgepoint-lift-station-sample.json',
    stations: LIFT_STATIONS.map((s) => ({ serialNum: s.serialNum })),
    publishToBroker: true,
  };
}

function buildLiftDrivers() {
  return LIFT_STATIONS.map((s) => {
    const type = stationTypeMeta(s.stationType);
    const built = buildFromPreset(s.templateId || 'lift_station_epi', {
      driverId: s.driverId,
      serialNum: s.serialNum,
      brokerUrl: NEXUS_MQTT_BROKER,
      liftProfile: s.liftProfile || 'epi_master',
      clientId: `mooreview-${s.driverId}`,
    });
    return {
      ...built.driver,
      name: s.name,
      templateId: s.templateId || type.templateId,
      activeProgram: type.defaultProgram,
      stationType: s.stationType,
      serialNum: s.serialNum,
      product: s.product,
      tagPrefix: s.tagPrefix,
      nexusDeviceId: s.nexusDeviceId,
      nexusAreaId: s.nexusAreaId,
    };
  });
}

/** MQTT I/O + prefixed ST logic tags (alarms, tank level, alternator) per lift. */
function buildLiftIoTags() {
  const out = [];
  for (const s of LIFT_STATIONS) {
    const { tags } = buildFromPreset(s.templateId || 'lift_station_epi', {
      driverId: s.driverId,
      serialNum: s.serialNum,
      brokerUrl: NEXUS_MQTT_BROKER,
      liftProfile: s.liftProfile || 'epi_master',
      clientId: `mooreview-${s.driverId}`,
    });
    out.push(...prefixTags(tags.filter((t) => t.driverAddress), s.tagPrefix, s.driverId));
    const ioIds = new Set(out.map((t) => t.id));
    out.push(...prefixLogicTags(
      liftStationLogicTagsFromFixture(logicFixtureForStation(s.stationType)),
      s.tagPrefix,
    ).filter((t) => !ioIds.has(t.id)));
  }
  return out;
}

function buildLiftStationLogicLines(station) {
  const p = station.tagPrefix;
  const type = stationTypeMeta(station.stationType);
  const alarmTag = `${p}_${type.alarmTag}`;
  const lines = [
    '',
    `(* ${station.name} — derive level + station alarm from MQTT I/O *)`,
    `IF ${p}_X1_I1 THEN TurnON(${p}_LVL_HIGH); ELSE TurnOFF(${p}_LVL_HIGH); END_IF;`,
    `IF ${p}_X1_I2 THEN TurnON(${p}_LVL_LEAD); ELSE TurnOFF(${p}_LVL_LEAD); END_IF;`,
    `IF ${p}_X1_I3 THEN TurnON(${p}_LVL_LAG); ELSE TurnOFF(${p}_LVL_LAG); END_IF;`,
    `IF NOT ${p}_X1_I4 THEN TurnON(${p}_LVL_OFF); ELSE TurnOFF(${p}_LVL_OFF); END_IF;`,
  ];
  if (station.stationType === 'triplex') {
    lines.push(`IF ${p}_X1_I1 THEN SetReal(${p}_TANK_LVL, 92.0);`);
    lines.push(`ELSIF ${p}_LVL_LAG2 THEN SetReal(${p}_TANK_LVL, 78.0);`);
    lines.push(`ELSIF ${p}_X1_I3 THEN SetReal(${p}_TANK_LVL, 68.0);`);
    lines.push(`ELSIF ${p}_X1_I2 THEN SetReal(${p}_TANK_LVL, 45.0);`);
    lines.push(`ELSIF NOT ${p}_X1_I4 THEN SetReal(${p}_TANK_LVL, 12.0);`);
    lines.push('END_IF;');
    lines.push(
      `IF ${p}_X1_I1 OR ${p}_X1_I7 OR ${p}_X1_I10 OR ${p}_ALT_FAULT THEN TurnON(${alarmTag}); ELSE TurnOFF(${alarmTag}); END_IF;`,
    );
    lines.push(`IF ${p}_X1_I5 THEN TurnON(${p}_MOTOR1_RUN); ELSE TurnOFF(${p}_MOTOR1_RUN); END_IF;`);
    lines.push(`IF ${p}_X1_I6 THEN TurnON(${p}_MOTOR2_RUN); ELSE TurnOFF(${p}_MOTOR2_RUN); END_IF;`);
    lines.push(`IF ${p}_X1_I8 THEN TurnON(${p}_MOTOR3_RUN); ELSE TurnOFF(${p}_MOTOR3_RUN); END_IF;`);
    lines.push(`IF ${p}_X1_I7 THEN TurnON(${p}_PHASE_FAULT); ELSE TurnOFF(${p}_PHASE_FAULT); END_IF;`);
  } else {
    lines.push(`IF ${p}_X1_I1 THEN SetReal(${p}_TANK_LVL, 92.0);`);
    lines.push(`ELSIF ${p}_X1_I3 THEN SetReal(${p}_TANK_LVL, 68.0);`);
    lines.push(`ELSIF ${p}_X1_I2 THEN SetReal(${p}_TANK_LVL, 45.0);`);
    lines.push(`ELSIF NOT ${p}_X1_I4 THEN SetReal(${p}_TANK_LVL, 12.0);`);
    lines.push('END_IF;');
    lines.push(
      `IF ${p}_X1_I1 OR ${p}_X1_I7 OR ${p}_X1_I10 OR ${p}_ALT_FAULT THEN TurnON(${alarmTag}); ELSE TurnOFF(${alarmTag}); END_IF;`,
    );
    lines.push(`IF ${p}_X1_I5 THEN TurnON(${p}_MOTOR1_RUN); ELSE TurnOFF(${p}_MOTOR1_RUN); END_IF;`);
    lines.push(`IF ${p}_X1_I6 THEN TurnON(${p}_MOTOR2_RUN); ELSE TurnOFF(${p}_MOTOR2_RUN); END_IF;`);
    lines.push(`IF ${p}_X1_I7 THEN TurnON(${p}_PHASE_FAULT); ELSE TurnOFF(${p}_PHASE_FAULT); END_IF;`);
    lines.push(`IF ${p}_X1_I8 THEN TurnON(${p}_GEN_RUN); ELSE TurnOFF(${p}_GEN_RUN); END_IF;`);
    lines.push(`IF ${p}_X1_I10 THEN TurnON(${p}_GEN_FAULT); ELSE TurnOFF(${p}_GEN_FAULT); END_IF;`);
  }
  lines.push(`IF ${alarmTag} THEN TurnON(${station.fleetAlarmTag}); ELSE TurnOFF(${station.fleetAlarmTag}); END_IF;`);
  lines.push(`IF ${alarmTag} THEN SetInt(${p}_STATION_STA, 1);`);
  lines.push(`ELSIF ${p}_X1_I1 THEN SetInt(${p}_STATION_STA, 2);`);
  lines.push(`ELSE SetInt(${p}_STATION_STA, 0); END_IF;`);
  return lines;
}

function prefixFleetTag(tagPrefix, tagId) {
  const p = String(tagPrefix || '').trim();
  const id = String(tagId || '').trim();
  if (!p || !id) return id;
  return id.startsWith(`${p}_`) ? id : `${p}_${id}`;
}

function tagIdForCompositeRole(manifest, role, tagPrefix) {
  const spec = manifest.tagRoles?.[role] || {};
  if (spec.pick === 'tagId' && spec.tagId) return prefixFleetTag(tagPrefix, spec.tagId);
  if (spec.pick === 'firstAlt') return prefixFleetTag(tagPrefix, spec.tagId || 'ALT1');
  return '';
}

function buildPrefixedCompositeBindings(screenId, col, row, manifest, tagPrefix) {
  return (manifest.defaultBindings || []).map((def) => {
    const tagId = tagIdForCompositeRole(manifest, def.tagRole || 'pv', tagPrefix);
    const binding = {
      screenId,
      elementId: compositeBindingElementId(col, row, manifest, def),
      tagId,
      property: def.property,
      onValue: def.onValue ?? '#22c55e',
      offValue: def.offValue ?? '#94a3b8',
      format: def.format || '',
      min: def.min != null ? def.min : 0,
      max: def.max != null ? def.max : 100,
      classOn: 'hmi-on',
      classOff: 'hmi-off',
    };
    if (def.tagField) binding.tagField = def.tagField;
    if (def.interaction) binding.interaction = def.interaction;
    if (def.hoaValue != null) binding.hoaValue = def.hoaValue;
    if (def.pumpIndex != null) binding.pumpIndex = def.pumpIndex;
    if (def.colors) binding.colors = def.colors.slice();
    if (def.flashStates) binding.flashStates = def.flashStates.slice();
    return binding;
  });
}

function liftCompositeForStation(station, compositesById) {
  if (station.stationType === 'triplex') {
    return {
      compositeId: 'triplexls',
      manifest: compositesById.triplexls,
      svg: TRIPLEXLS_SVG,
      overview: TRIPLEXLS_OVERVIEW,
      viewport: TRIPLEXLS_VIEWPORT,
      screenSuffix: 'TRIPLEXLS',
    };
  }
  return {
    compositeId: 'duplexls',
    manifest: compositesById.duplexls,
    svg: DUPLEXLS_SVG,
    overview: DUPLEXLS_OVERVIEW,
    viewport: DUPLEXLS_VIEWPORT,
    screenSuffix: 'DUPLEXLS',
  };
}

function liftStationScreenLayout(id, number, station, composite) {
  const shortName = String(station.name || station.slug).split('—').pop()?.trim()
    || station.slug;
  return {
    id,
    number,
    isHome: false,
    inheritProjectLayout: false,
    name: `${shortName} (${composite.screenSuffix})`,
    svg: composite.svg,
    tiles: [explodeCompositeToEdit(composite.manifest, 0, 0, {
      colSpan: LIFT_HMI_GRID.cols,
      rowSpan: LIFT_HMI_GRID.rows,
      compositeTagPrefix: station.tagPrefix,
    })],
    gridCols: LIFT_HMI_GRID.cols,
    gridRows: LIFT_HMI_GRID.rows,
    cellWidth: LIFT_HMI_GRID.cellWidth,
    cellHeight: LIFT_HMI_GRID.cellHeight,
    gridSize: LIFT_HMI_GRID.cols,
    width: composite.overview.width,
    height: composite.overview.height,
    naturalWidth: composite.overview.width,
    naturalHeight: composite.overview.height,
    displayMaxWidth: composite.viewport.displayMaxWidth,
    displayMaxHeight: composite.viewport.displayMaxHeight,
    scale: composite.viewport.scale,
    background: '#1a1a1a',
    fit: 'contain',
  };
}

/** Putnam fleet map — live 3D (uses screen.facility3dUrl, not global layout). */
function buildFleet3dScreen(number, isHome = false) {
  return {
    id: 'screen_fleet_3d',
    number,
    isHome,
    name: 'Putnam Lift Fleet (3D)',
    tiles: [],
    facility3dUrl: FLEET_3D,
    inheritProjectLayout: false,
  };
}

/** Fleet 3D map + one TRIPLEXLS/DUPLEXLS faceplate per lift station. */
function buildLiftFleetHmi(startNumber = 1) {
  const composites = listHmiComposites(PUBLIC);
  const byId = Object.fromEntries(
    composites.filter((c) => c.composite?.id).map((c) => [c.composite.id, c.composite]),
  );
  if (!byId.duplexls) throw new Error('Missing duplexls composite manifest');
  if (!byId.triplexls) throw new Error('Missing triplexls composite manifest — run scripts/lift-station/generate-triplexls.js');

  const screens = [];
  const bindings = [];
  let num = startNumber;

  screens.push(buildFleet3dScreen(num, startNumber === 1));
  bindings.push({
    screenId: 'screen_fleet_3d',
    elementId: 'fleet_alm',
    tagId: 'PCU_FLEET_ALM',
    property: 'fill',
    onValue: '#ef4444',
    offValue: '#22c55e',
  });
  num += 1;

  for (const station of LIFT_STATIONS) {
    const composite = liftCompositeForStation(station, byId);
    const screenId = `screen_ls_${station.slug}`;
    screens.push(liftStationScreenLayout(screenId, num, station, composite));
    bindings.push(...buildPrefixedCompositeBindings(screenId, 0, 0, composite.manifest, station.tagPrefix));
    num += 1;
  }

  return { screens, bindings };
}

function buildFleetTags() {
  const tags = [
    baseTag('FLEET_ANY_ALM', {
      label: 'Fleet — any lift alarm',
      alarmsEnabled: true,
      alarmCondition: 'on',
    }),
    baseTag('PLANT_ALM', {
      label: 'MLE plant — any alarm',
      alarmsEnabled: true,
      alarmCondition: 'on',
    }),
    baseTag('PCU_FLEET_ALM', {
      label: 'Putnam County — plant or lift alarm',
      alarmsEnabled: true,
      alarmCondition: 'on',
    }),
  ];
  for (const s of LIFT_STATIONS) {
    tags.push(baseTag(s.fleetAlarmTag, {
      label: `${s.name} — station alarm`,
      alarmsEnabled: true,
      alarmCondition: 'on',
    }));
  }
  return tags;
}

function buildFleetProgram() {
  const fleetOr = LIFT_STATIONS.map((s) => s.fleetAlarmTag).join(' OR ');
  const perStation = LIFT_STATIONS.flatMap((s) => buildLiftStationLogicLines(s));
  return [
    '(* Putnam County cloud fleet rollup *)',
    ...perStation,
    '',
    `IF ${fleetOr} THEN TurnON(FLEET_ANY_ALM); ELSE TurnOFF(FLEET_ANY_ALM); END_IF;`,
    'IF FLEET_ANY_ALM OR PLANT_ALM THEN TurnON(PCU_FLEET_ALM); ELSE TurnOFF(PCU_FLEET_ALM); END_IF;',
  ].join('\n');
}

function buildCloudEst() {
  const tags = [...buildFleetTags(), ...buildLiftIoTags()];
  const drivers = [buildMqttSimDriver(), ...buildLiftDrivers()];
  const program = buildFleetProgram();
  const liftHmi = buildLiftFleetHmi(1);

  return {
    format: 'mooreview-est',
    version: 1,
    savedAt: new Date().toISOString(),
    project: { name: 'putnam-county-cloud' },
    tags,
    drivers,
    program,
    activeProgram: 'logic/putnam_fleet_rollup.st',
    settings: {
      project: { name: 'putnam-county-cloud' },
      scanMs: 1000,
      activeProgram: 'logic/putnam_fleet_rollup.st',
      remoteExecution: false,
      mqtt: {
        enabled: true,
        brokerUrl: NEXUS_MQTT_BROKER,
      },
      mqttParc: {
        enabled: false,
        brokerUrl: 'mqtt://127.0.0.1:1883',
        topicPrefix: 'mooreview/v1',
      },
      nexusCloud: {
        accountId: NEXUS_ACCOUNT.id,
        accountName: NEXUS_ACCOUNT.name,
        bridgeMode: 'track_a_mqtt',
        eventsTopicPattern: '/devices/<serial>/messages/events/',
      },
      putnamFleet: fleetManifest(),
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
          composerMode: '3d',
        },
        screens: liftHmi.screens,
        bindings: liftHmi.bindings,
      },
    },
  };
}

function patchPlantDrivers(drivers) {
  return drivers.map((d) => {
    if (d.type !== 'modbus_rtu') return d;
    return {
      ...d,
      serialPort: PLANT.rs485PortA,
    };
  });
}

function buildPlantEst() {
  if (!fs.existsSync(MLE_EST)) {
    throw new Error(`Missing base plant project: ${MLE_EST} — run npm run generate:mle-wastewater first`);
  }
  const base = JSON.parse(fs.readFileSync(MLE_EST, 'utf8'));
  const est = {
    ...base,
    savedAt: new Date().toISOString(),
    project: { name: 'putnam-mle-plant' },
    drivers: patchPlantDrivers(base.drivers || []),
    settings: {
      ...base.settings,
      project: { name: 'putnam-mle-plant' },
      putnamFleet: {
        tenant: TENANT,
        plant: PLANT,
        role: 'edge-appliance',
      },
      cloudRemote: {
        enabled: true,
        tenantId: TENANT.tenantId,
        tenantSlug: TENANT.slug,
        siteId: PLANT.slug,
        locationSlug: PLANT.slug,
        systemSlug: 'mle-wwtp',
        applianceId: PLANT.applianceId,
        gatewayId: PLANT.gatewayId,
        brokerUrl: 'mqtt://<cloud-droplet-ip>:1883',
        topicPrefix: 'mooreview/v1',
        clientId: 'mooreview-putnam-mle-plant',
        username: 'mooreview',
        password: 'change-me',
        qos: 1,
        relayParc: true,
        relayAlarms: false,
        cloudApiUrl: 'http://<cloud-droplet-ip>:3090',
      },
      mqttParc: {
        enabled: false,
        brokerUrl: 'mqtt://127.0.0.1:1883',
        topicPrefix: 'mooreview/v1',
      },
    },
  };
  if (est.settings?.mleWastewater) {
    est.settings.mleWastewater.owner = TENANT.name;
    est.settings.mleWastewater.site = PLANT.name;
  }
  return est;
}

function mergeTagsById(primary, secondary) {
  const byId = new Map();
  for (const t of primary || []) byId.set(t.id, t);
  for (const t of secondary || []) {
    if (!byId.has(t.id)) byId.set(t.id, t);
  }
  return [...byId.values()];
}

function mergeDriversById(primary, secondary) {
  const byId = new Map();
  for (const d of primary || []) byId.set(d.id, d);
  for (const d of secondary || []) {
    if (!byId.has(d.id)) byId.set(d.id, d);
  }
  return [...byId.values()];
}

function buildCombinedProgram(plantProgram, fleetProgram) {
  const plant = String(plantProgram || '').replace(/\r\n/g, '\n').trim();
  const fleet = String(fleetProgram || '').replace(/\r\n/g, '\n').trim();
  return `${plant}\n\n(* --- Putnam lift fleet rollup --- *)\n${fleet}`;
}

function patchPlantDriversForPc(drivers) {
  return (drivers || []).map((d) => {
    if (d.type !== 'modbus_rtu') return d;
    return {
      ...d,
      serialPort: process.env.MOOREVIEW_RS485_PORT || d.serialPort || 'COM3',
    };
  });
}

/** MLE WWTP + 6 lift stations — single `.est` for PC / MVP Suite viewing. */
function buildCombinedEst() {
  const plantEst = buildPlantEst();
  const cloudEst = buildCloudEst();
  const fleetProgram = buildFleetProgram();
  const combinedProgram = buildCombinedProgram(plantEst.program, fleetProgram);

  const plantHmi = plantEst.settings?.hmi || {};
  const liftHmi = buildLiftFleetHmi(
    (plantHmi.screens || []).reduce((m, s) => Math.max(m, Number(s.number) || 0), 0) + 1,
  );
  const screens = [...(plantHmi.screens || []), ...liftHmi.screens];
  const plant3dUrl = plantHmi.layout?.facility3dUrl;
  const plantOverview = screens.find((s) => s.number === 1 || s.id === 'screen_1');
  if (plantOverview && plant3dUrl) {
    plantOverview.facility3dUrl = plant3dUrl;
  }
  const bindings = [...(plantHmi.bindings || []), ...liftHmi.bindings];

  return {
    format: 'mooreview-est',
    version: 1,
    savedAt: new Date().toISOString(),
    project: { name: 'putnam-county' },
    tags: mergeTagsById(plantEst.tags, cloudEst.tags),
    drivers: mergeDriversById(
      patchPlantDriversForPc(plantEst.drivers),
      cloudEst.drivers,
    ),
    program: combinedProgram,
    activeProgram: 'logic/putnam_county_combined.st',
    settings: {
      ...plantEst.settings,
      project: { name: 'putnam-county' },
      activeProgram: 'logic/putnam_county_combined.st',
      scanMs: 1000,
      remoteExecution: false,
      mqtt: {
        enabled: true,
        brokerUrl: NEXUS_MQTT_BROKER,
        ...(cloudEst.settings?.mqtt || {}),
      },
      mqttParc: {
        enabled: false,
        brokerUrl: 'mqtt://127.0.0.1:1883',
        topicPrefix: 'mooreview/v1',
        ...(plantEst.settings?.mqttParc || {}),
      },
      nexusCloud: cloudEst.settings?.nexusCloud,
      putnamFleet: {
        ...(cloudEst.settings?.putnamFleet || {}),
        combinedProject: 'putnam-county',
        cloudProject: 'putnam-county-cloud',
        plantProject: 'putnam-mle-plant',
        role: 'pc-appliance',
      },
      cloudRemote: {
        ...(plantEst.settings?.cloudRemote || {}),
        enabled: false,
      },
      hmi: {
        ...plantHmi,
        screens,
        bindings,
        layout: {
          ...(plantHmi.layout || {}),
          composerMode: 'grid',
        },
      },
    },
  };
}

function writeCombinedSt(combinedProgram) {
  const stPath = path.join(ROOT, 'st', 'logic', 'putnam_county_combined.st');
  fs.mkdirSync(path.dirname(stPath), { recursive: true });
  fs.writeFileSync(stPath, `${combinedProgram.replace(/\r\n/g, '\n')}\n`, 'utf8');
  return stPath;
}

function buildIotLinkEnv() {
  return `# Putnam County MLE WWTP — Compulab IOT-LINK appliance
# Copy to /etc/mooreview/env after install-generic.sh

PORT=3090
MOOREVIEW_PORT=3090
MOOREVIEW_DEPLOYMENT=appliance
MOOREVIEW_PRODUCT=iot-link
MOOREVIEW_TENANT_ID=local
MOOREVIEW_DATA=/var/lib/mooreview

MOOREVIEW_RS485_PORT_A=${PLANT.rs485PortA}
MOOREVIEW_RS485_PORT_B=${PLANT.rs485PortB}
MOOREVIEW_RS485_ENABLE=true

MONGO_URL=mongodb://127.0.0.1:27017/mooreview
MONGODB_URI=mongodb://127.0.0.1:27017/mooreview
MOOREVIEW_CONFIG_URI=mongodb://127.0.0.1:27017/mooreview
MOOREVIEW_CONFIG_DB=mooreview_config
MONGODB_DB=mooreview

# Local Mosquitto optional — plant uses Modbus + cloudRemote uplink
MOOREVIEW_MQTT_ENABLED=false

# Cloud uplink — match deploy/cloud/.env Mosquitto credentials
# Pair via System setup → Cloud remote or set here before first boot:
# MOOREVIEW_CLOUD_REMOTE_ENABLED=true
# MOOREVIEW_CLOUD_TENANT_ID=${TENANT.tenantId}
# MOOREVIEW_CLOUD_GATEWAY_ID=${PLANT.gatewayId}
# MOOREVIEW_CLOUD_BROKER_URL=mqtt://<cloud-droplet-ip>:1883

# Open data/projects/putnam-mle-plant.est.json on the appliance after install.
`;
}

function buildCloudEnv() {
  return `# Putnam County Utilities — MooreVIEW cloud VM
# Copy to deploy/cloud/.env (merge with .env.example)

MOOREVIEW_PORT=3090
MOOREVIEW_DEPLOYMENT=cloud
MOOREVIEW_TENANT_ID=${TENANT.tenantId}

MONGODB_URI=mongodb://mongodb:27017
MOOREVIEW_CONFIG_URI=mongodb://mongodb:27017
MOOREVIEW_CONFIG_DB=mooreview_config
MONGODB_DB=mooreview

MOOREVIEW_MQTT_BROKER=mqtt://mosquitto:1883
MOSQUITTO_ALLOW_ANONYMOUS=false
MOSQUITTO_USER=mooreview
MOSQUITTO_PASS=change-me

MOOREVIEW_CELLULAR_SIMS=1

# Fleet: 6 Nexcomm lift MQTT drivers (lift_station_epi) + 1 plant appliance relay
# Point NEXUS_MQTT_BROKER at Nexcomm/Azure MQTT bridge or local mirror.
# Open project putnam-county-cloud after deploy.

# Tenant slug: ${TENANT.slug}
# Plant gatewayId: ${PLANT.gatewayId}
# Lift serials: ${LIFT_STATIONS.map((s) => s.serialNum).join(', ')}
`;
}

function writeStProgram(program) {
  const stPath = path.join(ROOT, 'st', 'logic', 'putnam_fleet_rollup.st');
  fs.mkdirSync(path.dirname(stPath), { recursive: true });
  fs.writeFileSync(stPath, `${program}\n`, 'utf8');
  return stPath;
}

function main() {
  require('../lift-station/generate-triplexls.js');
  const manifest = fleetManifest();
  fs.writeFileSync(OUT_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_CSV, `${fleetCsvLines().join('\n')}\n`, 'utf8');

  const stPath = writeStProgram(buildFleetProgram());
  const cloudEst = buildCloudEst();
  const plantEst = buildPlantEst();
  const combinedEst = buildCombinedEst();
  const combinedStPath = writeCombinedSt(combinedEst.program);

  fs.mkdirSync(path.dirname(OUT_CLOUD_EST), { recursive: true });
  fs.writeFileSync(OUT_CLOUD_EST, `${JSON.stringify(cloudEst, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_PLANT_EST, `${JSON.stringify(plantEst, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_COMBINED_EST, `${JSON.stringify(combinedEst, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_IOT_ENV, buildIotLinkEnv(), 'utf8');
  fs.writeFileSync(OUT_CLOUD_ENV, buildCloudEnv(), 'utf8');

  // Keep legacy single-station sample pointing at full fleet CSV
  const legacySample = path.join(ROOT, 'st', 'fixtures', 'fleet_putnam_yelvington.sample.json');
  if (fs.existsSync(legacySample)) {
    const sample = JSON.parse(fs.readFileSync(legacySample, 'utf8'));
    sample.importCsv = 'st/fixtures/fleet_import_putnam.csv';
    sample.fleetManifest = 'st/fixtures/fleet_putnam_county.json';
    fs.writeFileSync(legacySample, `${JSON.stringify(sample, null, 2)}\n`, 'utf8');
  }

  console.log('Putnam County fleet artifacts generated:');
  console.log(`  ${path.relative(ROOT, OUT_MANIFEST)}`);
  console.log(`  ${path.relative(ROOT, OUT_CSV)} (${LIFT_STATIONS.length} lift stations)`);
  console.log(`  ${path.relative(ROOT, OUT_CLOUD_EST)} (${cloudEst.drivers.length} mqtt drivers, ${cloudEst.tags.length} tags)`);
  console.log(`  ${path.relative(ROOT, OUT_PLANT_EST)}`);
  console.log(`  ${path.relative(ROOT, OUT_COMBINED_EST)} (${combinedEst.drivers.length} drivers, ${combinedEst.tags.length} tags)`);
  console.log(`  ${path.relative(ROOT, combinedStPath)}`);
  console.log(`  ${path.relative(ROOT, stPath)}`);
  console.log(`  ${path.relative(ROOT, OUT_IOT_ENV)}`);
  console.log(`  ${path.relative(ROOT, OUT_CLOUD_ENV)}`);
}

main();
