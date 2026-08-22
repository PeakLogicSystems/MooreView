'use strict';

function createPageRoutes({ appVersion, product }) {
  const router = require('express').Router();
  router.get('/', (req, res) => {
    res.render('st-oem', {
      title: 'MV-ST-OEM',
      assetV: appVersion,
      product: product || 'st-oem',
    });
  });
  return router;
}

module.exports = { createPageRoutes };
