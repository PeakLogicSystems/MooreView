#!/usr/bin/env node
'use strict';

/**
 * Generate assisted-living HaLow + IOT-LINK pool subsystem artifacts.
 *
 * Usage: node scripts/assisted-living-halow/generate-artifacts.js
 * Prerequisite: npm run generate:assisted-living (for base ALF est)
 */

const fs = require('fs');
const path = require('path');
const {
  SITE,
  MAIN_APPLIANCE,
  POOL_SUBSYSTEM,
  manifest,
  halowNodeCsvLines,
  allHalowDrivers,
} = require('./alf-halow-data');
const { applyHalowSemanticMap, SEMANTIC_MAP, POOL_ROLLUP_MAP, HVAC_COND_BINDINGS } = require('./halow-semantic-map');
const { patchPoolDrivers, applyPoolHalowBindings } = require('./pool-halow-bindings');
const { buildIotLinkPoolEstDoc } = require('../../src/appliance/iotLinkPoolSeed');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE_ALF_EST = path.join(ROOT, 'data', 'projects', 'assisted-living.est.json');
const OUT_MANIFEST = path.join(ROOT, 'st', 'fixtures', 'assisted_living_halow.json');
const OUT_CSV = path.join(ROOT, 'st', 'fixtures', 'assisted_living_halow_nodes.csv');
const OUT_ALF_EST = path.join(ROOT, 'data', 'projects', 'assisted-living-halow.est.json');
const OUT_POOL_EST = path.join(ROOT, 'data', 'projects', 'assisted-living-pool-iot-link.est.json');
const OUT_ALF_ENV = path.join(ROOT, 'deploy', 'iot-link', '.env.assisted-living-halow.example');
const OUT_POOL_ENV = path.join(ROOT, 'deploy', 'iot-link', '.env.assisted-living-pool.example');

function buildAlfHalowEst() {
  if (!fs.existsSync(BASE_ALF_EST)) {
    throw new Error(`Missing ${BASE_ALF_EST} — run: npm run generate:assisted-living`);
  }
  const base = JSON.parse(fs.readFileSync(BASE_ALF_EST, 'utf8'));
  const drivers = allHalowDrivers();
  const tags = applyHalowSemanticMap(base.tags, drivers);

  const settings = {
    ...base.settings,
    project: { name: MAIN_APPLIANCE.projectId },
    assistedLiving: {
      ...(base.settings?.assistedLiving || {}),
      halow: {
        phase: 't-halow',
        futureVendor: 'nexcomm',
        mqttBroker: MAIN_APPLIANCE.mqttBroker,
        semanticMap: SEMANTIC_MAP,
        poolRollupMap: POOL_ROLLUP_MAP,
        hvacCondMap: HVAC_COND_BINDINGS,
      },
      nexcommHvac: {
        nodes: require('./alf-halow-data').NEXCOMM_HVAC_NODES,
        note: 'MCXN947 HVAC MCSA on each floor rooftop — Parc over HaLow to main broker',
      },
      poolSubsystem: {
        enabled: true,
        appliance: POOL_SUBSYSTEM,
        mqttBroker: POOL_SUBSYSTEM.mqttBroker,
        note: 'Pool HaLow nodes (MCXN947 + deck I/O) connect to pool IOT-LINK Mosquitto',
      },
      nextCentury: undefined,
    },
    mqttParc: {
      enabled: true,
      brokerUrl: MAIN_APPLIANCE.mqttBroker,
      topicPrefix: 'mooreview/v1',
      clientId: 'mv-alf-halow-main',
    },
    cloudRemote: {
      enabled: true,
      tenantId: 'assisted-living',
      tenantSlug: SITE.slug,
      siteId: SITE.slug,
      gatewayId: MAIN_APPLIANCE.gatewayId,
      brokerUrl: 'mqtt://<cloud-droplet-ip>:1883',
      topicPrefix: 'mooreview/v1',
      relayParc: true,
      cloudApiUrl: 'http://<cloud-droplet-ip>:3090',
    },
  };
  delete settings.assistedLiving.nextCentury;

  return {
    ...base,
    savedAt: new Date().toISOString(),
    project: { name: MAIN_APPLIANCE.projectId },
    tags,
    drivers,
    settings,
  };
}

function buildPoolHalowEst() {
  const env = {
    MOOREVIEW_POOL_OPTA_IO: 'false',
    MOOREVIEW_POOL_PENTAIR_BUS: 'true',
    MOOREVIEW_POOL_INTELLIFLO: 'true',
    MOOREVIEW_POOL_INTELLIVALVE: 'true',
  };
  let est = buildIotLinkPoolEstDoc({ env });
  est.drivers = patchPoolDrivers(est.drivers);
  est.tags = applyPoolHalowBindings(est.tags, est.drivers);
  est.project = { name: POOL_SUBSYSTEM.projectId };
  est.settings = {
    ...est.settings,
    project: { name: POOL_SUBSYSTEM.projectId },
    poolSubsystem: {
      role: POOL_SUBSYSTEM.role,
      halowNodes: require('./alf-halow-data').POOL_HALOW_NODES,
      optaIo: false,
      halowIo: true,
    },
    assistedLivingSite: SITE,
    mqttParc: {
      ...(est.settings.mqttParc || {}),
      enabled: true,
      brokerUrl: POOL_SUBSYSTEM.mqttBroker,
      clientId: 'mv-alf-pool-iot-link',
    },
    cloudRemote: {
      enabled: true,
      tenantId: 'assisted-living',
      tenantSlug: SITE.slug,
      siteId: 'therapy-pool',
      gatewayId: POOL_SUBSYSTEM.gatewayId,
      brokerUrl: 'mqtt://<cloud-droplet-ip>:1883',
      relayParc: true,
    },
    features: {
      ...(est.settings.features || {}),
      optaIo: false,
      halowIo: true,
    },
  };
  return est;
}

function buildAlfEnv() {
  return `# Assisted living — main building (T-HaLow nodes)
# Copy to /etc/mooreview/env on ALF IOT-LINK (generic install)

PORT=3090
MOOREVIEW_DEPLOYMENT=appliance
MOOREVIEW_PRODUCT=iot-link
MOOREVIEW_DATA=/var/lib/mooreview

MOOREVIEW_RS485_PORT_A=/dev/ttyLP6
MOOREVIEW_RS485_PORT_B=/dev/ttyLP4
MOOREVIEW_MQTT_ENABLED=true
MOOREVIEW_MQTT_BROKER=${MAIN_APPLIANCE.mqttBroker}

# Open project: assisted-living-halow.est.json
# HaLow AP must route to this broker IP for building T-HaLow nodes
# Nexcomm HVAC MCSA (one per floor): hvac_mcsa_fl1, hvac_mcsa_fl2, hvac_mcsa_fl3

# Pool subsystem is a separate IOT-LINK — see .env.assisted-living-pool.example
`;
}

function buildPoolEnv() {
  return `# Assisted living — therapy pool IOT-LINK subsystem
# HaLow pool devices (MCXN947 + deck T-HaLow) use THIS broker

PORT=3090
MOOREVIEW_DEPLOYMENT=appliance
MOOREVIEW_PRODUCT=iot-link-pool
MOOREVIEW_DATA=/var/lib/mooreview

MOOREVIEW_RS485_PORT_A=${POOL_SUBSYSTEM.rs485PortA}
MOOREVIEW_RS485_PORT_B=${POOL_SUBSYSTEM.rs485PortB}

MOOREVIEW_POOL_PENTAIR_BUS=true
MOOREVIEW_POOL_INTELLIFLO=true
MOOREVIEW_POOL_INTELLIVALVE=true
MOOREVIEW_POOL_OPTA_IO=false
MOOREVIEW_POOL_HALOW_IO=true

MOOREVIEW_MQTT_BROKER=${POOL_SUBSYSTEM.mqttBroker}
MOSQUITTO_ALLOW_ANONYMOUS=true

# HaLow commissioning:
#   pool_sensor_01  — MCXN947 chemistry (Parc over HaLow)
#   thalow_pool_deck — flow, leak, dose relays (replaces Opta)

# Install: bash deploy/iot-link/install.sh
# Project: assisted-living-pool-iot-link.est.json
`;
}

function main() {
  fs.writeFileSync(OUT_MANIFEST, `${JSON.stringify(manifest(), null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_CSV, `${halowNodeCsvLines().join('\n')}\n`, 'utf8');

  const alfEst = buildAlfHalowEst();
  const poolEst = buildPoolHalowEst();

  fs.mkdirSync(path.dirname(OUT_ALF_EST), { recursive: true });
  fs.writeFileSync(OUT_ALF_EST, `${JSON.stringify(alfEst, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_POOL_EST, `${JSON.stringify(poolEst, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_ALF_ENV, buildAlfEnv(), 'utf8');
  fs.writeFileSync(OUT_POOL_ENV, buildPoolEnv(), 'utf8');

  console.log('Assisted-living HaLow artifacts generated:');
  console.log(`  ${path.relative(ROOT, OUT_MANIFEST)}`);
  console.log(`  ${path.relative(ROOT, OUT_CSV)}`);
  console.log(`  ${path.relative(ROOT, OUT_ALF_EST)} (${alfEst.drivers.length} building HaLow drivers)`);
  console.log(`  ${path.relative(ROOT, OUT_POOL_EST)} (${poolEst.drivers.filter((d) => d.type === 'mqtt_parc').length} pool HaLow drivers)`);
  console.log(`  ${path.relative(ROOT, OUT_ALF_ENV)}`);
  console.log(`  ${path.relative(ROOT, OUT_POOL_ENV)}`);
}

main();
