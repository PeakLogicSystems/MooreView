'use strict';

/**
 * ACE Septic & Waste — LiftPoint Light fleet (Nexcomm + Purple Standard channel).
 * Scaffold: representative sample sites + CSV import row for bulk 2,000+ fleet.
 * All sites use lift_station_epi + liftProfile liftpoint_light (Track A MQTT).
 */

const OPERATOR = {
  name: 'ACE Septic & Waste',
  slug: 'ace-septic-waste',
  tenantId: 'ace-septic-waste',
  parent: 'The Purple Standard',
  website: 'https://www.acesepticandwaste.com',
};

/** Directional installed-base size (Nexcomm LiftPoint Light + ACE field service). */
const INSTALLED_BASE_ESTIMATE = 2000;

const NEXUS_MQTT_BROKER = process.env.NEXUS_MQTT_BROKER || 'mqtt://127.0.0.1:1883';

/**
 * Sample LiftPoint Light sites — mix of CT-equipped (amp PdM) and starts-only.
 * Replace serial_num / nexus_device_id from Nexus Cloud export for production cutover.
 * @type {Array<{
 *   name: string, slug: string, address: string, county: string,
 *   lat: number, lng: number, serialNum: string, product: string,
 *   hasCt: boolean, locationClass: string,
 *   nexusDeviceId?: string, nexusAreaId?: string,
 * }>}
 */
const LIFT_STATIONS = [
  {
    name: 'Salvation Army — US 41',
    slug: 'salvation-army-us41',
    address: 'US Hwy 41, Tampa Bay, FL',
    county: 'hillsborough',
    lat: 27.946,
    lng: -82.458,
    serialNum: '862406071948166',
    product: 'liftpoint light',
    hasCt: true,
    locationClass: 'office',
    nexusDeviceId: 'salvation-army-us41',
  },
  {
    name: 'Largo Commerce Park Lift',
    slug: 'largo-commerce-park',
    address: 'Largo, FL',
    county: 'pinellas',
    lat: 27.909,
    lng: -82.787,
    serialNum: '862406071948201',
    product: 'liftpoint light',
    hasCt: true,
    locationClass: 'strip_mall',
    nexusDeviceId: 'largo-commerce-park',
  },
  {
    name: 'Land O Lakes Medical Plaza',
    slug: 'lol-medical-plaza',
    address: 'Land O Lakes, FL',
    county: 'pasco',
    lat: 28.218,
    lng: -82.457,
    serialNum: '862406071948202',
    product: 'liftpoint light',
    hasCt: false,
    locationClass: 'office',
    nexusDeviceId: 'lol-medical-plaza',
  },
  {
    name: 'Spring Hill Apartments Lift',
    slug: 'spring-hill-apartments',
    address: 'Spring Hill, FL',
    county: 'hernando',
    lat: 28.476,
    lng: -82.525,
    serialNum: '862406071948203',
    product: 'liftpoint light',
    hasCt: false,
    locationClass: 'alf',
    nexusDeviceId: 'spring-hill-apartments',
  },
  {
    name: 'Lakeland Retail Center Lift',
    slug: 'lakeland-retail-center',
    address: 'Lakeland, FL',
    county: 'polk',
    lat: 28.04,
    lng: -81.953,
    serialNum: '862406071948204',
    product: 'liftpoint light',
    hasCt: false,
    locationClass: 'restaurant',
    nexusDeviceId: 'lakeland-retail-center',
  },
  {
    name: 'Tampa Hotel Lift Station',
    slug: 'tampa-hotel-lift',
    address: 'Tampa, FL',
    county: 'hillsborough',
    lat: 27.95,
    lng: -82.45,
    serialNum: '862406071948205',
    product: 'liftpoint light',
    hasCt: true,
    locationClass: 'restaurant',
    nexusDeviceId: 'tampa-hotel-lift',
  },
  {
    name: 'Pasco Strip Mall Lift',
    slug: 'pasco-strip-mall',
    address: 'Pasco County, FL',
    county: 'pasco',
    lat: 28.32,
    lng: -82.69,
    serialNum: '862406071948206',
    product: 'liftpoint light',
    hasCt: false,
    locationClass: 'strip_mall',
    nexusDeviceId: 'pasco-strip-mall',
  },
  {
    name: 'Hernando Industrial Lift',
    slug: 'hernando-industrial',
    address: 'Brooksville, FL',
    county: 'hernando',
    lat: 28.555,
    lng: -82.387,
    serialNum: '862406071948207',
    product: 'liftpoint light',
    hasCt: true,
    locationClass: 'warehouse',
    nexusDeviceId: 'hernando-industrial',
  },
];

function stationMeta(station) {
  const prefix = station.tagPrefix || station.slug.replace(/-/g, '_').slice(0, 8).toUpperCase();
  return {
    templateId: 'lift_station_epi',
    liftProfile: 'liftpoint_light',
    defaultProgram: 'logic/36_duplex_lift_station.st',
    driverId: station.driverId || `mqtt_${station.slug.replace(/-/g, '_')}`,
    tagPrefix: prefix,
    fleetAlarmTag: `FLEET_${prefix}_ALM`,
    alarmTag: `${prefix}_LVL_HIGH`,
  };
}

function enrichStation(raw) {
  const meta = stationMeta(raw);
  return {
    ...raw,
    stationType: 'dual_duplex',
    templateId: meta.templateId,
    liftProfile: meta.liftProfile,
    driverId: meta.driverId,
    tagPrefix: meta.tagPrefix,
    fleetAlarmTag: meta.fleetAlarmTag,
    alarmTag: meta.alarmTag,
    defaultProgram: meta.defaultProgram,
    uplink: 'nexus_mqtt',
  };
}

const STATIONS = LIFT_STATIONS.map(enrichStation);

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
    `${p}_LVL_LEAD`,
  ];
  if (station.hasCt && n === 1) tags.push(`${p}_AI1`);
  if (station.hasCt && n === 2) tags.push(`${p}_AI2`);
  return tags;
}

function buildPdmBlock(stations = STATIONS) {
  const assetTags = {};
  const assetContext = {};
  for (const s of stations) {
    for (const pumpIndex of [1, 2]) {
      const assetId = pdmAssetId(s, pumpIndex);
      assetTags[assetId] = pdmTagsForPump(s, pumpIndex);
      assetContext[assetId] = {
        application: 'lift_station',
        configuration: 'duplex',
        pumpIndex,
        pumpRole: pumpIndex === 1 ? 'lead' : 'lag',
        locationClass: s.locationClass || 'strip_mall',
        siteId: s.slug,
        operatorSlug: OPERATOR.slug,
        hasCt: !!s.hasCt,
        floatLadder: 'pull_down',
        installDate: '2022-01-01',
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
    forecastMethods: ['starts_analytics', 'run_amps_creep'],
    featuresCollection: 'pdm_features',
  };
}

function fleetManifest(stations = STATIONS) {
  return {
    operator: OPERATOR,
    installedBaseEstimate: INSTALLED_BASE_ESTIMATE,
    cloudProject: 'ace-liftpoint-fleet',
    bridgeMode: 'track_a_mqtt',
    mqttBroker: NEXUS_MQTT_BROKER,
    product: 'liftpoint light',
    ctEquippedCount: stations.filter((s) => s.hasCt).length,
    startsOnlyCount: stations.filter((s) => !s.hasCt).length,
    liftStations: stations.map((s) => ({
      name: s.name,
      slug: s.slug,
      address: s.address,
      county: s.county,
      lat: s.lat,
      lng: s.lng,
      serialNum: s.serialNum,
      product: s.product,
      hasCt: s.hasCt,
      locationClass: s.locationClass,
      driverId: s.driverId,
      tagPrefix: s.tagPrefix,
      templateId: s.templateId,
      liftProfile: s.liftProfile,
      nexusDeviceId: s.nexusDeviceId,
    })),
    pdm: {
      mode: 'starts_analytics',
      ctTier: 'run_amps_creep when hasCt',
      nonCtTier: 'starts_analytics only',
    },
  };
}

function fleetCsvLines(stations = STATIONS) {
  const header = [
    'tenant_slug',
    'site_slug',
    'site_name',
    'address',
    'county',
    'lat',
    'lng',
    'serial_num',
    'product',
    'has_ct',
    'location_class',
    'nexus_device_id',
    'template_id',
    'lift_profile',
    'driver_id',
    'tag_prefix',
  ].join(',');
  const rows = stations.map((s) => [
    OPERATOR.slug,
    s.slug,
    `"${s.name.replace(/"/g, '""')}"`,
    `"${s.address.replace(/"/g, '""')}"`,
    s.county,
    s.lat,
    s.lng,
    s.serialNum,
    s.product,
    s.hasCt ? '1' : '0',
    s.locationClass,
    s.nexusDeviceId || '',
    s.templateId,
    s.liftProfile,
    s.driverId,
    s.tagPrefix,
  ].join(','));
  return [header, ...rows];
}

module.exports = {
  OPERATOR,
  INSTALLED_BASE_ESTIMATE,
  NEXUS_MQTT_BROKER,
  LIFT_STATIONS: STATIONS,
  stationMeta,
  pdmAssetId,
  pdmTagsForPump,
  buildPdmBlock,
  fleetManifest,
  fleetCsvLines,
};
