'use strict';

const { EZMETER_DRIVER_ID, defaultEzMeterSemanticMap } = require('../../src/facilities/ezmeterPq');

/**
 * EZ Meter Modbus → assisted-living / facility semantic tags.
 * Apply ezmeter_dds_rgb_2025 template first, then wire via settings sync or project import.
 */
const SITE_SEMANTIC_MAP = defaultEzMeterSemanticMap();

function buildSemanticMap() {
  return [...SITE_SEMANTIC_MAP];
}

/** Copy driverAddress from source DDS_* tags onto facility summary tags. */
function applySemanticMap(tags, driverId = EZMETER_DRIVER_ID) {
  const byId = new Map(tags.map((t) => [t.id, t]));
  const map = buildSemanticMap();
  return tags.map((t) => {
    const m = map.find((row) => row.tagId === t.id);
    if (!m?.sourceTagId) return t;
    const src = byId.get(m.sourceTagId);
    if (!src?.driverAddress) return t;
    const out = {
      ...t,
      driverId,
      driverAddress: { ...src.driverAddress },
    };
    if (m.scale != null) out.scale = m.scale;
    if (m.offset != null) out.offset = m.offset;
    return out;
  });
}

module.exports = {
  EZMETER_DRIVER_ID,
  SITE_SEMANTIC_MAP,
  buildSemanticMap,
  applySemanticMap,
};
