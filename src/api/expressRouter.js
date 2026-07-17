'use strict';

const express = require('express');
const { createDashboardRoutes } = require('./routes/dashboard');
const { createProgramRoutes } = require('./routes/programs');
const { createRuntimeRoutes } = require('./routes/runtime');
const { createProjectRoutes } = require('./routes/project');
const { createTagRoutes } = require('./routes/tags');
const { createDriverRoutes } = require('./routes/drivers');
const { createSettingsRoutes } = require('./routes/settings');
const { createHmiRoutes } = require('./routes/hmi');
const { createMiscRoutes } = require('./routes/misc');
const { createParcRoutes } = require('./routes/parc');
const { createAlarmRoutes } = require('./routes/alarms');
const { createReportRoutes } = require('./routes/reports');
const { createPdmRoutes } = require('./routes/pdm');
const { createCameraRoutes } = require('./routes/cameras');
const { createStorageRoutes } = require('./routes/storage');
const { createCloudSiteRoutes } = require('./routes/cloudSites');
const { createTenantAuthRoutes } = require('./routes/tenantAuth');
const { createTenantFleetRoutes } = require('./routes/tenantFleet');
const { createIoMapRoutes } = require('./routes/ioMap');

let createMvDrawRoutes = null;
try {
  createMvDrawRoutes = require('../../mv-draw/src/api/mvDrawRoutes').createMvDrawRoutes;
} catch {
  // SaaS / headless forks omit mv-draw
}

function createExpressApi(deps) {
  const router = express.Router();
  router.use(createTenantAuthRoutes());
  router.use(createTenantFleetRoutes()); // /sites/devices + /fleet before /sites/:siteId
  router.use(createDashboardRoutes(deps));
  router.use(createProgramRoutes(deps));
  router.use(createRuntimeRoutes(deps));
  router.use(createProjectRoutes(deps));
  router.use(createTagRoutes(deps));
  router.use(createDriverRoutes(deps));
  router.use(createSettingsRoutes(deps));
  router.use(createHmiRoutes(deps));
  router.use(createIoMapRoutes(deps));
  router.use(createMiscRoutes(deps));
  router.use(createParcRoutes(deps));
  router.use(createAlarmRoutes(deps));
  router.use(createReportRoutes());
  router.use(createPdmRoutes());
  router.use(createCameraRoutes());
  router.use(createCloudSiteRoutes());
  router.use(createStorageRoutes());
  if (typeof createMvDrawRoutes === 'function') {
    router.use(createMvDrawRoutes());
  }
  return router;
}

module.exports = { createExpressApi };
