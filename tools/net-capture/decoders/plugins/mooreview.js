'use strict';

/** Optional plugin: enrich HTTP/MQTT with MooreVIEW-specific field names. */

const OPTA_PATHS = ['/api/status', '/api/tags', '/api/program', '/api/io-map', '/setup'];

function enhance(payload, ctx) {
  const out = {};
  if (ctx.known?.protocol === 'http' && ctx.known.role === 'request') {
    const pathOnly = ctx.known.path?.split('?')[0] || '';
    if (OPTA_PATHS.some((p) => pathOnly === p || pathOnly.startsWith(`${p}/`))) {
      out.vendor = { family: 'mooreview-opta', path: pathOnly };
    }
    if (ctx.known.headers?.['x-mv-protocol-version']) {
      out.vendor = {
        family: 'mooreview',
        protocolVersion: ctx.known.headers['x-mv-protocol-version'],
      };
    }
  }
  if (ctx.known?.protocol === 'mqtt' && ctx.known.topic?.startsWith('mooreview/v1/')) {
    out.vendor = { family: 'mooreview-parc', topic: ctx.known.topic };
  }
  return Object.keys(out).length ? out : null;
}

module.exports = { enhance };
