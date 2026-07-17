'use strict';

const {
  diTags, doTags, holdingRegTags, inputRegTags, explicitModbusTags, explicitVgreenTags, scanConcubeParameterTags,
  optaExpansionTags, edgepointGatewayTags, edgepointEventsTopic,
} = require('./tagBuilders');

/** Shared RS-485 bus (multi-slave DI/Q) vs dedicated driver row (explicit register map). */
function inferSharedBus(tagsSpec, explicit) {
  if (explicit !== undefined) return explicit !== false;
  const hasChannel = (tagsSpec.discrete || []).length > 0
    || (tagsSpec.coil || []).length > 0
    || (tagsSpec.input || []).length > 0
    || (tagsSpec.holding || []).length > 0;
  if (((tagsSpec.explicit || []).length > 0 || (tagsSpec.vgreen || []).length > 0) && !hasChannel) return false;
  if (tagsSpec.concube && !hasChannel) return false;
  return true;
}

/**
 * Build a device preset from a JSON template (see templates/*.json).
 * @param {object} spec
 */
function buildPresetFromJson(spec) {
  if (!spec?.id || !spec.label || !spec.transport) {
    throw new Error('Device template JSON requires id, label, and transport');
  }

  const driverIdDefault = spec.driverId || spec.id;

  const sharedBus = inferSharedBus(spec.tags || {}, spec.sharedBus);

  const concube = spec.tags?.concube || null;

  return {
    id: spec.id,
    label: spec.label,
    vendor: spec.vendor || '',
    model: spec.model || '',
    transport: spec.transport,
    sharedBus,
    concube,
    diCount: spec.diCount,
    doCount: spec.doCount,
    aiCount: spec.aiCount,
    hrCount: spec.hrCount,
    tagsFromDevice: spec.tagsFromDevice === true,
    defaults: spec.defaults || {},
    driver: (opts) => {
      const id = opts.driverId || driverIdDefault;
      const d = spec.driver || {};
      if (spec.transport === 'modbus_tcp') {
        return {
          id,
          type: 'modbus_tcp',
          enabled: d.enabled !== false,
          host: opts.host || d.host || '127.0.0.1',
          port: opts.port ?? d.port ?? 502,
          slaveId: opts.slaveId ?? d.slaveId ?? 1,
          timeoutMs: d.timeoutMs ?? 1000,
        };
      }
      if (spec.transport === 'vgreen_epc') {
        return {
          id,
          type: 'vgreen_epc',
          enabled: d.enabled !== false,
          serialPort: opts.serialPort || d.serialPort || 'COM3',
          baud: opts.baud ?? d.baud ?? 19200,
          slaveId: opts.slaveId ?? d.slaveId ?? 21,
          parity: opts.parity || d.parity || 'none',
          stopBits: opts.stopBits ?? d.stopBits ?? 1,
          timeoutMs: d.timeoutMs ?? 2000,
        };
      }
      if (spec.transport === 'opta_remote' || spec.transport === 'mqtt_parc') {
        const defs = spec.defaults || {};
        return {
          id,
          type: 'mqtt_parc',
          enabled: d.enabled !== false,
          deviceId: opts.deviceId || d.deviceId || defs.deviceId || id,
          remoteExecution: opts.remoteExecution ?? d.remoteExecution ?? defs.remoteExecution !== false,
          scanMs: opts.scanMs ?? d.scanMs ?? defs.scanMs ?? 100,
          reportIntervalMs: opts.reportIntervalMs
            ?? d.reportIntervalMs
            ?? (defs.reportIntervalSec != null ? defs.reportIntervalSec * 1000 : defs.reportIntervalMs)
            ?? 200,
        };
      }
      if (spec.transport === 'nextcentury') {
        const defs = spec.defaults || {};
        return {
          id,
          type: 'nextcentury',
          enabled: d.enabled !== false,
          email: opts.email || d.email || '',
          password: opts.password || d.password || '',
          reportId: opts.reportId || d.reportId || defs.reportId || 'rt_4510',
          pollIntervalMs: opts.pollIntervalMs ?? d.pollIntervalMs ?? defs.pollIntervalMs ?? 900000,
          propertyIds: opts.propertyIds ?? d.propertyIds ?? defs.propertyIds,
          propertyDelayMs: opts.propertyDelayMs ?? d.propertyDelayMs ?? defs.propertyDelayMs ?? 600,
          autoSyncTags: opts.autoSyncTags ?? d.autoSyncTags ?? defs.autoSyncTags !== false,
          timeoutMs: d.timeoutMs ?? 20000,
        };
      }
      if (spec.transport === 'mqtt') {
        const defs = spec.defaults || {};
        const serialNum = opts.serialNum || d.serialNum || defs.serialNum || '';
        const eventsTopic = serialNum ? edgepointEventsTopic(serialNum) : null;
        const subscriptions = opts.subscriptions || d.subscriptions || defs.subscriptions;
        return {
          id,
          type: 'mqtt',
          enabled: d.enabled !== false,
          brokerUrl: opts.brokerUrl || opts.broker || d.brokerUrl || d.broker || defs.brokerUrl || 'mqtt://127.0.0.1:1883',
          clientId: opts.clientId || d.clientId || defs.clientId || 'mooreview',
          username: opts.username || d.username || defs.username,
          password: opts.password || d.password || defs.password,
          subscribeQos: opts.subscribeQos ?? d.subscribeQos ?? defs.subscribeQos ?? 0,
          publishQos: opts.publishQos ?? d.publishQos ?? defs.publishQos ?? 0,
          subscriptions: subscriptions || (eventsTopic ? [eventsTopic] : undefined),
          serialNum: serialNum || undefined,
          timeoutMs: d.timeoutMs ?? 10000,
        };
      }
      if (spec.transport === 'https') {
        return {
          id,
          type: 'https',
          enabled: d.enabled !== false,
          baseUrl: opts.baseUrl || opts.url || d.baseUrl || d.url || 'https://127.0.0.1',
          pollIntervalMs: opts.pollIntervalMs ?? d.pollIntervalMs ?? 0,
          bearerToken: opts.bearerToken || d.bearerToken || '',
          timeoutMs: d.timeoutMs ?? 10000,
        };
      }
      if (spec.transport === 'hal') {
        const defs = spec.defaults || {};
        return {
          id,
          type: 'hal',
          enabled: d.enabled !== false,
          backend: opts.backend || d.backend || defs.backend || 'sim',
          pluginPath: opts.pluginPath || d.pluginPath || defs.pluginPath || '',
          halConfig: opts.halConfig || d.halConfig || {
            stack: opts.stack ?? defs.stack ?? 0,
            i2cBus: opts.i2cBus ?? defs.i2cBus ?? 1,
          },
          timeoutMs: d.timeoutMs ?? 1000,
        };
      }
      return {
        id,
        type: 'modbus_rtu',
        enabled: d.enabled !== false,
        serialPort: opts.serialPort || d.serialPort || 'COM3',
        baud: opts.baud ?? d.baud ?? 9600,
        slaveId: opts.slaveId ?? d.slaveId ?? 1,
        parity: opts.parity || d.parity || 'none',
        stopBits: opts.stopBits ?? d.stopBits ?? 1,
        timeoutMs: d.timeoutMs ?? 1000,
      };
    },
    tags: (opts) => buildTagsFromSpec(opts.driverId || driverIdDefault, spec.tags || {}, opts),
  };
}

function buildTagsFromSpec(driverId, tagsSpec, applyOpts = {}) {
  const out = [];
  for (const block of tagsSpec.discrete || []) {
    out.push(...diTags(driverId, block.count ?? 8, block.prefix || 'DI', block.start ?? 0));
  }
  for (const block of tagsSpec.coil || []) {
    out.push(...doTags(driverId, block.count ?? 8, block.prefix || 'Q', block.start ?? 0));
  }
  for (const block of tagsSpec.input || []) {
    out.push(...inputRegTags(
      driverId,
      block.count ?? 8,
      block.start ?? 0,
      block.prefix || 'AI',
      block.suffix || ''
    ));
  }
  for (const block of tagsSpec.holding || []) {
    out.push(...holdingRegTags(driverId, block.count ?? 8, block.start ?? 0, block.prefix || 'H'));
  }
  out.push(...explicitModbusTags(driverId, tagsSpec.explicit));
  out.push(...explicitVgreenTags(driverId, tagsSpec.vgreen));
  if (tagsSpec.concube) {
    const perGroup = tagsSpec.concube.paramsPerGroup ?? 4;
    const groups = Math.max(1, Math.min(16, Number(applyOpts.paramGroups) || tagsSpec.concube.defaultGroups || 1));
    const paramCount = Number(applyOpts.paramCount) || (groups * perGroup);
    const paramStart = Math.max(1, Number(applyOpts.paramStart) || 1);
    const includeSystemTags = applyOpts.includeSystemTags === true;
    out.push(...scanConcubeParameterTags(driverId, {
      paramStart,
      paramCount,
      includeSystemTags,
    }));
  }
  if (Array.isArray(tagsSpec.expansions) && tagsSpec.expansions.length) {
    out.push(...optaExpansionTags(driverId, tagsSpec.expansions));
  }
  if (tagsSpec.edgepoint) {
    const serialNum = applyOpts.serialNum || tagsSpec.edgepoint.serialNum;
    out.push(...edgepointGatewayTags(driverId, serialNum, tagsSpec.edgepoint));
  }
  return out;
}

module.exports = { buildPresetFromJson, buildTagsFromSpec };
