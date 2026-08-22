'use strict';

const express = require('express');
const { createDashboardRoutes } = require('./routes/dashboard');
const { createProgramRoutes } = require('./routes/programs');
const { createRuntimeRoutes } = require('./routes/runtime');
const { createTagRoutes } = require('./routes/tags');
const { createDriverRoutes } = require('./routes/drivers');
const { createSettingsRoutes } = require('./routes/settings');
const { createProjectRoutes } = require('./routes/project');
const { createMiscRoutes } = require('./routes/misc');
const { createAlarmRoutes } = require('./routes/alarms');

/** ST MVP — project, program, tags, drivers, runtime (no HMI / Mongo / Parc hub). */
function createExpressApi(deps) {
  const router = express.Router();
  router.use(createDashboardRoutes(deps));
  router.use(createProgramRoutes(deps));
  router.use(createRuntimeRoutes(deps));
  router.use(createProjectRoutes(deps));
  router.use(createTagRoutes(deps));
  router.use(createDriverRoutes(deps));
  router.use(createSettingsRoutes(deps));
  router.use(createMiscRoutes(deps));
  router.use(createAlarmRoutes(deps));
  return router;
}

module.exports = { createExpressApi };
