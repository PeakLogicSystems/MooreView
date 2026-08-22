'use strict';

/** Production multi-tenant SaaS entry (DigitalOcean droplet port 3100). */
process.env.MOOREVIEW_DEPLOYMENT = process.env.MOOREVIEW_DEPLOYMENT || 'cloud';
process.env.MOOREVIEW_PRODUCT = process.env.MOOREVIEW_PRODUCT || 'cloud';
if (!process.env.PORT && !process.env.MOOREVIEW_PORT) {
  process.env.PORT = '3100';
}
require('../server.js');
