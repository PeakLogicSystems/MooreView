'use strict';

function createPageRoutes({ appVersion, product, mooreviewApiBase }) {
  const router = require('express').Router();
  router.get('/', (req, res) => {
    res.render('dashboard', {
      title: 'MooreVIEW Opta Parc',
      assetV: appVersion,
      product: product || 'opta-parc',
      mooreviewApiBase: mooreviewApiBase || res.app?.locals?.mooreviewApiBase || 'https://mooreview.io/api',
    });
  });
  return router;
}

module.exports = { createPageRoutes };
