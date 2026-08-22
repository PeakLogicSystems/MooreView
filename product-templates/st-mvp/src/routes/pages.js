'use strict';

function createPageRoutes({ appVersion, product }) {
  const router = require('express').Router();
  router.get('/', (req, res) => {
    res.render('st-mvp', {
      title: 'MooreVIEW ST MVP',
      assetV: appVersion,
      product: product || 'st-mvp',
    });
  });
  return router;
}

module.exports = { createPageRoutes };
