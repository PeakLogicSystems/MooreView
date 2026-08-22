'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  IOT_LINK_DEFAULT_PORTS,
  loadIotLinkPoolDrivers,
  loadIotLinkPoolTags,
  loadIotLinkPoolSettings,
  seedIotLinkPoolConfig,
  ACTIVE_PROGRAM,
} = require('../src/appliance/iotLinkPoolSeed');
const { loadFixtureBundle } = require('../src/programs/programFixtures');
const { parseProgram, validateProgram } = require('../src/engine/parser');
const { ST_DIR } = require('../src/config');

describe('iotLinkPool fixtures', () => {
  it('drivers.iot_link_pool.json exists with Linux serial ports', () => {
    const fp = path.join(ST_DIR, 'fixtures', 'drivers.iot_link_pool.json');
    assert.ok(fs.existsSync(fp));
    const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const badu = raw.find((d) => d.id === 'badu_pump');
    const pentairHp = raw.find((d) => d.id === 'pentair_hp');
    const pentairBus = raw.find((d) => d.id === 'pentair_bus');
    assert.equal(badu.serialPort, IOT_LINK_DEFAULT_PORTS.portA);
    assert.equal(pentairHp.serialPort, IOT_LINK_DEFAULT_PORTS.portB);
    assert.equal(pentairBus.serialPort, IOT_LINK_DEFAULT_PORTS.portB);
    assert.equal(badu.baud, 19200);
    assert.equal(pentairHp.baud, 9600);
    assert.equal(pentairHp.deviceAddr, 112);
    assert.equal(pentairBus.busGapMs, 120);
  });

  it('loadIotLinkPoolDrivers honors env port overrides', () => {
    const drivers = loadIotLinkPoolDrivers({
      env: {
        MOOREVIEW_RS485_PORT_A: '/dev/ttyLP6',
        MOOREVIEW_RS485_PORT_B: '/dev/ttyCUSTOM',
        MOOREVIEW_POOL_PENTAIR: 'true',
        MOOREVIEW_POOL_OPTA_IO: 'true',
      },
    });
    const badu = drivers.find((d) => d.id === 'badu_pump');
    const pentair = drivers.find((d) => d.id === 'pentair_hp');
    const opta = drivers.find((d) => d.id === 'opta_mqtt_st');
    assert.equal(badu.serialPort, '/dev/ttyLP6');
    assert.equal(pentair.serialPort, '/dev/ttyCUSTOM');
    assert.equal(pentair.enabled, true);
    assert.equal(opta.enabled, true);
  });

  it('loadIotLinkPoolDrivers swaps PORT B to modbus when MOOREVIEW_POOL_MODBUS_CHEM=true', () => {
    const drivers = loadIotLinkPoolDrivers({
      env: {
        MOOREVIEW_POOL_MODBUS_CHEM: 'true',
        MOOREVIEW_POOL_PENTAIR: 'true',
      },
    });
    const pentair = drivers.find((d) => d.id === 'pentair_hp');
    const chem = drivers.find((d) => d.id === 'pool_chem_rtu');
    assert.equal(pentair.enabled, false);
    assert.ok(chem);
    assert.equal(chem.type, 'modbus_rtu');
    assert.equal(chem.serialPort, IOT_LINK_DEFAULT_PORTS.portB);
    assert.equal(chem.baud, 4800);
  });

  it('loadIotLinkPoolTags binds SEN0711 + SEN0712 onto PH_AI / ORP_AI', () => {
    const tags = loadIotLinkPoolTags({
      env: { MOOREVIEW_POOL_MODBUS_CHEM: 'true' },
    });
    const ph = tags.find((t) => t.id === 'PH_AI');
    const cl = tags.find((t) => t.id === 'ORP_AI');
    const temp = tags.find((t) => t.id === 'WATER_TEMP_C');
    const nh3 = tags.find((t) => t.id === 'NH3_MG_L');
    assert.equal(ph?.driverId, 'pool_chem_rtu');
    assert.equal(ph?.driverAddress?.slaveId, 1);
    assert.equal(ph?.driverAddress?.address, 1);
    assert.equal(ph?.scale, 0.01);
    assert.equal(cl?.driverId, 'pool_chem_rtu');
    assert.equal(cl?.driverAddress?.slaveId, 2);
    assert.equal(cl?.driverAddress?.address, 0);
    assert.equal(temp?.driverId, 'pool_chem_rtu');
    assert.ok(nh3);
  });

  it('loadIotLinkPoolDrivers enables pentair_bus when MOOREVIEW_POOL_PENTAIR_BUS=true', () => {
    const drivers = loadIotLinkPoolDrivers({
      env: {
        MOOREVIEW_POOL_PENTAIR_BUS: 'true',
        MOOREVIEW_POOL_INTELLIFLO: 'true',
        MOOREVIEW_POOL_PENTAIR: 'true',
      },
    });
    const bus = drivers.find((d) => d.id === 'pentair_bus');
    const hp = drivers.find((d) => d.id === 'pentair_hp');
    const badu = drivers.find((d) => d.id === 'badu_pump');
    assert.equal(bus?.enabled, true);
    assert.equal(bus?.serialPort, IOT_LINK_DEFAULT_PORTS.portB);
    assert.equal(hp?.enabled, false);
    assert.equal(badu?.enabled, false);
  });

  it('loadIotLinkPoolTags merges Pentair bus equipment tags', () => {
    const tags = loadIotLinkPoolTags({
      env: { MOOREVIEW_POOL_PENTAIR_BUS: 'true', MOOREVIEW_POOL_INTELLIFLO: 'true' },
    });
    const ids = tags.map((t) => t.id);
    assert.ok(ids.includes('IFLO_RPM'));
    assert.ok(ids.includes('IC_SALT_PPM'));
    assert.ok(ids.includes('HP_MODE'));
    assert.ok(ids.includes('VLV1_POS'));
    const pumpRpm = tags.find((t) => t.id === 'PUMP_RPM');
    assert.equal(pumpRpm?.driverId, 'pentair_bus');
    assert.equal(pumpRpm?.driverAddress?.pentair, 'rpm');
    assert.equal(pumpRpm?.driverAddress?.deviceClass, 'intelliflo');
    const bwCmd = tags.find((t) => t.id === 'BW_VLV1_CMD');
    assert.equal(bwCmd?.driverId, 'pentair_bus');
    assert.equal(bwCmd?.driverAddress?.deviceClass, 'intellivalve');
    assert.equal(bwCmd?.driverAddress?.pentair, 'pos_cmd');
    const pentairVlv = tags.find((t) => t.id === 'POOL_CFG_PENTAIR_VLV');
    assert.equal(pentairVlv?.value, true);
  });

  it('loadIotLinkPoolDrivers enables jandy_bus when MOOREVIEW_POOL_JANDY_BUS=true', () => {
    const drivers = loadIotLinkPoolDrivers({
      env: {
        MOOREVIEW_POOL_JANDY_BUS: 'true',
        MOOREVIEW_POOL_JANDY_EPUMP: 'true',
        MOOREVIEW_POOL_PENTAIR_BUS: 'false',
      },
    });
    const bus = drivers.find((d) => d.id === 'jandy_bus');
    const pentair = drivers.find((d) => d.id === 'pentair_bus');
    const badu = drivers.find((d) => d.id === 'badu_pump');
    assert.equal(bus?.enabled, true);
    assert.equal(pentair?.enabled, false);
    assert.equal(badu?.enabled, false);
  });

  it('loadIotLinkPoolTags merges Jandy bus equipment tags', () => {
    const tags = loadIotLinkPoolTags({
      env: { MOOREVIEW_POOL_JANDY_BUS: 'true', MOOREVIEW_POOL_JANDY_EPUMP: 'true' },
    });
    const ids = tags.map((t) => t.id);
    assert.ok(ids.includes('JEP_RPM'));
    assert.ok(ids.includes('JAP_SALT_PPM'));
    assert.ok(ids.includes('JXI_RUNNING'));
    const pumpRpm = tags.find((t) => t.id === 'PUMP_RPM');
    assert.equal(pumpRpm?.driverId, 'jandy_bus');
    assert.equal(pumpRpm?.driverAddress?.jandy, 'rpm');
  });

  it('loadIotLinkPoolDrivers enables hayward_bus when MOOREVIEW_POOL_HAYWARD_BUS=true', () => {
    const drivers = loadIotLinkPoolDrivers({
      env: {
        MOOREVIEW_POOL_HAYWARD_BUS: 'true',
        MOOREVIEW_POOL_HAYWARD_PUMP: 'true',
      },
    });
    const bus = drivers.find((d) => d.id === 'hayward_bus');
    assert.equal(bus?.enabled, true);
    assert.equal(bus?.baud, 19200);
    assert.equal(bus?.stopBits, 2);
  });

  it('loadIotLinkPoolTags merges Hayward VS pump tags', () => {
    const tags = loadIotLinkPoolTags({
      env: { MOOREVIEW_POOL_HAYWARD_BUS: 'true', MOOREVIEW_POOL_HAYWARD_PUMP: 'true' },
    });
    assert.ok(tags.some((t) => t.id === 'HVS_RPM'));
    const pumpRpm = tags.find((t) => t.id === 'PUMP_RPM');
    assert.equal(pumpRpm?.driverId, 'hayward_bus');
    assert.equal(pumpRpm?.driverAddress?.hayward, 'rpm');
  });

  it('loadIotLinkPoolTags merges Pentair heat pump only (legacy)', () => {
    const tags = loadIotLinkPoolTags();
    const ids = tags.map((t) => t.id);
    assert.ok(ids.includes('PUMP_RUN_CMD'));
    assert.ok(ids.includes('HP_MODE'));
    assert.ok(ids.includes('DOSE_CL'));
  });

  it('settings.iot_link_pool.json sets activeProgram and pool HMI', () => {
    const settings = loadIotLinkPoolSettings();
    assert.equal(settings.activeProgram, ACTIVE_PROGRAM);
    assert.equal(settings.hmi.activeScreen, 'screen_1');
    assert.ok(settings.hmi.screens.some((s) => s.tiles?.[0]?.compositeId === 'pool_overview'));
    assert.equal(settings.features.poolController, true);
  });

  it('pool controller ST validates against merged tags', () => {
    const tags = loadIotLinkPoolTags();
    const src = fs.readFileSync(path.join(ST_DIR, 'logic', '30_pool_controller.st'), 'utf8');
    const { ast } = parseProgram(src);
    const errors = validateProgram(ast, tags.map((t) => t.id));
    assert.equal(errors.length, 0, errors.join('; '));
  });

  it('loadFixtureBundle still works for pool program with default drivers file', () => {
    const bundle = loadFixtureBundle('logic/30_pool_controller.st', loadIotLinkPoolDrivers());
    assert.ok(bundle);
    assert.equal(bundle.driversFile, 'drivers.pool_controller.json');
    assert.ok(bundle.tags.some((t) => t.id === 'POOL_BW_STA'));
  });

  it('loadIotLinkPoolDrivers adds Waveshare satellite from RELAYS env', () => {
    const drivers = loadIotLinkPoolDrivers({
      env: {
        MOOREVIEW_POOL_WAVESHARE_RELAYS: 'dose_acid:ws_relay_acid:flow_sw,light_z1:ws_relay_lz1',
      },
    });
    const acid = drivers.find((d) => d.id === 'ws_relay_acid');
    const light = drivers.find((d) => d.id === 'ws_relay_lz1');
    assert.ok(acid);
    assert.equal(acid.type, 'mqtt_parc');
    assert.equal(acid.deviceId, 'ws_relay_acid');
    assert.equal(acid.remoteExecution, false);
    assert.ok(light);
  });

  it('residential-spa profile enables shared Pentair bus, spa, and default Waveshare spa jets', () => {
    const env = { MOOREVIEW_POOL_PROFILE: 'residential-spa' };
    const flags = require('../src/appliance/iotLinkPoolSeed').featureFlags(env);
    assert.equal(flags.profile, 'residential-spa');
    assert.equal(flags.pentairBus, true);
    assert.equal(flags.intellifloPump, true);
    assert.equal(flags.intellivalve, false);
    assert.equal(flags.optaIo, false);
    assert.equal(flags.pentairHeatPump, false);
    assert.equal(flags.spa, true);
    assert.equal(flags.waveshareRelay, true);

    const drivers = loadIotLinkPoolDrivers({ env });
    const bus = drivers.find((d) => d.id === 'pentair_bus');
    const badu = drivers.find((d) => d.id === 'badu_pump');
    const opta = drivers.find((d) => d.id === 'opta_mqtt_st');
    const spaRelay = drivers.find((d) => d.id === 'ws_relay_spa');
    assert.equal(bus?.enabled, true);
    assert.equal(badu?.enabled, false);
    assert.equal(opta?.enabled, false);
    assert.ok(spaRelay);
    assert.equal(spaRelay.deviceId, 'ws_relay_spa');

    const tags = loadIotLinkPoolTags({ env });
    const fp2 = tags.find((t) => t.id === 'CFG_FP2');
    const jets = tags.find((t) => t.id === 'SPA_JETS');
    const pumpRpm = tags.find((t) => t.id === 'PUMP_RPM');
    const icSalt = tags.find((t) => t.id === 'IC_SALT_PPM');
    const icPct = tags.find((t) => t.id === 'IC_PERCENT_CMD');
    assert.equal(fp2?.value, true);
    assert.equal(jets?.driverId, 'ws_relay_spa');
    assert.equal(jets?.driverAddress?.channel, 'R1');
    assert.equal(pumpRpm?.driverId, 'pentair_bus');
    assert.equal(pumpRpm?.driverAddress?.deviceClass, 'intelliflo');
    assert.ok(icSalt);
    assert.equal(icSalt.driverAddress?.deviceClass, 'intellichlor');
    assert.ok(icPct);

    const settings = loadIotLinkPoolSettings({ env });
    assert.equal(settings.project?.name, 'residential-pool-spa');
    assert.equal(settings.features.residentialSpa, true);
    assert.equal(settings.features.poolSpa, true);
    assert.equal(settings.mqttParc?.clientId, 'mv-residential-pool-spa');
    assert.equal(settings.hmi?.screens?.[0]?.name, 'Pool & Spa');
  });

  it('res-pool-link product enables ESP32 backwash valves (inlet/outlet/waste/spare)', () => {
    const env = { MOOREVIEW_PRODUCT: 'res-pool-link' };
    const { featureFlags } = require('../src/appliance/iotLinkPoolSeed');
    const flags = featureFlags(env);
    assert.equal(flags.profile, 'res-pool-link');
    assert.equal(flags.resPoolLink, true);
    assert.equal(flags.esp32Valves, true);
    assert.equal(flags.intellivalve, false);
    assert.equal(flags.pentairBus, true);
    assert.equal(flags.spa, true);

    const drivers = loadIotLinkPoolDrivers({ env });
    const valves = drivers.find((d) => d.id === 'res_pool_valves');
    assert.ok(valves);
    assert.equal(valves.type, 'mqtt_parc');
    assert.equal(valves.platform, 'esp32-res-pool-link');
    assert.equal(valves.remoteExecution, false);

    const tags = loadIotLinkPoolTags({ env });
    const inlet = tags.find((t) => t.id === 'FILT_INLET');
    const outlet = tags.find((t) => t.id === 'FILT_OUTLET');
    const waste = tags.find((t) => t.id === 'BW_WASTE');
    const spare = tags.find((t) => t.id === 'BW_SPARE');
    const stFilt = tags.find((t) => t.id === 'BW_VALVE_FILTER');
    const stBw = tags.find((t) => t.id === 'BW_VALVE_BW');
    assert.equal(inlet?.driverId, 'res_pool_valves');
    assert.equal(inlet?.driverAddress?.channel, 'R1');
    assert.equal(outlet?.driverAddress?.channel, 'R2');
    assert.equal(waste?.driverAddress?.channel, 'R3');
    assert.equal(spare?.driverAddress?.channel, 'R4');
    assert.equal(stFilt?.driverId, 'res_pool_valves');
    assert.equal(stBw?.driverAddress?.channel, 'BW_VALVE_BW');

    const settings = loadIotLinkPoolSettings({ env });
    assert.equal(settings.project?.name, 'res-pool-link');
    assert.equal(settings.features.esp32Valves, true);
    assert.equal(settings.mqttParc?.clientId, 'mv-res-pool-link');
  });

  it('loadIotLinkPoolTags binds Waveshare roles onto pool ST tags', () => {
    const tags = loadIotLinkPoolTags({
      env: {
        MOOREVIEW_POOL_WAVESHARE_RELAYS: 'dose_acid:ws_relay_acid:flow_sw,dose_cl:ws_relay_cl',
      },
    });
    const acid = tags.find((t) => t.id === 'DOSE_ACID');
    const cl = tags.find((t) => t.id === 'DOSE_CL');
    const flow = tags.find((t) => t.id === 'POOL_FLOW_SW');
    assert.equal(acid?.driverId, 'ws_relay_acid');
    assert.equal(acid?.driverAddress?.channel, 'R1');
    assert.equal(cl?.driverId, 'ws_relay_cl');
    assert.equal(flow?.driverId, 'ws_relay_acid');
    assert.equal(flow?.driverAddress?.channel, 'I1');
  });

  it('seedIotLinkPoolConfig writes persistence files', async () => {
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'mv-iot-link-'));
    const written = new Map();
    const persistence = {
      readJson(name, fallback) {
        if (name === 'settings.json' && written.has(name)) return written.get(name);
        return fallback;
      },
      writeJson(name, data) {
        written.set(name, data);
        fs.writeFileSync(path.join(tmp, name), JSON.stringify(data, null, 2));
      },
      flushConfig: async () => {},
    };

    const result = await seedIotLinkPoolConfig(persistence, { force: true });
    assert.equal(result.seeded, true);
    assert.equal(result.activeProgram, ACTIVE_PROGRAM);
    assert.ok(written.has('tags.json'));
    assert.ok(written.has('drivers.json'));
    assert.ok(written.has('workspace.est.json'));
    const drivers = written.get('drivers.json');
    assert.ok(drivers.some((d) => d.id === 'badu_pump' && d.serialPort === IOT_LINK_DEFAULT_PORTS.portA));

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
