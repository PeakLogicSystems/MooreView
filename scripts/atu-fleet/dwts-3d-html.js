'use strict';

/**
 * DWTS 3D site — simplex lifts, duplex boosters, trash + parallel 1,250 gal tanks, drip field.
 */

function buildDwts3dHtml(profile, manifest) {
  const tankGuide = manifest.tankGuide || {};
  const stationsJson = JSON.stringify(manifest.devices.map((d) => ({
    name: d.name,
    slug: d.slug,
    type: d.stationType,
    category: d.category,
    role: d.role || d.category,
    zoneId: d.zoneId,
    feedsBooster: d.feedsBooster,
    lat: d.lat,
    lng: d.lng,
    sceneX: d.sceneX,
    sceneZ: d.sceneZ,
    deviceId: d.deviceId,
    alarmTag: d.alarmTag,
    levelTag: d.levelTag,
    fleetAlarmTag: d.fleetAlarmTag,
    designGpd: d.designGpd,
    tanks: d.tanks || [],
    processChain: d.processChain || [],
    plantMeta: d.plantMeta || null,
  })), null, 2);
  const zonesJson = JSON.stringify(tankGuide.zones || [], null, 2);

  const subtitle = `${profile.designGpd} GPD drip DWTS — 2 zones × (10 simplex → duplex booster → trash ≥1,000 gal → 4× 1,250 gal ATU → drip)`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${profile.name} — DWTS 3D</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; font-family: "Segoe UI", system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
    #canvas-wrap { position: absolute; inset: 0; }
    canvas { display: block; width: 100%; height: 100%; }
    .panel { position: absolute; z-index: 10; background: rgba(15, 23, 42, 0.94); border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 10px; backdrop-filter: blur(8px); padding: 14px 16px; font-size: 13px; line-height: 1.45; }
    #title-panel { top: 14px; left: 14px; max-width: 440px; }
    #title-panel h1 { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
    #title-panel p { color: #94a3b8; font-size: 12px; }
    #mv-status { top: 14px; left: 50%; transform: translateX(-50%); font-size: 12px; padding: 8px 14px; }
    #mv-status.ok { border-color: rgba(34, 197, 94, 0.45); color: #86efac; }
    #mv-status.err { border-color: rgba(239, 68, 68, 0.45); color: #fca5a5; }
    #legend { bottom: 14px; left: 14px; max-width: 320px; }
    #legend h2 { font-size: 12px; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3b8; }
    .legend-item { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; font-size: 12px; }
    .swatch { width: 14px; height: 14px; border-radius: 3px; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.15); }
    #fleet-list { bottom: 14px; right: 14px; width: 340px; max-height: 40vh; overflow: auto; }
    #fleet-list ul { list-style: none; margin-top: 8px; font-size: 12px; }
    #fleet-list li { padding: 3px 0; border-bottom: 1px solid rgba(148,163,184,0.12); display: flex; justify-content: space-between; gap: 8px; }
    #detail-panel { top: 72px; right: 14px; width: 360px; max-height: 58vh; overflow: auto; display: none; }
    #detail-panel.open { display: block; }
    #detail-panel h2 { font-size: 14px; margin-bottom: 4px; }
    #detail-panel h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3b8; margin: 12px 0 6px; }
    #detail-chain { margin: 8px 0; padding-left: 18px; font-size: 12px; color: #cbd5e1; }
    #detail-chain li { margin-bottom: 4px; }
    #detail-panel dl { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; font-size: 12px; }
    #detail-panel dt { color: #94a3b8; }
    #detail-panel dd { text-align: right; font-family: Consolas, monospace; max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
    .alm { color: #f87171; font-weight: 600; }
    .ok { color: #86efac; }
    .off { color: #64748b; }
    .hint { margin-top: 8px; font-size: 11px; color: #64748b; }
    #zone-badges { margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap; }
    .zone-badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #1e293b; border: 1px solid #334155; color: #94a3b8; }
  </style>
</head>
<body>
  <div id="canvas-wrap"></div>
  <div id="mv-status" class="panel err">MV live: connecting…</div>
  <div id="title-panel" class="panel">
    <h1>${profile.name}</h1>
    <p>${subtitle}</p>
    <div id="zone-badges"><span class="zone-badge">Zone 1 — west</span><span class="zone-badge">Zone 2 — east</span></div>
  </div>
  <div id="legend" class="panel">
    <h2>Process train (per zone)</h2>
    <div class="legend-item"><span class="swatch" style="background:#38bdf8"></span> Simplex collection lift (wet well)</div>
    <div class="legend-item"><span class="swatch" style="background:#f59e0b"></span> Duplex booster (2 pumps, ALT2)</div>
    <div class="legend-item"><span class="swatch" style="background:#78716c"></span> Trash tank ≥1,000 gal</div>
    <div class="legend-item"><span class="swatch" style="background:#22c55e"></span> Parallel 1,250 gal ATU modules (×4)</div>
    <div class="legend-item"><span class="swatch" style="background:#4ade80"></span> Drip drainfield</div>
    <div class="legend-item"><span class="swatch" style="background:#ef4444"></span> Alarm</div>
  </div>
  <div id="detail-panel" class="panel">
    <h2 id="detail-title">Station</h2>
    <p id="detail-desc" class="hint"></p>
    <ol id="detail-chain"></ol>
    <h3>Tanks / vessels</h3>
    <dl id="detail-tanks"></dl>
    <h3>Lift / SCADA tags</h3>
    <dl id="detail-tags"></dl>
  </div>
  <div id="fleet-list" class="panel"><strong>Fleet (24)</strong><ul id="fleet-items"></ul></div>
  <script type="importmap">{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/" } }</script>
  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    import { buildLiftStation, applyLiftStationLevel, LIFT_STATION_TYPES } from './lift-station-3d.js';
    import { buildDwtsPlant } from './dwts-plant-3d.js';

    const STATIONS = ${stationsJson};
    const ZONES = ${zonesJson};

    const wrap = document.getElementById('canvas-wrap');
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.setClearColor(0x0f172a);
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0f172a, 100, 280);
    const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 600);
    camera.position.set(0, 75, 110);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 14);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(60, 100, 40);
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 260),
      new THREE.MeshStandardMaterial({ color: 0x1a2e1a, roughness: 0.98 }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const grid = new THREE.GridHelper(240, 48, 0x334155, 0x1e293b);
    grid.position.y = 0.02;
    scene.add(grid);

    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.35, roughness: 0.5 });
    const stationGroups = [];
    const rayPickables = [];
    const listEl = document.getElementById('fleet-items');
    const bySlug = Object.fromEntries(STATIONS.map(s => [s.slug, s]));

    function pos(s) { return { x: s.sceneX ?? 0, z: s.sceneZ ?? 0 }; }

    function addPipe(x1, z1, x2, z2, y = 0.35) {
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 1.5) return;
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, len, 10), pipeMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.rotation.y = Math.atan2(dx, dz);
      pipe.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
      scene.add(pipe);
    }

    for (const s of STATIONS) {
      const { x, z } = pos(s);
      let built;
      if (s.category === 'atu') {
        const pm = s.plantMeta || {};
        built = buildDwtsPlant(THREE, {
          name: s.name,
          scale: 0.95,
          trashGal: pm.trashGal || 1000,
          moduleGal: pm.moduleGal || 1250,
          moduleCount: pm.moduleCount || 4,
          alarmTag: s.alarmTag,
          levelTag: s.levelTag,
          tanks: s.tanks,
          processChain: s.processChain,
          detailTags: (LIFT_STATION_TYPES.quad_atu || {}).detailTags || [],
        });
      } else if (s.role === 'booster') {
        built = buildLiftStation(THREE, 'duplex', { name: s.name, scale: 0.88 });
      } else {
        built = buildLiftStation(THREE, 'simplex', { name: s.name, scale: 0.72 });
      }
      const { group, pickables, meta } = built;
      group.position.set(x, 0, z);
      group.userData = { station: s, meta };
      scene.add(group);
      stationGroups.push(group);
      for (const p of pickables) {
        p.userData = { station: s, meta, parentGroup: group };
        rayPickables.push(p);
      }
      const li = document.createElement('li');
      li.innerHTML = '<span>Z' + (s.zoneId || '?') + ' · ' + s.name + '</span><span class="off" data-slug="' + s.slug + '">…</span>';
      listEl.appendChild(li);
    }

    for (const s of STATIONS.filter(x => x.role === 'collection')) {
      const sp = pos(s);
      const booster = bySlug[s.feedsBooster];
      if (booster) {
        const bp = pos(booster);
        addPipe(sp.x, sp.z, bp.x, bp.z, 0.28);
      }
    }
    for (const s of STATIONS.filter(x => x.role === 'booster')) {
      const bp = pos(s);
      const plant = STATIONS.find(p => p.category === 'atu' && p.zoneId === s.zoneId);
      if (plant) {
        const pp = pos(plant);
        addPipe(bp.x, bp.z, pp.x, pp.z - 4, 0.42);
      }
    }

    const mvStatus = document.getElementById('mv-status');
    const detailPanel = document.getElementById('detail-panel');
    const detailTitle = document.getElementById('detail-title');
    const detailDesc = document.getElementById('detail-desc');
    const detailChain = document.getElementById('detail-chain');
    const detailTanks = document.getElementById('detail-tanks');
    const detailTags = document.getElementById('detail-tags');
    let parcDevices = [];

    async function refreshParc() {
      try {
        const res = await fetch('/api/parc/devices', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        parcDevices = data.devices || [];
        mvStatus.textContent = 'MV live: ' + parcDevices.length + ' device(s)';
        mvStatus.className = 'panel ok';
        updateFleetUi();
        updateColors();
      } catch (e) {
        mvStatus.textContent = 'MV demo: ' + e.message;
        mvStatus.className = 'panel err';
      }
    }

    function deviceById(id) { return parcDevices.find(d => d.deviceId === id); }
    function tagVal(dev, id) { return (dev?.tags || []).find(t => t.id === id)?.value; }
    function isAlarm(dev, tag) { const v = tagVal(dev, tag); return v === true || v === 1; }

    function liftTypeKey(s) {
      if (s.role === 'booster') return 'duplex';
      if (s.role === 'collection') return 'simplex';
      return null;
    }

    function updateColors() {
      for (const g of stationGroups) {
        const s = g.userData.station;
        const dev = deviceById(s.deviceId);
        const alarm = dev ? isAlarm(dev, s.alarmTag) : false;
        g.traverse(obj => {
          if (obj.isMesh && obj.material?.userData?.baseColor) {
            obj.material.color.copy(obj.material.userData.baseColor);
            obj.material.emissive = new THREE.Color(alarm ? 0x7f1d1d : 0x000000);
          }
        });
        const lk = liftTypeKey(s);
        if (lk) {
          const lvl = dev ? Number(tagVal(dev, s.levelTag)) : NaN;
          if (Number.isFinite(lvl)) applyLiftStationLevel(g.userData.meta, lvl);
        }
      }
    }

    function updateFleetUi() {
      for (const s of STATIONS) {
        const dev = deviceById(s.deviceId);
        const alarm = dev ? isAlarm(dev, s.alarmTag) : false;
        const span = listEl.querySelector('[data-slug="' + s.slug + '"]');
        if (span) {
          span.textContent = alarm ? 'ALARM' : (dev ? 'OK' : '—');
          span.className = alarm ? 'alm' : (dev ? 'ok' : 'off');
        }
      }
    }

    function showDetail(s, meta) {
      detailPanel.classList.add('open');
      detailTitle.textContent = s.name + (s.zoneId ? ' (Zone ' + s.zoneId + ')' : '');
      const lk = liftTypeKey(s);
      const liftSpec = lk ? LIFT_STATION_TYPES[lk] : null;
      detailDesc.textContent = meta?.description || liftSpec?.description || s.type;

      detailChain.innerHTML = '';
      const chain = s.processChain?.length ? s.processChain : (ZONES.find(z => z.zoneId === s.zoneId)?.processChain || []);
      for (const step of chain) {
        const li = document.createElement('li');
        li.textContent = step;
        detailChain.appendChild(li);
      }

      detailTanks.innerHTML = '';
      for (const t of (s.tanks || [])) {
        const dt = document.createElement('dt');
        dt.textContent = t.label;
        const dd = document.createElement('dd');
        if (t.capacityGal) dd.textContent = t.capacityGal.toLocaleString() + ' gal';
        else if (t.note) dd.textContent = t.note;
        else dd.textContent = t.dispersal || '—';
        detailTanks.appendChild(dt);
        detailTanks.appendChild(dd);
      }

      detailTags.innerHTML = '';
      const dev = deviceById(s.deviceId);
      const tagRows = liftSpec?.detailTags || meta?.detailTags || [[s.levelTag, s.levelTag], [s.alarmTag, s.alarmTag]];
      for (const [label, tag] of tagRows) {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        const v = dev ? tagVal(dev, tag) : null;
        dd.textContent = v == null ? '—' : String(v);
        detailTags.appendChild(dt);
        detailTags.appendChild(dd);
      }
      if (s.feedsBooster) {
        const dt = document.createElement('dt');
        dt.textContent = 'Feeds booster';
        const dd = document.createElement('dd');
        dd.textContent = bySlug[s.feedsBooster]?.name || s.feedsBooster;
        detailTags.appendChild(dt);
        detailTags.appendChild(dd);
      }
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    renderer.domElement.addEventListener('click', (ev) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(rayPickables, false);
      if (!hits.length) { detailPanel.classList.remove('open'); return; }
      const ud = hits[0].object.userData;
      if (ud?.station) showDetail(ud.station, ud.meta);
    });

    setInterval(refreshParc, 3000);
    refreshParc();
    function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }
    animate();
    addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });
  </script>
</body>
</html>
`;
}

module.exports = { buildDwts3dHtml };
