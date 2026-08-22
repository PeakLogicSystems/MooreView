'use strict';

/** SaaS detect_target entry — full Cloud Studio (same process as root server.js). */
process.env.MOOREVIEW_DEPLOYMENT = process.env.MOOREVIEW_DEPLOYMENT || 'cloud';
process.env.MOOREVIEW_PRODUCT = process.env.MOOREVIEW_PRODUCT || 'mvp-suite';
if (!process.env.PORT && !process.env.MOOREVIEW_PORT) {
  process.env.PORT = '3100';
}
require('../server.js');
