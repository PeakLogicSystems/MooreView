'use strict';

const express = require('express');
const { tenantStore } = require('../../tenants/tenantStore');
const {
  requireAuth,
  requirePlatformAdmin,
  requireTenantAccess,
  activeTenantId,
  setSessionCookie,
  clearSessionCookie,
} = require('../../tenants/authMiddleware');
const { isCloudDeployment } = require('../../cloud/agentProtocol');

function createTenantAuthRoutes() {
  const router = express.Router();

  router.post('/auth/login', (req, res) => {
    if (!isCloudDeployment()) {
      return res.status(404).json({ error: 'Auth only on cloud deployment' });
    }
    try {
      const result = tenantStore.login(req.body || {});
      setSessionCookie(res, result.token, result.expiresAt);
      res.json({
        user: result.user,
        tenant: result.tenant,
        expiresAt: result.expiresAt,
      });
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  router.post('/auth/logout', (req, res) => {
    if (req.mvToken) tenantStore.logout(req.mvToken);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  router.get('/auth/me', requireAuth, (req, res) => {
    res.json({
      user: req.mvAuth.user,
      tenant: req.mvAuth.tenant,
      cmmsEnabled: !!req.mvAuth.user.cmmsEnabled,
    });
  });

  router.get('/tenant', requireAuth, requireTenantAccess, (req, res) => {
    const tid = activeTenantId(req);
    const tenant = tid ? tenantStore.publicTenant(tenantStore.getTenant(tid)) : req.mvAuth.tenant;
    if (!tenant && req.mvAuth.user.role !== 'platform_admin') {
      return res.status(404).json({ error: 'No tenant' });
    }
    res.json({
      tenant: tenant || null,
      cmmsEnabled: !!(tenant && tenant.cmmsEnabled),
      user: req.mvAuth.user,
    });
  });

  router.get('/admin/tenants', requireAuth, requirePlatformAdmin, (req, res) => {
    res.json({ tenants: tenantStore.listTenants() });
  });

  router.post('/admin/tenants', requireAuth, requirePlatformAdmin, (req, res) => {
    try {
      const tenant = tenantStore.createTenant(req.body || {});
      res.status(201).json({ tenant });
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  router.patch('/admin/tenants/:id/cmms', requireAuth, requirePlatformAdmin, (req, res) => {
    try {
      const tenant = tenantStore.patchTenantCmms(req.params.id, req.body || {});
      res.json({ tenant, cmmsEnabled: tenant.cmmsEnabled });
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  router.get('/admin/users', requireAuth, requirePlatformAdmin, (req, res) => {
    res.json({ users: tenantStore.listUsers(req.query.tenantId || null) });
  });

  router.post('/admin/users', requireAuth, requirePlatformAdmin, (req, res) => {
    try {
      const user = tenantStore.createUser(req.body || {});
      res.status(201).json({ user });
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  // Tenant-scoped user list (tenant admins)
  router.get('/tenant/users', requireAuth, requireTenantAccess, (req, res) => {
    const tid = activeTenantId(req);
    const role = req.mvAuth.user.role;
    if (role !== 'platform_admin' && role !== 'tenant_admin') {
      return res.status(403).json({ error: 'Admin required' });
    }
    res.json({ users: tenantStore.listUsers(tid) });
  });

  router.post('/tenant/users', requireAuth, requireTenantAccess, (req, res) => {
    const role = req.mvAuth.user.role;
    if (role !== 'platform_admin' && role !== 'tenant_admin') {
      return res.status(403).json({ error: 'Admin required' });
    }
    try {
      const tid = activeTenantId(req);
      const body = { ...(req.body || {}), tenantId: tid, role: req.body?.role || 'operator' };
      if (body.role === 'platform_admin') {
        return res.status(403).json({ error: 'Cannot create platform admin here' });
      }
      const user = tenantStore.createUser(body);
      res.status(201).json({ user });
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  return router;
}

module.exports = { createTenantAuthRoutes };
