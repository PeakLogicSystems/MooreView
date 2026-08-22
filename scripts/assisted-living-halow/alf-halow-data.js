'use strict';

/**
 * Assisted living — T-HaLow (phase 1) + IOT-LINK pool subsystem.
 * Nexcomm-branded HaLow devices use the same MQTT shapes when they ship (phase 2).
 */

const SITE = {
  name: 'Assisted Living Facility',
  slug: 'assisted-living',
};

/** Main building MooreVIEW appliance (Compulab IOT-LINK generic). */
const MAIN_APPLIANCE = {
  role: 'alf-main',
  product: 'iot-link',
  projectId: 'assisted-living-halow',
  gatewayId: 'mv_alf_main_01',
  mqttBroker: 'mqtt://127.0.0.1:1883',
  uplink: 'cloudRemote',
};

/**
 * Pool plant MooreVIEW appliance (Compulab IOT-LINK pool).
 * Runs 30_pool_controller.st; RS-485 pump bus; MQTT Parc hub for HaLow pool devices.
 */
const POOL_SUBSYSTEM = {
  role: 'pool-iot-link',
  product: 'iot-link-pool',
  projectId: 'assisted-living-pool-iot-link',
  gatewayId: 'mv_alf_pool_01',
  mqttBroker: 'mqtt://127.0.0.1:1883',
  uplink: 'cloudRemote',
  rs485PortA: '/dev/ttyLP6',
  rs485PortB: '/dev/ttyLP4',
  stProgram: 'logic/30_pool_controller.st',
  /** Pool IOT-LINK is the HaLow MQTT anchor for pool-equipment room (broker reachable from HaLow AP). */
  halowMqttAnchor: true,
};

/** T-HaLow nodes in the pool equipment / deck area (Phase 1 — LilyGO). */
const POOL_HALOW_NODES = [
  {
    name: 'Therapy pool — MCXN947 chemistry',
    slug: 'pool-chem',
    deviceId: 'pool_sensor_01',
    driverId: 'pool_sensor_01',
    platform: 'mcxn947-pool',
    firmware: 'mcxn947-pool-sensor',
    uplink: 'halow_parc',
    parcTags: ['PH_AI', 'ORP_AI', 'COND_AI', 'WATER_TEMP_C'],
    notes: 'Nexcomm MCXN947 probe head; Parc MQTT over HaLow to pool IOT-LINK broker',
  },
  {
    name: 'Therapy pool — deck I/O',
    slug: 'pool-deck',
    deviceId: 'thalow_pool_deck',
    driverId: 'thalow_pool_deck',
    platform: 'lilygo-t-halow',
    sensorTemplate: 'custom',
    uplink: 'halow_parc',
    parcTags: ['FLOW', 'FLOW_SW', 'LEAK', 'R1', 'R2', 'R3', 'R4'],
    ioMap: {
      FLOW: 'POOL_FLOW_PULSE',
      FLOW_SW: 'POOL_FLOW_SW',
      R1: 'DOSE_BASE',
      R2: 'DOSE_ACID',
      R3: 'DOSE_CL',
      R4: 'DOSE_SALT',
    },
    notes: 'Replaces Opta MQTT for flow, leak rope, and dose relays',
  },
];

/**
 * Nexcomm MCXN947 HVAC MCSA monitors — one per floor rooftop condenser.
 * Parc MQTT over HaLow to main ALF IOT-LINK broker (phase 1 HaLow radio on MCXN947).
 */
const NEXCOMM_HVAC_NODES = [1, 2, 3].map((floor) => ({
  name: `Floor ${floor} rooftop — Nexcomm HVAC MCSA`,
  slug: `hvac-fl${floor}`,
  deviceId: `hvac_mcsa_fl${floor}`,
  driverId: `hvac_mcsa_fl${floor}`,
  platform: 'mcxn947-hvac',
  firmware: 'mcsa-hvac',
  uplink: 'halow_parc',
  floor,
  mcsaChannels: 2,
  parcTags: ['T1_C', 'T2_C', 'T3_C', 'T4_C', 'WR_DETECT', 'COMP_FLT', 'FAN_FLT'],
  notes: 'Compressor + fan CT MCSA, rooftop thermistors, condenser pan water rope',
}));

/** Representative building T-HaLow nodes (full facility uses same patterns × rooms). */
const BUILDING_HALOW_NODES = [
  {
    name: 'Mechanical room',
    slug: 'mechanical',
    deviceId: 'thalow_mech_01',
    driverId: 'thalow_mech',
    sensorTemplate: 1,
    templateName: 'ALF #1 Mechanical room',
  },
  {
    name: 'Kitchen refer/freezer',
    slug: 'kitchen',
    deviceId: 'thalow_kitchen_01',
    driverId: 'thalow_kitchen',
    sensorTemplate: 5,
    templateName: 'ALF #5 Kitchen',
  },
  {
    name: 'Kitchen six sinks',
    slug: 'kitchen-sinks',
    deviceId: 'thalow_kitchen_sinks',
    driverId: 'thalow_kitchen_sinks',
    sensorTemplate: 6,
    templateName: 'ALF #6 Kitchen six sinks',
  },
  {
    name: 'RM101 room',
    slug: 'rm101-room',
    deviceId: 'thalow_rm101_room',
    driverId: 'thalow_rm101_room',
    sensorTemplate: 2,
    templateName: 'ALF #2 Client room',
  },
  {
    name: 'RM101 bath',
    slug: 'rm101-bath',
    deviceId: 'thalow_rm101_bath',
    driverId: 'thalow_rm101_bath',
    sensorTemplate: 3,
    templateName: 'ALF #3 Client bathroom',
  },
  {
    name: 'RM102 room',
    slug: 'rm102-room',
    deviceId: 'thalow_rm102_room',
    driverId: 'thalow_rm102_room',
    sensorTemplate: 2,
  },
  {
    name: 'RM102 bath',
    slug: 'rm102-bath',
    deviceId: 'thalow_rm102_bath',
    driverId: 'thalow_rm102_bath',
    sensorTemplate: 3,
  },
  {
    name: 'GF lounge RR1 bath',
    slug: 'comm-gf-lounge-r1',
    deviceId: 'thalow_comm_gf_rr1',
    driverId: 'thalow_comm_gf_rr1',
    sensorTemplate: 3,
  },
];

function buildingHalowDrivers() {
  return BUILDING_HALOW_NODES.map((n) => ({
    id: n.driverId,
    type: 'mqtt_parc',
    enabled: true,
    deviceId: n.deviceId,
    name: n.name,
    scanMs: 100,
    reportIntervalSec: 1,
    remoteExecution: false,
  }));
}

function nexcommHvacDrivers() {
  return NEXCOMM_HVAC_NODES.map((n) => ({
    id: n.driverId,
    type: 'mqtt_parc',
    enabled: true,
    deviceId: n.deviceId,
    name: n.name,
    scanMs: 100,
    reportIntervalSec: 1,
    remoteExecution: false,
    telemetryOnly: true,
  }));
}

function allHalowDrivers() {
  return [...buildingHalowDrivers(), ...nexcommHvacDrivers(), ...POOL_HALOW_NODES.map((n) => ({
    id: n.driverId,
    type: 'mqtt_parc',
    enabled: true,
    deviceId: n.deviceId,
    name: n.name,
    scanMs: 100,
    reportIntervalSec: n.deviceId === 'pool_sensor_01' ? 1 : 0.5,
    remoteExecution: false,
  }))];
}

function manifest() {
  return {
    description: 'Assisted living — T-HaLow building nodes + Nexcomm HVAC MCSA (×3 floors) + IOT-LINK pool subsystem',
    site: SITE,
    phase: { field: 't-halow', future: 'nexcomm' },
    mainAppliance: MAIN_APPLIANCE,
    poolSubsystem: POOL_SUBSYSTEM,
    mqtt: {
      buildingBroker: MAIN_APPLIANCE.mqttBroker,
      poolBroker: POOL_SUBSYSTEM.mqttBroker,
      topicPrefix: 'mooreview/v1',
      note: 'Pool HaLow nodes home to pool IOT-LINK Mosquitto; optional bridge to main ALF broker',
    },
    buildingHalowNodes: BUILDING_HALOW_NODES,
    nexcommHvacNodes: NEXCOMM_HVAC_NODES,
    poolHalowNodes: POOL_HALOW_NODES,
    importCsv: 'st/fixtures/assisted_living_halow_nodes.csv',
  };
}

function halowNodeCsvLines() {
  const header = 'zone,device_id,driver_id,sensor_template,platform,notes';
  const rows = [];
  for (const n of BUILDING_HALOW_NODES) {
    rows.push([
      n.slug,
      n.deviceId,
      n.driverId,
      n.sensorTemplate ?? '',
      'lilygo-t-halow',
      `"${n.name}"`,
    ].join(','));
  }
  for (const n of NEXCOMM_HVAC_NODES) {
    rows.push([
      n.slug,
      n.deviceId,
      n.driverId,
      n.firmware ?? '',
      n.platform,
      `"${n.name}"`,
    ].join(','));
  }
  for (const n of POOL_HALOW_NODES) {
    rows.push([
      n.slug,
      n.deviceId,
      n.driverId,
      n.sensorTemplate ?? n.platform ?? '',
      n.platform || 'lilygo-t-halow',
      `"${n.name}"`,
    ].join(','));
  }
  return [header, ...rows];
}

module.exports = {
  SITE,
  MAIN_APPLIANCE,
  POOL_SUBSYSTEM,
  POOL_HALOW_NODES,
  NEXCOMM_HVAC_NODES,
  BUILDING_HALOW_NODES,
  buildingHalowDrivers,
  nexcommHvacDrivers,
  allHalowDrivers,
  manifest,
  halowNodeCsvLines,
};
