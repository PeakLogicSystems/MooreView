'use strict';

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { version: APP_VERSION } = require('../../package.json');
const authRoutes = require('../routes/auth');
const ingestRoutes = require('../routes/ingest');
const webRoutes = require('../routes/web');
const locationRoutes = require('../routes/locations');
const locationSystemsRoutes = require('../routes/locationSystems');
const systemRoutes = require('../routes/systems');
const deviceRoutes = require('../routes/devices');
const userRoutes = require('../routes/users');
const adminRoutes = require('../routes/admin');
const adminWebRoutes = require('../routes/adminWeb');
const cmmsRoutes = require('../routes/cmms');
const cmmsWebRoutes = require('../routes/cmmsWeb');
const teamWebRoutes = require('../routes/teamWeb');
const sitesWebRoutes = require('../routes/sitesWeb');
const fleetWebRoutes = require('../routes/fleetWeb');
const fleetRoutes = require('../routes/fleet');
const { createConnectivityBillingRoutes } = require('../routes/connectivityBilling');
const { createInstallManifestRoutes } = require('../routes/installManifest');
const installWebRoutes = require('../routes/installWeb');
const applianceRoutes = require('../routes/appliance');
const { createStudioRoutes } = require('../routes/studio');
const { createHmiAssetRedirect } = require('../routes/staticAssets');
const { authenticate } = require('../auth/middleware');
const authService = require('../services/authService');
const { asyncHandler } = require('../util/http');
const { CORS_ORIGINS, EDITION, MOOREVIEW_PLATFORM, DOCUMENTDB_ENABLED } = require('../config');
const { isServiceBusConfigured } = require('../messaging/serviceBus');
const { isEventHubConfigured } = require('../messaging/eventHub');
const { isMailConfigured } = require('../mail/mailConfig');
const { isSmsConfigured } = require('../sms/smsConfig');
const { TELEMETRY_INGEST_MODE, TELEMETRY_TTL_DAYS } = require('../config');

function createCloudApp() {
  const app = express();
  const rootDir = path.join(__dirname, '..', '..');

  app.set('trust proxy', 1);

  app.set('view engine', 'ejs');
  app.set('views', path.join(rootDir, 'views'));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    res.locals.edition = EDITION;
    res.locals.product = EDITION.product;
    res.locals.productLabel = EDITION.label;
    next();
  });
  app.use(createHmiAssetRedirect(path.join(rootDir, 'public')));
  app.use(express.static(path.join(rootDir, 'public')));

  if (CORS_ORIGINS.length) {
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (origin && CORS_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      }
      if (req.method === 'OPTIONS') return res.status(204).end();
      return next();
    });
  }

  app.get('/health', (req, res) => {
    res.json({
      ok: true,
      service: EDITION.product,
      edition: EDITION.label,
      platform: MOOREVIEW_PLATFORM,
      version: APP_VERSION,
      documentDb: DOCUMENTDB_ENABLED,
      serviceBus: isServiceBusConfigured(),
      mail: isMailConfigured(),
      sms: isSmsConfigured(),
      platformAdmin: require('../config').isPlatformAdminConfigured(),
      telemetryIngest: {
        mode: TELEMETRY_INGEST_MODE,
        eventHub: isEventHubConfigured(),
        ttlDays: TELEMETRY_TTL_DAYS,
      },
    });
  });

  app.use('/api/ingest', ingestRoutes);

  app.use(webRoutes);
  app.use(installWebRoutes);
  app.use(createStudioRoutes());
  app.use('/admin', adminWebRoutes);
  app.use('/cmms', cmmsWebRoutes);
  app.use('/team', teamWebRoutes);
  app.use('/sites', sitesWebRoutes);
  app.use('/fleet', fleetWebRoutes);

  app.use('/api/auth', authRoutes);
  app.use('/api/appliance', applianceRoutes);
  app.use('/api/project-hub', require('../routes/projectHub'));

  app.get('/api/tenant', authenticate, asyncHandler(async (req, res) => {
    const tenant = await authService.getTenantById(req.auth.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json({ tenant });
  }));

  app.use('/api/locations', locationRoutes);
  app.use('/api/locations/:locationId/systems', locationSystemsRoutes);
  app.use('/api/systems', systemRoutes);
  app.use('/api/devices', deviceRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/fleet', fleetRoutes);
  app.use('/api/cmms', cmmsRoutes);

  // Remote cameras / site agent hub — mount BEFORE routers that use router.use(authenticate)
  // on the bare /api prefix (billing/install), or public /api/cloud/* never runs.
  try {
    const { createCloudSiteRoutes } = require('./routes/cloudSites');
    app.use('/api', createCloudSiteRoutes());
  } catch (e) {
    console.warn('[cloud] cloud sites/cameras routes unavailable:', e.message || e);
  }

  app.use('/api', createConnectivityBillingRoutes());
  app.use('/api', createInstallManifestRoutes());

  app.use((err, req, res, next) => {
    console.error('[cloud]', err.stack || err.message || err);
    if (res.headersSent) return next(err);
    const status = err.status || err.statusCode || 500;
    const path = req.originalUrl || req.url || req.path || '';
    const isAdminWeb = /^\/(admin|cmms|team|sites|fleet)(\/|$)/.test(path.split('?')[0]);
    const wantsHtml = isAdminWeb || (req.accepts(['html', 'json']) === 'html');
    if (wantsHtml) {
      const message = status >= 500
        ? 'Something went wrong. Check server logs (journalctl -u mooreview-saas) and try again.'
        : (err.message || 'Request failed');
      return res.status(status).type('html').send(
        `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem">`
        + `<h1>Error</h1><p>${message.replace(/</g, '&lt;')}</p>`
        + `<p><a href="/sites">Back to sites</a></p></body></html>`,
      );
    }
    res.status(status).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

module.exports = { createCloudApp };
