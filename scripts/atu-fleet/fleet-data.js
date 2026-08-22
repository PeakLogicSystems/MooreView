'use strict';

/**
 * Aerobic treatment unit (ATU) cloud fleets — 100% cellular Opta → cloud MQTT.
 * ATU edge programs: single / dual / quad (duplex trains + TPO schedules).
 * Lift stations: simplex, dual_duplex (and triplex) support collection networks.
 */

const TENANT = {
  name: 'MooreVIEW ATU Service',
  slug: 'atu-cloud',
  tenantId: 'atu-cloud',
};

/** @type {Record<string, object>} */
const STATION_TYPES = {
  simplex: {
    templateId: 'lift_station_simplex',
    defaultProgram: 'logic/35_lift_simplex.st',
    alarmTag: 'ALT_FAULT',
    levelTag: 'LVL_HIGH',
    pumps: 1,
    category: 'lift',
    role: 'lift',
  },
  dual_duplex: {
    templateId: 'lift_station_dual_duplex',
    defaultProgram: 'logic/36_duplex_lift_station.st',
    alarmTag: 'ALT_FAULT',
    levelTag: 'TANK_LVL',
    pumps: 2,
    category: 'lift',
    role: 'lift',
    ioBaseOnly: true,
  },
  triplex: {
    templateId: 'lift_station_triplex',
    defaultProgram: 'logic/28_alternator_triplex.st',
    alarmTag: 'TPX_ALM',
    levelTag: 'TPX_LEVEL',
    pumps: 3,
    category: 'lift',
    role: 'lift',
  },
  single_atu: {
    templateId: 'lift_station_single_atu',
    defaultProgram: 'logic/32_single_atu.st',
    alarmTag: 'ALT_FAULT',
    alarmTags: ['ALT_FAULT'],
    levelTag: 'LVL_HIGH',
    trains: 1,
    category: 'atu',
    role: 'atu',
    typicalGpd: '250–750',
  },
  dual_atu: {
    templateId: 'lift_station_dual_atu',
    defaultProgram: 'logic/33_dual_atu.st',
    alarmTag: 'ALT_FAULT',
    alarmTags: ['ALT_FAULT', 'ALT_FAULT2'],
    levelTag: 'LVL_HIGH',
    trains: 2,
    category: 'atu',
    role: 'atu',
    typicalGpd: '500–1500',
  },
  quad_atu: {
    templateId: 'lift_station_quad_atu',
    defaultProgram: 'logic/34_quad_atu.st',
    alarmTag: 'ALT_FAULT',
    alarmTags: ['ALT_FAULT', 'ALT_FAULT2', 'ALT_FAULT3', 'ALT_FAULT4'],
    levelTag: 'LVL_HIGH',
    trains: 4,
    category: 'atu',
    role: 'atu',
    typicalGpd: '1000–4000',
  },
};

const SIZING_GUIDE = {
  description: 'ATU trains run duplex alternation (ALT2) with TPO aeration schedules on-device. Lift stations handle wet-well collection/distribution on separate cellular gateways.',
  uplink: 'cellular_mqtt',
  deployment: '100% cloud — no site IOT-LINK; each Opta + modem publishes Parc to MooreVIEW cloud Mosquitto',
  atuToLiftPairing: [
    { atu: 'single_atu', typicalLift: 'simplex or dual_duplex', note: 'Residential 500 GPD often uses one single ATU only' },
    { atu: 'dual_atu', typicalLift: 'dual_duplex', note: 'Two treatment trains; paired duplex lift for equalization' },
    { atu: 'quad_atu', typicalLift: 'simplex × N or dual_duplex × N', note: 'Commercial sites scale lift count with collection network' },
  ],
  scaleExamples: [
    { designGpd: 500, atu: [{ type: 'single_atu', count: 1 }], lifts: [] },
    { designGpd: 2500, atu: [{ type: 'dual_atu', count: 1 }], lifts: [{ type: 'simplex', count: 4 }] },
    { designGpd: 10000, atu: [{ type: 'quad_atu', count: 4 }], lifts: [{ type: 'simplex', count: 20 }] },
    {
      designGpd: 10000,
      profile: 'dwts',
      atu: [{ type: 'quad_atu', count: 2, gpdEach: 5000, modules: '4× 1,250 gal parallel + drip' }],
      lifts: [
        { type: 'simplex', count: 20, role: 'collection', note: '10 simplex lifts per zone → duplex booster' },
        { type: 'dual_duplex', count: 2, role: 'booster', note: 'Zone booster → trash tank → parallel ATU' },
      ],
    },
  ],
};

const DWTS_MODULE_GAL = 1250;
const DWTS_MODULES_PER_ZONE = 4;
const DWTS_SIMPLEX_PER_ZONE = 10;
const DWTS_TRASH_MIN_GAL = 1000;

function dwtsPlantTanks(zoneGpd) {
  return [
    {
      id: 'trash',
      label: 'Trash / pretreatment tank',
      capacityGal: DWTS_TRASH_MIN_GAL,
      rule: '≥1,000 gal before parallel ATU modules (Florida DEP)',
    },
    ...Array.from({ length: DWTS_MODULES_PER_ZONE }, (_, i) => ({
      id: `atu_${i + 1}`,
      label: `Parallel treatment module ${i + 1}`,
      capacityGal: DWTS_MODULE_GAL,
      parallel: true,
      gpdEach: zoneGpd / DWTS_MODULES_PER_ZONE,
    })),
    {
      id: 'drip',
      label: 'Drip drainfield',
      dispersal: 'pressure_compensated_drip',
      note: 'Treated effluent to drip tubing in subsurface drainfield',
    },
  ];
}

function dwtsZoneChain(boosterLabel) {
  return [
    `${DWTS_SIMPLEX_PER_ZONE} simplex collection lifts`,
    boosterLabel,
    `Trash tank ≥${DWTS_TRASH_MIN_GAL.toLocaleString()} gal`,
    `${DWTS_MODULES_PER_ZONE}× parallel ${DWTS_MODULE_GAL.toLocaleString()} gal treatment`,
    'Drip drainfield',
  ];
}

/**
 * Tank sizing — collection lifts → booster → trash → parallel 1,250 gal ATU → drip.
 */
const DWTS_TANK_GUIDE = {
  description: '10,000 GPD — two 5,000 GPD zones. Each: 10 simplex → duplex booster → trash ≥1,000 gal → 4× parallel 1,250 gal ATU → drip drainfield.',
  dispersal: 'drip_drainfield',
  references: [
    'Florida DEP DWTS — closed-tank advanced treatment with subsurface drip dispersal',
    'Florida DEP ATU list — ≥1,000 gal pretreatment before parallel ATU modules',
    'EPA collection systems — duplex booster wet-well on neighborhood force main',
  ],
  system: {
    designGpd: 10000,
    zones: 2,
    gpdPerZone: 5000,
    simplexPerZone: DWTS_SIMPLEX_PER_ZONE,
    treatmentModulesPerZone: DWTS_MODULES_PER_ZONE,
    treatmentModuleGal: DWTS_MODULE_GAL,
    trashTankMinGal: DWTS_TRASH_MIN_GAL,
  },
  zones: [
    {
      zoneId: 1,
      designGpd: 5000,
      processChain: dwtsZoneChain('Booster BS-1'),
      simplexCollection: {
        count: DWTS_SIMPLEX_PER_ZONE,
        stationType: 'simplex',
        designGpdEach: 500,
        wetWellGal: 500,
        note: 'Home collection lift — simplex submersible to zone force main',
      },
      boosterDuplex: {
        stationType: 'dual_duplex',
        wetWellGal: 2500,
        pumps: 2,
        alternation: 'duplex_lead_lag',
      },
      plant: {
        stationType: 'quad_atu',
        trashTankGal: DWTS_TRASH_MIN_GAL,
        parallelModules: DWTS_MODULES_PER_ZONE,
        moduleGal: DWTS_MODULE_GAL,
        dispersal: 'drip_drainfield',
        tanks: dwtsPlantTanks(5000),
      },
    },
    {
      zoneId: 2,
      designGpd: 5000,
      processChain: dwtsZoneChain('Booster BS-2'),
      simplexCollection: {
        count: DWTS_SIMPLEX_PER_ZONE,
        stationType: 'simplex',
        designGpdEach: 500,
        wetWellGal: 500,
      },
      boosterDuplex: {
        stationType: 'dual_duplex',
        wetWellGal: 2500,
        pumps: 2,
        alternation: 'duplex_lead_lag',
      },
      plant: {
        stationType: 'quad_atu',
        trashTankGal: DWTS_TRASH_MIN_GAL,
        parallelModules: DWTS_MODULES_PER_ZONE,
        moduleGal: DWTS_MODULE_GAL,
        dispersal: 'drip_drainfield',
        tanks: dwtsPlantTanks(5000),
      },
    },
  ],
};

function stationTypeMeta(stationType) {
  const meta = STATION_TYPES[stationType];
  if (!meta) throw new Error(`Unknown station type: ${stationType}`);
  return meta;
}

function deviceRow(base) {
  const type = stationTypeMeta(base.stationType);
  const fleetAlarmTag = base.fleetAlarmTag || `FLEET_${base.slug.replace(/-/g, '_').toUpperCase()}_ALM`;
  return {
    ...base,
    owner: TENANT.name,
    templateId: type.templateId,
    defaultProgram: type.defaultProgram,
    alarmTag: type.alarmTag,
    alarmTags: type.alarmTags || [type.alarmTag],
    levelTag: type.levelTag,
    category: type.category,
    role: base.role || type.role,
    pumps: type.pumps,
    trains: type.trains,
    uplink: 'cellular_mqtt',
    fleetAlarmTag,
    gatewayId: base.gatewayId || `gw_${base.deviceSlug || base.slug}`,
    driverId: base.driverId || `drv_${base.slug.replace(/-/g, '_')}`,
  };
}

/** Residential 500 GPD — one single ATU (simplex train + TPO). */
const RESIDENTIAL_SITE = {
  profileId: 'residential-500gpd',
  name: 'Oak Lane Residence',
  slug: 'oak-lane',
  designGpd: 500,
  address: '142 Oak Lane, DeLand, FL 32724',
  lat: 29.0286,
  lng: -81.3031,
};

const RESIDENTIAL_DEVICES = [
  deviceRow({
    name: 'Oak Lane — single ATU',
    slug: 'oak-atu',
    stationType: 'single_atu',
    lat: RESIDENTIAL_SITE.lat,
    lng: RESIDENTIAL_SITE.lng,
    address: RESIDENTIAL_SITE.address,
    deviceId: 'mv_atu_oak_01',
    deviceSlug: 'dev-oak-atu',
  }),
];

/** Commercial 10,000 GPD — 4 quad ATU + 20 simplex lifts. */
const COMMERCIAL_SITE = {
  profileId: 'commercial-10000gpd',
  name: 'Harbor Commerce Park',
  slug: 'harbor-commerce',
  designGpd: 10000,
  address: '8800 Harbor Blvd, Port Orange, FL 32127',
  lat: 29.1384,
  lng: -81.0065,
};

function buildCommercialDevices() {
  const { lat: baseLat, lng: baseLng } = COMMERCIAL_SITE;
  const atus = [1, 2, 3, 4].map((i) => deviceRow({
    name: `Harbor Quad ATU-${i}`,
    slug: `harbor-qatu-${i}`,
    stationType: 'quad_atu',
    lat: baseLat + (i - 2.5) * 0.0012,
    lng: baseLng + (i % 2) * 0.0008,
    address: `${8800 + i * 10} Harbor Blvd, Port Orange, FL`,
    deviceId: `mv_atu_harbor_q${i}`,
    deviceSlug: `dev-harbor-qatu-${i}`,
  }));

  const lifts = Array.from({ length: 20 }, (_, idx) => {
    const n = idx + 1;
    const pad = String(n).padStart(2, '0');
    const angle = (idx / 20) * Math.PI * 2;
    const radius = 0.012 + (idx % 3) * 0.002;
    return deviceRow({
      name: `Harbor Lift LS-${pad}`,
      slug: `harbor-ls-${n}`,
      stationType: 'simplex',
      lat: baseLat + Math.sin(angle) * radius,
      lng: baseLng + Math.cos(angle) * radius * 1.4,
      address: `Harbor Commerce Park — pad ${pad}`,
      deviceId: `mv_ls_harbor_${pad}`,
      deviceSlug: `dev-harbor-ls-${n}`,
    });
  });

  return [...atus, ...lifts];
}

const COMMERCIAL_DEVICES = buildCommercialDevices();

/** DWTS 10,000 GPD — 2 zones: 10 simplex → booster → trash → 4×1,250 gal ATU → drip. */
const DWTS_SITE = {
  profileId: 'dwts-10000gpd',
  name: 'Magnolia Village DWTS',
  slug: 'magnolia-village-dwts',
  designGpd: 10000,
  address: '4200 Magnolia Bend Dr, Sanford, FL 32771',
  lat: 28.7897,
  lng: -81.2751,
  systemType: 'dwts',
  regulatory: 'Florida DEP DWTS / SB 796 general permit',
};

function buildDwtsDevices() {
  const { lat: baseLat, lng: baseLng } = DWTS_SITE;
  const gpdPerHome = 500;
  const gpdPerZone = 5000;
  const zoneCenters = [
    { zoneId: 1, cx: -14, cz: 0, boosterSlug: 'magnolia-bs-1' },
    { zoneId: 2, cx: 14, cz: 0, boosterSlug: 'magnolia-bs-2' },
  ];

  const simplexWetWell = {
    id: 'wet_well',
    label: 'Collection wet well',
    capacityGal: 500,
    rule: 'Simplex lift — pumps to zone duplex booster force main',
  };

  const boosterTanks = [
    {
      id: 'wet_well',
      label: 'Duplex booster wet well',
      capacityGal: 2500,
      rule: 'Receives 10 simplex lifts; duplex alternating pumps to plant trash tank',
    },
  ];

  const boosters = zoneCenters.map((z, i) => {
    const n = i + 1;
    return deviceRow({
      name: `Booster BS-${n}`,
      slug: z.boosterSlug,
      stationType: 'dual_duplex',
      role: 'booster',
      zoneId: z.zoneId,
      designGpd: gpdPerZone,
      lat: baseLat + (n === 1 ? -0.001 : 0.001),
      lng: baseLng,
      sceneX: z.cx,
      sceneZ: 10,
      address: `Magnolia Village — zone ${n} duplex booster`,
      deviceId: `mv_ls_magnolia_bs${n}`,
      deviceSlug: `dev-magnolia-bs-${n}`,
      tanks: boosterTanks,
      processChain: dwtsZoneChain(`Booster BS-${n}`),
    });
  });

  const atus = zoneCenters.map((z, i) => {
    const n = i + 1;
    const zone = DWTS_TANK_GUIDE.zones[i];
    return deviceRow({
      name: `Magnolia DWTU-${n}`,
      slug: `magnolia-dwtu-${n}`,
      stationType: 'quad_atu',
      designGpd: gpdPerZone,
      zoneId: z.zoneId,
      lat: baseLat + (n === 1 ? -0.002 : 0.002),
      lng: baseLng + 0.003,
      sceneX: z.cx,
      sceneZ: 34,
      address: `${4200 + n * 50} Magnolia Bend Dr — zone ${n} treatment plant`,
      deviceId: `mv_atu_magnolia_z${n}`,
      deviceSlug: `dev-magnolia-dwtu-${n}`,
      tanks: zone.plant.tanks,
      processChain: zone.processChain,
      plantMeta: {
        trashGal: DWTS_TRASH_MIN_GAL,
        moduleGal: DWTS_MODULE_GAL,
        moduleCount: DWTS_MODULES_PER_ZONE,
        dispersal: 'drip_drainfield',
      },
    });
  });

  const collectionLifts = [];
  for (const z of zoneCenters) {
    for (let i = 0; i < DWTS_SIMPLEX_PER_ZONE; i += 1) {
      const n = (z.zoneId - 1) * DWTS_SIMPLEX_PER_ZONE + i + 1;
      const pad = String(n).padStart(2, '0');
      const angle = (i / DWTS_SIMPLEX_PER_ZONE) * Math.PI - Math.PI / 2;
      const radius = 22;
      collectionLifts.push(deviceRow({
        name: `Collection LS-${pad}`,
        slug: `magnolia-ls-${n}`,
        stationType: 'simplex',
        role: 'collection',
        zoneId: z.zoneId,
        feedsBooster: z.boosterSlug,
        designGpd: gpdPerHome,
        lat: baseLat + Math.sin(angle) * 0.012,
        lng: baseLng + Math.cos(angle) * 0.014,
        sceneX: z.cx + Math.cos(angle) * radius,
        sceneZ: z.cz + Math.sin(angle) * radius - 12,
        address: `${100 + n} Village Ln, Sanford, FL`,
        deviceId: `mv_ls_magnolia_${pad}`,
        deviceSlug: `dev-magnolia-ls-${n}`,
        tanks: [simplexWetWell],
      }));
    }
  }

  return [...collectionLifts, ...boosters, ...atus];
}

const DWTS_DEVICES = buildDwtsDevices();

const SITE_PROFILES = {
  residential: {
    ...RESIDENTIAL_SITE,
    devices: RESIDENTIAL_DEVICES,
    cloudProject: 'atu-cloud-residential',
    manifestFile: 'st/fixtures/fleet_atu_residential.json',
    importCsv: 'st/fixtures/fleet_import_atu_residential.csv',
    facility3dUrl: '/samples/atu-fleet-residential-3d.html',
  },
  commercial: {
    ...COMMERCIAL_SITE,
    devices: COMMERCIAL_DEVICES,
    cloudProject: 'atu-cloud-commercial',
    manifestFile: 'st/fixtures/fleet_atu_commercial.json',
    importCsv: 'st/fixtures/fleet_import_atu_commercial.csv',
    facility3dUrl: '/samples/atu-fleet-commercial-3d.html',
  },
  dwts: {
    ...DWTS_SITE,
    devices: DWTS_DEVICES,
    cloudProject: 'atu-cloud-dwts',
    manifestFile: 'st/fixtures/fleet_dwts_magnolia.json',
    importCsv: 'st/fixtures/fleet_import_dwts_magnolia.csv',
    facility3dUrl: '/samples/dwts-magnolia-3d.html',
    tankGuide: DWTS_TANK_GUIDE,
  },
};

function profileManifest(profileKey) {
  const profile = SITE_PROFILES[profileKey];
  if (!profile) throw new Error(`Unknown profile: ${profileKey}`);
  const atuCount = profile.devices.filter((d) => d.category === 'atu').length;
  const liftCount = profile.devices.filter((d) => d.category === 'lift').length;
  const stepCount = profile.devices.filter((d) => d.role === 'step' || d.role === 'collection').length;
  const boosterCount = profile.devices.filter((d) => d.role === 'booster').length;
  const description = profile.systemType === 'dwts'
    ? `DWTS cloud fleet — ${profile.name} (${profile.designGpd} GPD): ${atuCount} treatment plants, ${stepCount} simplex collection, ${boosterCount} duplex booster — drip drainfield`
    : `ATU cloud fleet — ${profile.name} (${profile.designGpd} GPD design): ${atuCount} ATU, ${liftCount} lift stations, 100% cellular → cloud`;
  return {
    description,
    tenant: TENANT,
    sizingGuide: SIZING_GUIDE,
    ...(profile.tankGuide ? { tankGuide: profile.tankGuide } : {}),
    profile: {
      id: profile.profileId,
      name: profile.name,
      slug: profile.slug,
      designGpd: profile.designGpd,
      address: profile.address,
      lat: profile.lat,
      lng: profile.lng,
      ...(profile.systemType ? { systemType: profile.systemType, regulatory: profile.regulatory } : {}),
    },
    devices: profile.devices,
    counts: {
      atu: atuCount,
      lift: liftCount,
      step: stepCount,
      collection: profile.devices.filter((d) => d.role === 'collection').length,
      booster: boosterCount,
      total: profile.devices.length,
    },
    importCsv: profile.importCsv,
    cloudProject: profile.cloudProject,
    mqtt: {
      topicPrefix: 'mooreview/v1',
      cloudBrokerPort: 1883,
      optaLanBroker: '192.168.1.1:1883',
    },
    cellular: {
      vendorHint: 'hologram',
      apn: 'hologram',
      linkApi: '/api/cellular/sims/:id/link',
    },
  };
}

function profilesCatalog() {
  return {
    tenant: TENANT,
    sizingGuide: SIZING_GUIDE,
    stationTypes: STATION_TYPES,
    profiles: Object.fromEntries(
      Object.entries(SITE_PROFILES).map(([key, p]) => [key, {
        profileId: p.profileId,
        name: p.name,
        designGpd: p.designGpd,
        deviceCount: p.devices.length,
        cloudProject: p.cloudProject,
        systemType: p.systemType || 'atu_fleet',
        atu: p.devices.filter((d) => d.category === 'atu').map((d) => d.stationType),
        lifts: p.devices.filter((d) => d.category === 'lift').length,
        step: p.devices.filter((d) => d.role === 'step' || d.role === 'collection').length,
        collection: p.devices.filter((d) => d.role === 'collection').length,
        booster: p.devices.filter((d) => d.role === 'booster').length,
      }]),
    ),
  };
}

function fleetCsvLines(devices) {
  const header = 'role,category,station_name,station_slug,station_type,design_gpd,lat,lng,device_id,device_slug,gateway_id,driver_id,address,owner';
  const rows = devices.map((d) => [
    d.role,
    d.category,
    `"${d.name}"`,
    d.slug,
    d.stationType,
    d.designGpd ?? '',
    d.lat,
    d.lng,
    d.deviceId,
    d.deviceSlug,
    d.gatewayId,
    d.driverId,
    `"${d.address || ''}"`,
    TENANT.name,
  ].join(','));
  return [header, ...rows];
}

module.exports = {
  TENANT,
  STATION_TYPES,
  SIZING_GUIDE,
  RESIDENTIAL_SITE,
  RESIDENTIAL_DEVICES,
  COMMERCIAL_SITE,
  COMMERCIAL_DEVICES,
  DWTS_TANK_GUIDE,
  DWTS_SITE,
  DWTS_DEVICES,
  SITE_PROFILES,
  stationTypeMeta,
  deviceRow,
  profileManifest,
  profilesCatalog,
  fleetCsvLines,
};
