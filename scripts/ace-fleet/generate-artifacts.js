#!/usr/bin/env node
'use strict';

/**
 * Generate ACE Septic LiftPoint Light fleet artifacts:
 *   st/fixtures/fleet_ace_liftpoint.json
 *   st/fixtures/fleet_import_ace.csv
 *   data/projects/ace-liftpoint-fleet.est.json
 *   st/logic/ace_fleet_rollup.st
 *   deploy/cloud/.env.ace.example
 *
 * Usage: node scripts/ace-fleet/generate-artifacts.js
 */

const fs = require('fs');
const path = require('path');
const { buildFromPreset } = require('../../src/devices/devicePresets');
const {
  OPERATOR,
  NEXUS_MQTT_BROKER,
  LIFT_STATIONS,
  buildPdmBlock,
  fleetManifest,
  fleetCsvLines,
} = require('./fleet-data');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_MANIFEST = path.join(ROOT, 'st', 'fixtures', 'fleet_ace_liftpoint.json');
const OUT_CSV = path.join(ROOT, 'st', 'fixtures', 'fleet_import_ace.csv');
const OUT_EST = path.join(ROOT, 'data', 'projects', 'ace-liftpoint-fleet.est.json');
const OUT_ST = path.join(ROOT, 'st', 'logic', 'ace_fleet_rollup.st');
const OUT_ENV = path.join(ROOT, 'deploy', 'cloud', '.env.ace.example');

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

function buildLiftDrivers() {
  return LIFT_STATIONS.map((s) => {
    const built = buildFromPreset('lift_station_epi', {
      driverId: s.driverId,
      serialNum: s.serialNum,
      brokerUrl: NEXUS_MQTT_BROKER,
      liftProfile: 'liftpoint_light',
    });
    return {
      ...built.driver,
      name: s.name,
      templateId: s.templateId,
      activeProgram: s.defaultProgram,
      stationType: s.stationType,
      serialNum: s.serialNum,
      product: s.product,
      hasCt: s.hasCt,
      tagPrefix: s.tagPrefix,
      nexusDeviceId: s.nexusDeviceId,
      locationClass: s.locationClass,
    };
  });
}

function buildLiftIoTags() {
  const out = [];
  for (const s of LIFT_STATIONS) {
    const { tags } = buildFromPreset('lift_station_epi', {
      driverId: s.driverId,
      serialNum: s.serialNum,
      brokerUrl: NEXUS_MQTT_BROKER,
      liftProfile: 'liftpoint_light',
    });
    out.push(...prefixTags(tags.filter((t) => t.driverAddress), s.tagPrefix, s.driverId));
  }
  return out;
}

function buildFleetTags() {
  const tags = [
    baseTag('ACE_FLEET_ANY_ALM', {
      label: 'ACE fleet — any lift alarm',
      alarmsEnabled: true,
      alarmCondition: 'on',
    }),
    baseTag('ACE_FLEET_CT_COUNT', {
      label: 'ACE sample fleet CT-equipped sites',
      type: 'INT',
      default: LIFT_STATIONS.filter((s) => s.hasCt).length,
    }),
    baseTag('ACE_FLEET_STARTS_ONLY', {
      label: 'ACE sample fleet starts-only sites',
      type: 'INT',
      default: LIFT_STATIONS.filter((s) => !s.hasCt).length,
    }),
  ];
  for (const s of LIFT_STATIONS) {
    tags.push(baseTag(s.fleetAlarmTag, {
      label: `${s.name} — high level / alarm`,
      alarmsEnabled: true,
      alarmCondition: 'on',
    }));
  }
  return tags;
}

function buildFleetProgram() {
  const fleetOr = LIFT_STATIONS.map((s) => s.fleetAlarmTag).join(' OR ');
  return [
    '(* ACE Septic & Waste — LiftPoint Light fleet rollup *)',
    '(* Wire FLEET_*_ALM from each site LVL_HIGH after Drivers → Sync tags *)',
    '',
    `IF ${fleetOr} THEN TurnON(ACE_FLEET_ANY_ALM); ELSE TurnOFF(ACE_FLEET_ANY_ALM); END_IF;`,
  ].join('\n');
}

function buildEstProject() {
  const tags = [...buildFleetTags(), ...buildLiftIoTags()];
  const drivers = buildLiftDrivers();
  const program = buildFleetProgram();
  const pdm = buildPdmBlock();

  return {
    format: 'mooreview-est',
    version: 1,
    savedAt: new Date().toISOString(),
    project: { name: 'ace-liftpoint-fleet' },
    tags,
    drivers,
    program,
    activeProgram: 'logic/ace_fleet_rollup.st',
    settings: {
      project: { name: 'ace-liftpoint-fleet' },
      scanMs: 1000,
      activeProgram: 'logic/ace_fleet_rollup.st',
      remoteExecution: false,
      mqtt: {
        enabled: true,
        brokerUrl: NEXUS_MQTT_BROKER,
      },
      mqttParc: {
        enabled: true,
        brokerUrl: 'mqtt://127.0.0.1:1883',
        topicPrefix: 'mooreview/v1',
      },
      nexusCloud: {
        bridgeMode: 'track_a_mqtt',
        eventsTopicPattern: '/devices/<serial>/messages/events/',
        operator: OPERATOR.slug,
        product: 'liftpoint light',
      },
      aceFleet: fleetManifest(),
      pdm,
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
          composerMode: 'list',
        },
        screens: [
          {
            id: 'screen_1',
            number: 1,
            isHome: true,
            name: 'ACE LiftPoint Fleet',
            tiles: [],
          },
        ],
        bindings: [
          {
            screenId: 'screen_1',
            elementId: 'fleet_alm',
            tagId: 'ACE_FLEET_ANY_ALM',
            property: 'fill',
            onValue: '#ef4444',
            offValue: '#22c55e',
          },
        ],
      },
    },
  };
}

function buildCloudEnv() {
  const ct = LIFT_STATIONS.filter((s) => s.hasCt).length;
  const startsOnly = LIFT_STATIONS.length - ct;
  return `# ACE Septic & Waste — LiftPoint Light fleet (MooreVIEW cloud)
# Copy to deploy/cloud/.env (merge with .env.example)

MOOREVIEW_PORT=3090
MOOREVIEW_DEPLOYMENT=cloud
MOOREVIEW_TENANT_ID=${OPERATOR.tenantId}

MONGODB_URI=mongodb://mongodb:27017
MOOREVIEW_CONFIG_URI=mongodb://mongodb:27017
MOOREVIEW_CONFIG_DB=mooreview_config
MONGODB_DB=mooreview

MOOREVIEW_MQTT_BROKER=mqtt://mosquitto:1883
MOSQUITTO_ALLOW_ANONYMOUS=false
MOSQUITTO_USER=mooreview
MOSQUITTO_PASS=change-me

# Nexcomm MQTT bridge — point at Azure IoT Hub / Nexus fan-out
NEXUS_MQTT_BROKER=${NEXUS_MQTT_BROKER}

# Open project ace-liftpoint-fleet after deploy.
# PdM: starts_analytics (all sites) + run_amps_creep (CT-equipped subset)
# Sample scaffold: ${LIFT_STATIONS.length} sites (${ct} CT, ${startsOnly} starts-only)
# Bulk import: st/fixtures/fleet_import_ace.csv (${OPERATOR.slug})

# Operator: ${OPERATOR.name}
# Parent: ${OPERATOR.parent}
`;
}

function main() {
  fs.mkdirSync(path.dirname(OUT_MANIFEST), { recursive: true });
  fs.mkdirSync(path.dirname(OUT_EST), { recursive: true });
  fs.mkdirSync(path.dirname(OUT_ST), { recursive: true });
  fs.mkdirSync(path.dirname(OUT_ENV), { recursive: true });

  const program = buildFleetProgram();
  fs.writeFileSync(OUT_MANIFEST, `${JSON.stringify(fleetManifest(), null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_CSV, `${fleetCsvLines().join('\n')}\n`, 'utf8');
  fs.writeFileSync(OUT_ST, `${program}\n`, 'utf8');
  fs.writeFileSync(OUT_EST, `${JSON.stringify(buildEstProject(), null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_ENV, buildCloudEnv(), 'utf8');

  console.log('ACE LiftPoint fleet artifacts written:');
  console.log(`  ${path.relative(ROOT, OUT_MANIFEST)}`);
  console.log(`  ${path.relative(ROOT, OUT_CSV)}`);
  console.log(`  ${path.relative(ROOT, OUT_EST)}`);
  console.log(`  ${path.relative(ROOT, OUT_ST)}`);
  console.log(`  ${path.relative(ROOT, OUT_ENV)}`);
  console.log(`  ${LIFT_STATIONS.length} sample sites (${LIFT_STATIONS.filter((s) => s.hasCt).length} CT, ${LIFT_STATIONS.filter((s) => !s.hasCt).length} starts-only)`);
}

if (require.main === module) main();

module.exports = {
  buildEstProject,
  buildFleetProgram,
  buildCloudEnv,
};
