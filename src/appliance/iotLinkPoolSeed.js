'use strict';

const fs = require('fs');
const path = require('path');
const { ST_DIR, DEFAULT_MQTT_PARC_BROKER } = require('../config');
const { normalizeHmi } = require('../hmi/hmiConfig');
const { EST_FORMAT } = require('../project/estFile');
const {
  parseWaveshareRelayBindings,
  buildWaveshareRelayDriver,
  bindWavesharePoolRelays,
} = require('../devices/wavesharePoolRelay');
const {
  buildResPoolValveDriver,
  bindResPoolValves,
  valveDeviceId,
} = require('../devices/resPoolValves');
const { dfrobotPoolChemistryDraginoTags } = require('../devices/tagBuilders');

const FIXTURE_DIR = path.join(ST_DIR, 'fixtures');
const ACTIVE_PROGRAM = 'logic/30_pool_controller.st';
const PROJECT_ID = 'iot-link-pool';

/** Compulab IOT-LINK RS-485 tty mapping (FARS4 = PORT A, FBRS4 = PORT B). */
const IOT_LINK_DEFAULT_PORTS = {
  portA: '/dev/ttyLP6',
  portB: '/dev/ttyLP4',
};

const DEFAULT_INTELLIFLO_ADDR = 96;
const DEFAULT_INTELLIVALVE_ADDR = 12;
const DEFAULT_INTELLIVALVE_COUNT = 1;

/** Four valve slots (Pentair IntelliValve path). Default res-pool-link uses ESP32 relays. */
const INTELLIVALVE_ROLES = [
  { role: 'inlet', label: 'Filter inlet', cmdId: 'IV1_CMD', atId: 'IV1_AT_POS', pvId: 'IV1_POS' },
  { role: 'outlet', label: 'Filter outlet', cmdId: 'IV2_CMD', atId: 'IV2_AT_POS', pvId: 'IV2_POS' },
  { role: 'waste', label: 'Filter backwash waste', cmdId: 'BW_VLV1_CMD', atId: 'VLV1_AT_POS', pvId: 'VLV1_IV_POS' },
  { role: 'spare', label: 'Spare valve', cmdId: 'IV4_CMD', atId: 'IV4_AT_POS', pvId: 'IV4_POS' },
];
const DEFAULT_JANDY_EPUMP_ADDR = 120;
const DEFAULT_HAYWARD_PUMP_HUA = 0;

const PENTAIR_BUS_TAG_FIXTURES = [
  'tags.pentair_intelliflo.json',
  'tags.pentair_intellichlor.json',
  'tags.pentair_ultratemp.json',
  'tags.pentair_valves.json',
];

const JANDY_BUS_TAG_FIXTURES = [
  'tags.jandy_epump.json',
  'tags.jandy_aquapure.json',
  'tags.jandy_jxi_heater.json',
  'tags.jandy_lx_heater.json',
  'tags.jandy_heat_pump.json',
];

const HAYWARD_BUS_TAG_FIXTURES = [
  'tags.hayward_vs_pump.json',
];

function readFixtureJson(name) {
  const fp = path.join(FIXTURE_DIR, name);
  if (!fs.existsSync(fp)) {
    throw new Error(`Missing fixture: ${name}`);
  }
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function resolveSerialPorts(env = process.env) {
  return {
    portA: String(env.MOOREVIEW_RS485_PORT_A || IOT_LINK_DEFAULT_PORTS.portA).trim(),
    portB: String(env.MOOREVIEW_RS485_PORT_B || IOT_LINK_DEFAULT_PORTS.portB).trim(),
  };
}

function poolProfile(env = process.env) {
  const product = String(env.MOOREVIEW_PRODUCT || '').trim().toLowerCase();
  const raw = String(env.MOOREVIEW_POOL_PROFILE || '').trim().toLowerCase();
  if (product === 'res-pool-link' || raw === 'res-pool-link') {
    return 'res-pool-link';
  }
  if (raw === 'residential-spa' || raw === 'residential-pool-spa' || raw === 'pool-spa') {
    return 'residential-spa';
  }
  return raw || 'default';
}

function featureFlags(env = process.env) {
  const truthy = (v, fallback) => {
    if (v == null || v === '') return fallback;
    return /^(1|true|yes|on)$/i.test(String(v));
  };
  const profile = poolProfile(env);
  const resPoolLink = profile === 'res-pool-link';
  const residentialSpa = profile === 'residential-spa' || resPoolLink;
  const pentairBus = truthy(env.MOOREVIEW_POOL_PENTAIR_BUS, residentialSpa);
  const intellifloPump = truthy(env.MOOREVIEW_POOL_INTELLIFLO, pentairBus || residentialSpa);
  const esp32Valves = truthy(env.MOOREVIEW_POOL_ESP32_VALVES, resPoolLink);
  const intellivalve = truthy(env.MOOREVIEW_POOL_INTELLIVALVE, (pentairBus && !residentialSpa) || (resPoolLink && !esp32Valves));
  const intellivalveCount = resolveIntellivalveCount(env, resPoolLink && intellivalve);
  const jandyBus = truthy(env.MOOREVIEW_POOL_JANDY_BUS, false);
  const jandyEpump = truthy(env.MOOREVIEW_POOL_JANDY_EPUMP, jandyBus);
  const haywardBus = truthy(env.MOOREVIEW_POOL_HAYWARD_BUS, false);
  const haywardPump = truthy(env.MOOREVIEW_POOL_HAYWARD_PUMP, haywardBus);
  return {
    profile,
    resPoolLink,
    residentialSpa,
    pentairHeatPump: truthy(env.MOOREVIEW_POOL_PENTAIR, !residentialSpa),
    pentairBus,
    intellifloPump,
    intellivalve,
    intellivalveCount,
    jandyBus,
    jandyEpump,
    haywardBus,
    haywardPump,
    optaIo: truthy(env.MOOREVIEW_POOL_OPTA_IO, !residentialSpa),
    halowIo: truthy(env.MOOREVIEW_POOL_HALOW_IO, false),
    modbusChemistryBus: truthy(env.MOOREVIEW_POOL_MODBUS_CHEM, false),
    waveshareRelay: truthy(env.MOOREVIEW_POOL_WAVESHARE_RELAY, residentialSpa)
      || Boolean(String(env.MOOREVIEW_POOL_WAVESHARE_RELAYS || '').trim()),
    esp32Valves,
    spa: truthy(env.MOOREVIEW_POOL_SPA, residentialSpa),
  };
}

/**
 * Waveshare satellite bindings. Residential pool & spa defaults to spa jets
 * when the profile is on and no RELAY / RELAYS list was given.
 */
function resolveWaveshareBindings(env = process.env, features = featureFlags(env)) {
  if (!features.waveshareRelay) return [];
  const listed = parseWaveshareRelayBindings(env);
  if (listed.length) return listed;
  if (features.residentialSpa) {
    return parseWaveshareRelayBindings({
      MOOREVIEW_POOL_WAVESHARE_RELAYS: 'spa_jets:ws_relay_spa',
    });
  }
  return [];
}

function intellifloAddr(env = process.env) {
  const n = Number(env.MOOREVIEW_POOL_INTELLIFLO_ADDR);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_INTELLIFLO_ADDR;
}

function intellivalveAddr(env = process.env) {
  const n = Number(env.MOOREVIEW_POOL_INTELLIVALVE_ADDR);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_INTELLIVALVE_ADDR;
}

function resolveIntellivalveCount(env = process.env, resPoolLink = false) {
  const n = Number(env.MOOREVIEW_POOL_INTELLIVALVE_COUNT);
  if (Number.isFinite(n) && n >= 1) return Math.min(4, Math.max(1, Math.round(n)));
  return resPoolLink ? 4 : DEFAULT_INTELLIVALVE_COUNT;
}

function intellivalveAddrs(env = process.env, count = 1) {
  const listed = String(env.MOOREVIEW_POOL_INTELLIVALVE_ADDRS || '')
    .split(',')
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (listed.length >= count) return listed.slice(0, count);
  const start = intellivalveAddr(env);
  return Array.from({ length: count }, (_, i) => start + i);
}

function jandyEpumpAddr(env = process.env) {
  const n = Number(env.MOOREVIEW_POOL_JANDY_EPUMP_ADDR);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_JANDY_EPUMP_ADDR;
}

function haywardPumpHua(env = process.env) {
  const n = Number(env.MOOREVIEW_POOL_HAYWARD_PUMP_HUA);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_HAYWARD_PUMP_HUA;
}

function mergePentairBusTags(byId, driverId = 'pentair_bus', opts = {}) {
  for (const name of PENTAIR_BUS_TAG_FIXTURES) {
    if (opts.skipValves && name === 'tags.pentair_valves.json') continue;
    for (const tag of readFixtureJson(name)) {
      byId.set(tag.id, {
        ...tag,
        driverId: driverId || tag.driverId || 'pentair_bus',
        driverAddress: {
          ...(tag.driverAddress || {}),
          deviceClass: tag.driverAddress?.deviceClass
            || (tag.id.startsWith('HP_') ? 'ultratemp' : undefined),
        },
      });
    }
  }
}

function mergeJandyBusTags(byId, driverId = 'jandy_bus') {
  for (const name of JANDY_BUS_TAG_FIXTURES) {
    for (const tag of readFixtureJson(name)) {
      byId.set(tag.id, {
        ...tag,
        driverId: driverId || tag.driverId || 'jandy_bus',
        driverAddress: {
          ...(tag.driverAddress || {}),
          deviceClass: tag.driverAddress?.deviceClass
            || (tag.id.startsWith('JHP_') ? 'heat_pump'
              : tag.id.startsWith('JLX_') ? 'lx_heater'
                : tag.id.startsWith('JXI_') ? 'jxi_heater'
                  : tag.id.startsWith('JAP_') ? 'aquapure' : 'epump'),
        },
      });
    }
  }
}

function mergeHaywardBusTags(byId, driverId = 'hayward_bus', hua = 0) {
  for (const name of HAYWARD_BUS_TAG_FIXTURES) {
    for (const tag of readFixtureJson(name)) {
      byId.set(tag.id, {
        ...tag,
        driverId: driverId || tag.driverId || 'hayward_bus',
        driverAddress: {
          ...(tag.driverAddress || {}),
          deviceClass: 'vs_pump',
          deviceAddr: hua,
        },
      });
    }
  }
}

/** Retarget Speck pump tags to Jandy ePump (ST tag IDs unchanged). */
function retargetPoolPumpToJandyEpump(byId, driverId, addr) {
  const base = { deviceClass: 'epump', deviceAddr: addr };
  const map = {
    PUMP_RPM: { jandy: 'rpm', ...base },
    PUMP_RPM_DEM: { jandy: 'rpm', ...base },
    PUMP_PWR_W: { jandy: 'watts', ...base },
    PUMP_RUN_CMD: { jandy: 'run_cmd', ...base },
    PUMP_RPM_CMD: { jandy: 'rpm_cmd', ...base },
  };
  for (const [id, driverAddress] of Object.entries(map)) {
    const t = byId.get(id);
    if (!t) continue;
    byId.set(id, { ...t, driverId, driverAddress });
  }
}

/** Retarget Speck pump tags to Hayward VS pump (ST tag IDs unchanged). */
function retargetPoolPumpToHaywardVs(byId, driverId, hua) {
  const base = { deviceClass: 'vs_pump', deviceAddr: hua };
  const map = {
    PUMP_RPM: { hayward: 'rpm', ...base },
    PUMP_RPM_DEM: { hayward: 'rpm', ...base },
    PUMP_PWR_W: { hayward: 'watts', ...base },
    PUMP_RUN_CMD: { hayward: 'run_cmd', ...base },
    PUMP_RPM_CMD: { hayward: 'speed_cmd', ...base },
  };
  for (const [id, driverAddress] of Object.entries(map)) {
    const t = byId.get(id);
    if (!t) continue;
    byId.set(id, { ...t, driverId, driverAddress });
  }
}

/** Retarget Speck pump tags to IntelliFlo (ST tag IDs unchanged). */
function retargetPoolPumpToIntelliflo(byId, driverId, addr) {
  const base = { deviceClass: 'intelliflo', deviceAddr: addr };
  const map = {
    PUMP_RPM: { pentair: 'rpm', ...base },
    PUMP_RPM_DEM: { pentair: 'rpm', ...base },
    PUMP_PWR_W: { pentair: 'watts', ...base },
    PUMP_RUN_CMD: { pentair: 'run_cmd', ...base },
    PUMP_RPM_CMD: { pentair: 'rpm_cmd', ...base },
    PUMP_STA_RAW: { pentair: 'status_speck', ...base },
  };
  for (const [id, driverAddress] of Object.entries(map)) {
    const t = byId.get(id);
    if (!t) continue;
    byId.set(id, { ...t, driverId, driverAddress });
  }
  if (!byId.has('IFLO_REMOTE_CMD')) {
    byId.set('IFLO_REMOTE_CMD', {
      id: 'IFLO_REMOTE_CMD',
      label: 'IntelliFlo remote cmd',
      type: 'BOOL',
      role: 'output',
      value: true,
      driverId,
      driverAddress: { pentair: 'remote_cmd', ...base },
    });
  }
}

/** Retarget backwash valve tags to Pentair IntelliValve (ST tag IDs unchanged). */
function retargetBackwashValveToIntellivalve(byId, driverId, addr) {
  const base = { deviceClass: 'intellivalve', deviceAddr: addr };
  const map = {
    BW_VLV1_CMD: { pentair: 'pos_cmd', ...base },
    VLV1_AT_POS: { pentair: 'at_pos', ...base },
  };
  for (const [id, driverAddress] of Object.entries(map)) {
    const t = byId.get(id);
    if (!t) continue;
    byId.set(id, { ...t, driverId, driverAddress });
  }
  const cfg = byId.get('POOL_CFG_PENTAIR_VLV');
  if (cfg) byId.set('POOL_CFG_PENTAIR_VLV', { ...cfg, value: true });
}

function upsertPoolTag(byId, id, fields) {
  const existing = byId.get(id);
  byId.set(id, existing ? { ...existing, ...fields, id } : { id, ...fields });
}

/** Bind 1–4 IntelliValve actuators (each has its own RS-485 address). */
function bindIntelliValves(byId, driverId, addrs) {
  const roles = INTELLIVALVE_ROLES.slice(0, addrs.length);
  for (let i = 0; i < roles.length; i++) {
    const spec = roles[i];
    const addr = addrs[i];
    const base = { deviceClass: 'intellivalve', deviceAddr: addr };
    upsertPoolTag(byId, spec.cmdId, {
      label: `${spec.label} cmd`,
      type: 'INT',
      role: 'output',
      value: 0,
      wordWidth: 16,
      driverId,
      driverAddress: { pentair: 'pos_cmd', ...base },
      comment: `${spec.label} — 0=A/pool/filter 1=B/spa/waste 2=middle (addr ${addr})`,
    });
    upsertPoolTag(byId, spec.atId, {
      label: `${spec.label} at position`,
      type: 'BOOL',
      role: 'input',
      value: true,
      driverId,
      driverAddress: { pentair: 'at_pos', ...base },
    });
    upsertPoolTag(byId, spec.pvId, {
      label: `${spec.label} position`,
      type: 'INT',
      role: 'input',
      value: 0,
      driverId,
      driverAddress: { pentair: 'pos_pv', ...base },
    });
  }
  const cfg = byId.get('POOL_CFG_PENTAIR_VLV');
  if (cfg) byId.set('POOL_CFG_PENTAIR_VLV', { ...cfg, value: true });
}

/**
 * Load IOT-LINK pool driver bundle with Linux serial ports and feature toggles.
 * @param {{ env?: NodeJS.ProcessEnv }} [opts]
 */
function loadIotLinkPoolDrivers(opts = {}) {
  const env = opts.env || process.env;
  const ports = resolveSerialPorts(env);
  const features = featureFlags(env);
  const drivers = readFixtureJson('drivers.iot_link_pool.json').map((d) => ({ ...d }));

  for (const d of drivers) {
    if (d.id === 'badu_pump') {
      d.serialPort = ports.portA;
      d.enabled = !features.intellifloPump && !features.jandyEpump && !features.haywardPump;
    }
    if (d.id === 'pentair_hp') {
      d.serialPort = ports.portB;
      d.enabled = features.pentairHeatPump && !features.modbusChemistryBus
        && !features.pentairBus && !features.jandyBus && !features.haywardBus;
    }
    if (d.id === 'pentair_bus') {
      d.serialPort = ports.portB;
      d.enabled = features.pentairBus && !features.modbusChemistryBus
        && !features.jandyBus && !features.haywardBus;
      d.busGapMs = Number(d.busGapMs) || 120;
      d.pollIntervalMs = Number(d.pollIntervalMs) || 60000;
    }
    if (d.id === 'jandy_bus') {
      d.serialPort = ports.portB;
      d.enabled = features.jandyBus && !features.modbusChemistryBus
        && !features.pentairBus && !features.haywardBus;
      d.deviceAddr = jandyEpumpAddr(env);
      d.busGapMs = Number(d.busGapMs) || 120;
      d.pollIntervalMs = Number(d.pollIntervalMs) || 60000;
    }
    if (d.id === 'hayward_bus') {
      d.serialPort = ports.portB;
      d.enabled = features.haywardBus && !features.modbusChemistryBus
        && !features.pentairBus && !features.jandyBus;
      d.deviceAddr = haywardPumpHua(env);
      d.pollIntervalMs = Number(d.pollIntervalMs) || 5000;
      d.keepaliveMs = Number(d.keepaliveMs) || 1000;
    }
    if (d.id === 'opta_mqtt_st') d.enabled = features.optaIo && !features.halowIo;
  }

  if (features.esp32Valves) {
    const row = buildResPoolValveDriver(env);
    if (!drivers.some((d) => d.id === row.id)) drivers.push(row);
  }

  if (features.waveshareRelay) {
    const seen = new Set(drivers.map((d) => d.id));
    for (const binding of resolveWaveshareBindings(env, features)) {
      const row = buildWaveshareRelayDriver(binding);
      if (seen.has(row.id)) continue;
      drivers.push(row);
      seen.add(row.id);
    }
  }

  if (features.modbusChemistryBus) {
    drivers.push({
      id: 'pool_chem_rtu',
      type: 'modbus_rtu',
      enabled: true,
      serialPort: ports.portB,
      baud: 4800,
      slaveId: 1,
      parity: 'none',
      stopBits: 1,
      timeoutMs: 2000,
      pollIntervalMs: 5000,
      comment: 'DFRobot SEN0711 slave 1 + SEN0712 slave 2 — 4800 8N1',
    });
  }

  return drivers;
}

/** Merge pool controller tags with optional Pentair heat-pump tags. */
function loadIotLinkPoolTags(opts = {}) {
  const env = opts.env || process.env;
  const features = featureFlags(env);
  const base = readFixtureJson('tags.pool_controller.json');
  const byId = new Map(base.map((t) => [t.id, { ...t }]));

  if (features.pentairBus && !features.modbusChemistryBus && !features.jandyBus && !features.haywardBus) {
    mergePentairBusTags(byId, 'pentair_bus', {
      skipValves: features.intellivalve && features.intellivalveCount >= 4,
    });
  } else if (features.pentairHeatPump && !features.modbusChemistryBus
      && !features.jandyBus && !features.haywardBus) {
    for (const tag of readFixtureJson('tags.pentair_ultratemp.json')) {
      byId.set(tag.id, { ...tag, driverId: 'pentair_hp' });
    }
  }

  if (features.jandyBus && !features.modbusChemistryBus && !features.pentairBus && !features.haywardBus) {
    mergeJandyBusTags(byId, 'jandy_bus');
  }

  if (features.haywardBus && !features.modbusChemistryBus && !features.pentairBus && !features.jandyBus) {
    mergeHaywardBusTags(byId, 'hayward_bus', haywardPumpHua(env));
  }

  if (features.intellifloPump && !features.modbusChemistryBus && !features.jandyEpump && !features.haywardPump) {
    const driverId = features.pentairBus ? 'pentair_bus' : 'pentair_pump';
    retargetPoolPumpToIntelliflo(byId, driverId, intellifloAddr(env));
  }

  if (features.jandyEpump && !features.modbusChemistryBus && !features.intellifloPump && !features.haywardPump) {
    const driverId = features.jandyBus ? 'jandy_bus' : 'jandy_pump';
    retargetPoolPumpToJandyEpump(byId, driverId, jandyEpumpAddr(env));
  }

  if (features.haywardPump && !features.modbusChemistryBus && !features.intellifloPump && !features.jandyEpump) {
    const driverId = features.haywardBus ? 'hayward_bus' : 'hayward_pump';
    retargetPoolPumpToHaywardVs(byId, driverId, haywardPumpHua(env));
  }

  if (features.intellivalve && features.pentairBus && !features.modbusChemistryBus
      && !features.jandyBus && !features.haywardBus) {
    const count = features.intellivalveCount || 1;
    if (count >= 4) {
      bindIntelliValves(byId, 'pentair_bus', intellivalveAddrs(env, count));
    } else {
      retargetBackwashValveToIntellivalve(byId, 'pentair_bus', intellivalveAddr(env));
    }
  }

  if (features.esp32Valves) {
    bindResPoolValves(byId, valveDeviceId(env));
  }

  if (features.waveshareRelay) {
    bindWavesharePoolRelays(byId, resolveWaveshareBindings(env, features));
  }

  if (features.modbusChemistryBus) {
    bindDfrobotPoolChemistry(byId, 'pool_chem_rtu');
  }

  if (features.spa) {
    const fp2 = byId.get('CFG_FP2');
    if (fp2) byId.set('CFG_FP2', { ...fp2, value: true, comment: 'Spa filter / spa mode enabled' });
    if (!byId.has('SPA_JETS')) {
      byId.set('SPA_JETS', {
        id: 'SPA_JETS',
        label: 'Spa jets / blower',
        type: 'BOOL',
        role: 'output',
        value: false,
        comment: 'Spa jets or blower — Waveshare satellite or local coil',
      });
    }
  }

  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** SEN0711 → PH_AI / WATER_TEMP_C / NH3_MG_L; SEN0712 → ORP_AI (CL2 ppm). */
function bindDfrobotPoolChemistry(byId, driverId) {
  for (const tag of dfrobotPoolChemistryDraginoTags(driverId, {
    phSlaveId: 1,
    clSlaveId: 2,
    phTagId: 'PH_AI',
    clTagId: 'ORP_AI',
  })) {
    const existing = byId.get(tag.id);
    byId.set(tag.id, existing ? { ...existing, ...tag, label: existing.label || tag.comment } : tag);
  }
}

function loadIotLinkPoolSettings(opts = {}) {
  const env = opts.env || process.env;
  const base = readFixtureJson('settings.iot_link_pool.json');
  const features = featureFlags(env);
  const settings = {
    ...base,
    mqttParc: {
      ...(base.mqttParc || {}),
      brokerUrl: env.MOOREVIEW_MQTT_BROKER || base.mqttParc?.brokerUrl || DEFAULT_MQTT_PARC_BROKER,
      clientId: features.resPoolLink
        ? 'mv-res-pool-link'
        : (features.residentialSpa ? 'mv-residential-pool-spa' : (base.mqttParc?.clientId || 'mv-iot-link-pool')),
    },
    features: {
      ...(base.features || {}),
      poolController: true,
      poolSpa: features.spa,
      residentialSpa: features.residentialSpa,
      resPoolLink: features.resPoolLink,
      pentairHeatPump: features.pentairHeatPump,
      pentairBus: features.pentairBus,
      intellifloPump: features.intellifloPump,
      intellivalve: features.intellivalve,
      intellivalveCount: features.intellivalveCount,
      jandyBus: features.jandyBus,
      jandyEpump: features.jandyEpump,
      haywardBus: features.haywardBus,
      haywardPump: features.haywardPump,
      optaIo: features.optaIo,
      halowIo: features.halowIo,
      modbusChemistryBus: features.modbusChemistryBus,
      waveshareRelay: features.waveshareRelay,
      esp32Valves: features.esp32Valves,
    },
  };
  if (features.resPoolLink || features.residentialSpa) {
    const projectId = features.resPoolLink ? 'res-pool-link' : 'residential-pool-spa';
    settings.project = { name: projectId };
    settings.startup = {
      ...(settings.startup || {}),
      mode: 'saved_project',
      projectId,
      promptOnBoot: false,
    };
    if (settings.hmi?.screens?.[0]) {
      settings.hmi.screens[0] = { ...settings.hmi.screens[0], name: 'Pool & Spa' };
    }
  }
  settings.hmi = normalizeHmi(settings.hmi || {}, loadIotLinkPoolTags(opts));
  return settings;
}

function readActiveProgramSource() {
  const fp = path.join(ST_DIR, ACTIVE_PROGRAM);
  if (!fs.existsSync(fp)) throw new Error(`Missing program: ${ACTIVE_PROGRAM}`);
  return fs.readFileSync(fp, 'utf8');
}

function buildWorkspaceEst(tags, drivers, settings) {
  return {
    format: EST_FORMAT,
    version: 1,
    savedAt: new Date().toISOString(),
    project: { name: settings?.project?.name || PROJECT_ID },
    tags,
    drivers,
    program: readActiveProgramSource(),
    activeProgram: ACTIVE_PROGRAM,
    settings,
  };
}

/** Full .est snapshot for export / project hub (no persistence writes). */
function buildIotLinkPoolEstDoc(opts = {}) {
  const tags = loadIotLinkPoolTags(opts);
  const drivers = loadIotLinkPoolDrivers(opts);
  const settings = loadIotLinkPoolSettings(opts);
  return buildWorkspaceEst(tags, drivers, settings);
}

/**
 * Write pool appliance config into MOOREVIEW_DATA (tags, drivers, settings, workspace).
 * @param {{ writeJson: Function, flushConfig?: Function }} persistence
 * @param {{ force?: boolean, env?: NodeJS.ProcessEnv }} [opts]
 */
async function seedIotLinkPoolConfig(persistence, opts = {}) {
  const env = opts.env || process.env;
  const existing = persistence.readJson('settings.json', {});
  if (!opts.force && existing.activeProgram) {
    return { seeded: false, reason: 'settings.json already configured' };
  }

  const tags = loadIotLinkPoolTags({ env });
  const drivers = loadIotLinkPoolDrivers({ env });
  const settings = loadIotLinkPoolSettings({ env });

  persistence.writeJson('tags.json', tags);
  persistence.writeJson('drivers.json', drivers);
  persistence.writeJson('settings.json', settings);
  persistence.writeJson('workspace.est.json', buildWorkspaceEst(tags, drivers, settings));

  if (typeof persistence.flushConfig === 'function') {
    await persistence.flushConfig();
  }

  return {
    seeded: true,
    activeProgram: ACTIVE_PROGRAM,
    drivers: drivers.map((d) => ({ id: d.id, type: d.type, enabled: d.enabled, serialPort: d.serialPort })),
    tagCount: tags.length,
    features: featureFlags(env),
  };
}

module.exports = {
  ACTIVE_PROGRAM,
  PROJECT_ID,
  IOT_LINK_DEFAULT_PORTS,
  DEFAULT_INTELLIFLO_ADDR,
  DEFAULT_INTELLIVALVE_ADDR,
  DEFAULT_INTELLIVALVE_COUNT,
  INTELLIVALVE_ROLES,
  DEFAULT_JANDY_EPUMP_ADDR,
  DEFAULT_HAYWARD_PUMP_HUA,
  PENTAIR_BUS_TAG_FIXTURES,
  JANDY_BUS_TAG_FIXTURES,
  HAYWARD_BUS_TAG_FIXTURES,
  resolveSerialPorts,
  poolProfile,
  featureFlags,
  intellifloAddr,
  intellivalveAddr,
  resolveIntellivalveCount,
  intellivalveAddrs,
  bindIntelliValves,
  jandyEpumpAddr,
  haywardPumpHua,
  mergePentairBusTags,
  mergeJandyBusTags,
  mergeHaywardBusTags,
  retargetPoolPumpToIntelliflo,
  retargetPoolPumpToJandyEpump,
  retargetPoolPumpToHaywardVs,
  retargetBackwashValveToIntellivalve,
  parseWaveshareRelayBindings,
  resolveWaveshareBindings,
  bindWavesharePoolRelays,
  bindResPoolValves,
  bindDfrobotPoolChemistry,
  loadIotLinkPoolDrivers,
  loadIotLinkPoolTags,
  loadIotLinkPoolSettings,
  buildIotLinkPoolEstDoc,
  seedIotLinkPoolConfig,
};
