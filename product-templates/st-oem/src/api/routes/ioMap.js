'use strict';

const persistence = require('../../persistence');

function isExpansionIoTag(tag) {
  return /^X(\d+)_/.test(String(tag?.id || ''));
}

function expansionSlotFromId(id) {
  const m = /^X(\d+)_/.exec(String(id || ''));
  return m ? Number(m[1]) : 0;
}

function expansionModuleKind(tags) {
  const ids = (tags || []).map((t) => t.id);
  if (ids.some((id) => /_I\d+$/.test(id) || /_R\d+$/.test(id))) return 'D1608E';
  if (ids.some((id) => /_AI\d+$/.test(id) || /_PWM\d+$/.test(id))) return 'A0602';
  return '';
}

function expansionSectionTitle(slot, tags) {
  const kind = expansionModuleKind(tags);
  return kind ? `Expansion ${slot} (${kind})` : `Expansion ${slot}`;
}

function isIoMapTag(tag) {
  if (!tag) return false;
  return tag.role === 'input' || tag.role === 'output';
}

function sortIoMapTags(a, b) {
  const ea = isExpansionIoTag(a) ? expansionSlotFromId(a.id) : 0;
  const eb = isExpansionIoTag(b) ? expansionSlotFromId(b.id) : 0;
  if (ea !== eb) {
    if (!ea) return -1;
    if (!eb) return 1;
    return ea - eb;
  }
  const roleOrder = { input: 0, output: 1 };
  const ra = roleOrder[a.role] ?? 9;
  const rb = roleOrder[b.role] ?? 9;
  if (ra !== rb) return ra - rb;
  const typeOrder = { BOOL: 0, INT: 1, REAL: 2 };
  const ta = typeOrder[a.type] ?? 9;
  const tb = typeOrder[b.type] ?? 9;
  if (ta !== tb) return ta - tb;
  return String(a.id).localeCompare(String(b.id));
}

function ioMapPointFromTag(tag) {
  return {
    id: tag.id,
    label: tag.label || '',
    type: tag.type,
    role: tag.role,
    value: tag.value,
    quality: tag.quality,
    driverId: tag.driverId || '',
    forceInput: !!tag.forceInput,
    forceOutput: !!tag.forceOutput,
    forceValue: tag.forceValue,
    logicValue: (tag.forceInput || tag.forceOutput) ? tag.logicValue : undefined,
    updatedAt: tag.updatedAt ?? null,
  };
}

function tagWireSummary(tag) {
  if (!tag) return null;
  const addr = tag.driverAddress && typeof tag.driverAddress === 'object' ? tag.driverAddress : null;
  return {
    id: tag.id,
    label: tag.label || '',
    type: tag.type,
    role: tag.role,
    driverId: tag.driverId || '',
    driverAddress: addr
      ? { deviceId: addr.deviceId || '', field: addr.field || '' }
      : null,
  };
}

/** MV-ST-OEM I/O map — hardware wiring only (no HMI bindings). */
function shouldPollFieldbusForIoMap(runtime) {
  return !(runtime?.running && !runtime?.paused);
}

async function pollFieldbusForIoMap(driverManager, tagStore) {
  if (!driverManager?.readFieldbus) return;
  await driverManager.readFieldbus();
  tagStore.applyForcesAfterRead?.();
}

function createIoMapRoutes(deps) {
  const { tagStore, scanEngine, driverManager } = deps;
  const router = require('express').Router();

  router.get('/io-map', async (req, res) => {
    const runtime = scanEngine.status();
    if (shouldPollFieldbusForIoMap(runtime)) {
      try {
        await pollFieldbusForIoMap(driverManager, tagStore);
      } catch (e) {
        console.warn('[io-map] fieldbus poll:', e.message || String(e));
      }
    }
    const tagList = tagStore.list();
    const points = tagList.filter(isIoMapTag).sort(sortIoMapTags).map(ioMapPointFromTag);
    const drivers = (driverManager?.list?.() || []).map((d) => ({
      id: d.id,
      type: d.type,
      enabled: d.enabled !== false,
    }));
    const wiredTags = tagList
      .filter((t) => t.driverId)
      .map(tagWireSummary)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    res.json({
      runtime: {
        running: !!runtime.running,
        paused: !!runtime.paused,
        scanMs: runtime.scanMs,
      },
      updatedAt: Date.now(),
      count: points.length,
      points,
      drivers,
      wiredTags,
    });
  });

  router.patch('/io-map/tags/:id', (req, res) => {
    const tagId = String(req.params.id || '').trim();
    if (!tagId) return res.status(400).json({ error: 'tag id required' });
    const tag = tagStore.get(tagId);
    if (!tag) return res.status(404).json({ error: `Tag not found: ${tagId}` });
    const body = req.body || {};
    const patch = {};
    if (Object.prototype.hasOwnProperty.call(body, 'driverId')) {
      patch.driverId = body.driverId ? String(body.driverId).trim() : undefined;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'driverAddress')) {
      patch.driverAddress = body.driverAddress && typeof body.driverAddress === 'object'
        ? {
          deviceId: body.driverAddress.deviceId ? String(body.driverAddress.deviceId).trim() : undefined,
          field: body.driverAddress.field ? String(body.driverAddress.field).trim() : undefined,
        }
        : undefined;
    }
    const mirrorFrom = String(body.mirrorFromTagId || '').trim();
    if (mirrorFrom) {
      const src = tagStore.get(mirrorFrom);
      if (!src?.driverId) {
        return res.status(400).json({ error: `Source tag "${mirrorFrom}" is not wired to a driver` });
      }
      patch.driverId = src.driverId;
      patch.driverAddress = src.driverAddress;
    }
    const updated = tagStore.upsert({ ...tag, ...patch });
    res.json({ ok: true, tag: tagWireSummary(updated) });
  });

  return router;
}

module.exports = {
  createIoMapRoutes,
  isIoMapTag,
  isExpansionIoTag,
  expansionSlotFromId,
  expansionModuleKind,
  expansionSectionTitle,
  sortIoMapTags,
  ioMapPointFromTag,
};
