'use strict';

const express = require('express');
const { EST_VERSION } = require('../project/estFile');
const { isCloudSimsEnabled } = require('../cloud/cloudSimsEnabled');
const { isCellularSimsEnabled } = require('../cellular/cellularSimsEnabled');

function createPageRoutes({ appVersion, product, deployment }) {
  const router = express.Router();
  const dep = deployment || 'appliance';
  router.get('/', (req, res) => {
    res.render('dashboard', dashboardViewLocals({ appVersion, product, deployment: dep }));
  });
  router.get('/mv-draw', (req, res) => {
    const embedded = String(req.query.embedded || '').trim() === '1'
      || String(req.query.embedded || '').toLowerCase() === 'true';
    res.render('mv-draw', dashboardViewLocals({ appVersion, product, deployment: dep, embedded }));
  });
  router.get('/io-map', (req, res) => {
    res.render('io-map', dashboardViewLocals({ appVersion, product, deployment: dep }));
  });
  return router;
}

function dashboardViewLocals({ appVersion, product, deployment, embedded }) {
  const dep = deployment || 'appliance';
  return {
    title: dep === 'cloud' ? 'MooreVIEW Cloud Studio' : 'MooreVIEW',
    assetV: appVersion,
    appVersion,
    product: product || 'mvp-suite',
    deployment: dep,
    isCloud: dep === 'cloud',
    embedded: !!embedded,
    companyName: 'The Purple Standard',
    estVersion: EST_VERSION,
    cloudSimsEnabled: isCloudSimsEnabled(),
    cellularSimsEnabled: isCellularSimsEnabled(),
  };
}

module.exports = { createPageRoutes, dashboardViewLocals };
