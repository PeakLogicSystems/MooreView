'use strict';

const fs = require('fs');
const path = require('path');

const COMPOSITE_PATH_PREFIX = '@composite/';

/**
 * @typedef {object} HmiCompositePart
 * @property {string} svg
 * @property {number} [z]
 * @property {string} [kind]
 * @property {string} [role]
 */

/**
 * @typedef {object} HmiCompositeManifest
 * @property {string} id
 * @property {string} [label]
 * @property {string} [group]
 * @property {string} [subgroup]
 * @property {string} [preview]
 * @property {string} [defaultTagId]
 * @property {Record<string, { pick?: string, types?: string[] }>} [tagRoles]
 * @property {HmiCompositePart[]} parts
 * @property {object[]} defaultBindings
 */

function normalizePart(raw, publicRoot) {
  const svg = String(raw?.svg || '').trim();
  if (!svg) return null;
  const { resolveAssetPath } = require('./hmiConfig');
  const resolved = publicRoot ? resolveAssetPath(publicRoot, svg) : svg;
  const z = Math.max(0, Math.min(4, Number.isFinite(Number(raw?.z)) ? Number(raw.z) : 0));
  const kind = String(raw?.kind || 'staticImage').trim();
  const role = String(raw?.role || raw?.elementId || '').trim();
  return { svg: resolved, z, kind, role };
}

function normalizeBindingDef(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const elementId = String(raw.elementId || raw.role || '').trim();
  const property = String(raw.property || '').trim();
  if (!elementId || !property) return null;
  const out = {
    elementId,
    property,
    tagRole: String(raw.tagRole || 'pv').trim() || 'pv',
  };
  if (raw.min != null && Number.isFinite(Number(raw.min))) out.min = Number(raw.min);
  if (raw.max != null && Number.isFinite(Number(raw.max))) out.max = Number(raw.max);
  if (raw.format != null) out.format = String(raw.format);
  if (raw.onValue != null) out.onValue = raw.onValue;
  if (raw.offValue != null) out.offValue = raw.offValue;
  if (raw.tagField != null) out.tagField = String(raw.tagField).trim();
  if (raw.interaction != null) out.interaction = String(raw.interaction).trim();
  if (raw.colors && Array.isArray(raw.colors)) out.colors = raw.colors.slice();
  if (raw.flashStates && Array.isArray(raw.flashStates)) out.flashStates = raw.flashStates.slice();
  return out;
}

/** @returns {HmiCompositeManifest|null} */
function normalizeManifest(raw, id, publicRoot) {
  if (!raw || typeof raw !== 'object') return null;
  const manifestId = String(raw.id || id || '').trim();
  if (!manifestId) return null;
  const parts = (Array.isArray(raw.parts) ? raw.parts : [])
    .map((p) => normalizePart(p, publicRoot))
    .filter(Boolean);
  if (!parts.length) return null;
  const defaultBindings = (Array.isArray(raw.defaultBindings) ? raw.defaultBindings : [])
    .map(normalizeBindingDef)
    .filter(Boolean);
  return {
    id: manifestId,
    label: String(raw.label || manifestId).trim(),
    group: String(raw.group || 'Gauges & meters').trim(),
    subgroup: String(raw.subgroup || 'composites').trim(),
    preview: raw.preview ? (publicRoot ? require('./hmiConfig').resolveAssetPath(publicRoot, String(raw.preview)) : String(raw.preview)) : parts[0].svg,
    defaultTagId: String(raw.defaultTagId || '').trim(),
    tagRoles: raw.tagRoles && typeof raw.tagRoles === 'object' ? raw.tagRoles : { pv: { pick: 'firstNumeric', types: ['REAL', 'INT'] } },
    parts,
    defaultBindings,
  };
}

function compositesDir(publicRoot) {
  return path.join(publicRoot, 'hmi', 'svg', 'composites');
}

/** @param {string} publicRoot */
function listHmiComposites(publicRoot) {
  const dir = compositesDir(publicRoot);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (!/\.json$/i.test(name) || name.toLowerCase() === 'index.json') continue;
    const fp = path.join(dir, name);
    if (!fs.statSync(fp).isFile()) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
      const id = name.replace(/\.json$/i, '');
      const manifest = normalizeManifest(raw, id, publicRoot);
      if (!manifest) continue;
      out.push({
        path: `${COMPOSITE_PATH_PREFIX}${manifest.id}`,
        name: `${manifest.id}.json`,
        type: 'composite',
        group: manifest.group,
        subgroup: manifest.subgroup,
        vendor: 'mooreview',
        label: manifest.label,
        preview: manifest.preview,
        composite: manifest,
      });
    } catch { /* skip invalid manifest */ }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

function compositePathFromId(id) {
  return `${COMPOSITE_PATH_PREFIX}${String(id || '').trim()}`;
}

function compositeIdFromPath(assetPath) {
  const p = String(assetPath || '').trim();
  if (!p.startsWith(COMPOSITE_PATH_PREFIX)) return '';
  return p.slice(COMPOSITE_PATH_PREFIX.length);
}

function compositeBindingElementId(col, row, manifest, bindingDef) {
  const role = String(bindingDef?.elementId || '').trim();
  const part = manifest.parts?.[0];
  const z = part?.z ?? 0;
  return `t${Number(col) + 1}_${Number(row) + 1}_z${z}__${role}`;
}

function tagIdForCompositeRole(manifest, role) {
  const spec = manifest.tagRoles?.[role] || manifest.tagRoles?.pv || {};
  if (spec.pick === 'tagId' && spec.tagId) return String(spec.tagId);
  if (spec.pick === 'firstAlt' && spec.tagId) return String(spec.tagId);
  return '';
}

function compositeInstanceTagPrefix(tile) {
  return String(tile?.compositeTagPrefix || tile?.tagPrefix || '').trim();
}

/** MOTOR1 + index 1 → MOTOR2 when tiles lack explicit compositeTagPrefix. */
function numberedInstancePrefix(basePrefix, instanceIndex) {
  const base = String(basePrefix || 'MOTOR1').trim();
  if (instanceIndex <= 0) return base;
  const m = /^(.*?)(\d+)$/.exec(base);
  if (!m) return `${base}${instanceIndex + 1}`;
  return `${m[1]}${Number(m[2]) + instanceIndex}`;
}

/** Map "col,row" → instance tag prefix for multi-instance composites on one screen. */
function buildCompositeInstancePrefixMap(screen, manifestForCompositeId) {
  const grouped = new Map();
  for (const tile of screen?.tiles || []) {
    const compositeId = String(tile.compositeId || '').trim();
    if (!compositeId) continue;
    const manifest = typeof manifestForCompositeId === 'function'
      ? manifestForCompositeId(compositeId)
      : null;
    const base = String(manifest?.instanceTagPrefix || manifest?.defaultInstancePrefix || '').trim();
    if (!base) continue;
    if (!grouped.has(compositeId)) grouped.set(compositeId, []);
    grouped.get(compositeId).push({
      tile,
      col: Number(tile.col),
      row: Number(tile.row),
    });
  }
  const out = new Map();
  for (const [compositeId, items] of grouped) {
    const manifest = typeof manifestForCompositeId === 'function'
      ? manifestForCompositeId(compositeId)
      : null;
    const base = String(manifest?.instanceTagPrefix || manifest?.defaultInstancePrefix || 'MOTOR1').trim();
    items.sort((a, b) => (a.row - b.row) || (a.col - b.col));
    items.forEach(({ tile, col, row }, idx) => {
      let prefix = compositeInstanceTagPrefix(tile);
      if (!prefix) prefix = numberedInstancePrefix(base, idx);
      if (!tile.compositeTagPrefix) tile.compositeTagPrefix = prefix;
      out.set(`${col},${row}`, prefix);
    });
  }
  return out;
}

function resolveCompositeInstanceTagPrefix(tile, col, row, prefixMap) {
  return compositeInstanceTagPrefix(tile)
    || prefixMap?.get?.(`${col},${row}`)
    || '';
}

/** Remap manifest default tag ids (e.g. MOTOR1_*) to a tile instance prefix (e.g. MOTOR2). */
function remapManifestTagId(manifestTagId, manifest, tilePrefix) {
  const id = String(manifestTagId || '').trim();
  const prefix = String(tilePrefix || '').trim();
  if (!id || !prefix) return id;
  const base = String(manifest?.instanceTagPrefix || manifest?.defaultInstancePrefix || 'MOTOR1').trim();
  if (!base || base === prefix) return id;
  const esc = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${esc}(?=_)`).test(id) ? id.replace(new RegExp(`^${esc}`), prefix) : id;
}

function tagIdForCompositeRoleOnTile(manifest, role, tile) {
  const base = tagIdForCompositeRole(manifest, role);
  return remapManifestTagId(base, manifest, compositeInstanceTagPrefix(tile));
}

function bindingSuffix(elementId) {
  const id = String(elementId || '');
  const i = id.lastIndexOf('__');
  return i >= 0 ? id.slice(i + 2) : id;
}

/** Backfill manifest paint defaults without clobbering user-edited colors. */
function backfillBindingPaint(binding, def) {
  if (def.onValue != null && (binding.onValue == null || binding.onValue === '')) {
    binding.onValue = def.onValue;
  }
  if (def.offValue != null && (binding.offValue == null || binding.offValue === '')) {
    binding.offValue = def.offValue;
  }
  if (Array.isArray(def.colors) && def.colors.length
    && (!Array.isArray(binding.colors) || !binding.colors.length)) {
    binding.colors = def.colors.slice();
  }
  if (Array.isArray(def.flashStates) && def.flashStates.length
    && (!Array.isArray(binding.flashStates) || !binding.flashStates.length)) {
    binding.flashStates = def.flashStates.slice();
  }
}

/** Merge composite manifest defaults into screen bindings (format, interaction, tags). */
function repairCompositeBindings(hmi, publicRoot) {
  if (!hmi?.screens?.length || !Array.isArray(hmi.bindings)) return hmi;
  const byId = new Map();
  if (publicRoot) {
    for (const entry of listHmiComposites(publicRoot)) {
      if (entry.composite?.id) byId.set(entry.composite.id, entry.composite);
    }
  }
  for (const screen of hmi.screens) {
    const prefixMap = buildCompositeInstancePrefixMap(screen, (cid) => byId.get(cid));
    for (const tile of screen.tiles || []) {
      const compositeId = String(tile.compositeId || '').trim();
      if (!compositeId) continue;
      const manifest = byId.get(compositeId);
      if (!manifest?.defaultBindings?.length) continue;
      const col = Number(tile.col);
      const row = Number(tile.row);
      if (!Number.isFinite(col) || !Number.isFinite(row)) continue;
      const screenId = screen.id;
      const validKeys = new Set();
      const tagByRole = new Map();
      const tilePrefix = resolveCompositeInstanceTagPrefix(tile, col, row, prefixMap);
      if (tilePrefix && !tile.compositeTagPrefix) tile.compositeTagPrefix = tilePrefix;

      for (const def of manifest.defaultBindings) {
        const elementId = compositeBindingElementId(col, row, manifest, def);
        const tagRole = def.tagRole || 'pv';
        let tagId = tagByRole.get(tagRole);
        if (!tagId) {
          const baseTag = tagIdForCompositeRole(manifest, tagRole);
          tagId = remapManifestTagId(baseTag, manifest, tilePrefix);
          tagByRole.set(tagRole, tagId);
        }
        validKeys.add(`${elementId}|${def.property}`);

        let binding = hmi.bindings.find((b) => (
          b.screenId === screenId && b.elementId === elementId && b.property === def.property
        ));
        if (!binding) {
          binding = {
            screenId,
            elementId,
            tagId: tagId || '',
            property: def.property,
            onValue: def.onValue ?? '#22c55e',
            offValue: def.offValue ?? '#94a3b8',
            format: def.format || '',
            min: def.min != null ? def.min : 0,
            max: def.max != null ? def.max : 100,
            classOn: 'hmi-on',
            classOff: 'hmi-off',
          };
          if (def.tagField) binding.tagField = def.tagField;
          if (def.interaction) binding.interaction = def.interaction;
          if (def.colors) binding.colors = def.colors.slice();
          if (def.flashStates) binding.flashStates = def.flashStates.slice();
          hmi.bindings.push(binding);
          continue;
        }
        if (tagId && tilePrefix && !def.tagField) binding.tagId = tagId;
        else if (tagId && !String(binding.tagId || '').trim()) binding.tagId = tagId;
        if (def.format) binding.format = def.format;
        if (def.tagField) binding.tagField = def.tagField;
        if (def.interaction) binding.interaction = def.interaction;
        if (def.min != null) binding.min = def.min;
        if (def.max != null) binding.max = def.max;
        backfillBindingPaint(binding, def);
      }

      const suffixes = new Set(manifest.defaultBindings.map((d) => d.elementId));
      hmi.bindings = hmi.bindings.filter((b) => {
        if (b.screenId !== screenId) return true;
        const suf = bindingSuffix(b.elementId);
        if (!suffixes.has(suf)) return true;
        const parsed = /^t(\d+)_(\d+)_z\d+__/.exec(String(b.elementId || ''));
        if (!parsed) return true;
        const bCol = Number(parsed[1]) - 1;
        const bRow = Number(parsed[2]) - 1;
        if (bCol !== col || bRow !== row) return true;
        return validKeys.has(`${b.elementId}|${b.property}`);
      });
    }
  }
  return hmi;
}

module.exports = {
  COMPOSITE_PATH_PREFIX,
  listHmiComposites,
  normalizeManifest,
  compositePathFromId,
  compositeIdFromPath,
  compositeBindingElementId,
  compositeInstanceTagPrefix,
  numberedInstancePrefix,
  buildCompositeInstancePrefixMap,
  resolveCompositeInstanceTagPrefix,
  remapManifestTagId,
  tagIdForCompositeRoleOnTile,
  repairCompositeBindings,
};
