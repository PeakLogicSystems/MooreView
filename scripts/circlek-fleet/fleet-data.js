'use strict';

/**
 * C-store / Circle K — Opta Parc cloud lift fleet metadata.
 *
 * Portable SaaS workflow: deploy cloud once → admin creates tenant → import
 * `cstore-opta-parc-starter` → add stores from Parc registry as Optas connect.
 *
 * Circle K Florida sample sites + CSV are reference data for bulk import / demos —
 * not pre-loaded in the starter project.
 */

/** Bundled empty project — import per customer tenant in Cloud Studio. */
const STARTER = {
  projectId: 'cstore-opta-parc-starter',
  projectName: 'cstore-opta-parc-starter',
  rollupProgram: 'logic/cstore_opta_parc_fleet_rollup.st',
  fleetAlarmTag: 'FLEET_ANY_ALM',
  fleet3dUrl: '/samples/cstore-opta-parc-fleet-3d.html',
  templateId: 'lift_station_dual_duplex',
  defaultProgram: 'logic/36_duplex_lift_station.st',
};

/** Full Circle K Florida fleet — 500 stores, 400 monitored lift/septic (cloud import). */
const FLEET = {
  projectId: 'circle-k-florida-fleet',
  projectName: 'circle-k-florida-fleet',
  rollupProgram: 'logic/circle_k_florida_fleet_rollup.st',
  fleetAlarmTag: 'FLEET_ANY_ALM',
  fleet3dUrl: '/samples/circle-k-florida-fleet-3d.html',
  totalStores: 500,
  monitoredStores: 400,
  storeNumberBase: 2701001,
};

/** Demo sample — 12 reference stores. */
const DEMO = {
  projectId: 'circle-k-florida-demo',
  projectName: 'circle-k-florida-demo',
  rollupProgram: 'logic/circle_k_fleet_rollup.st',
};

/** Example operator for Circle K Florida (create this tenant in /admin/tenants). */
const OPERATOR = {
  name: 'Circle K',
  slug: 'circle-k-florida',
  tenantId: 'circle-k-florida',
  parent: 'Alimentation Couche-Tard',
  website: 'https://www.circlek.com',
  region: 'Florida',
};

const { FLORIDA_COUNTIES } = require('./florida-counties');

/** Directional installed-base size (Circle K Florida c-store grease/lift retrofit). */
const INSTALLED_BASE_ESTIMATE = 500;

/** Fleet planning targets. */
const FLEET_TOTAL_STORES = FLEET.totalStores;
const FLEET_MONITORED_STORES = FLEET.monitoredStores;

const MQTT_PARC_BROKER = process.env.MQTT_PARC_BROKER || 'mqtt://127.0.0.1:1883';

/**
 * Sample Circle K stores — duplex grease/lift Opta panels (DUPLEXLS + CT PdM).
 * Replace deviceId from Opta /setup or Parc registry at commissioning.
 * @type {Array<{
 *   name: string, slug: string, storeNumber: string, address: string, county: string,
 *   lat: number, lng: number, deviceId: string, product: string,
 *   hasCt: boolean, locationClass: string,
 * }>}
 */
/** Reference sample stores — demo CSV / sales walkthrough only. */
const SAMPLE_LIFT_STATIONS = [
  {
    name: 'Circle K #2701045 — Tampa Fowler Ave',
    slug: 'tampa-fowler-ave',
    storeNumber: '2701045',
    address: '4202 E Fowler Ave, Tampa, FL 33620',
    county: 'hillsborough',
    lat: 28.054,
    lng: -82.411,
    deviceId: 'mv_ck_tampa_fowler_01',
    product: 'arduino opta mqtt parc',
    hasCt: true,
    locationClass: 'cstore',
  },
  {
    name: 'Circle K #2702712 — Orlando Colonial Dr',
    slug: 'orlando-colonial-dr',
    storeNumber: '2702712',
    address: '12301 E Colonial Dr, Orlando, FL 32826',
    county: 'orange',
    lat: 28.569,
    lng: -81.208,
    deviceId: 'mv_ck_orlando_colonial_01',
    product: 'arduino opta mqtt parc',
    hasCt: true,
    locationClass: 'cstore',
  },
  {
    name: 'Circle K #2703891 — Miami NW 27th Ave',
    slug: 'miami-nw-27th',
    storeNumber: '2703891',
    address: '8901 NW 27th Ave, Miami, FL 33147',
    county: 'miami-dade',
    lat: 25.857,
    lng: -80.244,
    deviceId: 'mv_ck_miami_nw27_01',
    product: 'arduino opta mqtt parc',
    hasCt: true,
    locationClass: 'cstore',
  },
  {
    name: 'Circle K #2701523 — Jacksonville Beach Blvd',
    slug: 'jacksonville-beach-blvd',
    storeNumber: '2701523',
    address: '8500 Beach Blvd, Jacksonville, FL 32216',
    county: 'duval',
    lat: 30.287,
    lng: -81.589,
    deviceId: 'mv_ck_jax_beach_01',
    product: 'arduino opta mqtt parc',
    hasCt: true,
    locationClass: 'cstore',
  },
  {
    name: 'Circle K #2704410 — Fort Lauderdale Federal Hwy',
    slug: 'ft-lauderdale-federal',
    storeNumber: '2704410',
    address: '2200 S Federal Hwy, Fort Lauderdale, FL 33316',
    county: 'broward',
    lat: 26.112,
    lng: -80.137,
    deviceId: 'mv_ck_ftl_federal_01',
    product: 'arduino opta mqtt parc',
    hasCt: true,
    locationClass: 'cstore',
  },
  {
    name: 'Circle K #2701988 — Gainesville University Ave',
    slug: 'gainesville-university-ave',
    storeNumber: '2701988',
    address: '1700 W University Ave, Gainesville, FL 32603',
    county: 'alachua',
    lat: 29.652,
    lng: -82.349,
    deviceId: 'mv_ck_gainesville_univ_01',
    product: 'arduino opta mqtt parc',
    hasCt: true,
    locationClass: 'cstore',
  },
  {
    name: 'Circle K #2703055 — Tallahassee Tennessee St',
    slug: 'tallahassee-tennessee-st',
    storeNumber: '2703055',
    address: '1202 W Tennessee St, Tallahassee, FL 32304',
    county: 'leon',
    lat: 30.445,
    lng: -84.298,
    deviceId: 'mv_ck_tally_tenn_01',
    product: 'arduino opta mqtt parc',
    hasCt: true,
    locationClass: 'cstore',
  },
  {
    name: 'Circle K #2705122 — Naples Airport Rd',
    slug: 'naples-airport-rd',
    storeNumber: '2705122',
    address: '4100 Airport-Pulling Rd N, Naples, FL 34105',
    county: 'collier',
    lat: 26.154,
    lng: -81.775,
    deviceId: 'mv_ck_naples_airport_01',
    product: 'arduino opta mqtt parc',
    hasCt: true,
    locationClass: 'cstore',
  },
  {
    name: 'Circle K #2700876 — Pensacola Davis Hwy',
    slug: 'pensacola-davis-hwy',
    storeNumber: '2700876',
    address: '6200 N Davis Hwy, Pensacola, FL 32504',
    county: 'escambia',
    lat: 30.474,
    lng: -87.212,
    deviceId: 'mv_ck_pensacola_davis_01',
    product: 'arduino opta mqtt parc',
    hasCt: true,
    locationClass: 'cstore',
  },
  {
    name: 'Circle K #2702234 — St Petersburg 4th St N',
    slug: 'st-pete-4th-st',
    storeNumber: '2702234',
    address: '4501 4th St N, St Petersburg, FL 33703',
    county: 'pinellas',
    lat: 27.813,
    lng: -82.638,
    deviceId: 'mv_ck_stpete_4th_01',
    product: 'arduino opta mqtt parc',
    hasCt: true,
    locationClass: 'cstore',
  },
  {
    name: 'Circle K #2703677 — Lakeland US Hwy 98',
    slug: 'lakeland-us98',
    storeNumber: '2703677',
    address: '4520 US Hwy 98 N, Lakeland, FL 33809',
    county: 'polk',
    lat: 28.118,
    lng: -81.973,
    deviceId: 'mv_ck_lakeland_us98_01',
    product: 'arduino opta mqtt parc',
    hasCt: true,
    locationClass: 'cstore',
  },
  {
    name: 'Circle K #2704189 — Daytona Beach ISB',
    slug: 'daytona-isp-blvd',
    storeNumber: '2704189',
    address: '1400 International Speedway Blvd, Daytona Beach, FL 32114',
    county: 'volusia',
    lat: 29.185,
    lng: -81.071,
    deviceId: 'mv_ck_daytona_isb_01',
    product: 'arduino opta mqtt parc',
    hasCt: true,
    locationClass: 'cstore',
  },
];

function stationMeta(station) {
  const isSimplex = station.stationType === 'simplex' || station.monitorType === 'septic';
  const templateId = station.templateId
    || (isSimplex ? 'lift_station_simplex' : 'lift_station_dual_duplex');
  const defaultProgram = station.defaultProgram
    || (isSimplex ? 'logic/35_lift_simplex.st' : 'logic/36_duplex_lift_station.st');
  const prefix = station.tagPrefix || station.slug.replace(/-/g, '_').slice(0, 10).toUpperCase();
  return {
    templateId,
    defaultProgram,
    driverId: station.driverId || `ck_${station.slug.replace(/-/g, '_')}`,
    tagPrefix: prefix,
    fleetAlarmTag: `FLEET_${prefix}_ALM`,
    alarmTag: `${prefix}_ALT_FAULT`,
    levelTag: `${prefix}_TANK_LVL`,
  };
}

function enrichStation(raw) {
  const monitored = raw.monitored !== false;
  if (!monitored) {
    return {
      ...raw,
      monitored: false,
      monitorType: null,
      stationType: null,
      templateId: null,
      driverId: null,
      tagPrefix: null,
      fleetAlarmTag: null,
      alarmTag: null,
      levelTag: null,
      defaultProgram: null,
      uplink: null,
      phase: raw.phase || null,
      iotLinkPhase2: raw.iotLinkPhase2 !== false,
    };
  }
  const isSimplex = raw.monitorType === 'septic' || raw.stationType === 'simplex';
  const meta = stationMeta(raw);
  return {
    ...raw,
    stationType: isSimplex ? 'simplex' : (raw.stationType || 'dual_duplex'),
    templateId: meta.templateId,
    driverId: raw.driverId || meta.driverId,
    tagPrefix: raw.tagPrefix || meta.tagPrefix,
    fleetAlarmTag: meta.fleetAlarmTag,
    alarmTag: meta.alarmTag,
    levelTag: meta.levelTag,
    defaultProgram: meta.defaultProgram,
    uplink: 'opta_parc_direct',
    phase: raw.phase || 1,
    iotLinkPhase2: raw.iotLinkPhase2 !== false,
    monitored: true,
  };
}

const STATIONS = SAMPLE_LIFT_STATIONS.map(enrichStation);

/** @deprecated use STATIONS — kept for tests/generators */
const LIFT_STATIONS = STATIONS;

/** Florida centroid for fleet 3D map projection. */
const FLEET_MAP_CENTER = {
  name: 'Circle K Florida — regional view',
  lat: 28.1,
  lng: -81.6,
};

function pdmAssetId(station, pumpIndex) {
  return `${station.slug}-pump-${pumpIndex}`;
}

function pdmTagsForPump(station, pumpIndex) {
  const p = station.tagPrefix;
  const n = pumpIndex;
  const tags = [
    `${p}_P${n}_STARTS`,
    `${p}_P${n}_RUNTIME_HRS`,
    `${p}_P${n}_RUN_FB`,
    `${p}_LVL_HIGH`,
    `${p}_ALT_FAULT`,
  ];
  if (station.hasCt && n === 1) tags.push(`${p}_AI1`, `${p}_AI2`, `${p}_AI3`);
  if (station.hasCt && n === 2) tags.push(`${p}_AI4`, `${p}_AI5`, `${p}_AI6`);
  return tags;
}

function buildPdmBlock(stations = STATIONS) {
  const assetTags = {};
  const assetContext = {};
  for (const s of stations) {
    if (s.monitored === false) continue;
    const pumpCount = s.stationType === 'simplex' ? 1 : 2;
    for (let pumpIndex = 1; pumpIndex <= pumpCount; pumpIndex += 1) {
      const assetId = pdmAssetId(s, pumpIndex);
      assetTags[assetId] = pdmTagsForPump(s, pumpIndex);
      assetContext[assetId] = {
        application: s.monitorType === 'septic' ? 'septic_lift' : 'lift_station',
        configuration: s.stationType === 'simplex' ? 'simplex' : 'duplex',
        pumpIndex,
        pumpRole: pumpIndex === 1 ? 'lead' : 'lag',
        locationClass: s.locationClass || 'cstore',
        siteId: s.slug,
        operatorSlug: OPERATOR.slug,
        storeNumber: s.storeNumber,
        monitorType: s.monitorType || 'lift',
        hasCt: !!s.hasCt,
        floatLadder: 'pull_down',
        installDate: '2026-01-01',
        phase: s.phase || 1,
      };
    }
  }
  return {
    assetTags,
    assetContext,
    windowMin: 15,
    failureThreshold: 0.35,
    buildEnabled: true,
    buildIntervalHours: 24,
    liftModelId: 'lift-submersible-v2',
    forecastMethods: ['starts_analytics', 'run_amps_creep', 'mcsa_onnx'],
    featuresCollection: 'pdm_features',
  };
}

function starterManifest() {
  return {
    mode: 'incremental',
    starterProject: STARTER.projectId,
    onboardingDoc: 'docs/CSTORE_OPTA_PARC_CLOUD.md',
    bridgeMode: 'opta_parc_direct',
    mqttParcBroker: MQTT_PARC_BROKER,
    product: 'arduino opta mqtt parc',
    templateId: STARTER.templateId,
    defaultProgram: STARTER.defaultProgram,
    fleet3dUrl: STARTER.fleet3dUrl,
    liftStations: [],
    bulkImportCsv: 'st/fixtures/fleet_import_circle_k.csv',
    referenceOperator: OPERATOR,
    planningInstalledBase: INSTALLED_BASE_ESTIMATE,
    commissioning: {
      doc: 'docs/OPTA_PARC_CLOUD.md',
      brokerPort: 1883,
      topicPattern: 'mooreview/v1/{deviceId}/telemetry',
      addDriver: 'Drivers → Add Opta Parc devices (from registry)',
      applyTemplate: STARTER.templateId,
    },
  };
}

function sampleFleetManifest(stations = STATIONS) {
  return {
    operator: OPERATOR,
    installedBaseEstimate: INSTALLED_BASE_ESTIMATE,
    cloudProject: 'circle-k-florida-demo',
    bridgeMode: 'opta_parc_direct',
    mqttParcBroker: MQTT_PARC_BROKER,
    product: 'arduino opta mqtt parc',
    templateId: 'lift_station_dual_duplex',
    fleetMapCenter: FLEET_MAP_CENTER,
    ctEquippedCount: stations.filter((s) => s.hasCt).length,
    liftStations: stations.map((s) => ({
      name: s.name,
      slug: s.slug,
      storeNumber: s.storeNumber,
      address: s.address,
      county: s.county,
      lat: s.lat,
      lng: s.lng,
      deviceId: s.deviceId,
      product: s.product,
      hasCt: s.hasCt,
      locationClass: s.locationClass,
      driverId: s.driverId,
      tagPrefix: s.tagPrefix,
      templateId: s.templateId,
      fleetAlarmTag: s.fleetAlarmTag,
      alarmTag: s.alarmTag,
      levelTag: s.levelTag,
    })),
    pdm: {
      mode: 'mcsa_onnx + run_amps_creep',
      ctTier: '6-channel CT + on-device MCSA-lite',
      note: 'Opta firmware 2.3.73+ publishes mcsa[] on pump starts',
    },
  };
}

/** @deprecated use sampleFleetManifest */
function fleetManifest(stations = STATIONS) {
  return sampleFleetManifest(stations);
}

/**
 * Deterministic pseudo-random jitter for store lat/lng within a county.
 */
function jitterCoord(base, index, axis) {
  const n = Math.sin((index + 1) * 12.9898 + (axis === 'lat' ? 78.233 : 45.164)) * 43758.5453;
  return base + (n - Math.floor(n) - 0.5) * 0.35;
}

/**
 * Generate Circle K Florida fleet: 500 stores, `monitoredCount` with lift/septic Opta paths.
 * @param {object} [opts]
 * @param {number} [opts.total=500]
 * @param {number} [opts.monitored=400]
 * @param {number} [opts.storeNumberBase=2701001]
 * @param {number} [opts.septicShare=0.3] — share of monitored that are septic/simplex
 */
function generateFloridaFleet(opts = {}) {
  const total = opts.total ?? FLEET.totalStores;
  const monitored = opts.monitored ?? FLEET.monitoredStores;
  const storeNumberBase = opts.storeNumberBase ?? FLEET.storeNumberBase;
  const septicShare = opts.septicShare ?? 0.3;
  const septicCount = Math.round(monitored * septicShare);
  const liftCount = monitored - septicCount;
  const counties = FLORIDA_COUNTIES.length ? FLORIDA_COUNTIES : [{ slug: 'florida', name: 'Florida', lat: 28.1, lng: -81.6 }];
  const all = [];

  for (let i = 0; i < total; i += 1) {
    const storeNumber = String(storeNumberBase + i);
    const county = counties[i % counties.length];
    const slug = `ck-${storeNumber}`;
    const isMonitored = i < monitored;
    const monitorIndex = i;
    let monitorType = null;
    let stationType = null;
    if (isMonitored) {
      if (monitorIndex < liftCount) {
        monitorType = 'lift';
        stationType = 'dual_duplex';
      } else {
        monitorType = 'septic';
        stationType = 'simplex';
      }
    }
    const tagIdx = String(i + 1).padStart(3, '0');
    all.push({
      name: `Circle K #${storeNumber} — ${county.name}`,
      slug,
      storeNumber,
      address: `${100 + (i % 900)} FL-${county.slug.toUpperCase().slice(0, 3)} Hwy, ${county.name} County, FL`,
      county: county.slug,
      lat: jitterCoord(county.lat, i, 'lat'),
      lng: jitterCoord(county.lng, i, 'lng'),
      deviceId: `mv_ck_${storeNumber}`,
      product: isMonitored ? 'arduino opta mqtt parc' : 'unmonitored',
      hasCt: isMonitored && monitorType === 'lift' && (i % 3 !== 0),
      locationClass: 'cstore',
      monitored: isMonitored,
      monitorType,
      stationType,
      tagPrefix: isMonitored ? `CK${tagIdx}` : null,
      driverId: isMonitored ? `ck_${storeNumber}` : null,
      phase: 1,
      iotLinkPhase2: true,
      iotLinkRole: 'hvac-refrigeration-leak-cooler',
    });
  }
  return all.map(enrichStation);
}

function fleetFleetManifest(stores = []) {
  const monitored = stores.filter((s) => s.monitored !== false);
  return {
    operator: OPERATOR,
    installedBaseEstimate: FLEET.totalStores,
    monitoredStores: monitored.length,
    unmonitoredStores: stores.length - monitored.length,
    cloudProject: FLEET.projectId,
    bridgeMode: 'opta_parc_direct',
    mqttParcBroker: MQTT_PARC_BROKER,
    product: 'arduino opta mqtt parc',
    fleetMapCenter: FLEET_MAP_CENTER,
    ctEquippedCount: monitored.filter((s) => s.hasCt).length,
    liftCount: monitored.filter((s) => s.monitorType === 'lift').length,
    septicCount: monitored.filter((s) => s.monitorType === 'septic').length,
    rollout: {
      phase1: 'Opta Parc direct to cloud — lift/septic monitoring',
      phase2: 'IoT-Link per store — HVAC, refrigeration, leaks, cooler/freezer (planned)',
    },
    liftStations: monitored.map((s) => ({
      name: s.name,
      slug: s.slug,
      storeNumber: s.storeNumber,
      address: s.address,
      county: s.county,
      lat: s.lat,
      lng: s.lng,
      deviceId: s.deviceId,
      product: s.product,
      hasCt: s.hasCt,
      locationClass: s.locationClass,
      monitorType: s.monitorType,
      stationType: s.stationType,
      driverId: s.driverId,
      tagPrefix: s.tagPrefix,
      templateId: s.templateId,
      fleetAlarmTag: s.fleetAlarmTag,
      alarmTag: s.alarmTag,
      levelTag: s.levelTag,
      phase: s.phase,
      iotLinkPhase2: s.iotLinkPhase2,
    })),
    allStores: stores.map((s) => ({
      storeNumber: s.storeNumber,
      slug: s.slug,
      county: s.county,
      lat: s.lat,
      lng: s.lng,
      monitored: s.monitored !== false,
      monitorType: s.monitorType || null,
    })),
    pdm: {
      mode: 'host ONNX + run_amps_creep on cloud :3090',
      ctTier: '6-channel CT + Opta MCSA-lite on lift stores',
      note: 'See docs/AI_EDGE_CLOUD.md — cloud host inference, IoT-Link phase 2',
    },
  };
}

function fleetCsvLines(stations = STATIONS) {
  const header = [
    'tenant_slug',
    'site_slug',
    'site_name',
    'store_number',
    'address',
    'county',
    'lat',
    'lng',
    'monitored',
    'monitor_type',
    'station_type',
    'phase',
    'iot_link_phase2',
    'device_id',
    'product',
    'has_ct',
    'location_class',
    'template_id',
    'driver_id',
    'tag_prefix',
  ].join(',');
  const rows = stations.map((s) => [
    OPERATOR.slug,
    s.slug,
    `"${s.name.replace(/"/g, '""')}"`,
    s.storeNumber,
    `"${s.address.replace(/"/g, '""')}"`,
    s.county,
    s.lat,
    s.lng,
    s.monitored === false ? '0' : '1',
    s.monitorType || '',
    s.stationType || '',
    s.phase || 1,
    s.iotLinkPhase2 ? '1' : '0',
    s.deviceId || '',
    s.product,
    s.hasCt ? '1' : '0',
    s.locationClass,
    s.templateId || '',
    s.driverId || '',
    s.tagPrefix || '',
  ].join(','));
  return [header, ...rows];
}

module.exports = {
  STARTER,
  FLEET,
  DEMO,
  OPERATOR,
  INSTALLED_BASE_ESTIMATE,
  FLEET_TOTAL_STORES,
  FLEET_MONITORED_STORES,
  MQTT_PARC_BROKER,
  FLEET_MAP_CENTER,
  SAMPLE_LIFT_STATIONS,
  LIFT_STATIONS: STATIONS,
  FLORIDA_COUNTIES,
  stationMeta,
  pdmAssetId,
  pdmTagsForPump,
  buildPdmBlock,
  starterManifest,
  sampleFleetManifest,
  fleetFleetManifest,
  fleetManifest,
  fleetCsvLines,
  generateFloridaFleet,
  enrichStation,
};
