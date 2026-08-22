'use strict';

const express = require('express');
const { createDashboardRoutes } = require('./routes/dashboard');
const { createProgramRoutes } = require('./routes/programs');
const { createRuntimeRoutes } = require('./routes/runtime');
const { createProjectRoutes } = require('./routes/project');
const { createProjectHubRoutes } = require('./routes/projectHub');
const { createTagRoutes } = require('./routes/tags');
const { createDriverRoutes } = require('./routes/drivers');
const { createSettingsRoutes } = require('./routes/settings');
const { createHmiRoutes } = require('./routes/hmi');
const { createMiscRoutes } = require('./routes/misc');
const { createParcRoutes } = require('./routes/parc');
const { createAlarmRoutes } = require('./routes/alarms');
const { createReportRoutes } = require('./routes/reports');
const { createPdmRoutes } = require('./routes/pdm');
const { createInferenceRoutes } = require('./routes/inference');
const { createCmmsRoutes } = require('./routes/cmms');
const { createCameraRoutes } = require('./routes/cameras');
const { createStorageRoutes } = require('./routes/storage');
const { createCloudSiteRoutes } = require('./routes/cloudSites');
const { createTenantAuthRoutes } = require('./routes/tenantAuth');
const { createTenantFleetRoutes } = require('./routes/tenantFleet');
const { createIoMapRoutes } = require('./routes/ioMap');
const { createSysLogRoutes } = require('./routes/sysLog');
const { createHardwareHistoryRoutes } = require('./routes/hardwareHistory');
const { createUserRoutes } = require('./routes/users');
const { requireAuth } = require('../tenants/authMiddleware');
const { isCloudDeployment } = require('../cloud/agentProtocol');

let createCellularSimRoutes = null;
let createCloudSimRoutes = null;
let createMessagingRoutes = null;
try {
  createCellularSimRoutes = require('./routes/cellularSims').createCellularSimRoutes;
} catch { /* optional fork */ }
try {
  createCloudSimRoutes = require('./routes/cloudSims').createCloudSimRoutes;
} catch { /* optional fork */ }
try {
  createMessagingRoutes = require('./routes/messaging').createMessagingRoutes;
} catch { /* optional fork */ }

let createMvDrawRoutes = null;
try {
  createMvDrawRoutes = require('../../mv-draw/src/api/mvDrawRoutes').createMvDrawRoutes;
} catch {
  // SaaS / headless forks omit mv-draw
}

function createExpressApi(deps) {
  const router = express.Router();
  router.use(createTenantAuthRoutes());

  if (!isCloudDeployment()) {
    router.use((req, res, next) => {
      if (req.path === '/auth/login') return next();
      return requireAuth(req, res, next);
    });
  }

  router.use(createTenantFleetRoutes()); // /sites/devices + /fleet before /sites/:siteId
  router.use(createDashboardRoutes(deps));
  router.use(createProgramRoutes(deps));
  router.use(createRuntimeRoutes(deps));
  router.use(createProjectRoutes(deps));
  router.use(createProjectHubRoutes(deps));
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
  router.use(createInferenceRoutes());
  router.use(createCmmsRoutes());
  router.use(createSysLogRoutes());
  router.use(createHardwareHistoryRoutes(deps));
  if (typeof createMvDrawRoutes === 'function') {
    router.use(createMvDrawRoutes());
  }
  router.use(createCameraRoutes());
  router.use(createCloudSiteRoutes());
  router.use(createStorageRoutes());
  if (typeof createCellularSimRoutes === 'function') {
    router.use(createCellularSimRoutes());
  }
  if (typeof createCloudSimRoutes === 'function') {
    router.use(createCloudSimRoutes());
  }
  if (typeof createMessagingRoutes === 'function') {
    router.use(createMessagingRoutes());
  }
  router.use(createUserRoutes());
  return router;
}

module.exports = { createExpressApi };
