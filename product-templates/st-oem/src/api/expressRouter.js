'use strict';

const express = require('express');
const { createDashboardRoutes } = require('./routes/dashboard');
const { createProgramRoutes } = require('./routes/programs');
const { createRuntimeRoutes } = require('./routes/runtime');
const { createTagRoutes } = require('./routes/tags');
const { createDriverRoutes } = require('./routes/drivers');
const { createSettingsRoutes } = require('./routes/settings');
const { createMiscRoutes } = require('./routes/misc');
const { createIoMapRoutes } = require('./routes/ioMap');

/** MV-ST-OEM — program, tags, drivers, I/O map (no HMI / project / Parc). */
function createExpressApi(deps) {
  const router = express.Router();
  router.use(createDashboardRoutes(deps));
  router.use(createProgramRoutes(deps));
  router.use(createRuntimeRoutes(deps));
  router.use(createTagRoutes(deps));
  router.use(createDriverRoutes(deps));
  router.use(createSettingsRoutes(deps));
  router.use(createMiscRoutes(deps));
  router.use(createIoMapRoutes(deps));
  return router;
}

module.exports = { createExpressApi };
