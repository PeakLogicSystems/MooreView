'use strict';

const { version: APP_VERSION } = require('../../package.json');

/** Must match MV_PROTOCOL_VERSION in firmware/.../mv_version.h */
const OPTA_PROTOCOL_VERSION = 2;

/** Max bytecode deploy payload (wire JSON); firmware MV_BC_MAX */
const OPTA_PROGRAM_MAX_BYTES = 32768;

function parseSemver(v) {
  const m = String(v || '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function semverCompare(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

function clientHeaders() {
  return {
    'X-MV-Client-Version': APP_VERSION,
    'X-MV-Protocol-Version': String(OPTA_PROTOCOL_VERSION),
    'X-MV-Client-Time': String(Math.floor(Date.now() / 1000)),
  };
}

function clientDeployMeta(opts = {}) {
  const meta = {
    clientVersion: APP_VERSION,
    protocolVersion: OPTA_PROTOCOL_VERSION,
    clientTimeUnix: Math.floor(Date.now() / 1000),
  };
  if (opts.programName) meta.programName = String(opts.programName);
  return meta;
}

function checkOptaDeviceStatus(status) {
  const warnings = [];
  const errors = [];
  if (!status || typeof status !== 'object') {
    errors.push('Opta did not return status JSON');
    return { ok: false, warnings, errors, device: status || null };
  }
  if (status.protocolVersion == null) {
    warnings.push(
      'Opta firmware has no protocolVersion — re-flash from est-pc/firmware/arduino-opta-st',
    );
  } else if (Number(status.protocolVersion) !== OPTA_PROTOCOL_VERSION) {
    errors.push(
      `Protocol mismatch: Opta=${status.protocolVersion} MooreVIEW=${OPTA_PROTOCOL_VERSION} — re-flash Opta ST firmware`,
    );
  }
  if (!status.firmwareVersion) {
    warnings.push('Opta firmwareVersion missing — re-flash MooreVIEW Opta ST firmware');
  } else if (semverCompare(status.firmwareVersion, APP_VERSION) < 0) {
    warnings.push(
      `Opta firmware ${status.firmwareVersion} is older than MooreVIEW ${APP_VERSION}`,
    );
  }
  return {
    ok: errors.length === 0,
    warnings,
    errors,
    device: status,
  };
}

/** Must match MV_FIRMWARE_VERSION in firmware/arduino-opta-mqtt-st/.../mv_version.h */
const OPTA_RECOMMENDED_FIRMWARE = '2.3.7';

function firmwareStatus(reportedVersion) {
  const v = String(reportedVersion || '').trim();
  if (!v) return 'unknown';
  return semverCompare(v, OPTA_RECOMMENDED_FIRMWARE) < 0 ? 'outdated' : 'current';
}

module.exports = {
  APP_VERSION,
  OPTA_PROTOCOL_VERSION,
  OPTA_PROGRAM_MAX_BYTES,
  OPTA_RECOMMENDED_FIRMWARE,
  parseSemver,
  semverCompare,
  clientHeaders,
  clientDeployMeta,
  checkOptaDeviceStatus,
  firmwareStatus,
};
