#!/usr/bin/env node
'use strict';

/**
 * Generate pool-cloud-residential bundled project + deploy env.
 *
 * Usage: node scripts/pool-fleet/generate-artifacts.js
 */

const fs = require('fs');
const path = require('path');
const { buildIotLinkPoolEstDoc } = require('../../src/appliance/iotLinkPoolSeed');
const { normalizeHmi } = require('../../src/hmi/hmiConfig');
const {
  TENANT,
  RESIDENTIAL_SITE,
  RESIDENTIAL_DEVICE,
  profileManifest,
} = require('./fleet-data');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_MANIFEST = path.join(ROOT, 'st', 'fixtures', 'fleet_pool_residential.json');

/** Cloud SaaS: no local RS-485 — gateway uplinks chemistry/status via MQTT Parc. */
const CLOUD_POOL_ENV = {
  MOOREVIEW_POOL_OPTA_IO: 'false',
  MOOREVIEW_POOL_PENTAIR: 'false',
  MOOREVIEW_POOL_PENTAIR_BUS: 'false',
  MOOREVIEW_POOL_INTELLIFLO: 'false',
  MOOREVIEW_POOL_MODBUS_CHEM: 'false',
};

function baseTag(id, extra = {}) {
  return {
    id,
    label: extra.label || id,
    type: extra.type || 'BOOL',
    role: extra.role || 'memory',
    driverId: null,
    driverAddress: null,
    default: extra.type === 'REAL' ? (extra.default ?? 0) : extra.type === 'INT' ? (extra.default ?? 0) : (extra.default ?? false),
    scale: extra.scale ?? 1,
    offset: extra.offset ?? 0,
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

function buildPoolCloudResidentialEst() {
  const doc = buildIotLinkPoolEstDoc({ env: CLOUD_POOL_ENV });
  const device = RESIDENTIAL_DEVICE;

  doc.project = { name: RESIDENTIAL_SITE.cloudProject, id: RESIDENTIAL_SITE.cloudProject };
  doc.drivers = [{
    id: device.driverId,
    type: 'mqtt_parc',
    enabled: true,
    deviceId: device.deviceId,
    name: device.name,
    scanMs: 1000,
    reportIntervalSec: 1,
    remoteExecution: true,
    telemetryOnly: true,
  }];

  const hasSiteAlm = doc.tags.some((t) => t.id === 'SITE_ALM');
  if (!hasSiteAlm) {
    doc.tags.push(baseTag('SITE_ALM', {
      label: `${RESIDENTIAL_SITE.name} — summary alarm`,
      alarmsEnabled: true,
      alarmCondition: 'on',
    }));
  }
  const hasFleetAlm = doc.tags.some((t) => t.id === device.fleetAlarmTag);
  if (!hasFleetAlm) {
    doc.tags.push(baseTag(device.fleetAlarmTag, {
      label: `${device.name} — fleet mirror`,
      alarmsEnabled: true,
      alarmCondition: 'on',
    }));
  }

  doc.settings = {
    ...doc.settings,
    project: { name: RESIDENTIAL_SITE.cloudProject },
    scanMs: 1000,
    remoteExecution: true,
    autoStartRuntime: false,
    startup: {
      mode: 'saved_project',
      projectId: RESIDENTIAL_SITE.cloudProject,
      promptOnBoot: false,
    },
    userLevel: 'operator',
    poolResidential: profileManifest(),
    mqttParc: {
      ...(doc.settings.mqttParc || {}),
      enabled: true,
      brokerUrl: 'mqtt://127.0.0.1:1883',
      topicPrefix: 'mooreview/v1',
    },
    hmi: {
      ...(doc.settings.hmi || {}),
      activeScreen: 'screen_1',
      layout: {
        ...(doc.settings.hmi?.layout || {}),
        showGridChrome: false,
        composerMode: 'tiles',
        showLiveStatus: true,
        fit: 'contain',
      },
    },
  };
  doc.settings.hmi = normalizeHmi(doc.settings.hmi, doc.tags);
  return doc;
}

function buildCloudEnv() {
  return `# MooreVIEW Pool cloud — ${RESIDENTIAL_SITE.name} (residential)
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

# Residential pool — 1 cellular gateway (chemistry + status uplink)
# Open project: ${RESIDENTIAL_SITE.cloudProject}
# Homeowner login role: homeowner

# Device ID:
#   ${RESIDENTIAL_DEVICE.deviceId}
`;
}

function main() {
  const manifest = profileManifest();
  fs.writeFileSync(OUT_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const estPath = path.join(ROOT, 'data', 'projects', `${RESIDENTIAL_SITE.cloudProject}.est.json`);
  const envPath = path.join(ROOT, 'deploy', 'cloud', '.env.pool-residential.example');
  const est = buildPoolCloudResidentialEst();

  fs.mkdirSync(path.dirname(estPath), { recursive: true });
  fs.writeFileSync(estPath, `${JSON.stringify(est, null, 2)}\n`, 'utf8');
  fs.writeFileSync(envPath, buildCloudEnv(), 'utf8');

  console.log('Pool cloud residential artifacts generated:');
  console.log(`  ${path.relative(ROOT, OUT_MANIFEST)}`);
  console.log(`  ${path.relative(ROOT, estPath)}`);
  console.log(`  ${path.relative(ROOT, envPath)}`);
  console.log(`  device: ${RESIDENTIAL_DEVICE.deviceId}`);
  console.log(`  HMI home: pool_overview (screen_1)`);
}

main();
