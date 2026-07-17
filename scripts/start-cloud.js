'use strict';

/** Local cloud-mode dev: MOOREVIEW_DEPLOYMENT=cloud + cloud sim APIs. */
process.env.MOOREVIEW_DEPLOYMENT = 'cloud';
process.env.MOOREVIEW_CLOUD_SIMS = '1';
require('../server.js');
