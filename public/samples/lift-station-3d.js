// Reusable 3D lift-station objects (simplex / duplex / triplex).
//
// These match the MooreVIEW lift-station device templates + ST programs:
//   src/devices/templates/lift_station_{simplex,duplex,triplex}.json
//   st/logic/lift_station_{simplex,duplex,triplex}.st
//
// The module is renderer-agnostic: pass in the THREE namespace so it can be
// shared by any Three.js scene (e.g. the FL service-area map) without its own
// import map.
//
// Usage:
//   import { LIFT_STATION_TYPES, buildLiftStation } from './lift-station-3d.js';
//   const { group, pickables } = buildLiftStation(THREE, 'duplex', { name: 'LS-01 Bayshore' });
//   scene.add(group);
//   // pickables[].userData carries { label, description, alarmTag, detailTags, levelTag, levelFill }

export const LS_COLORS = {
  well: 0x64748b,
  wellRing: 0x475569,
  slab: 0x9ca3af,
  water: 0x0ea5e9,
  pump: 0x1e293b,
  motor: 0xf59e0b,
  pipe: 0x64748b,
  discharge: 0x2563eb,
  valve: 0xc2410c,
  cabinet: 0xcbd5e1,
  cabinetTrim: 0x475569,
  vent: 0x78716c,
  hatch: 0x334155,
  float: 0xfbbf24,
  rail: 0x71717a,
};

// Per-type metadata. Tag ids match the shipped tag fixtures so a station on the
// map reflects live SCADA values as soon as a device of that type is added.
export const LIFT_STATION_TYPES = {
  simplex: {
    label: 'Simplex lift station',
    short: 'Simplex',
    pumps: 1,
    accent: 0x38bdf8,
    stProgram: 'logic/lift_station_simplex.st',
    template: 'lift_station_simplex',
    alarmTag: 'SPX_ALM',
    levelTag: 'SPX_LEVEL',
    description: 'Single-pump submersible wet-well with three level floats (off/stop, on/start, high). Buried force-main manifold with four-way connections; no above-grade piping.',
    detailTags: [
      ['Station alarm', 'SPX_ALM'],
      ['Wet well level %', 'SPX_LEVEL'],
      ['Stop float (off)', 'LVL_STOP'],
      ['Start float (on)', 'LVL_START'],
      ['High level float', 'LVL_HIGH'],
      ['Pump 1 run', 'SPX_P1_RUN'],
      ['Pump 1 fault', 'SPX_P1_FAIL'],
      ['High level alarm', 'SPX_HI_ALM'],
      ['Low level alarm', 'SPX_LO_ALM'],
    ],
  },
  duplex: {
    label: 'Duplex lift station',
    short: 'Duplex',
    pumps: 2,
    accent: 0x34d399,
    stProgram: 'logic/36_duplex_lift_station.st',
    template: 'lift_station_dual_duplex',
    alarmTag: 'ALT_FAULT',
    levelTag: 'TANK_LVL',
    description: 'Two-pump lead/lag alternating wet-well station (ALT2) with HOA faceplates and four level floats. Buried force-main manifold with four-way connections; no above-grade piping.',
    detailTags: [
      ['Alternator fault', 'ALT_FAULT'],
      ['Wet well level %', 'TANK_LVL'],
      ['Lead running', 'LEAD_RUN'],
      ['Pump 1 run', 'MOTOR1_RUN'],
      ['Pump 2 run', 'MOTOR2_RUN'],
      ['Off float (pump-to-off)', 'LVL_OFF'],
      ['Lead float', 'LVL_LEAD'],
      ['Lag float', 'LVL_LAG'],
      ['High level float', 'LVL_HIGH'],
      ['System run', 'SYS_RUN'],
    ],
  },
  triplex: {
    label: 'Triplex lift station',
    short: 'Triplex',
    pumps: 3,
    accent: 0xa78bfa,
    stProgram: 'logic/lift_station_triplex.st',
    template: 'lift_station_triplex',
    alarmTag: 'TPX_ALM',
    levelTag: 'TPX_LEVEL',
    description: 'Three-pump lead/lag/lag2 alternating wet-well station. Buried force-main manifold with four-way connections; no above-grade piping.',
    detailTags: [
      ['Station alarm', 'TPX_ALM'],
      ['Alternator fault', 'TPX_FAULT'],
      ['Wet well level %', 'TPX_LEVEL'],
      ['Lead running', 'TPX_LEAD_RUN'],
      ['Pump 1 run', 'TPX_P1_RUN'],
      ['Pump 2 run', 'TPX_P2_RUN'],
      ['Pump 3 run', 'TPX_P3_RUN'],
      ['High level alarm', 'TPX_HI_ALM'],
    ],
  },
};

function stdMat(THREE, color, opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.7,
    metalness: opts.metalness ?? 0.1,
    transparent: opts.opacity != null && opts.opacity < 1,
    opacity: opts.opacity ?? 1,
  });
  m.userData.baseColor = new THREE.Color(color);
  return m;
}

function addPipeSegment(THREE, group, from, to, radius = 0.085) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.05) return;
  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, len, 12),
    stdMat(THREE, LS_COLORS.pipe, { metalness: 0.35 }),
  );
  pipe.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  group.add(pipe);
}

function addLevelFloats(THREE, group, bands, wellFloorY, waterH, offsetX, offsetZ) {
  for (const band of bands) {
    const fy = wellFloorY + waterH * band.pct;
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.35, 6),
      stdMat(THREE, LS_COLORS.rail),
    );
    rod.position.set(offsetX, fy, offsetZ);
    group.add(rod);
    const fl = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 10),
      stdMat(THREE, LS_COLORS.float, { metalness: 0.2 }),
    );
    fl.position.set(offsetX, fy + 0.2, offsetZ);
    fl.userData.floatTag = band.tag;
    group.add(fl);
  }
}

/** Buried cross manifold — four cardinal stubs below grade (no above-ground piping). */
function addBuriedFourWayPlumbing(THREE, group, opts) {
  const {
    pipeY, wellR, stubLen, headerSpan,
  } = opts;
  const pt = (x, y, z) => ({ x, y, z });

  addPipeSegment(THREE, group, pt(-headerSpan / 2, pipeY, 0), pt(headerSpan / 2, pipeY, 0));
  addPipeSegment(THREE, group, pt(0, pipeY, -headerSpan / 2), pt(0, pipeY, headerSpan / 2));

  const dirs = [
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -1 },
  ];
  for (const d of dirs) {
    const inner = wellR - 0.12;
    const outer = wellR + stubLen;
    addPipeSegment(
      THREE,
      group,
      pt(d.x * inner, pipeY, d.z * inner),
      pt(d.x * outer, pipeY, d.z * outer),
    );
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.028, 8, 16),
      stdMat(THREE, LS_COLORS.wellRing, { metalness: 0.4 }),
    );
    collar.rotation.y = d.x !== 0 ? Math.PI / 2 : 0;
    collar.rotation.x = Math.PI / 2;
    collar.position.set(d.x * (wellR - 0.02), pipeY, d.z * (wellR - 0.02));
    group.add(collar);
    const coupling = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.035, 8, 16),
      stdMat(THREE, LS_COLORS.valve, { metalness: 0.3 }),
    );
    coupling.rotation.x = Math.PI / 2;
    coupling.rotation.y = d.x !== 0 ? Math.PI / 2 : 0;
    coupling.position.set(d.x * outer, pipeY, d.z * outer);
    group.add(coupling);
  }
}

function addUndergroundPumpDischarge(THREE, group, pumpX, pumpZ, pumpY, pipeY) {
  addPipeSegment(THREE, group, { x: pumpX, y: pumpY, z: pumpZ }, { x: pumpX, y: pipeY, z: pumpZ });
  if (Math.abs(pumpZ) > 0.05) {
    addPipeSegment(THREE, group, { x: pumpX, y: pipeY, z: pumpZ }, { x: pumpX, y: pipeY, z: 0 });
  }
}

/**
 * Build a lift-station 3D object.
 * @param {object} THREE - the three namespace
 * @param {'simplex'|'duplex'|'triplex'} type
 * @param {object} [opts] - { name, scale }
 * @returns {{ group: THREE.Group, pickables: THREE.Mesh[], meta: object }}
 */
export function buildLiftStation(THREE, type, opts = {}) {
  const spec = LIFT_STATION_TYPES[type] || LIFT_STATION_TYPES.simplex;
  const scale = opts.scale ?? 1;
  const name = opts.name || spec.label;

  const group = new THREE.Group();
  const pickables = [];

  const meta = {
    zone: true,
    type,
    label: name,
    typeLabel: spec.label,
    description: spec.description,
    alarmTag: spec.alarmTag,
    levelTag: spec.levelTag,
    detailTags: spec.detailTags,
    detailScreen: opts.detailScreen || '',
  };

  const WELL_R = 1.85;
  const WELL_H = 3.6;
  const gradeY = 0;
  const wellCenterY = gradeY - WELL_H / 2 + 0.12;
  const wellFloorY = wellCenterY - WELL_H / 2 + 0.2;
  const deckY = gradeY + 0.22;
  const slabW = WELL_R * 2.85;

  // Buried wet-well — semi-transparent so pumps, rails, and floats are visible
  const wellGeo = new THREE.CylinderGeometry(WELL_R, WELL_R, WELL_H, 48);
  const well = new THREE.Mesh(wellGeo, stdMat(THREE, LS_COLORS.well, { opacity: 0.28, roughness: 0.85 }));
  well.position.y = wellCenterY;
  well.castShadow = true;
  well.receiveShadow = true;
  Object.assign(well.userData, meta);
  group.add(well);
  pickables.push(well);

  for (let ring = 0; ring < 4; ring += 1) {
    const y = wellFloorY + 0.35 + ring * (WELL_H - 0.7) / 3;
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(WELL_R - 0.04, 0.045, 8, 48),
      stdMat(THREE, LS_COLORS.wellRing, { metalness: 0.35 }),
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    group.add(band);
  }

  // Live water column inside the well
  const waterH = WELL_H - 0.45;
  const waterGeo = new THREE.CylinderGeometry(WELL_R - 0.16, WELL_R - 0.16, waterH, 36);
  const water = new THREE.Mesh(waterGeo, stdMat(THREE, LS_COLORS.water, { opacity: 0.55, roughness: 0.25 }));
  water.position.y = wellFloorY + waterH / 2;
  group.add(water);
  meta.levelFill = water;
  meta.levelFillBaseY = water.position.y;
  meta.levelFillHeight = waterH;

  // Rectangular concrete pad (plan view matches field drawings)
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(slabW, 0.24, slabW),
    stdMat(THREE, LS_COLORS.slab, { roughness: 0.95 }),
  );
  slab.position.y = gradeY + 0.12;
  slab.castShadow = true;
  slab.receiveShadow = true;
  group.add(slab);

  // Center access hatch with metal frame
  const hatchFrame = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.1, 1.05),
    stdMat(THREE, LS_COLORS.hatch, { metalness: 0.45 }),
  );
  hatchFrame.position.set(0, deckY, 0);
  group.add(hatchFrame);
  const hatchDoor = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 0.04, 0.9),
    stdMat(THREE, 0x475569, { metalness: 0.5 }),
  );
  hatchDoor.position.set(0, deckY + 0.05, 0);
  group.add(hatchDoor);

  // Guide rails (pump lift rails)
  for (const rx of [-0.62, 0.62]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, WELL_H - 0.5, 0.06),
      stdMat(THREE, LS_COLORS.rail, { metalness: 0.55 }),
    );
    rail.position.set(rx, wellCenterY, 0);
    group.add(rail);
  }

  // Level floats — simplex: 3 (off/stop, on/start, high); duplex+: 4-float ladder
  const floatOffsetX = WELL_R - 0.35;
  const floatOffsetZ = 0.25;
  if (type === 'simplex') {
    addLevelFloats(THREE, group, [
      { pct: 0.22, tag: 'LVL_STOP' },
      { pct: 0.42, tag: 'LVL_START' },
      { pct: 0.72, tag: 'LVL_HIGH' },
    ], wellFloorY, waterH, floatOffsetX, floatOffsetZ);
  } else {
    addLevelFloats(THREE, group, [
      { pct: 0.16, tag: 'LVL_OFF' },
      { pct: 0.36, tag: 'LVL_LEAD' },
      { pct: 0.56, tag: 'LVL_LAG' },
      { pct: 0.78, tag: 'LVL_HIGH' },
    ], wellFloorY, waterH, floatOffsetX, floatOffsetZ);
  }

  const pipeY = gradeY - 0.38;
  const stubLen = 1.65;
  const headerSpan = slabW * 0.72;

  function pumpSlot(i, count) {
    if (count === 1) return { x: 0, z: 0 };
    if (count === 2) return { x: i === 0 ? -0.62 : 0.62, z: 0 };
    const ang = (i / count) * Math.PI * 2 - Math.PI / 2;
    return { x: Math.cos(ang) * 0.55, z: Math.sin(ang) * 0.55 };
  }

  const pumpCount = spec.pumps;
  const pumpMotors = [];
  for (let i = 0; i < pumpCount; i += 1) {
    const { x: px, z: pz } = pumpSlot(i, pumpCount);
    const pumpY = wellFloorY + 0.42;

    const pumpBody = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 18, 14),
      stdMat(THREE, LS_COLORS.pump, { metalness: 0.4, roughness: 0.45 }),
    );
    pumpBody.position.set(px, pumpY, pz);
    pumpBody.castShadow = true;
    group.add(pumpBody);

    const motor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.19, 0.38, 16),
      stdMat(THREE, LS_COLORS.motor, { metalness: 0.45, roughness: 0.4 }),
    );
    motor.position.set(px, pumpY + 0.42, pz);
    motor.castShadow = true;
    group.add(motor);
    pumpMotors.push(motor);
    addUndergroundPumpDischarge(THREE, group, px, pz, pumpY, pipeY);
  }

  addBuriedFourWayPlumbing(THREE, group, { pipeY, wellR: WELL_R, stubLen, headerSpan });

  // MCC / RTU cabinet on pedestal beside the hatch
  const cabX = slabW / 2 - 0.55;
  const pedestal = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.35, 0.55),
    stdMat(THREE, LS_COLORS.slab, { roughness: 0.9 }),
  );
  pedestal.position.set(cabX, gradeY + 0.35, 0);
  group.add(pedestal);

  const cabinet = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 1.45, 0.5),
    stdMat(THREE, LS_COLORS.cabinet),
  );
  cabinet.position.set(cabX, gradeY + 1.15, 0);
  cabinet.castShadow = true;
  Object.assign(cabinet.userData, meta);
  group.add(cabinet);
  pickables.push(cabinet);

  const cabinetFace = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 1.05, 0.04),
    stdMat(THREE, LS_COLORS.cabinetTrim, { metalness: 0.3 }),
  );
  cabinetFace.position.set(cabX, gradeY + 1.2, 0.27);
  group.add(cabinetFace);

  meta.pumpMotors = pumpMotors;

  group.scale.setScalar(scale);

  meta.pickables = pickables;
  return { group, pickables, meta };
}

/** Scale a station's water column mesh to a level percentage (0..100). */
export function applyLiftStationLevel(meta, levelPct) {
  const fill = meta?.levelFill;
  if (!fill) return;
  const pct = Math.max(0, Math.min(100, Number(levelPct) || 0)) / 100;
  const h = meta.levelFillHeight || 1;
  fill.scale.y = Math.max(0.02, pct);
  // keep the water column sitting on the well floor as it grows
  fill.position.y = (meta.levelFillBaseY - h / 2) + (h * pct) / 2;
}
