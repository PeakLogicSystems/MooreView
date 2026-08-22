'use strict';

const express = require('express');
const { tenantStore } = require('../../tenants/tenantStore');
const { siteStore } = require('../../cloud/siteStore');
const { isAgentOnline } = require('../../cloud/agentHub');
const {
  requireAuth,
  requireTenantAccess,
  activeTenantId,
} = require('../../tenants/authMiddleware');
const { isCloudDeployment } = require('../../cloud/agentProtocol');

function createTenantFleetRoutes() {
  const router = express.Router();

  // Skip this entire router on appliance — do NOT 404 here or every /api/* dies.
  router.use((req, res, next) => {
    if (!isCloudDeployment()) return next('router');
    next();
  });

  router.get('/sites/devices', requireAuth, requireTenantAccess, (req, res) => {
    const tid = activeTenantId(req);
    const manual = tenantStore.listDevices(tid);
    const cameras = siteStore.listCameras().filter((c) => {
      const site = siteStore.getSite(c.siteId);
      return site && site.tenantId === tid;
    }).map((c) => ({
      deviceId: `cam:${c.cameraId}`,
      tenantId: tid,
      siteId: c.siteId,
      name: c.name || c.cameraId,
      kind: 'camera',
      serial: c.model || '',
      sim: '',
      online: isAgentOnline(c.siteId),
      commissioning: c.probeStatus === 'ok' ? 'commissioned' : (c.probeStatus || 'unknown'),
      firmware: '',
      source: 'camera_catalog',
    }));
    const sites = siteStore.listSites().filter((s) => s.tenantId === tid).map((s) => ({
      deviceId: `site-agent:${s.siteId}`,
      tenantId: tid,
      siteId: s.siteId,
      name: `${s.name} agent`,
      kind: 'site_agent',
      serial: '',
      sim: '',
      online: !!(s.agentOnline || isAgentOnline(s.siteId)),
      commissioning: s.pairedAt ? 'commissioned' : 'pending',
      firmware: '',
      source: 'site_agent',
    }));
    const byId = new Map();
    for (const d of [...sites, ...cameras, ...manual]) byId.set(d.deviceId, d);
    res.json({ devices: [...byId.values()] });
  });

  router.post('/sites/devices', requireAuth, requireTenantAccess, (req, res) => {
    const tid = activeTenantId(req);
    const device = tenantStore.upsertDevice(tid, req.body || {});
    res.status(201).json({ device });
  });

  router.get('/fleet', requireAuth, requireTenantAccess, (req, res) => {
    const tid = activeTenantId(req);
    const assets = tenantStore.listAssets(tid);
    res.json({ assets });
  });

  router.post('/fleet', requireAuth, requireTenantAccess, (req, res) => {
    const tid = activeTenantId(req);
    const asset = tenantStore.upsertAsset(tid, req.body || {});
    res.status(201).json({ asset });
  });

  router.delete('/fleet/:assetId', requireAuth, requireTenantAccess, (req, res) => {
    const tid = activeTenantId(req);
    const ok = tenantStore.deleteAsset(tid, req.params.assetId);
    if (!ok) return res.status(404).json({ error: 'Asset not found' });
    res.json({ ok: true });
  });

  router.get('/tenant/cmms', requireAuth, requireTenantAccess, (req, res) => {
    const tid = activeTenantId(req);
    const tenant = tenantStore.publicTenant(tenantStore.getTenant(tid));
    const enabled = !!(tenant && tenant.cmmsEnabled);
    res.json({
      cmmsEnabled: enabled,
      integrated: enabled,
      externalUrl: tenant?.cmmsExternalUrl || '',
      message: enabled
        ? 'Integrated CMMS enabled for this organization'
        : 'CMMS not enabled — ask a platform admin (PATCH /api/admin/tenants/:id/cmms)',
    });
  });

  return router;
}

module.exports = { createTenantFleetRoutes };
