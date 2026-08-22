'use strict';

const express = require('express');
const { tenantStore } = require('../../tenants/tenantStore');
const { applianceAuthStore } = require('../../auth/applianceAuthStore');
const { FEATURE_CATALOG, ROLE_FEATURE_DEFAULTS } = require('../../auth/featureCatalog');
const mongoSysLog = require('../../logger/mongoSysLog');
const {
  requireAuth,
  requirePlatformAdmin,
  requireTenantAccess,
  requireApplianceAdmin,
  activeTenantId,
  setSessionCookie,
  clearSessionCookie,
  logoutToken,
} = require('../../tenants/authMiddleware');
const { isCloudDeployment } = require('../../cloud/agentProtocol');
const { requireFeature } = require('../../auth/featureGate');

function authUserForLog(user) {
  if (!user) return null;
  return {
    id: user.userId || user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

function createTenantAuthRoutes() {
  const router = express.Router();

  router.post('/auth/login', (req, res) => {
    try {
      const body = req.body || {};
      let result;
      if (isCloudDeployment()) {
        result = tenantStore.login(body);
      } else {
        result = applianceAuthStore.login({
          email: body.email,
          password: body.password,
        });
      }
      setSessionCookie(res, result.token, result.expiresAt);
      mongoSysLog.info('auth', 'User signed in', {
        email: result.user.email,
        role: result.user.role,
      }, { user: authUserForLog(result.user) });
      res.json({
        user: result.user,
        tenant: result.tenant,
        expiresAt: result.expiresAt,
        features: result.user.features || null,
        featureCatalog: FEATURE_CATALOG,
      });
    } catch (e) {
      mongoSysLog.warn('auth', 'Sign-in failed', {
        email: String(req.body?.email || '').trim() || null,
        reason: e.message || String(e),
      });
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  router.post('/auth/logout', (req, res) => {
    const user = req.mvAuth?.user;
    if (req.mvToken) logoutToken(req.mvToken);
    clearSessionCookie(res);
    if (user) {
      mongoSysLog.info('auth', 'User signed out', {
        email: user.email,
      }, { user: authUserForLog(user) });
    }
    res.json({ ok: true });
  });

  router.get('/auth/me', requireAuth, (req, res) => {
    res.json({
      user: req.mvAuth.user,
      tenant: req.mvAuth.tenant,
      cmmsEnabled: !!req.mvAuth.user.cmmsEnabled,
      features: req.mvAuth.user.features || null,
      featureCatalog: FEATURE_CATALOG,
    });
  });

  router.get('/auth/features', (req, res) => {
    if (isCloudDeployment()) {
      return res.status(404).json({ error: 'Not available on cloud deployment' });
    }
    res.json({ features: FEATURE_CATALOG });
  });

  router.get('/auth/users', requireAuth, requireApplianceAdmin, (req, res) => {
    if (isCloudDeployment()) {
      return res.status(404).json({ error: 'Use /tenant/users on cloud deployment' });
    }
    res.json({ users: applianceAuthStore.listUsers(), features: FEATURE_CATALOG, roleDefaults: ROLE_FEATURE_DEFAULTS });
  });

  router.post('/auth/users', requireAuth, requireApplianceAdmin, (req, res) => {
    if (isCloudDeployment()) {
      return res.status(404).json({ error: 'Use /tenant/users on cloud deployment' });
    }
    try {
      const user = applianceAuthStore.createUser(req.body || {});
      mongoSysLog.maintenance('users', 'Created user account', {
        email: user.email,
        role: user.role,
      }, { user: authUserForLog(req.mvAuth.user) });
      res.status(201).json({ user });
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  router.put('/auth/users/:id', requireAuth, requireApplianceAdmin, (req, res) => {
    if (isCloudDeployment()) {
      return res.status(404).json({ error: 'Use /tenant/users on cloud deployment' });
    }
    try {
      const user = applianceAuthStore.updateUser(req.params.id, req.body || {});
      mongoSysLog.maintenance('users', 'Updated user account', {
        email: user.email,
        role: user.role,
      }, { user: authUserForLog(req.mvAuth.user) });
      res.json({ user });
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  router.put('/auth/users/features-matrix', requireAuth, requireFeature('users'), (req, res) => {
    if (isCloudDeployment()) {
      return res.status(404).json({ error: 'Not available on cloud deployment' });
    }
    try {
      const users = applianceAuthStore.updateFeaturesMatrix(req.body?.matrix || req.body || {});
      mongoSysLog.maintenance('users', 'Updated user feature access matrix', {
        userCount: users.length,
      }, { user: authUserForLog(req.mvAuth.user) });
      res.json({ users, features: FEATURE_CATALOG, roleDefaults: ROLE_FEATURE_DEFAULTS });
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  router.delete('/auth/users/:id', requireAuth, requireApplianceAdmin, (req, res) => {
    if (isCloudDeployment()) {
      return res.status(404).json({ error: 'Use cloud admin routes' });
    }
    try {
      const victim = applianceAuthStore.getUser(req.params.id);
      applianceAuthStore.deleteUser(req.params.id);
      mongoSysLog.maintenance('users', 'Deleted user account', {
        email: victim?.email || req.params.id,
      }, { user: authUserForLog(req.mvAuth.user) });
      res.status(204).end();
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
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

  router.get('/tenant/users', requireAuth, requireTenantAccess, (req, res) => {
    const tid = activeTenantId(req);
    const authRole = req.mvAuth.user.role;
    const isAdmin = authRole === 'platform_admin' || authRole === 'tenant_admin';
    const payload = {
      features: FEATURE_CATALOG,
      roleDefaults: ROLE_FEATURE_DEFAULTS,
      readOnly: !isAdmin,
    };
    if (isAdmin) {
      payload.users = tenantStore.listUsers(tid);
    } else {
      const uid = req.mvAuth.user.userId;
      payload.users = tenantStore.listUsers(tid).filter((u) => u.userId === uid);
    }
    res.json(payload);
  });

  router.put('/tenant/users/features-matrix', requireAuth, requireTenantAccess, (req, res) => {
    const role = req.mvAuth.user.role;
    if (role !== 'platform_admin' && role !== 'tenant_admin') {
      return res.status(403).json({ error: 'Admin required' });
    }
    try {
      const tid = activeTenantId(req);
      if (!tid) return res.status(400).json({ error: 'No tenant context — sign in with the target Organization ID' });
      const users = tenantStore.updateFeaturesMatrix(tid, req.body?.matrix || req.body || {});
      mongoSysLog.maintenance('users', 'Updated tenant user feature access matrix', {
        tenantId: tid,
        userCount: users.length,
      }, { user: authUserForLog(req.mvAuth.user) });
      res.json({ users: tenantStore.listUsers(tid), features: FEATURE_CATALOG, roleDefaults: ROLE_FEATURE_DEFAULTS, updated: users.length });
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
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
