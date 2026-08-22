'use strict';

function createPageRoutes({ appVersion, product, mooreviewApiBase }) {
  const router = require('express').Router();
  router.get('/', (req, res) => {
    res.render('dashboard', {
      title: 'MooreVIEW Client',
      assetV: appVersion,
      product: product || 'client',
      mooreviewApiBase: mooreviewApiBase || res.app?.locals?.mooreviewApiBase || '',
    });
  });
  return router;
}

module.exports = { createPageRoutes };
