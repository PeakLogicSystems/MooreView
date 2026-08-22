'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  NEXUS_ACCOUNT,
  TENANT,
  PLANT,
  LIFT_STATIONS,
  fleetManifest,
  fleetCsvLines,
  stationTypeMeta,
} = require('../scripts/putnam-fleet/fleet-data');

const ROOT = path.resolve(__dirname, '..');

describe('putnam fleet configuration', () => {
  it('defines tenant, plant, and six Nexus lift stations', () => {
    assert.equal(TENANT.slug, 'putnam-county-utilities');
    assert.equal(PLANT.gatewayId, 'mv_pcu_mle_plant_01');
    assert.equal(NEXUS_ACCOUNT.name, 'Putnam County');
    assert.equal(LIFT_STATIONS.length, 6);
    const slugs = new Set(LIFT_STATIONS.map((s) => s.slug));
    assert.equal(slugs.size, 6);
    const serials = new Set(LIFT_STATIONS.map((s) => s.serialNum));
    assert.equal(serials.size, 6);
  });

  it('maps every station to lift_station_epi template', () => {
    for (const s of LIFT_STATIONS) {
      const meta = stationTypeMeta(s.stationType);
      assert.equal(meta.templateId, 'lift_station_epi');
      assert.equal(s.templateId, 'lift_station_epi');
      assert.ok(s.serialNum.startsWith('40a36'));
      assert.ok(s.nexusDeviceId);
      assert.ok(s.tagPrefix);
      assert.ok(meta.defaultProgram.endsWith('.st'));
      assert.ok(meta.alarmTag);
    }
  });

  it('includes Yelvington EPI triplex and five LiftPoint duplex sites', () => {
    const yelv = LIFT_STATIONS.find((s) => s.slug === 'yelvington-triplex');
    assert.equal(yelv.serialNum, '40a36bce47f3');
    assert.equal(yelv.product, 'edge point industrial');
    assert.equal(yelv.stationType, 'triplex');
    const duplex = LIFT_STATIONS.filter((s) => s.stationType === 'dual_duplex');
    assert.equal(duplex.length, 5);
    assert.ok(duplex.every((s) => s.product === 'liftpoint'));
  });

  it('fleet manifest references cloud and plant projects', () => {
    const m = fleetManifest();
    assert.equal(m.tenant.slug, TENANT.slug);
    assert.equal(m.plant.slug, PLANT.slug);
    assert.equal(m.nexusAccount.id, NEXUS_ACCOUNT.id);
    assert.equal(m.liftStations.length, 6);
    assert.equal(m.cloudProject, 'putnam-county-cloud');
    assert.equal(m.plantProject, 'putnam-mle-plant');
    assert.equal(m.combinedProject, 'putnam-county');
    assert.ok(m.wwtpDialer.serialNum);
  });

  it('CSV has header and six data rows with serial_num', () => {
    const lines = fleetCsvLines();
    assert.equal(lines.length, 7);
    assert.match(lines[0], /serial_num/);
    assert.match(lines[1], /yelvington-triplex/);
    assert.match(lines[1], /40a36bce47f3/);
  });

  it('generated artifacts exist after generate-artifacts', () => {
    const files = [
      'st/fixtures/fleet_putnam_county.json',
      'st/fixtures/fleet_import_putnam.csv',
      'data/projects/putnam-county-cloud.est.json',
      'data/projects/putnam-mle-plant.est.json',
      'data/projects/putnam-county.est.json',
      'st/logic/putnam_fleet_rollup.st',
      'st/logic/putnam_county_combined.st',
      'public/hmi/svg/composites/triplexls.json',
      'public/hmi/svg/library/lift-station-faceplates/mooreview/triplexls.svg',
      'deploy/iot-link/.env.putnam-mle.example',
      'deploy/cloud/.env.putnam.example',
      'public/samples/putnam-county-fleet-3d.html',
    ];
    for (const rel of files) {
      assert.ok(fs.existsSync(path.join(ROOT, rel)), `missing ${rel}`);
    }
  });

  it('fleet 3D map links each lift to its HMI faceplate screen', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public/samples/putnam-county-fleet-3d.html'), 'utf8');
    assert.match(html, /hmiScreenNumber:\s*11/);
    assert.match(html, /slug:\s*'pc-blvd-duplex'/);
    assert.match(html, /mv-hmi-open-area/);
    assert.match(html, /btn-open-hmi/);
    assert.match(html, /LIFT_HIT_RADIUS/);
    assert.match(html, /LIFT_MODEL_SCALE/);
    assert.match(html, /mv-north-indicator/);
  });

  it('cloud est has six mqtt drivers wired to lift_station_epi serials', () => {
    const est = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/projects/putnam-county-cloud.est.json'), 'utf8'));
    const mqtt = est.drivers.filter((d) => d.type === 'mqtt');
    assert.equal(mqtt.length, 6);
    assert.ok(mqtt.every((d) => d.templateId === 'lift_station_epi'));
    assert.ok(mqtt.every((d) => d.serialNum && d.subscriptions?.length));
    assert.ok(mqtt.every((d) => d.clientId === `mooreview-${d.id}`));
    assert.equal(est.settings.putnamFleet.liftStations.length, 6);
    assert.equal(est.settings.mqtt.enabled, true);
    assert.equal(est.settings.nexusCloud.accountId, NEXUS_ACCOUNT.id);
    const screens = est.settings.hmi.screens;
    assert.equal(screens.length, 7);
    const fleet3d = screens.find((s) => s.id === 'screen_fleet_3d');
    assert.ok(fleet3d);
    assert.match(fleet3d.facility3dUrl || '', /putnam-county-fleet-3d/);
    assert.equal(est.settings.hmi.activeScreen, 'screen_fleet_3d');
    const yelv = screens.find((s) => s.id === 'screen_ls_yelvington-triplex');
    assert.ok(yelv);
    assert.equal(yelv.tiles[0].compositeId, 'triplexls');
    assert.ok(screens.find((s) => s.id === 'screen_ls_currie-duplex')?.tiles[0].compositeId === 'duplexls');
    assert.ok(est.settings.hmi.bindings.some((b) => b.screenId === 'screen_ls_yelvington-triplex' && b.tagId === 'YELV_MOTOR3_START'));
    assert.ok(est.settings.hmi.bindings.some((b) => b.screenId === 'screen_ls_currie-duplex' && b.tagId === 'CURR_TANK_LVL'));
    assert.ok(est.tags.some((t) => t.id === 'YELV_X1_I1'));
    assert.ok(est.tags.some((t) => t.id === 'YELV_TPX_ALM'));
    assert.ok(est.tags.some((t) => t.id === 'YELV_TANK_LVL'));
    assert.ok(est.tags.some((t) => t.id === 'CURR_ALT_FAULT'));
    assert.ok(est.tags.some((t) => t.id === 'FLEET_YELV_ALM'));
  });

  it('plant est has cloudRemote and IOT-LINK serial ports', () => {
    const est = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/projects/putnam-mle-plant.est.json'), 'utf8'));
    assert.equal(est.settings.cloudRemote.enabled, true);
    assert.equal(est.settings.cloudRemote.gatewayId, PLANT.gatewayId);
    assert.equal(est.settings.cloudRemote.tenantId, TENANT.tenantId);
    const rtu = est.drivers.filter((d) => d.type === 'modbus_rtu');
    assert.ok(rtu.length >= 1);
    assert.equal(rtu[0].serialPort, PLANT.rs485PortA);
  });

    it('combined est pins plant 3D on screen 1 and fleet 3D on screen 6', () => {
    const est = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/projects/putnam-county.est.json'), 'utf8'));
    const s1 = est.settings.hmi.screens.find((s) => s.id === 'screen_1');
    const fleet = est.settings.hmi.screens.find((s) => s.id === 'screen_fleet_3d');
    assert.match(s1?.facility3dUrl || '', /mle-wastewater/);
    assert.match(fleet?.facility3dUrl || '', /putnam-county-fleet-3d/);
    assert.equal(fleet?.inheritProjectLayout, false);
  });

  it('combined est merges plant + lifts for PC viewing', () => {
    const est = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/projects/putnam-county.est.json'), 'utf8'));
    const { normalizeHmi } = require('../src/hmi/hmiConfig');
    const normalized = normalizeHmi(est.settings.hmi, est.tags || [], path.join(ROOT, 'public'));
    const lift = normalized.screens.find((s) => s.number === 7);
    assert.ok(lift?.tiles?.length, 'lift faceplate tile survives normalizeHmi');
    assert.equal(lift.tiles[0].compositeId, 'triplexls');
    const fleet3d = normalized.screens.find((s) => s.number === 6);
    assert.match(fleet3d?.facility3dUrl || '', /putnam-county-fleet-3d/);
    const home = normalized.screens.find((s) => s.number === 1);
    assert.match(home?.facility3dUrl || '', /mle-wastewater/);
    assert.equal(est.project.name, 'putnam-county');
    assert.equal(est.activeProgram, 'logic/putnam_county_combined.st');
    const mqtt = est.drivers.filter((d) => d.type === 'mqtt');
    const modbus = est.drivers.filter((d) => d.type === 'modbus_rtu');
    assert.equal(mqtt.length, 6);
    const sim = est.drivers.find((d) => d.type === 'mqtt_sim');
    assert.ok(sim, 'mqtt_sim_putnam driver');
    assert.equal(sim.stations?.length, 6);
    assert.ok(modbus.length >= 1);
    assert.ok(est.tags.some((t) => t.id === 'T1_AER_DO'));
    assert.ok(est.tags.some((t) => t.id === 'YELV_X1_I1'));
    assert.ok(est.tags.some((t) => t.id === 'YELV_TPX_ALM'));
    assert.ok(est.tags.some((t) => t.id === 'CURR_ALT_FAULT'));
    assert.ok(est.tags.some((t) => t.id === 'PCU_FLEET_ALM'));
    assert.ok(mqtt.every((d) => d.clientId === `mooreview-${d.id}`));
    assert.match(est.program, /YELV_X1_I1.*FLEET_YELV_ALM/s);
    assert.equal(est.settings.putnamFleet.combinedProject, 'putnam-county');
    assert.equal(est.settings.cloudRemote.enabled, false);
    const screens = est.settings.hmi.screens;
    assert.equal(screens.length, 12);
    const estFleet3d = screens.find((s) => s.id === 'screen_fleet_3d');
    assert.ok(estFleet3d);
    assert.equal(estFleet3d.number, 6);
    assert.match(estFleet3d.facility3dUrl || '', /putnam-county-fleet-3d/);
    assert.ok(screens.some((s) => s.id === 'screen_ls_yelvington-triplex'));
    assert.ok(screens.find((s) => s.id === 'screen_ls_yelvington-triplex')?.tiles[0].compositeId === 'triplexls');
    assert.ok(screens.some((s) => s.id === 'screen_ls_port-buena-vista-duplex'));
    assert.match(est.settings.hmi.layout.facility3dUrl || '', /mle-wastewater/);
    assert.ok(est.settings.hmi.bindings.some((b) => b.tagId === 'YELV_TANK_LVL' && b.screenId === 'screen_ls_yelvington-triplex'));
    assert.ok(est.settings.hmi.bindings.some((b) => b.tagId === 'YELV_MOTOR3_RUN' && b.screenId === 'screen_ls_yelvington-triplex'));
    const plantLayoutRows = est.settings.hmi.layout.gridRows;
    assert.ok(plantLayoutRows <= 12, 'plant layout uses 12-row grid');
    for (const liftId of [
      'screen_fleet_3d',
      'screen_ls_yelvington-triplex',
      'screen_ls_currie-duplex',
    ]) {
      const liftScreen = screens.find((s) => s.id === liftId);
      assert.ok(liftScreen, liftId);
      assert.equal(liftScreen.inheritProjectLayout, false, `${liftId} opts out of global layout`);
    }
    const yelvScreen = screens.find((s) => s.id === 'screen_ls_yelvington-triplex');
    assert.equal(yelvScreen.gridRows, 13);
    assert.equal(yelvScreen.tiles[0].rowSpan, 13);
    assert.ok(yelvScreen.gridRows > plantLayoutRows, 'lift faceplate grid taller than plant layout');
  });
});
