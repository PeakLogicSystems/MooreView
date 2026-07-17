'use strict';

const { parseProgram, validateProgram, collectProgramTagRefs } = require('../engine/parser');
const { compileProgramBytecode, bytecodeToBase64, estimateBytecodeBytes } = require('../engine/stBytecode');
const {
  tagMetaForDevice,
  slimTagMetaForDeploy,
  inferTagType,
  defaultMetaForId,
} = require('./optaTagMeta');

/** Build put_program body for Opta ST firmware (HTTP or MQTT Parc cmd). */
function buildOptaProgramBody(source, tagStore, driverId, opts = {}) {
  const storeTags = tagStore.list();
  const storeById = new Map(storeTags.map((t) => [t.id, t]));
  const { ast, errors: parseErrs } = parseProgram(source);
  if (parseErrs.length) return { ok: false, errors: parseErrs };

  const programRefs = ast ? collectProgramTagRefs(ast) : [];
  // Opta firmware bootstraps on-board I/O and expansion tags — deploy only program refs.
  const tagIds = [...new Set(programRefs)].sort();

  const valErrs = validateProgram(ast, [...new Set([...storeTags.map((t) => t.id), ...programRefs])]);
  if (valErrs.length) return { ok: false, errors: valErrs };

  const tags = tagIds.map((id) => {
    const existing = storeById.get(id);
    if (opts.fullTagMeta && existing) return tagMetaForDevice(existing);
    return slimTagMetaForDeploy(existing, id, driverId);
  });

  let bc;
  try {
    bc = bytecodeToBase64(compileProgramBytecode(ast, tagIds, tags));
  } catch (e) {
    return { ok: false, errors: [e.message || String(e)] };
  }

  const body = { bc, tagCount: tagIds.length };
  if (opts.includeSource) body.source = source;

  return { ok: true, body, tagIds, tags };
}

/** Estimate HTTP/MQTT deploy payload size for Opta remote ST. */
function estimateOptaDeploy(source, tagStore, driverId, opts = {}) {
  const built = buildOptaProgramBody(source, tagStore, driverId, opts);
  if (!built.ok) {
    return { ok: false, errors: built.errors || ['Program invalid'] };
  }
  const { clientDeployMeta, OPTA_PROGRAM_MAX_BYTES } = require('../drivers/optaProtocol');
  const body = {
    ...built.body,
    ...clientDeployMeta(opts.programName ? { programName: opts.programName } : {}),
  };
  const bytes = Buffer.byteLength(JSON.stringify(body));
  const bcBuf = Buffer.from(built.body.bc, 'base64');
  const bcBytes = bcBuf.length;
  const { parseBytecodeStats } = require('../engine/stBytecode');
  const bcStats = parseBytecodeStats(bcBuf) || {
    tagCount: built.tagIds.length,
    codeBytes: 0,
    dataBytes: bcBytes,
    totalBytes: bcBytes,
  };
  const limit = Number(opts.limitBytes) > 0 ? Number(opts.limitBytes) : OPTA_PROGRAM_MAX_BYTES;
  return {
    ok: true,
    bytes,
    bcBytes,
    astBytes: bcBytes,
    codeBytes: bcStats.codeBytes,
    dataBytes: bcStats.dataBytes,
    bcTotalBytes: bcStats.totalBytes,
    tagCount: built.tagIds.length,
    limit,
    overLimit: bytes >= limit,
    headroom: limit - bytes,
    pct: Math.min(100, Math.round((bytes / limit) * 100)),
  };
}

module.exports = {
  buildOptaProgramBody,
  estimateOptaDeploy,
  tagMetaForDevice,
  slimTagMetaForDeploy,
  inferTagType,
  defaultMetaForId,
};
