#!/usr/bin/env node
'use strict';

/**
 * Generate ATU cloud fleet artifacts (residential + commercial profiles).
 *
 * Usage: node scripts/atu-fleet/generate-artifacts.js
 */

const fs = require('fs');
const path = require('path');
const {
  TENANT,
  SITE_PROFILES,
  stationTypeMeta,
  profileManifest,
  profilesCatalog,
  fleetCsvLines,
} = require('./fleet-data');
const { buildDwts3dHtml } = require('./dwts-3d-html');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_CATALOG = path.join(ROOT, 'st', 'fixtures', 'fleet_atu_profiles.json');

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

function buildDrivers(devices) {
  return devices.map((d) => {
    const type = stationTypeMeta(d.stationType);
    const drv = {
      id: d.driverId,
      type: 'mqtt_parc',
      enabled: true,
      deviceId: d.deviceId,
      name: d.name,
      scanMs: 100,
      reportIntervalSec: 0.2,
      remoteExecution: true,
      templateId: type.templateId,
      activeProgram: type.defaultProgram,
    };
    if (type.ioBaseOnly) drv.ioBaseOnly = true;
    return drv;
  });
}

function buildFleetTags(profile, devices) {
  const tags = [
    baseTag('FLEET_ANY_ALM', {
      label: `${profile.name} — any device alarm`,
      alarmsEnabled: true,
      alarmCondition: 'on',
    }),
    baseTag('FLEET_ATU_ALM', {
      label: `${profile.name} — any ATU alarm`,
      alarmsEnabled: true,
      alarmCondition: 'on',
    }),
    baseTag('FLEET_LIFT_ALM', {
      label: `${profile.name} — any lift alarm`,
      alarmsEnabled: true,
      alarmCondition: 'on',
    }),
    baseTag('SITE_ALM', {
      label: `${profile.name} — site summary alarm`,
      alarmsEnabled: true,
      alarmCondition: 'on',
    }),
    baseTag('SITE_DESIGN_GPD', {
      label: 'Design flow (GPD)',
      type: 'INT',
      role: 'memory',
      default: profile.designGpd,
      value: profile.designGpd,
      graphEnabled: true,
    }),
  ];
  for (const d of devices) {
    tags.push(baseTag(d.fleetAlarmTag, {
      label: `${d.name} — fleet mirror`,
      alarmsEnabled: true,
      alarmCondition: 'on',
    }));
  }
  return tags;
}

function buildFleetProgram(devices) {
  const allFleet = devices.map((d) => d.fleetAlarmTag);
  const atuFleet = devices.filter((d) => d.category === 'atu').map((d) => d.fleetAlarmTag);
  const liftFleet = devices.filter((d) => d.category === 'lift').map((d) => d.fleetAlarmTag);
  const lines = [
    `(* ${devices[0]?.owner || 'ATU'} cloud fleet rollup *)`,
    '(* Mirror FLEET_*_ALM from each device primary alarm after Drivers → Sync tags *)',
    '',
  ];
  if (allFleet.length) {
    lines.push(`IF ${allFleet.join(' OR ')} THEN TurnON(FLEET_ANY_ALM); ELSE TurnOFF(FLEET_ANY_ALM); END_IF;`);
  }
  if (atuFleet.length) {
    lines.push(`IF ${atuFleet.join(' OR ')} THEN TurnON(FLEET_ATU_ALM); ELSE TurnOFF(FLEET_ATU_ALM); END_IF;`);
  } else {
    lines.push('TurnOFF(FLEET_ATU_ALM);');
  }
  if (liftFleet.length) {
    lines.push(`IF ${liftFleet.join(' OR ')} THEN TurnON(FLEET_LIFT_ALM); ELSE TurnOFF(FLEET_LIFT_ALM); END_IF;`);
  } else {
    lines.push('TurnOFF(FLEET_LIFT_ALM);');
  }
  lines.push('IF FLEET_ANY_ALM THEN TurnON(SITE_ALM); ELSE TurnOFF(SITE_ALM); END_IF;');
  return lines.join('\n');
}

function buildCloudEst(profileKey) {
  const profile = SITE_PROFILES[profileKey];
  const devices = profile.devices;
  const tags = buildFleetTags(profile, devices);
  const drivers = buildDrivers(devices);
  const program = buildFleetProgram(devices);
  const stName = `atu_fleet_${profileKey}_rollup.st`;

  return {
    est: {
      format: 'mooreview-est',
      version: 1,
      savedAt: new Date().toISOString(),
      project: { name: profile.cloudProject },
      tags,
      drivers,
      program,
      activeProgram: `logic/${stName}`,
      settings: {
        project: { name: profile.cloudProject },
        scanMs: 1000,
        activeProgram: `logic/${stName}`,
        remoteExecution: true,
        mqttParc: {
          enabled: true,
          brokerUrl: 'mqtt://127.0.0.1:1883',
          topicPrefix: 'mooreview/v1',
        },
        atuFleet: profileManifest(profileKey),
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
            composerMode: '3d',
            facility3dUrl: profile.facility3dUrl,
          },
          screens: [{ id: 'screen_1', number: 1, isHome: true, name: profile.name, tiles: [] }],
          bindings: [{
            screenId: 'screen_1',
            elementId: 'site_alm',
            tagId: 'SITE_ALM',
            property: 'fill',
            onValue: '#ef4444',
            offValue: '#22c55e',
          }],
        },
      },
    },
    program,
    stName,
  };
}

function buildCloudEnv(profileKey) {
  const profile = SITE_PROFILES[profileKey];
  const manifest = profileManifest(profileKey);
  return `# MooreVIEW ATU cloud — ${profile.name} (${profile.designGpd} GPD)
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

MOOREVIEW_CELLULAR_SIMS=1

# 100% cloud — ${manifest.counts.total} cellular gateways (Opta + modem → cloud MQTT)
# ATU: ${manifest.counts.atu} | Lifts: ${manifest.counts.lift}
# Open project: ${profile.cloudProject}

# Device IDs:
${profile.devices.map((d) => `#   ${d.deviceId}  (${d.stationType})`).join('\n')}
`;
}

function writeStProgram(stName, program) {
  const stPath = path.join(ROOT, 'st', 'logic', stName);
  fs.mkdirSync(path.dirname(stPath), { recursive: true });
  fs.writeFileSync(stPath, `${program}\n`, 'utf8');
  return stPath;
}

function build3dHtml(profileKey) {
  const profile = SITE_PROFILES[profileKey];
  const manifest = profileManifest(profileKey);
  const isDwts = profile.systemType === 'dwts';
  const stationsJson = JSON.stringify(manifest.devices.map((d) => ({
    name: d.name,
    slug: d.slug,
    type: d.stationType,
    category: d.category,
    role: d.role || d.category,
    lat: d.lat,
    lng: d.lng,
    deviceId: d.deviceId,
    alarmTag: d.alarmTag,
    levelTag: d.levelTag,
    fleetAlarmTag: d.fleetAlarmTag,
    designGpd: d.designGpd,
  })), null, 2);
  const tankGuideJson = manifest.tankGuide ? JSON.stringify(manifest.tankGuide, null, 2) : 'null';
  const subtitle = isDwts
    ? `${profile.designGpd} GPD — ${manifest.counts.atu} quad DWTU, ${manifest.counts.step} home STEP, ${manifest.counts.booster} duplex booster. 100% cloud.`
    : `${profile.designGpd} GPD design — ${manifest.counts.atu} ATU, ${manifest.counts.lift} lifts. 100% cloud (cellular Opta → MQTT).`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${profile.name} — ATU Cloud Fleet</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; font-family: "Segoe UI", system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
    #canvas-wrap { position: absolute; inset: 0; }
    canvas { display: block; width: 100%; height: 100%; }
    .panel { position: absolute; z-index: 10; background: rgba(15, 23, 42, 0.92); border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 10px; padding: 14px 16px; font-size: 13px; line-height: 1.45; }
    #title-panel { top: 14px; left: 14px; max-width: 420px; }
    #title-panel h1 { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
    #title-panel p { color: #94a3b8; font-size: 12px; }
    #legend { bottom: 14px; left: 14px; }
    .legend-item { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; font-size: 12px; }
    .swatch { width: 14px; height: 14px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.15); }
    #fleet-list { bottom: 14px; right: 14px; width: 320px; max-height: 45vh; overflow: auto; }
    #tank-panel { top: 14px; right: 14px; width: 340px; max-height: 55vh; overflow: auto; font-size: 11px; }
    #tank-panel h2 { font-size: 12px; margin-bottom: 6px; }
    #tank-panel ul { margin: 4px 0 10px 16px; color: #cbd5e1; }
    #tank-panel li { margin-bottom: 3px; }
    #fleet-list ul { list-style: none; margin-top: 8px; font-size: 12px; }
    #fleet-list li { padding: 3px 0; border-bottom: 1px solid rgba(148,163,184,0.12); display: flex; justify-content: space-between; }
    .alm { color: #f87171; font-weight: 600; }
    .ok { color: #86efac; }
  </style>
</head>
<body>
  <div id="canvas-wrap"></div>
  <div id="title-panel" class="panel">
    <h1>${profile.name}</h1>
    <p>${subtitle}</p>
  </div>
  <div id="legend" class="panel">
    <div class="legend-item"><span class="swatch" style="background:#22c55e"></span> ${isDwts ? 'Quad DWTU' : 'ATU'}</div>
    <div class="legend-item"><span class="swatch" style="background:#38bdf8"></span> ${isDwts ? 'Home STEP' : 'Lift station'}</div>
    ${isDwts ? '<div class="legend-item"><span class="swatch" style="background:#f59e0b"></span> Duplex booster</div>' : ''}
    <div class="legend-item"><span class="swatch" style="background:#ef4444"></span> Alarm</div>
  </div>
  ${isDwts ? '<div id="tank-panel" class="panel"><h2>Tank configuration</h2><div id="tank-content"></div></div>' : ''}
  <div id="fleet-list" class="panel"><strong>Fleet</strong><ul id="fleet-items"></ul></div>
  <script type="importmap">{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/" } }</script>
  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    const STATIONS = ${stationsJson};
    const TANK_GUIDE = ${tankGuideJson};
    const wrap = document.getElementById('canvas-wrap');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 500);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    wrap.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(40, 60, 30);
    scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const lats = STATIONS.map(s => s.lat), lngs = STATIONS.map(s => s.lng);
    const latMid = (Math.min(...lats) + Math.max(...lats)) / 2;
    const lngMid = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const markers = [];
    const listEl = document.getElementById('fleet-items');
    STATIONS.forEach((s, i) => {
      const isAtu = s.category === 'atu';
      const isBooster = s.role === 'booster';
      const geo = isAtu ? new THREE.CylinderGeometry(1.2, 1.4, 3, 8) : new THREE.BoxGeometry(1.5, 2, 1.5);
      const baseColor = isAtu ? 0x22c55e : (isBooster ? 0xf59e0b : 0x38bdf8);
      const mat = new THREE.MeshStandardMaterial({ color: baseColor });
      const mesh = new THREE.Mesh(geo, mat);
      const x = (s.lng - lngMid) * 8000;
      const z = -(s.lat - latMid) * 8000;
      mesh.position.set(x, isAtu ? 1.5 : 1, z);
      mesh.userData = s;
      scene.add(mesh);
      markers.push(mesh);
      const li = document.createElement('li');
      li.innerHTML = '<span>' + s.name + '</span><span class="off" data-slug="' + s.slug + '">…</span>';
      listEl.appendChild(li);
    });
    camera.position.set(0, 35, 45);
    controls.target.set(0, 0, 0);
    async function poll() {
      for (const m of markers) {
        const s = m.userData;
        try {
          const r = await fetch('/api/parc/devices/' + encodeURIComponent(s.deviceId));
          if (!r.ok) continue;
          const dev = await r.json();
          const tag = (dev.tags || []).find(t => t.id === s.alarmTag);
          const alm = !!(tag && tag.value);
          m.material.color.setHex(alm ? 0xef4444 : (s.category === 'atu' ? 0x22c55e : (s.role === 'booster' ? 0xf59e0b : 0x38bdf8)));
          const span = listEl.querySelector('[data-slug="' + s.slug + '"]');
          if (span) { span.textContent = alm ? 'ALARM' : 'OK'; span.className = alm ? 'alm' : 'ok'; }
        } catch { /* offline */ }
      }
    }
    setInterval(poll, 3000);
    poll();
    if (TANK_GUIDE) {
      const el = document.getElementById('tank-content');
      const sections = [
        ['Home STEP (×' + TANK_GUIDE.homeStep.count + ')', TANK_GUIDE.homeStep.tanks],
        ['Booster duplex (×' + TANK_GUIDE.boosterDuplex.count + ')', TANK_GUIDE.boosterDuplex.tanks],
        ['Quad DWTU (×' + TANK_GUIDE.dwtuQuad.count + ')', TANK_GUIDE.dwtuQuad.tanks],
      ];
      sections.forEach(([title, tanks]) => {
        const h = document.createElement('h3');
        h.textContent = title;
        h.style.fontSize = '11px';
        h.style.marginTop = '8px';
        el.appendChild(h);
        const ul = document.createElement('ul');
        tanks.forEach(t => {
          const li = document.createElement('li');
          const gal = t.capacityGal ? ' — ' + t.capacityGal.toLocaleString() + ' gal' : '';
          li.textContent = t.label + gal + (t.rule ? ' (' + t.rule + ')' : '');
          ul.appendChild(li);
        });
        el.appendChild(ul);
      });
    }
    function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }
    animate();
    addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
  </script>
</body>
</html>
`;
}

function generateProfile(profileKey) {
  const profile = SITE_PROFILES[profileKey];
  const manifest = profileManifest(profileKey);
  const manifestPath = path.join(ROOT, profile.manifestFile.replace(/\//g, path.sep));
  const csvPath = path.join(ROOT, profile.importCsv.replace(/\//g, path.sep));
  const estPath = path.join(ROOT, 'data', 'projects', `${profile.cloudProject}.est.json`);
  const envPath = path.join(ROOT, 'deploy', 'cloud', `.env.atu-${profileKey}.example`);
  const htmlPath = path.join(ROOT, 'public', 'samples', path.basename(profile.facility3dUrl));

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const csvDevices = profile.devices.map((d) => ({ ...d, designGpd: profile.designGpd }));
  fs.writeFileSync(csvPath, `${fleetCsvLines(csvDevices).join('\n')}\n`, 'utf8');

  const { est, program, stName } = buildCloudEst(profileKey);
  const stPath = writeStProgram(stName, program);
  fs.mkdirSync(path.dirname(estPath), { recursive: true });
  fs.writeFileSync(estPath, `${JSON.stringify(est, null, 2)}\n`, 'utf8');
  fs.writeFileSync(envPath, buildCloudEnv(profileKey), 'utf8');
  const html = profile.systemType === 'dwts'
    ? buildDwts3dHtml(profile, manifest)
    : build3dHtml(profileKey);
  fs.writeFileSync(htmlPath, html, 'utf8');

  return { manifestPath, csvPath, estPath, stPath, envPath, htmlPath, deviceCount: profile.devices.length };
}

function main() {
  fs.writeFileSync(OUT_CATALOG, `${JSON.stringify(profilesCatalog(), null, 2)}\n`, 'utf8');

  console.log('ATU cloud fleet artifacts generated:');
  console.log(`  ${path.relative(ROOT, OUT_CATALOG)}`);

  for (const key of Object.keys(SITE_PROFILES)) {
    const out = generateProfile(key);
    console.log(`  [${key}] ${out.deviceCount} devices`);
    console.log(`    ${path.relative(ROOT, out.manifestPath)}`);
    console.log(`    ${path.relative(ROOT, out.estPath)}`);
    console.log(`    ${path.relative(ROOT, out.stPath)}`);
    console.log(`    ${path.relative(ROOT, out.htmlPath)}`);
  }
}

main();
